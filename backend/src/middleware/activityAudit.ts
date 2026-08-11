import {NextFunction,Request,Response} from 'express';
import {v4 as uuidv4} from 'uuid';
import {query} from '../database';
import {AuthRequest} from './auth';

const MUTATIONS=new Set(['POST','PUT','PATCH','DELETE']);
const SENSITIVE_READS=['/profil','/scan','/api/v1/interventions','/api/v1/admissions','/api/v1/audit','/api/v1/admin/users','/api/v1/organizations'];
const SECRET_FIELDS=new Set(['password','pin','access_pin','token','access_token','refresh_token','code','code_hash','authorization','expo_push_token']);
function routeTemplate(path:string){return path.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,':id').replace(/\/\d+(?=\/|$)/g,'/:id');}
function clientType(req:Request){const declared=String(req.headers['x-lotisec-client']||'').slice(0,40);if(declared)return declared;const origin=String(req.headers.origin||'');if(origin.includes('console'))return 'console_web';if(origin)return 'citizen_web';return /Expo|okhttp|ReactNative/i.test(String(req.headers['user-agent']||''))?'mobile':'api';}
function visibleFields(body:unknown){if(!body||typeof body!=='object'||Array.isArray(body))return[];return Object.keys(body as Record<string,unknown>).filter(key=>!SECRET_FIELDS.has(key.toLowerCase())).slice(0,50);}

export function activityAudit(req:AuthRequest,res:Response,next:NextFunction){
  if(!MUTATIONS.has(req.method)&&!(req.method==='GET'&&SENSITIVE_READS.some(prefix=>req.path.startsWith(prefix))))return next();
  const started=Date.now();const requestId=uuidv4();res.setHeader('X-Request-Id',requestId);
  res.on('finish',()=>{const route=routeTemplate(req.originalUrl||req.path);const metadata={body_fields:visibleFields(req.body),query_fields:Object.keys(req.query||{}).slice(0,30),content_length:Number(req.headers['content-length']||0)};void query(`INSERT INTO api_activity_logs(request_id,actor_id,organization_id,method,route,action,status_code,success,client_type,ip_address,user_agent,duration_ms,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[requestId,req.userId||null,req.organizationId||null,req.method,route,`${req.method.toLowerCase()}:${route}`,res.statusCode,res.statusCode<400,clientType(req),req.ip||req.socket.remoteAddress||null,String(req.headers['user-agent']||'').slice(0,500),Date.now()-started,metadata]).catch(error=>console.warn('Audit API non enregistré:',error?.message||error));});
  next();
}
