const { Pool } = require('pg');
require('dotenv').config();

const expected=['organizations','roles','organization_members','user_roles','zem_driver_applications','incidents','incident_events','response_units','interventions','facility_capacities','hospital_admission_requests','audit_logs','operational_notifications','notification_receipts'];
const realtimeTables=['incidents','interventions','facility_capacities','hospital_admission_requests','response_units','operational_notifications'];
const rlsPolicies=['incidents_realtime_select','interventions_realtime_select','capacities_realtime_select','admissions_realtime_select','response_units_realtime_select','operational_notifications_realtime_select'];

async function main(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL manquante');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
  try{
    const result=await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])`,[expected]);
    const found=new Set(result.rows.map((row)=>row.table_name));
    const missing=expected.filter((name)=>!found.has(name));
    if(missing.length)throw new Error(`Tables manquantes: ${missing.join(', ')}`);
    const publications=await pool.query(`SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=ANY($1::text[])`,[realtimeTables]);
    const published=new Set(publications.rows.map((row)=>row.tablename));
    const missingPublications=realtimeTables.filter((name)=>!published.has(name));
    if(missingPublications.length)throw new Error(`Publications Realtime manquantes: ${missingPublications.join(', ')}`);
    const policies=await pool.query(`SELECT policyname FROM pg_policies WHERE schemaname='public' AND policyname=ANY($1::text[])`,[rlsPolicies]);
    const installedPolicies=new Set(policies.rows.map((row)=>row.policyname));
    const missingPolicies=rlsPolicies.filter((name)=>!installedPolicies.has(name));
    if(missingPolicies.length)throw new Error(`Politiques RLS manquantes: ${missingPolicies.join(', ')}`);
    console.log(`Schéma valide: ${found.size}/${expected.length} tables, ${published.size}/${realtimeTables.length} publications Realtime, ${installedPolicies.size}/${rlsPolicies.length} politiques RLS.`);
  }finally{await pool.end();}
}

main().catch((error)=>{console.error(error.message);process.exit(1);});
