const jwt=require('jsonwebtoken');
require('dotenv').config();

async function main(){
  for(const key of ['INITIAL_ADMIN_PHONE','INITIAL_ADMIN_PASSWORD','JWT_SECRET','DATABASE_URL']) if(!process.env[key]) throw new Error(`${key} manquante`);
  const app=require('./dist/app').default;
  const server=app.listen(0,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const port=server.address().port;
  const base=`http://127.0.0.1:${port}`;
  const call=async(path,options={})=>{
    const response=await fetch(`${base}${path}`,options);
    const body=await response.json().catch(()=>({}));
    return {status:response.status,body};
  };
  try{
    const health=await call('/health');
    if(health.status!==200||health.body.ok!==true)throw new Error('Healthcheck local échoué');
    const login=await call('/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone:process.env.INITIAL_ADMIN_PHONE,password:process.env.INITIAL_ADMIN_PASSWORD})});
    if(login.status!==200||!login.body.token||!login.body.user?.roles?.includes('admin'))throw new Error(`Connexion admin échouée (${login.status})`);
    const auth={authorization:`Bearer ${login.body.token}`};
    const checks=['/auth/me','/api/v1/organizations','/api/v1/admin/users','/api/v1/facilities','/api/v1/resources','/api/v1/incidents','/api/v1/interventions','/api/v1/admissions','/api/v1/notifications','/api/v1/audit','/accidents/geojson','/accidents/stats','/responders'];
    for(const path of checks){const result=await call(path,{headers:auth});if(result.status!==200)throw new Error(`${path} a répondu ${result.status}`);}
    const realtime=await call('/auth/realtime-token',{method:'POST',headers:auth});
    if(realtime.status!==200||!realtime.body.token)throw new Error(`Jeton Realtime indisponible (${realtime.status})`);
    const citizenToken=jwt.sign({sub:'rbac-smoke-user',roles:['citizen'],permissions:['profile:self','incidents:create','zem:ride'],organizationId:null},process.env.JWT_SECRET,{expiresIn:'2m'});
    const denied=await call('/api/v1/audit',{headers:{authorization:`Bearer ${citizenToken}`}});
    if(denied.status!==403)throw new Error(`RBAC citoyen incorrect (${denied.status})`);
    console.log(JSON.stringify({health:'ok',admin_login:'ok',admin_routes:checks.length,realtime_token:'ok',citizen_audit_denied:403},null,2));
  } finally {
    await new Promise((resolve)=>server.close(resolve));
    const {pool}=require('./dist/database');
    if(pool)await pool.end();
  }
}

main().catch((error)=>{console.error(error.message);process.exit(1);});
