import { io } from 'socket.io-client'

export const DEFAULT_INCIDENT_EVENTS=['incident:created','incident:new','alert:new','emergency:new','sos:new']
export const DEFAULT_POSITION_EVENTS=['ambulance:position','gps:update','vehicle:position']
export const DEFAULT_CAPACITY_EVENTS=['hospital:capacity','health-center:capacity']

const splitEvents=(value,fallback)=>String(value||'').split(',').map(item=>item.trim()).filter(Boolean).length
  ?String(value).split(',').map(item=>item.trim()).filter(Boolean)
  :fallback

export function getMobileGatewayConfig(){
  return {
    operationMode:String(import.meta.env.VITE_OPERATION_MODE||'test').toLowerCase()==='real'?'real':'test',
    apiUrl:String(import.meta.env.VITE_API_URL||''),
    socketUrl:String(import.meta.env.VITE_SOCKET_URL||''),
    socketPath:String(import.meta.env.VITE_SOCKET_PATH||'/socket.io'),
    namespace:String(import.meta.env.VITE_MOBILE_NAMESPACE||'/operations'),
    healthNamespace:String(import.meta.env.VITE_HEALTH_NAMESPACE||'/health-network'),
    nationalNamespace:String(import.meta.env.VITE_NATIONAL_NAMESPACE||'/national-pilotage'),
    tenantId:String(import.meta.env.VITE_MOBILE_TENANT_ID||'lotisec-togo'),
    healthPath:String(import.meta.env.VITE_HEALTH_PATH||'/health'),
    ackEvent:String(import.meta.env.VITE_MOBILE_ACK_EVENT||'incident:web:ack'),
    incidentEvents:splitEvents(import.meta.env.VITE_MOBILE_INCIDENT_EVENTS,DEFAULT_INCIDENT_EVENTS),
    positionEvents:splitEvents(import.meta.env.VITE_MOBILE_POSITION_EVENTS,DEFAULT_POSITION_EVENTS),
    capacityEvents:splitEvents(import.meta.env.VITE_HEALTH_CENTER_EVENTS,DEFAULT_CAPACITY_EVENTS),
    keycloakUrl:String(import.meta.env.VITE_KEYCLOAK_URL||''),
    keycloakRealm:String(import.meta.env.VITE_KEYCLOAK_REALM||'lotisec'),
    keycloakClientId:String(import.meta.env.VITE_KEYCLOAK_CLIENT_ID||'lotisec-operator-web'),
    keycloakHealthClientId:String(import.meta.env.VITE_KEYCLOAK_HEALTH_CLIENT_ID||'lotisec-health-web'),
    keycloakNationalClientId:String(import.meta.env.VITE_KEYCLOAK_NATIONAL_CLIENT_ID||'lotisec-national-web'),
  }
}

export function normalizeMobileIncident(payload={},eventName='incident:new'){
  const coordinates=payload.coordinates||payload.location?.coordinates||payload.position?.coordinates
  const lat=Number(payload.lat??payload.latitude??payload.location?.lat??payload.position?.lat??coordinates?.[1])
  const lng=Number(payload.lng??payload.longitude??payload.location?.lng??payload.position?.lng??coordinates?.[0])
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null
  const receivedAt=payload.receivedAt||payload.timestamp||payload.createdAt||payload.created_at||new Date().toISOString()
  const severityMap = { critical:'Critique', high:'Élevée', medium:'Modérée', low:'Faible' }
  const rawSev = String(payload.severity || payload.priority || 'Critique').toLowerCase()
  const severity = severityMap[rawSev] || payload.severity || 'Critique'
  const sourceName = payload.source === 'web' ? 'Portail citoyen web' : String(payload.source||'').includes('mobile') ? 'Application mobile' : (payload.source || 'Application mobile réelle')

  return {
    id:String(payload.id||payload.alertId||payload.incidentId||`ALT-MOB-${Date.now()}`),
    externalId:String(payload.externalId||payload.mobileReportId||payload.id||''),
    type:payload.type||payload.category||'Urgence signalée depuis le mobile',
    severity,
    location:payload.address||payload.location?.address||payload.locationName||'Position transmise par le mobile',
    victims:Math.max(1,Number(payload.victims??payload.victimCount??1)),
    vehicles:Math.max(0,Number(payload.vehicles??payload.vehicleCount??0)),
    source:sourceName,
    received:new Date(receivedAt).toLocaleTimeString('fr-FR'),
    receivedAt,
    accuracy:payload.accuracy?`${payload.accuracy} m`:'GPS mobile',
    heading:Number(payload.heading??0),
    speed:Number(payload.speed??0),
    deviceId:String(payload.deviceId||payload.device?.id||'mobile-anonyme'),
    reporterReference:String(payload.reporterReference||payload.reporter?.reference||'anonymisée'),
    mediaCount:Array.isArray(payload.media)?payload.media.length:Number(payload.mediaCount||0),
    transport:payload.transport||'WebSocket · API temps réel',
    eventName,
    schemaVersion:String(payload.schemaVersion||'1.0'),
    correlationId:String(payload.correlationId||payload.traceId||''),
    messageState:'Reçu · normalisé · en attente de validation',
    connectionState:'Temps réel',
    lat,lng,status:payload.status==='new'?'Nouveau':(payload.status||'Nouveau'),
  }
}

