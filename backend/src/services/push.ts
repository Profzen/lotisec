import { query } from '../database';

export async function notifyUsers(userIds:string[],title:string,body:string,data:Record<string,unknown>={}){
  if(!userIds.length)return;
  try{
    const tokens=await query<{expo_push_token:string}>('SELECT expo_push_token FROM device_push_tokens WHERE active=true AND user_id=ANY($1::varchar[])',[userIds]);
    if(!tokens.rows.length)return;
    const messages=tokens.rows.map(({expo_push_token})=>({to:expo_push_token,sound:'default',title,body,data}));
    const response=await fetch('https://exp.host/--/api/v2/push/send',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(messages),signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)console.warn('Expo push rejected:',response.status);
  }catch(error:any){console.warn('Expo push unavailable:',error.message);}
}
