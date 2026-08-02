import {api} from './client';
import {supabase} from './supabase';

export async function configureRealtime(){
  if(!supabase||!localStorage.getItem('lotisec_token'))return;
  try{const {data}=await api.post('/auth/realtime-token',{});if(data.token){localStorage.setItem('lotisec_realtime_token',data.token);await supabase.realtime.setAuth(data.token);}}catch{/* Les écrans conservent leur rafraîchissement HTTP. */}
}
