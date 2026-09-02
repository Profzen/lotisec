import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clearFogItems, enqueueFogItem, fogStorageLabel, listFogItems, removeFogItems } from '../lib/fogStore'

const API_URL=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')
const wait=duration=>new Promise(resolve=>setTimeout(resolve,duration))

export function useFogEngine(){
  const [networkMode,setNetworkModeState]=useState('normal')
  const [browserOnline,setBrowserOnline]=useState(()=>typeof navigator==='undefined'?true:navigator.onLine)
  const [queue,setQueue]=useState([])
  const [syncing,setSyncing]=useState(false)
  const [lastSync,setLastSync]=useState(()=>typeof localStorage==='undefined'?null:localStorage.getItem('lotisec-fog-last-sync'))
  const [history,setHistory]=useState([])
  const [stats,setStats]=useState({queued:0,synced:0,failures:0,lastDuration:0})
  const syncingRef=useRef(false)
  const effectiveMode=!browserOnline?'offline':networkMode

  const log=useCallback((title,detail,tone='blue')=>{
    setHistory(current=>[{id:`SYNC-${Date.now()}-${Math.random().toString(16).slice(2)}`,time:new Date().toLocaleTimeString('fr-FR'),title,detail,tone},...current].slice(0,24))
  },[])

  const refreshQueue=useCallback(async()=>{
    const entries=await listFogItems()
    setQueue(entries.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)))
    return entries
  },[])

  useEffect(()=>{refreshQueue()},[refreshQueue])
  useEffect(()=>{
    const online=()=>{setBrowserOnline(true);log('Connexion détectée','Le navigateur signale le retour du réseau.','green')}
    const offline=()=>{setBrowserOnline(false);log('Perte de connexion','Les nouvelles données seront conservées localement.','red')}
    window.addEventListener('online',online);window.addEventListener('offline',offline)
    return ()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offline)}
  },[log])

  const enqueue=useCallback(async(type,payload,source)=>{
    const entry=await enqueueFogItem(type,payload,source)
    setQueue(current=>[...current,entry])
    setStats(current=>({...current,queued:current.queued+1}))
    log('Donnée conservée localement',`${type} placé dans la file Fog persistante.`,'amber')
    return entry
  },[log])

  const syncNow=useCallback(async(force=false)=>{
    if(syncingRef.current) return {ok:false,reason:'busy'}
    const entries=await listFogItems()
    if(!entries.length){log('File déjà synchronisée','Aucune donnée locale en attente.','green');setQueue([]);return {ok:true,count:0,duration:0}}
    if(!force&&(effectiveMode==='offline')){log('Synchronisation différée',`${entries.length} donnée(s) restent protégées dans IndexedDB.`,'red');return {ok:false,reason:'offline'}}
    syncingRef.current=true;setSyncing(true)
    const started=performance.now()
    try{
      let transport='Accusé Cloud du prototype'
      if(API_URL&&!API_URL.includes('localhost')){
        const response=await fetch(`${API_URL}/fog/sync`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nodeId:'FOG-LOME-01',entries})})
        if(!response.ok) throw new Error(`HTTP ${response.status}`)
        transport='API NestJS'
      }else{
        await wait(effectiveMode==='degraded'?1100:380)
      }
      await removeFogItems(entries.map(item=>item.id))
      const duration=Math.max(1,Math.round(performance.now()-started))
      const timestamp=new Date().toISOString()
      localStorage.setItem('lotisec-fog-last-sync',timestamp)
      setLastSync(timestamp);setQueue([])
      setStats(current=>({...current,synced:current.synced+entries.length,lastDuration:duration}))
      log('Synchronisation Fog → Cloud terminée',`${entries.length} donnée(s) acquittée(s) via ${transport} en ${duration} ms.`,'green')
      return {ok:true,count:entries.length,duration,transport}
    }catch(error){
      const duration=Math.max(1,Math.round(performance.now()-started))
      setStats(current=>({...current,failures:current.failures+1,lastDuration:duration}))
      log('Échec de synchronisation',`${entries.length} donnée(s) restent locales · ${error.message}.`,'red')
      return {ok:false,reason:error.message,duration}
    }finally{syncingRef.current=false;setSyncing(false);refreshQueue()}
  },[effectiveMode,log,refreshQueue])

  useEffect(()=>{
    if(effectiveMode==='offline'||!queue.length||syncing) return undefined
    const timer=setTimeout(()=>syncNow(),effectiveMode==='degraded'?1800:750)
    return ()=>clearTimeout(timer)
  },[effectiveMode,queue.length,syncing,syncNow])

  const setNetworkMode=useCallback(mode=>{
    setNetworkModeState(mode)
    const messages={normal:['Connexion normale','Échanges directs et synchronisation automatique.','green'],degraded:['Connexion dégradée','Traitements locaux maintenus, envoi ralenti.','amber'],offline:['Connexion interrompue','File persistante activée, aucune donnée ne sera perdue.','red']}
    const [title,detail,tone]=messages[mode]
    log(title,detail,tone)
  },[log])

  const reset=useCallback(async()=>{
    await clearFogItems();setQueue([]);setNetworkModeState('normal');setStats({queued:0,synced:0,failures:0,lastDuration:0});setHistory([])
  },[])

  const quality=effectiveMode==='normal'?{label:'Stable',latency:stats.lastDuration?`${stats.lastDuration} ms mesurés`:'latence à mesurer',loss:'0 % (scénario)'}:effectiveMode==='degraded'?{label:'Dégradée',latency:'+1,1 s injectée',loss:'12 % (scénario)'}:{label:'Interrompue',latency:'—',loss:'100 % (scénario)'}
  const syncRate=stats.queued?Math.round(stats.synced/stats.queued*100):100

  return useMemo(()=>({networkMode,effectiveMode,browserOnline,setNetworkMode,queue,enqueue,syncNow,syncing,lastSync,history,stats:{...stats,syncRate},quality,storage:fogStorageLabel(),refreshQueue,reset}),[networkMode,effectiveMode,browserOnline,setNetworkMode,queue,enqueue,syncNow,syncing,lastSync,history,stats,quality.label,quality.latency,quality.loss,refreshQueue,reset])
}