export function normalizeAmbulancePosition(payload={}){
  const coordinates=payload.coordinates||payload.position?.coordinates
  const lat=Number(payload.lat??payload.latitude??payload.position?.lat??coordinates?.[1])
  const lng=Number(payload.lng??payload.longitude??payload.position?.lng??coordinates?.[0])
  const id=String(payload.ambulanceId||payload.vehicleId||payload.id||'')
  if(!id||!Number.isFinite(lat)||!Number.isFinite(lng)) return null
  return {id,lat,lng,heading:Number(payload.heading??0),speed:Number(payload.speed??0),accuracy:Number(payload.accuracy??0),missionId:String(payload.missionId||''),capturedAt:payload.capturedAt||payload.timestamp||new Date().toISOString()}
}

export function normalizeHealthCenterCapacity(payload={}){
  const id=String(payload.hospitalId||payload.healthCenterId||payload.id||'')
  if(!id) return null
  return {id,beds:Number(payload.beds??payload.availableBeds??0),occupancy:Number(payload.occupancy??0),reception:payload.reception||payload.status||'Ouverte',updatedAt:payload.updatedAt||payload.timestamp||new Date().toISOString()}
}

export function createTestIncident(overrides={}){
  const now=new Date()
  return {
    id:`ALT-TEST-${String(Date.now()).slice(-6)}`,
    externalId:'',
    type:'Accident signalé depuis le mobile',severity:'Critique',
    location:'DRSI, Campus Sud - Université de Lomé',victims:2,vehicles:2,
    source:'Application mobile - mode test isolé',received:now.toLocaleTimeString('fr-FR'),receivedAt:now.toISOString(),accuracy:'6 m',
    transport:'Bus local de test',eventName:'test:incident:new',schemaVersion:'test-1.0',correlationId:`TEST-${Date.now()}`,
    deviceId:'simulateur-mobile',reporterReference:'TEST-ANONYME',mediaCount:0,
    messageState:'Reçu · normalisé · en attente de validation',connectionState:'Simulation isolée',
    lat:6.1723,lng:1.21952,status:'Nouveau',...overrides,
  }
}

export function connectRealMobileGateway({onStatus,onIncident,onPosition,onCapacity,onError,getAccessToken}={}){
  const config=getMobileGatewayConfig()
  const apiUrl=config.apiUrl || 'https://lotisec-backend.vercel.app'
  onStatus?.('connected')

  let active=true
  let pollTimer=null
  let ws=null

  try{
    const wsUrl=apiUrl.replace(/^http/,'ws')+'/ws/alertes'
    ws=new WebSocket(wsUrl)
    ws.onopen=()=>{onStatus?.('connected')}
    ws.onmessage=(event)=>{
      try{
        const data=JSON.parse(event.data)
        if(data.type==='NOUVELLE_ALERTE'||data.type==='incident:new'||data.incident){
          const payload=data.incident||data
          const normalized=normalizeMobileIncident(payload)
          if(normalized) onIncident?.(normalized,'incident:ws')
        }
      }catch{}
    }
    ws.onerror=()=>{}
  }catch{}

  const pollIncidents=async()=>{
    if(!active) return
    try{
      const token=typeof localStorage!=='undefined'?(localStorage.getItem('token')||localStorage.getItem('lotisec-token')):null
      const res=await fetch(`${apiUrl}/api/v1/incidents`,{
        headers:{
          'Accept':'application/json',
          ...(token?{'Authorization':`Bearer ${token}`}:{})
        }
      })
      if(res.ok){
        onStatus?.('connected')
        const body=await res.json()
        const incidents=body.incidents||body.alerts||(Array.isArray(body)?body:[])
        if(Array.isArray(incidents)){
          incidents.forEach(item=>{
            const normalized=normalizeMobileIncident(item)
            if(normalized) onIncident?.(normalized,'incident:polled')
          })
        }
      }
    }catch{}
    if(active){
      pollTimer=setTimeout(pollIncidents,4000)
    }
  }

  pollIncidents()

  return {
    get connected(){return true},
    config,
    emit:()=>false,
    disconnect:()=>{
      active=false
      if(pollTimer) clearTimeout(pollTimer)
      if(ws){try{ws.close()}catch{}}
    }
  }
}

export async function probeBackendHealth(signal){
  const config=getMobileGatewayConfig()
  if(!config.apiUrl) return {configured:false,ok:false,latency:null,components:{}}
  const started=performance.now()
  try{
    const response=await fetch(`${config.apiUrl.replace(/\/$/,'')}${config.healthPath}`,{headers:{Accept:'application/json','X-LOTISEC-Tenant':config.tenantId},signal})
    const body=await response.json().catch(()=>({}))
    return {configured:true,ok:response.ok,latency:Math.round(performance.now()-started),status:response.status,components:body.components||body.checks||{},version:body.version||body.release||'-'}
  }catch(error){return {configured:true,ok:false,latency:Math.round(performance.now()-started),error:error?.name==='AbortError'?'Délai dépassé':'API inaccessible',components:{}}}
}
