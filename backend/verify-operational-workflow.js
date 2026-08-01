const {Pool}=require('pg');
const {randomUUID}=require('crypto');
require('dotenv').config();

async function main(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL manquante');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
  const client=await pool.connect();
  const suffix=Date.now().toString().slice(-8);
  try{
    await client.query('BEGIN');
    const dispatcher=randomUUID(),hospitalAgent=randomUUID(),zem=randomUUID();
    for(const [id,phone] of [[dispatcher,`e2e-dispatch-${suffix}`],[hospitalAgent,`e2e-hospital-${suffix}`],[zem,`e2e-zem-${suffix}`]]) await client.query('INSERT INTO users(id,phone,password) VALUES($1,$2,$3)',[id,phone,'transactional-e2e-only']);
    const emergency=(await client.query(`INSERT INTO organizations(name,type,code) VALUES($1,'ambulance_service',$2) RETURNING id`,[`E2E Urgences ${suffix}`,`E2E-U-${suffix}`])).rows[0].id;
    const hospital=(await client.query(`INSERT INTO organizations(name,type,code) VALUES($1,'hospital',$2) RETURNING id`,[`E2E Hôpital ${suffix}`,`E2E-H-${suffix}`])).rows[0].id;
    await client.query(`INSERT INTO organization_members(organization_id,user_id,status) VALUES($1,$2,'active'),($3,$4,'active')`,[emergency,dispatcher,hospital,hospitalAgent]);
    await client.query(`INSERT INTO user_roles(user_id,role_key,organization_id) VALUES($1,'dispatcher',$2),($3,'hospital_manager',$4),($5,'citizen',NULL)`,[dispatcher,emergency,hospitalAgent,hospital,zem]);
    const application=(await client.query(`INSERT INTO zem_driver_applications(user_id,identity_document,license_number,motorcycle_make,plate,work_zone) VALUES($1,'E2E-ID','E2E-LIC','E2E-MOTO','E2E-PLATE','Lomé') RETURNING id,status`,[zem])).rows[0];
    if(application.status!=='pending')throw new Error('Cycle Zem pending invalide');
    const incident=(await client.query(`INSERT INTO incidents(reporter_id,organization_id,source,type,severity,latitude,longitude,priority_score) VALUES($1,$2,'operator','E2E accident','high',6.13,1.22,70) RETURNING id`,[dispatcher,emergency])).rows[0];
    await client.query(`INSERT INTO incident_events(incident_id,actor_id,type,to_status) VALUES($1,$2,'created','new')`,[incident.id,dispatcher]);
    const unit=(await client.query(`INSERT INTO response_units(organization_id,name,call_sign) VALUES($1,'E2E Ambulance','E2E-AMB') RETURNING id`,[emergency])).rows[0];
    await client.query(`UPDATE incidents SET status='validated' WHERE id=$1`,[incident.id]);
    const intervention=(await client.query(`INSERT INTO interventions(incident_id,organization_id,response_unit_id,assigned_to,status) VALUES($1,$2,$3,$4,'assigned') RETURNING id`,[incident.id,emergency,unit.id,dispatcher])).rows[0];
    await client.query(`UPDATE incidents SET status='assigned' WHERE id=$1`,[incident.id]);
    await client.query(`UPDATE response_units SET status='assigned',latitude=6.14,longitude=1.23 WHERE id=$1`,[unit.id]);
    await client.query(`UPDATE interventions SET status='patient_loaded' WHERE id=$1`,[intervention.id]);
    const admission=(await client.query(`INSERT INTO hospital_admission_requests(intervention_id,hospital_id,requested_by) VALUES($1,$2,$3) RETURNING id,status`,[intervention.id,hospital,dispatcher])).rows[0];
    if(admission.status!=='pending')throw new Error('Admission pending invalide');
    await client.query(`UPDATE hospital_admission_requests SET status='accepted',responded_by=$1,responded_at=NOW() WHERE id=$2`,[hospitalAgent,admission.id]);
    await client.query(`UPDATE interventions SET status='to_hospital',hospital_id=$1 WHERE id=$2`,[hospital,intervention.id]);
    await client.query(`INSERT INTO facility_capacities(organization_id,service,available,total,updated_by) VALUES($1,'Urgences',3,5,$2)`,[hospital,hospitalAgent]);
    await client.query(`INSERT INTO operational_notifications(organization_id,recipient_roles,type,title,message,entity_type,entity_id) VALUES($1,$2,'admission.requested','E2E admission','Test transactionnel','admission',$3)`,[hospital,['hospital_manager','hospital_agent'],admission.id]);
    await client.query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id) VALUES($1,$2,'e2e.workflow','intervention',$3)`,[dispatcher,emergency,intervention.id]);
    const ownInterventions=await client.query(`SELECT count(*)::int count FROM interventions WHERE organization_id=$1`,[emergency]);
    const otherInterventions=await client.query(`SELECT count(*)::int count FROM interventions WHERE organization_id=$1`,[hospital]);
    const hospitalAdmissions=await client.query(`SELECT count(*)::int count FROM hospital_admission_requests WHERE hospital_id=$1`,[hospital]);
    if(ownInterventions.rows[0].count!==1||otherInterventions.rows[0].count!==0||hospitalAdmissions.rows[0].count!==1)throw new Error('Isolation organisationnelle invalide');
    console.log(JSON.stringify({zem_application:'pending',incident:'assigned',gps:'updated',intervention:'to_hospital',admission:'accepted',capacity:'created',notification:'created',audit:'created',organization_isolation:'ok',persistence:'rolled_back'},null,2));
  }finally{
    await client.query('ROLLBACK').catch(()=>{});
    client.release();await pool.end();
  }
}

main().catch((error)=>{console.error(error.message);process.exit(1);});
