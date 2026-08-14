const {Pool}=require('pg');
const bcrypt=require('bcryptjs');
const {randomUUID}=require('crypto');
require('dotenv').config();

const fireOrg={name:'Caserne LOTISEC Recette',type:'fire_station',code:'LOTISEC-FIRE-RECETTE'};
const ambulanceOrg={name:'Ambulances LOTISEC Recette',type:'ambulance_service',code:'LOTISEC-AMB-RECETTE'};
const hqOrg={name:'Administration LOTISEC',type:'lotisec',code:'LOTISEC-HQ'};
const hospitalOrg={name:'CHU Sylvanus Olympio',type:'hospital',code:'CHU-SO'};
const accounts=[
  {key:'citizen-1',phone:'+22800001001',legacyPhone:'00001001',role:'citizen',first:'Afi',last:'Citoyenne'},
  {key:'citizen-2',phone:'+22800002001',legacyPhone:'00002001',role:'citizen',first:'Komi',last:'Citoyen'},
  {key:'zem-1',phone:'+22800001002',legacyPhone:'00001002',role:'zem_driver',first:'Kossi',last:'Zem'},
  {key:'zem-2',phone:'+22800002002',legacyPhone:'00002002',role:'zem_driver',first:'Kodjo',last:'Zem'},
  {key:'firefighter-1',phone:'+22800001003',legacyPhone:'00001003',role:'firefighter',first:'Yao',last:'Pompier',org:fireOrg},
  {key:'firefighter-2',phone:'+22800002003',legacyPhone:'00002003',role:'firefighter',first:'Essi',last:'Pompier',org:fireOrg},
  {key:'ambulance-1',phone:'+22800001004',legacyPhone:'00001004',role:'ambulance_driver',first:'Ama',last:'Ambulancière',org:ambulanceOrg},
  {key:'ambulance-2',phone:'+22800002004',legacyPhone:'00002004',role:'ambulance_driver',first:'Koffi',last:'Ambulancier',org:ambulanceOrg},
  {key:'admin-1',phone:'+22800001005',legacyPhone:'00001005',role:'admin',first:'Admin',last:'Recette Un',org:hqOrg},
  {key:'admin-2',phone:'+22800002005',legacyPhone:'00002005',role:'admin',first:'Admin',last:'Recette Deux',org:hqOrg},
  {key:'hospital-manager-1',phone:'+22800001006',legacyPhone:'00001006',role:'hospital_manager',first:'Kossi',last:'Gestionnaire',org:hospitalOrg},
  {key:'hospital-manager-2',phone:'+22800002006',legacyPhone:'00002006',role:'hospital_manager',first:'Akou',last:'Gestionnaire',org:hospitalOrg},
  {key:'supervisor-1',phone:'+22800001007',legacyPhone:'00001007',role:'supervisor',first:'Mawuli',last:'Superviseur',org:hqOrg},
  {key:'supervisor-2',phone:'+22800002007',legacyPhone:'00002007',role:'supervisor',first:'Dédé',last:'Superviseure',org:hqOrg},
  {key:'dispatcher-1',phone:'+22800001008',legacyPhone:'00001008',role:'dispatcher',first:'Kossi',last:'Répartiteur',org:hqOrg},
  {key:'dispatcher-2',phone:'+22800002008',legacyPhone:'00002008',role:'dispatcher',first:'Afi',last:'Répartitrice',org:hqOrg},
  {key:'hospital-agent-1',phone:'+22800001009',legacyPhone:'00001009',role:'hospital_agent',first:'Sena',last:'Agent CHU',org:hospitalOrg},
  {key:'hospital-agent-2',phone:'+22800002009',legacyPhone:'00002009',role:'hospital_agent',first:'Elom',last:'Agent CHU',org:hospitalOrg}
];

const ACCEPTANCE_PASSWORD='Ls!Pass2026!';

async function main(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL manquante');
  if(process.env.ALLOW_ACCEPTANCE_ACCOUNT_RESET!=='true')throw new Error('Définissez temporairement ALLOW_ACCEPTANCE_ACCOUNT_RESET=true pour régénérer les comptes de recette.');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
  const credentials=[];
  try{
    await pool.query('BEGIN');
    for(const account of accounts){
      const clearPassword=ACCEPTANCE_PASSWORD;
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
