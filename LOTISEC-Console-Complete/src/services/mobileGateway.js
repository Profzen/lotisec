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
  const receivedAt=payload.receivedAt||payload.timestamp||payload.createdAt||new Date().toISOString()
  return {
    id:String(payload.id||payload.alertId||payload.incidentId||`ALT-MOB-${Date.now()}`),
    externalId:String(payload.externalId||payload.mobileReportId||payload.id||''),
    type:payload.type||payload.category||'Urgence signalée depuis le mobile',
    severity:payload.severity||payload.priority||'Critique',
    location:payload.address||payload.location?.address||payload.locationName||'Position transmise par le mobile',
    victims:Math.max(1,Number(payload.victims??payload.victimCount??1)),
    vehicles:Math.max(1,Number(payload.vehicles??payload.vehicleCount??1)),
    source:'Application mobile réelle',
    received:new Date(receivedAt).toLocaleTimeString('fr-FR'),
    receivedAt,
    accuracy:payload.accuracy?`${payload.accuracy} m`:'GPS mobile',
    heading:Number(payload.heading??0),
    speed:Number(payload.speed??0),
    deviceId:String(payload.deviceId||payload.device?.id||'mobile-anonyme'),
    reporterReference:String(payload.reporterReference||payload.reporter?.reference||'anonymisée'),
    mediaCount:Array.isArray(payload.media)?payload.media.length:Number(payload.mediaCount||0),
    transport:payload.transport||'Socket.IO · WebSocket',
    eventName,
    schemaVersion:String(payload.schemaVersion||'1.0'),
    correlationId:String(payload.correlationId||payload.traceId||''),
    messageState:'Reçu · normalisé · en attente de validation',
    connectionState:'Temps réel',
    lat,lng,status:'Nouveau',
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
    location:'Carrefour GTA, Lomé',victims:2,vehicles:2,
    source:'Application mobile — mode test isolé',received:now.toLocaleTimeString('fr-FR'),receivedAt:now.toISOString(),accuracy:'6 m',
    transport:'Bus local de test',eventName:'test:incident:new',schemaVersion:'test-1.0',correlationId:`TEST-${Date.now()}`,
    deviceId:'simulateur-mobile',reporterReference:'TEST-ANONYME',mediaCount:0,
    messageState:'Reçu · normalisé · en attente de validation',connectionState:'Simulation isolée',
    lat:6.1639,lng:1.2058,status:'Nouveau',...overrides,
  }
}

export function connectRealMobileGateway({onStatus,onIncident,onPosition,onCapacity,onError,getAccessToken}={}){
  const config=getMobileGatewayConfig()
  if(!config.socketUrl||config.socketUrl.includes('localhost')){
    onStatus?.('not-configured')
    return {connected:false,config,emit:()=>false,disconnect:()=>{}}
  }
  onStatus?.('connecting')
  const base=config.socketUrl.replace(/\/$/,'')
  const namespace=config.namespace.startsWith('/')?config.namespace:`/${config.namespace}`
  const socket=io(`${base}${namespace}`,{
    path:config.socketPath,
    transports:['websocket','polling'],
    reconnection:true,
    reconnectionDelay:1200,
    timeout:8000,
    auth:callback=>Promise.resolve(getAccessToken?.()).then(token=>callback({token:token||undefined,tenantId:config.tenantId,clientId:config.keycloakClientId})),
  })
  const handlers=[]
  const bind=(events,normalizer,callback)=>events.forEach(eventName=>{
    const handler=payload=>{
      const normalized=normalizer(payload,eventName)
      if(normalized) callback?.(normalized,eventName,payload)
    }
    socket.on(eventName,handler);handlers.push([eventName,handler])
  })
  socket.on('connect',()=>{
    onStatus?.('connected')
    socket.emit('web:operator:ready',{client:'lotisec-operator-web',tenantId:config.tenantId,schemaVersion:'1.0',capabilities:['incident-reception','mission-dispatch','gps-tracking','hospital-capacity','fog-continuity']})
  })
  socket.on('disconnect',()=>onStatus?.('offline'))
  socket.on('connect_error',error=>{onStatus?.('offline');onError?.(error)})
  bind(config.incidentEvents,normalizeMobileIncident,(incident,eventName)=>{
    onIncident?.(incident,eventName)
    socket.emit(config.ackEvent,{incidentId:incident.id,externalId:incident.externalId,status:'received',receivedAt:new Date().toISOString(),client:'lotisec-operator-web',correlationId:incident.correlationId})
  })
  bind(config.positionEvents,normalizeAmbulancePosition,onPosition)
  bind(config.capacityEvents,normalizeHealthCenterCapacity,onCapacity)
  return {
    get connected(){return socket.connected},
    config,
    emit(event,payload={}){if(!socket.connected)return false;socket.emit(event,{...payload,emittedAt:new Date().toISOString(),source:'lotisec-web',tenantId:config.tenantId});return true},
    disconnect(){handlers.forEach(([event,handler])=>socket.off(event,handler));socket.disconnect()},
  }
}

export async function probeBackendHealth(signal){
  const config=getMobileGatewayConfig()
  if(!config.apiUrl) return {configured:false,ok:false,latency:null,components:{}}
  const started=performance.now()
  try{
    const response=await fetch(`${config.apiUrl.replace(/\/$/,'')}${config.healthPath}`,{headers:{Accept:'application/json','X-LOTISEC-Tenant':config.tenantId},signal})
    const body=await response.json().catch(()=>({}))
    return {configured:true,ok:response.ok,latency:Math.round(performance.now()-started),status:response.status,components:body.components||body.checks||{},version:body.version||body.release||'—'}
  }catch(error){return {configured:true,ok:false,latency:Math.round(performance.now()-started),error:error?.name==='AbortError'?'Délai dépassé':'API inaccessible',components:{}}}
}
