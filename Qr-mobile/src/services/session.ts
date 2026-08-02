import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/config';
import { supabase } from '../api/supabase';

export type LotisecSession={token:string;realtimeToken?:string|null;user:any};
const KEYS={token:'token',user:'user',profile:'profile',qr:'qrToken',realtime:'realtimeToken'} as const;

export async function persistSession(data:any):Promise<LotisecSession>{
  const token=data.token||data.access_token;if(!token)throw new Error('Jeton de session absent');
  const user=data.user||{},realtimeToken=data.realtime_token||null;
  const pairs:[string,string][]=[[KEYS.token,token],[KEYS.user,JSON.stringify(user)],['lotisec_user',JSON.stringify(user)],[KEYS.profile,JSON.stringify(user)]];
  if(realtimeToken)pairs.push([KEYS.realtime,realtimeToken]);if(user.qr_token)pairs.push([KEYS.qr,user.qr_token]);
  await AsyncStorage.multiSet(pairs);if(realtimeToken&&supabase)await supabase.realtime.setAuth(realtimeToken);
  return {token,realtimeToken,user};
}

export async function hydrateSession():Promise<LotisecSession|null>{
  const values=await AsyncStorage.multiGet([KEYS.token,KEYS.user,KEYS.realtime,'lotisec_user']);const map=Object.fromEntries(values);
  const storedToken=map[KEYS.token];if(!storedToken)return null;const token:string=storedToken;const storedUser=map[KEYS.user]||map.lotisec_user;let user=storedUser?JSON.parse(storedUser):{};
  try{const me=await api('/auth/me','GET',undefined,token);user={...user,...me.user};await AsyncStorage.multiSet([[KEYS.user,JSON.stringify(user)],['lotisec_user',JSON.stringify(user)],[KEYS.profile,JSON.stringify(user)]]);if(user.qr_token)await AsyncStorage.setItem(KEYS.qr,user.qr_token);}catch(error){if(!user.id)throw error;}
  let realtimeToken=map[KEYS.realtime]||null;
  try{const result=await api('/auth/realtime-token','POST',{},token);realtimeToken=result.token;if(realtimeToken){await AsyncStorage.setItem(KEYS.realtime,realtimeToken);if(supabase)await supabase.realtime.setAuth(realtimeToken);}}catch{/* Polling remains available. */}
  return {token,realtimeToken,user};
}

export async function clearSession(){await AsyncStorage.multiRemove([...Object.values(KEYS),'lotisec_user','userProfile']);}
