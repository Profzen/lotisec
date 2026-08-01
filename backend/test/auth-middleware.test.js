const test=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const {requireAuth,requirePermission}=require('../dist/middleware/auth');
const {permissionsFor}=require('../dist/security/rbac');

process.env.JWT_SECRET='local-test-secret-that-is-at-least-32-characters';

function response(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test('un JWT valide hydrate rôle, permissions et organisation',()=>{
  const token=jwt.sign({sub:'user-1',roles:['dispatcher'],permissions:permissionsFor(['dispatcher']),organizationId:'org-a'},process.env.JWT_SECRET,{expiresIn:'5m'});
  const req={headers:{authorization:`Bearer ${token}`}}; const res=response(); let next=false;
  requireAuth(req,res,()=>{next=true;});
  assert.equal(next,true); assert.equal(req.userId,'user-1'); assert.equal(req.organizationId,'org-a');
  assert.deepEqual(req.roles,['dispatcher']);
});

test('un JWT expiré est refusé',()=>{
  const token=jwt.sign({sub:'user-1'},process.env.JWT_SECRET,{expiresIn:-1});
  const req={headers:{authorization:`Bearer ${token}`}}; const res=response();
  requireAuth(req,res,()=>assert.fail('next ne doit pas être appelé'));
  assert.equal(res.statusCode,401);
});

test('la permission backend refuse un rôle hors périmètre',()=>{
  const req={permissions:permissionsFor(['hospital_agent'])}; const res=response();
  requirePermission('incidents:manage')(req,res,()=>assert.fail('permission indue'));
  assert.equal(res.statusCode,403);
  let allowed=false; requirePermission('admissions:organization')(req,response(),()=>{allowed=true;}); assert.equal(allowed,true);
});
