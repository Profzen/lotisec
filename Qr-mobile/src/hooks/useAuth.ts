import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser } from '../api/auth';
import { clearSession, hydrateSession, persistSession } from '../services/session';

export const useAuth=()=>{
  const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);
  const run=async(operation:()=>Promise<any>)=>{try{setLoading(true);setError(null);const data=await operation();await persistSession(data);return data;}catch(err:any){setError(err.message||'Authentification impossible');throw err;}finally{setLoading(false);}};
  const register=(phone:string,password:string,accountType:'citizen'|'zem_driver'='citizen',zemApplication?:any)=>run(()=>registerUser(phone,password,accountType,zemApplication));
  const login=(phone:string,password:string,_email?:string)=>run(()=>loginUser(phone,password));
  const logout=()=>clearSession();
  const getToken=()=>AsyncStorage.getItem('token');
  const getUser=async()=>(await hydrateSession())?.user||null;
  return {register,login,logout,getToken,getUser,loading,error};
};
