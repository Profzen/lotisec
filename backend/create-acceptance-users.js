const {Pool}=require('pg');
const bcrypt=require('bcryptjs');
const {randomUUID,randomBytes}=require('crypto');
require('dotenv').config();

const accounts=[
  {key:'citizen',phone:'+22800001001',legacyPhone:'00001001',role:'citizen',first:'Afi',last:'Citoyenne'},
  {key:'zem',phone:'+22800001002',legacyPhone:'00001002',role:'zem_driver',first:'Kossi',last:'Zem'},
  {key:'firefighter',phone:'+22800001003',legacyPhone:'00001003',role:'firefighter',first:'Yao',last:'Pompier',org:{name:'Caserne LOTISEC Recette',type:'fire_station',code:'LOTISEC-FIRE-RECETTE'}},
  {key:'ambulance',phone:'+22800001004',legacyPhone:'00001004',role:'ambulance_driver',first:'Ama',last:'Ambulancière',org:{name:'Ambulances LOTISEC Recette',type:'ambulance_service',code:'LOTISEC-AMB-RECETTE'}},
  {key:'admin',phone:'+22800001005',legacyPhone:'00001005',role:'admin',first:'Admin',last:'Recette',org:{name:'Administration LOTISEC',type:'lotisec',code:'LOTISEC-HQ'}}
];

function password(){return `Ls!${randomBytes(9).toString('base64url')}9`;}

async function main(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL manquante');
  if(process.env.ALLOW_ACCEPTANCE_ACCOUNT_RESET!=='true')throw new Error('Définissez temporairement ALLOW_ACCEPTANCE_ACCOUNT_RESET=true pour régénérer les comptes de recette.');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
  const credentials=[];
  try{
    await pool.query('BEGIN');
    for(const account of accounts){
      const clearPassword=password();
      let user=(await pool.query('SELECT id FROM users WHERE phone=$1 OR phone=$2',[account.phone,account.legacyPhone])).rows[0];
      const userId=user?.id||randomUUID();
      if(user)await pool.query('UPDATE users SET phone=$1,password=$2 WHERE id=$3',[account.phone,await bcrypt.hash(clearPassword,12),userId]);
      else await pool.query('INSERT INTO users(id,phone,password) VALUES($1,$2,$3)',[userId,account.phone,await bcrypt.hash(clearPassword,12)]);
      const existingProfile=await pool.query('SELECT 1 FROM profiles WHERE user_id=$1',[userId]);
      if(existingProfile.rows[0])await pool.query('UPDATE profiles SET first_name=$1,last_name=$2 WHERE user_id=$3',[account.first,account.last,userId]);
      else await pool.query(`INSERT INTO profiles(id,user_id,qr_token,profile_type,first_name,last_name,birth_date,gender,nationality,blood_type,access_code,has_vehicle,is_zem)
        VALUES($1,$2,$3,$4,$5,$6,'01/01/1995','NC','Togo','O+',$7,false,$8)`,[randomUUID(),userId,randomUUID().slice(0,8).toUpperCase(),account.role==='citizen'||account.role==='zem_driver'?'STANDARD':'PROFESSIONAL',account.first,account.last,randomUUID().slice(0,8),account.role==='zem_driver']);
      let organizationId=null;
      if(account.org){
        const org=await pool.query(`INSERT INTO organizations(name,type,code) VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,active=true RETURNING id`,[account.org.name,account.org.type,account.org.code]);
        organizationId=org.rows[0].id;
        await pool.query(`INSERT INTO organization_members(organization_id,user_id,status) VALUES($1,$2,'active') ON CONFLICT(organization_id,user_id) DO UPDATE SET status='active'`,[organizationId,userId]);
      }
      await pool.query('DELETE FROM user_roles WHERE user_id=$1',[userId]);
      await pool.query(`INSERT INTO user_roles(user_id,role_key,organization_id,granted_by) VALUES($1,$2,$3,$4)`,[userId,account.role,organizationId,userId]);
      if(organizationId&&['firefighter','ambulance_driver'].includes(account.role)){
        const callSign=account.role==='firefighter'?'FIRE-RECETTE-01':'AMB-RECETTE-01';
        const unitType=account.role==='firefighter'?'fire_engine':'ambulance';
        await pool.query(`INSERT INTO response_units(organization_id,name,call_sign,type,status,equipment)
          SELECT $1,$2,$3,$4,'available',$5 WHERE NOT EXISTS(SELECT 1 FROM response_units WHERE organization_id=$1 AND call_sign=$3)`,[organizationId,account.role==='firefighter'?'Engin pompier recette':'Ambulance recette',callSign,unitType,{acceptance:true}]);
      }
      if(account.role==='zem_driver'){
        await pool.query(`INSERT INTO user_roles(user_id,role_key,organization_id,granted_by) VALUES($1,'citizen',NULL,$1)`,[userId]);
        await pool.query(`UPDATE zem_driver_applications SET status='rejected',updated_at=NOW() WHERE user_id=$1 AND status='pending'`,[userId]);
        await pool.query(`INSERT INTO zem_driver_applications(user_id,status,identity_document,license_number,motorcycle_make,motorcycle_model,plate,work_zone,review_note,reviewed_by,reviewed_at)
          VALUES($1,'approved','RECETTE-ID','RECETTE-PERMIS','TVS','HLX','TG-RECETTE','Lomé','Compte de recette validé',$1,NOW())
          ON CONFLICT DO NOTHING`,[userId]);
      }
      credentials.push({type:account.key,phone:account.phone,password:clearPassword,role:account.role,organization:account.org?.name||null});
    }
    await pool.query('COMMIT');
    console.log(JSON.stringify(credentials,null,2));
  }catch(error){await pool.query('ROLLBACK');throw error;}finally{await pool.end();}
}

main().catch((error)=>{console.error(error.message);process.exit(1);});
