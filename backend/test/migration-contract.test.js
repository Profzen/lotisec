const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');

const sql=readFileSync(join(__dirname,'..','migrations','20260731_operational_platform.sql'),'utf8');

test('la migration est additive et contient le schéma opérationnel complet',()=>{
  assert.doesNotMatch(sql,/\bDROP\s+(TABLE|COLUMN)\b/i);
  for(const table of ['organizations','user_roles','zem_driver_applications','incidents','incident_events','response_units','interventions','facility_capacities','hospital_admission_requests','operational_notifications','notification_receipts','audit_logs']) {
    assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`,'i'));
  }
});

test('les flux Realtime sensibles ont RLS et publication',()=>{
  for(const table of ['incidents','interventions','response_units','facility_capacities','hospital_admission_requests','operational_notifications']) {
    assert.match(sql,new RegExp(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table}`,'i'));
    assert.match(sql,new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,'i'));
  }
});
