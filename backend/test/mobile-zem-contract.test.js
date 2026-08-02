const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('la migration Zem complète contient offres, événements, chat, positions, scans et RLS',()=>{
  const sql=fs.readFileSync(path.join(root,'migrations','20260802_mobile_zem_complete.sql'),'utf8');
  for(const table of ['ride_offers','ride_events','ride_messages','ride_positions','device_push_tokens','scan_access_events'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`,'i'));
  for(const table of ['rides','zem_locations','ride_offers','ride_events','ride_messages','ride_positions'])assert.match(sql,new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,'i'));
  assert.match(sql,/app_user_id/i);
});

test('les routes Zem exposent offres, actions, chat, positions et push',()=>{
  const source=fs.readFileSync(path.join(root,'src','routers','zem.ts'),'utf8');
  for(const route of ['/offers/current','/offers/:offerId/respond','/rides/:rideId/action','/rides/:rideId/messages','/rides/:rideId/positions/latest','/push-token'])assert.ok(source.includes(route),route);
  assert.match(source,/FOR UPDATE OF ro,r/);
  assert.match(source,/version=version\+1/);
});
