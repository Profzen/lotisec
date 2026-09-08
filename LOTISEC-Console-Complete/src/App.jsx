import { useEffect, useMemo, useRef, useState } from 'react'
import Login from './components/Login'
import Layout from './components/Layout'
import DecisionReviewDialog from './components/DecisionReviewDialog'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Interventions from './pages/Interventions'
import OperationalMap from './pages/OperationalMap'
import Ambulances from './pages/Ambulances'
import Hospitals from './pages/Hospitals'
import Routing from './pages/Routing'
import Orientation from './pages/Orientation'
import Statistics from './pages/Statistics'
import Fog from './pages/Fog'
import Settings from './pages/Settings'
import Audit from './pages/Audit'
import Evaluation from './pages/Evaluation'
import MissionReports from './pages/MissionReports'
import SystemHealth from './pages/SystemHealth'
import Security from './pages/Security'
import HealthPortal from './pages/HealthPortal'
import NationalPilotage from './pages/NationalPilotage'
import { alerts as initialAlerts, ambulances as initialAmbulances, hospitals as initialHospitals } from './data/demo'
import { getRoadRoute, localRoutePlan } from './services/routing'
import { rankAmbulances, rankHospitals } from './services/decision'
import { connectRealMobileGateway, createTestIncident, getMobileGatewayConfig, probeBackendHealth } from './services/mobileGateway'
import { getAccessToken } from './services/auth'
import { useFogEngine } from './hooks/useFogEngine'
import { announceAmbulanceAssignment, announceCongestion, announceMissionStage, announceNewIncident, announcePreDepartureDecision, getSoundsEnabled, playTargetLock, setSoundsEnabled as persistSounds, speakOperational, stopOperationalAudio, unlockSound } from './lib/sound'

const MISSION_STAGES=['Analyse trafic','Affectée','En route','Sur place','Orientation hospitalière','Vers le centre de santé','Pris en charge','Terminée']
const DEMO_STEPS=[
  {label:'Signalement',detail:'Réception mobile, alerte sonore et localisation'},
  {label:'Validation',detail:'Contrôle humain et validation traçable du signalement'},
  {label:'Affectation & trafic',detail:'Ambulance recommandée, congestion détectée avant départ'},
  {label:'Départ guidé',detail:'Déplacement vers l’incident pendant 10 secondes en mode test'},
  {label:'Arrivée sur les lieux',detail:'Intervention sur place pendant 10 secondes avant l’orientation'},
  {label:'Décision hôpital',detail:'Recommandation et validation humaine de l’hôpital'},
  {label:'Transfert hospitalier',detail:'Déplacement vers l’hôpital pendant 5 secondes en mode test'},
  {label:'Bilan',detail:'Mission clôturée et comparaison prévision/réalité'},
]
const DEMO_INCIDENT_TRAVEL_MS=10000
const DEMO_ON_SCENE_MS=10000
const DEMO_HOSPITAL_TRAVEL_MS=5000
const INITIAL_AUDIT=[
  {id:'AUD-3',time:'18:42:20',actor:'Système GPS',category:'mission',tone:'green',action:'Position ambulance synchronisée',details:'AMB-07 a transmis une nouvelle position terrain.',reference:'AMB-07'},
  {id:'AUD-2',time:'18:41:08',actor:'Centre de santé',category:'system',tone:'green',action:'Capacité mise à jour',details:'Le CHU Tokoin déclare 5 places disponibles.',reference:'HSP-01'},
  {id:'AUD-1',time:'18:40:12',actor:'Application mobile',category:'mobile',tone:'red',action:'Urgence reçue',details:'Accident de la route localisé à la Douane Adidogomé.',reference:'ALT-2026-081'},
]

const mobileConfig=getMobileGatewayConfig()
const DEFAULT_OPERATOR={id:'USR-OP-001',name:'Opérateur LOTISEC',role:'Opérateur',authenticated:true,sessionStartedAt:new Date().toISOString()}
const ROLE_ACTIONS={Administrateur:['operate','configure','export'],Opérateur:['operate','export'],Observateur:['view']}
const PORTAL_DEFAULTS={operations:'dashboard',health:'health-dashboard',national:'national-dashboard'}
const PORTAL_PAGE_PREFIX={operations:null,health:'health-',national:'national-'}

function initialPortalLocation(){
  if(typeof window==='undefined') return {portal:'operations',page:'dashboard'}
  const params=new URLSearchParams(window.location.search)
  const requested=params.get('espace')
  const portal=Object.hasOwn(PORTAL_DEFAULTS,requested)?requested:'operations'
  const page=params.get('page')||PORTAL_DEFAULTS[portal]
  const prefix=PORTAL_PAGE_PREFIX[portal]
  const valid=portal==='operations'?!page.startsWith('health-')&&!page.startsWith('national-'):page.startsWith(prefix)
  return {portal,page:valid?page:PORTAL_DEFAULTS[portal]}
}

export default function App(){
  const initialLocation=useMemo(()=>initialPortalLocation(),[])
  const [portal,setPortal]=useState(initialLocation.portal)
  const [activePage,setActivePage]=useState(initialLocation.page)
  const [mission,setMission]=useState(null)
  const [alerts,setAlerts]=useState(mobileConfig.operationMode==='real'?[]:initialAlerts)
  const [ambulanceFleet,setAmbulanceFleet]=useState(initialAmbulances)
  const [healthCenters,setHealthCenters]=useState(initialHospitals)
  const [auditLog,setAuditLog]=useState(mobileConfig.operationMode==='real'?[]:INITIAL_AUDIT)
  const [selectedAlertId,setSelectedAlertId]=useState(mobileConfig.operationMode==='real'?'':initialAlerts[0].id)
  const [notice,setNotice]=useState(null)
  const [mobileFeedStatus,setMobileFeedStatus]=useState('demo')
  const [dataMode,setDataMode]=useState(mobileConfig.operationMode)
  const [realEventQueue,setRealEventQueue]=useState([])
  const [soundsEnabled,setSoundsEnabled]=useState(getSoundsEnabled())
  const [metrics,setMetrics]=useState([])
  const [missionHistory,setMissionHistory]=useState([])
  const [decisionReview,setDecisionReview]=useState(null)
  const [operator,setOperator]=useState(DEFAULT_OPERATOR)
  const [isAuthenticated,setIsAuthenticated]=useState(()=>{
    if(typeof window==='undefined') return true
    return localStorage.getItem('lotisec-auth')!=='false'
  })
  const [securityConfig,setSecurityConfig]=useState({requireHumanValidation:true,anonymizeVictims:true,auditEnabled:true,isolateTestData:true})
  const [systemHealth,setSystemHealth]=useState({checking:false,lastCheckedAt:null,backendLatency:null,backendVersion:null,services:[]})
  const [demoMode,setDemoMode]=useState(false)
  const [demoStep,setDemoStep]=useState(0)
  const [demoBusy,setDemoBusy]=useState(false)
  const [demoDecisionPending,setDemoDecisionPending]=useState(null)
  const demoBusyRef=useRef(false)
  const gatewayRef=useRef(null)
  const portalRef=useRef(initialLocation.portal)
  const dataModeRef=useRef(mobileConfig.operationMode)
  const dataSnapshotsRef=useRef({test:null,real:null})
  const seenIncidentIds=useRef(new Set((mobileConfig.operationMode==='real'?[]:initialAlerts).map(item=>item.id)))
  const missionStatusKeyRef=useRef('')
  const fog=useFogEngine()
  const activeAlert=alerts.find(item=>item.id===selectedAlertId)||alerts[0]
  const ambulanceRanking=useMemo(()=>rankAmbulances(activeAlert,ambulanceFleet),[activeAlert,ambulanceFleet])
  const hospitalRanking=useMemo(()=>rankHospitals(activeAlert,healthCenters),[activeAlert,healthCenters])
  const canOperate=ROLE_ACTIONS[operator.role]?.includes('operate')

  const notify=(message,tone='blue')=>{
    setNotice({message,tone,id:Date.now()})
  }

  const changePortal=nextPortal=>{
    const next=Object.hasOwn(PORTAL_DEFAULTS,nextPortal)?nextPortal:'operations'
    portalRef.current=next
    setPortal(next)
    setActivePage(PORTAL_DEFAULTS[next])
    if(next!=='operations'){setDemoMode(false);setDemoDecisionPending(null);stopOperationalAudio()}
    notify(next==='health'?'Espace Professionnels de santé ouvert':next==='national'?'Espace Pilotage national ouvert':'Centre opérationnel ouvert','green')
  }

  useEffect(()=>{
    portalRef.current=portal
    const params=new URLSearchParams(window.location.search)
    params.set('espace',portal)
    params.set('page',activePage)
    window.history.replaceState({portal,page:activePage},'',`${window.location.pathname}?${params.toString()}`)
  },[portal,activePage])

  useEffect(()=>{
    const restore=()=>{const next=initialPortalLocation();portalRef.current=next.portal;setPortal(next.portal);setActivePage(next.page)}
    window.addEventListener('popstate',restore)
    return()=>window.removeEventListener('popstate',restore)
  },[])

  const publishRealtime=(event,payload={})=>{
    return gatewayRef.current?.emit(event,{...payload,operatorId:operator.id,operatorRole:operator.role})||false
  }

  const recordMetric=(name,value,unit='ms',source='Plateforme web',detail='Mesure du prototype')=>{
    const numeric=Math.max(0,Math.round(Number(value)||0))
    setMetrics(current=>[{id:`MET-${Date.now()}-${Math.random().toString(16).slice(2)}`,time:new Date().toLocaleTimeString('fr-FR'),name,value:numeric,unit,source,detail},...current].slice(0,80))
  }

  const recordAudit=(action,details,{category='system',tone='blue',reference='SYSTÈME',actor=operator.name,operatorId=operator.id,operatorRole=operator.role,dataMode:mode=dataModeRef.current}={})=>{
    setAuditLog(current=>[{id:`AUD-${Date.now()}-${Math.random().toString(16).slice(2)}`,timestamp:new Date().toISOString(),time:new Date().toLocaleTimeString('fr-FR'),actor,operatorId,operatorRole,dataMode:mode,category,tone,action,details,reference},...current].slice(0,120))
  }

  const requireOperate=action=>{
    if(canOperate) return true
    notify(`Action refusée : le rôle ${operator.role} ne peut pas ${action}`,'red')
    recordAudit('Action refusée',`${operator.role} a tenté de ${action}.`,{category:'security',tone:'red',reference:operator.id})
    return false
  }

  const openAlertOnMap=(alert)=>{
    playTargetLock()
    setSelectedAlertId(alert.id)
    if(portalRef.current==='operations') setActivePage('map')
  }

  const receiveIncident=(incident,{real=false}={})=>{
    if(real&&dataModeRef.current!=='real'){
      setRealEventQueue(current=>[...current,{kind:'incident',payload:incident,receivedAt:new Date().toISOString()}].slice(-100))
      return incident
    }
    const started=performance.now()
    const enriched={receivedAt:new Date().toISOString(),transport:real?'Socket.IO · WebSocket':'WebSocket simulé',eventName:'incident:new',messageState:'Reçu · normalisé · en attente de validation',connectionState:real?'Temps réel':'Simulation contrôlée',...incident}
    const alreadyKnown=seenIncidentIds.current.has(enriched.id)
    seenIncidentIds.current.add(enriched.id)
    setAlerts(current=>alreadyKnown?current.map(item=>item.id===enriched.id?{...item,...enriched}:item):[enriched,...current])
    setSelectedAlertId(enriched.id)
    if(portalRef.current==='operations') setActivePage('map')
    if(!alreadyKnown) announceNewIncident(enriched)
    notify(`${alreadyKnown?'Signalement mobile actualisé':real?'Urgence mobile reçue':'Signalement du mode test reçu'} : ${enriched.location}`,alreadyKnown?'blue':'red')
    recordAudit(alreadyKnown?'Signalement mobile actualisé':real?'Urgence mobile reçue':'Signalement mobile reçu',`${enriched.type} · ${enriched.location} · ${enriched.victims} victime(s) · GPS ${enriched.accuracy}`,{category:'mobile',tone:alreadyKnown?'blue':'red',reference:enriched.id,actor:real?'Application mobile réelle':'Application mobile - mode test'})
    fog.enqueue('incident.mobile',enriched,enriched.source)
    recordMetric('Traitement du signalement',performance.now()-started,'ms','Flux mobile','Réception, normalisation, alerte sonore et ciblage cartographique')
    return enriched
  }

  const simulateMobileAlert=()=>{
    if(dataModeRef.current!=='test'){notify('Le simulateur est isolé : activez le mode test pour l’utiliser','amber');return null}
    const incident=createTestIncident()
    return receiveIncident(incident)
  }

  useEffect(()=>{
    const unlock=()=>unlockSound()
    window.addEventListener('pointerdown',unlock,{once:true})
    return ()=>window.removeEventListener('pointerdown',unlock)
  },[])

  const changeDataMode=nextMode=>{
    const next=nextMode==='real'?'real':'test'
    if(next===dataModeRef.current) return
    dataSnapshotsRef.current[dataModeRef.current]={alerts,ambulances:ambulanceFleet,hospitals:healthCenters,mission,missionHistory,selectedAlertId}
    const fallback=next==='test'
      ?{alerts:initialAlerts,ambulances:initialAmbulances,hospitals:initialHospitals,mission:null,missionHistory:[],selectedAlertId:initialAlerts[0].id}
      :{alerts:[],ambulances:initialAmbulances,hospitals:initialHospitals,mission:null,missionHistory:[],selectedAlertId:null}
    const snapshot=dataSnapshotsRef.current[next]||fallback
    const queued=next==='real'?realEventQueue:[]
    const queuedIncidents=queued.filter(item=>item.kind==='incident').map(item=>item.payload)
    const queuedPositions=queued.filter(item=>item.kind==='position').map(item=>item.payload)
    const queuedCapacities=queued.filter(item=>item.kind==='capacity').map(item=>item.payload)
    const nextAlerts=next==='real'?[...queuedIncidents,...snapshot.alerts.filter(item=>!queuedIncidents.some(queuedItem=>queuedItem.id===item.id))]:snapshot.alerts
    const nextAmbulances=snapshot.ambulances.map(item=>{const update=[...queuedPositions].reverse().find(position=>position.id===item.id);return update?{...item,lat:update.lat,lng:update.lng,heading:update.heading,liveSpeed:update.speed,updated:"à l'instant",gpsSource:'GPS réel'}:item})
    const nextHospitals=snapshot.hospitals.map(item=>{const update=[...queuedCapacities].reverse().find(capacity=>capacity.id===item.id);return update?{...item,beds:update.beds,occupancy:update.occupancy,reception:update.reception,lastCapacityUpdate:"à l'instant"}:item})
    dataModeRef.current=next;setDataMode(next)
    setAlerts(nextAlerts);setAmbulanceFleet(nextAmbulances);setHealthCenters(nextHospitals);setMission(snapshot.mission);setMissionHistory(snapshot.missionHistory);setSelectedAlertId(snapshot.selectedAlertId||nextAlerts[0]?.id||'')
    seenIncidentIds.current=new Set(nextAlerts.map(item=>item.id))
    if(next==='real') setRealEventQueue([])
    recordAudit('Environnement de données changé',next==='test'?'Mode test restauré, sans données terrain.':`Flux réel activé · ${queued.length} événement(s) isolé(s) importé(s).`,{category:'security',tone:next==='test'?'blue':'green',reference:'DATA-MODE',dataMode:next})
    notify(next==='test'?'Mode test restauré':'Flux mobile réel activé','green')
  }

  useEffect(()=>{
    const gateway=connectRealMobileGateway({
      getAccessToken,
      onStatus:status=>setMobileFeedStatus(status==='not-configured'?'demo':status),
      onIncident:incident=>receiveIncident(incident,{real:true}),
      onPosition:position=>{
        if(dataModeRef.current!=='real'){setRealEventQueue(current=>[...current,{kind:'position',payload:position,receivedAt:new Date().toISOString()}].slice(-100));return}
        setAmbulanceFleet(current=>current.map(item=>item.id===position.id?{...item,lat:position.lat,lng:position.lng,heading:position.heading,liveSpeed:position.speed,updated:"à l'instant",gpsSource:'GPS réel'}:item))
        recordAudit('Position GPS reçue',`${position.id} · ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,{category:'mission',tone:'green',reference:position.id,actor:'GPS ambulance',dataMode:'real'})
        fog.enqueue('ambulance.position',position,'GPS ambulance')
      },
      onCapacity:capacity=>{
        if(dataModeRef.current!=='real'){setRealEventQueue(current=>[...current,{kind:'capacity',payload:capacity,receivedAt:new Date().toISOString()}].slice(-100));return}
        setHealthCenters(current=>current.map(item=>item.id===capacity.id?{...item,beds:capacity.beds,occupancy:capacity.occupancy,reception:capacity.reception,lastCapacityUpdate:"à l'instant"}:item))
        recordAudit('Capacité hospitalière reçue',`${capacity.id} · ${capacity.beds} place(s) annoncée(s).`,{category:'system',tone:'green',reference:capacity.id,actor:'Portail hôpital',dataMode:'real'})
        fog.enqueue('health-center.capacity',capacity,'Portail centre de santé')
      },
    })
    gatewayRef.current=gateway
    return ()=>{gateway.disconnect();gatewayRef.current=null}
  },[])

  const toggleSounds=()=>{
    const next=!soundsEnabled
    setSoundsEnabled(next);persistSounds(next)
    if(next) playTargetLock()
    notify(next?'Sons opérationnels activés':'Sons opérationnels coupés')
  }

  const updateAlert=(id,status,options={})=>{
    if(!requireOperate('modifier le statut d’un signalement')) return
    setAlerts(current=>current.map(alert=>alert.id===id?{...alert,status,messageState:status==='Validée'?'Reçu · normalisé · validé par l’opérateur':status==='Rejetée'?'Reçu · contrôlé · rejeté':alert.messageState}:alert))
    if(!options.silent) notify(status==='Rejetée'?'Alerte classée comme rejetée':`Alerte ${status.toLowerCase()}` ,status==='Rejetée'?'red':'green')
    recordAudit(`Alerte ${status.toLowerCase()}`,`Le statut du signalement ${id} a été modifié par validation humaine.`,{category:'security',tone:status==='Rejetée'?'red':'green',reference:id,actor:options.actor||operator.name})
    publishRealtime('incident:status:update',{incidentId:id,status,operatorId:operator.id,operatorRole:operator.role})
  }

  const performAssignment=(ambulance,alertId=selectedAlertId,validation={})=>{
    if(!requireOperate('affecter une ambulance')) return null
    if(mission&&mission.status!=='Terminée'){
      notify('Une mission est déjà active. Terminez-la ou réinitialisez-la avant une nouvelle affectation.','red')
      return null
    }
    const decisionStarted=performance.now()
    const targetId=alertId||alerts[0].id
    const alert=alerts.find(item=>item.id===targetId)||alerts[0]
    const rankedAmbulances=rankAmbulances(alert,ambulanceFleet)
    const chosenAmbulance=ambulance||rankedAmbulances.find(item=>item.recommended)||rankedAmbulances[0]
    const rankedHospitals=rankHospitals(alert,healthCenters)
    const nearestHospital=rankedHospitals.find(item=>item.recommended)||rankedHospitals[0]
    const ambulanceDecision=rankedAmbulances.find(item=>item.id===chosenAmbulance.id)||chosenAmbulance
    const hospitalDecision=rankedHospitals.find(item=>item.id===nearestHospital?.id)||nearestHospital
    const missionId=`MISSION-${Date.now()}`
    const createdAt=Date.now()
    const fallback=localRoutePlan(chosenAmbulance,alert)
    const fallbackHospitalRoute=nearestHospital?localRoutePlan(alert,nearestHospital):null
    setMission({
      id:missionId,
      ambulanceId:chosenAmbulance.id,
      alertId:targetId,
      hospitalId:null,
      recommendedHospitalId:nearestHospital?.id||null,
      createdAt,
      startedAt:null,
      duration:demoMode?DEMO_INCIDENT_TRAVEL_MS:48000,
      animationDuration:demoMode?DEMO_INCIDENT_TRAVEL_MS:48000,
      status:'Analyse trafic',
      leg:'incident',
      routeState:'loading',
      route:fallback.coordinates,
      alternatives:fallback.alternatives,
      routeMeta:fallback,
      hospitalRoute:fallbackHospitalRoute?.coordinates||null,
      hospitalRouteMeta:fallbackHospitalRoute,
      congestion:false,
      rerouteCount:0,
      dataMode:dataModeRef.current,
      stageHistory:[{status:'Analyse trafic',at:new Date().toISOString(),actor:validation.operator||operator.name}],
      preDeparture:{state:'analysing',message:'Analyse des axes et comparaison des alternatives en cours'},
      ambulanceDecision,
      hospitalDecision,
      ambulanceValidation:{operator:validation.operator||operator.name,operatorId:validation.operatorId||operator.id,role:validation.role||operator.role,note:validation.note||'Recommandation confirmée par l’opérateur.',confirmedAt:new Date().toISOString()},
    })
    setAmbulanceFleet(current=>current.map(item=>item.id===chosenAmbulance.id?{...item,status:'Analyse trafic',updated:"à l'instant"}:item))
    setAlerts(current=>current.map(item=>item.id===targetId?{...item,status:'Analyse trafic',messageState:'Validé · ressource réservée · trafic en analyse'}:item))
    setSelectedAlertId(targetId)
    setActivePage('map')
    notify(`${chosenAmbulance.id} validée : analyse du trafic avant départ`,'blue')
    recordAudit('Affectation validée par l’opérateur',`${chosenAmbulance.id} a été affectée à ${targetId} · ${validation.note||'Recommandation conforme.'}`,{category:'security',tone:'green',reference:missionId,actor:validation.operator||operator.name,operatorId:validation.operatorId||operator.id,operatorRole:validation.role||operator.role})
    recordAudit('Analyse pré-départ lancée',`${chosenAmbulance.id} réservée pour ${targetId} · comparaison des axes avant mouvement.`,{category:'mission',tone:'blue',reference:missionId,actor:'Moteur trafic'})
    fog.enqueue('mission.assignment',{missionId,alertId:targetId,ambulanceId:chosenAmbulance.id,hospitalId:nearestHospital?.id,ambulanceEta:ambulanceDecision.decisionEta,hospitalEta:hospitalDecision?.decisionEta},'Moteur géodécisionnel')
    publishRealtime('mission:created',{missionId,incidentId:targetId,ambulanceId:chosenAmbulance.id,recommendedHospitalId:nearestHospital?.id||null,status:'Affectée',ambulanceEta:ambulanceDecision.decisionEta,hospitalEta:hospitalDecision?.decisionEta})
    recordMetric('Décision géospatiale',performance.now()-decisionStarted,'ms','Moteur de recommandation','Classement explicable des ambulances et centres de santé')
    const routingStarted=performance.now()
    Promise.all([getRoadRoute(chosenAmbulance,alert),nearestHospital?getRoadRoute(alert,nearestHospital):Promise.resolve(null)]).then(([plan,hospitalPlan])=>{
      const routes=plan.alternatives?.length?plan.alternatives:[plan.coordinates]
      const routeMetas=plan.alternativesMeta?.length?plan.alternativesMeta:[plan]
      const selectedIndex=routes.length>1?1:0
      const selectedRoute=routes[selectedIndex]||plan.coordinates
      const selectedMeta=routeMetas[selectedIndex]||plan
      const originalMeta=routeMetas[0]||plan
      const congestionDetected=selectedIndex>0
      const alternatives=routes.filter((_,index)=>index!==selectedIndex)
      const congestedRoad=originalMeta.steps?.find(step=>!['Point de départ','Zone de destination','Voie locale non nommée'].includes(step.road))?.road||originalMeta.name
      const departureDelay=demoMode?0:6000
      const departureAt=Date.now()+departureDelay
      const routeMeta={...selectedMeta,alternativesMeta:routeMetas,engine:`${plan.engine}${congestionDetected?' · alternative fluide retenue':''}`}
      setMission(current=>current?.id===missionId?{
        ...current,status:'Affectée',routeState:'ready',departureAt,route:selectedRoute,alternatives,routeMeta,
        originalRoute:routes[0],ambulanceRoute:selectedRoute,ambulanceRouteMeta:routeMeta,
        initialRouteMeta:selectedMeta,plannedEta:selectedMeta.eta,plannedDistance:selectedMeta.distance,
        congestion:congestionDetected,rerouteCount:congestionDetected?1:0,
        stageHistory:[...(current.stageHistory||[]),{status:'Affectée',at:new Date().toISOString(),actor:'Moteur de recommandation'}],
        preDeparture:{state:congestionDetected?'rerouted':'clear',congestedRoad,originalRouteName:originalMeta.name,selectedRouteName:selectedMeta.name,detectedAt:new Date().toISOString(),departureDelay},
        ...(hospitalPlan?{hospitalRoute:hospitalPlan.coordinates,hospitalRouteMeta:hospitalPlan}:{}),
      }:current)
      if(congestionDetected&&!demoMode) announcePreDepartureDecision({ambulanceId:chosenAmbulance.id,road:congestedRoad,route:selectedMeta.name,eta:selectedMeta.eta})
      recordAudit(congestionDetected?'Congestion détectée avant départ':'Axes vérifiés avant départ',congestionDetected?`${congestedRoad} écarté · ${selectedMeta.name} retenu · ambulance encore à l'arrêt.`:`${plan.engine} · ${plan.distance} km · aucun blocage détecté.`,{category:'mission',tone:congestionDetected?'red':'green',reference:missionId,actor:'Moteur trafic'})
      recordMetric('Analyse trafic pré-départ',performance.now()-routingStarted,'ms','Moteur trafic',congestionDetected?'Axe dense identifié et alternative sélectionnée avant mouvement':'Aucun axe bloquant identifié')
      if(nearestHospital&&hospitalPlan) recordAudit('Hôpital le plus proche identifié',`${nearestHospital.name} · ${hospitalPlan.distance} km depuis l’incident · ETA ${hospitalPlan.eta} min.`,{category:'mission',tone:'green',reference:missionId,actor:'Moteur de routage'})
      recordMetric('Calcul des itinéraires',performance.now()-routingStarted,'ms',plan.engine,'Ambulance → incident et incident → centre de santé')
    }).catch(error=>{
      const departureAt=Date.now()+4000
      setMission(current=>current?.id===missionId?{...current,status:'Affectée',routeState:'fallback',routeError:error.message||'Service de routage indisponible',departureAt,ambulanceRoute:fallback.coordinates,ambulanceRouteMeta:fallback,preDeparture:{state:'fallback',message:'Routage local activé avant départ'}}:current)
      notify('Service de routage distant indisponible : itinéraire local de secours activé','red')
      recordAudit('Repli de routage activé','Le calcul distant a échoué ; le trajet local du prototype est conservé.',{category:'mission',tone:'red',reference:missionId,actor:'Moteur de continuité'})
    })
  }

  const transitionMission=next=>{
    setMission(current=>{
      if(!current) return current
      const now=Date.now()
      const timestamp=new Date(now).toISOString()
      const stageHistory=[...(current.stageHistory||[]),{status:next,at:timestamp,actor:operator.name}]
      if(next==='En route') return {...current,status:next,leg:'incident',startedAt:now,incidentArrivedAt:null,duration:demoMode?DEMO_INCIDENT_TRAVEL_MS:48000,animationDuration:demoMode?DEMO_INCIDENT_TRAVEL_MS:48000,stageHistory}
      if(next==='Sur place') return {...current,status:next,startedAt:current.startedAt||now,incidentArrivedAt:timestamp,stageHistory}
      if(next==='Vers le centre de santé') return {...current,status:next,leg:'hospital',route:current.hospitalRoute||current.route,routeMeta:current.hospitalRouteMeta||current.routeMeta,startedAt:now,hospitalArrivedAt:null,duration:demoMode?DEMO_HOSPITAL_TRAVEL_MS:36000,animationDuration:demoMode?DEMO_HOSPITAL_TRAVEL_MS:36000,stageHistory}
      if(next==='Pris en charge') return {...current,status:next,hospitalArrivedAt:timestamp,stageHistory}
      if(next==='Terminée') return {...current,status:next,completedAt:timestamp,stageHistory}
      return {...current,status:next,stageHistory}
    })
  }

  const movementCompleted=current=>{
    if(!current?.startedAt) return false
    const duration=current.animationDuration||current.duration||DEMO_INCIDENT_TRAVEL_MS
    return Date.now()-current.startedAt>=duration
  }

  const assignAmbulance=(ambulance,alertId=selectedAlertId,options={})=>{
    if(!requireOperate('affecter une ambulance')) return
    const alert=alerts.find(item=>item.id===(alertId||selectedAlertId))||alerts[0]
    if(!alert) return notify('Aucun incident ne peut être affecté','red')
    const ranking=rankAmbulances(alert,ambulanceFleet)
    const candidate=ambulance||ranking.find(item=>item.recommended)||ranking[0]
    if(options.autoApprove||!securityConfig.requireHumanValidation){
      if(alert.status!=='Validée') updateAlert(alert.id,'Validée',{silent:true,actor:options.operator||operator.name})
      return performAssignment(candidate,alert.id,{operator:options.operator||operator.name,operatorId:options.operatorId||operator.id,role:options.role||operator.role,note:options.note||'Validation opérateur du mode test contrôlé.'})
    }
    setDecisionReview({type:'assignment',alert,candidate,ranking,defaultNote:'Disponibilité vérifiée. Affectation confirmée par l’opérateur.'})
    recordAudit('Affectation soumise à validation',`${candidate.id} est proposé pour ${alert.id} selon sa disponibilité, son délai et son équipement.`,{category:'security',tone:'blue',reference:alert.id})
  }

  const buildMissionReport=current=>{
    const ambulancePlan=current.initialRouteMeta||current.ambulanceRouteMeta||current.routeMeta||{}
    const ambulanceActual=current.ambulanceRouteMeta||ambulancePlan
    const hospitalPlan=current.hospitalRouteMeta||{}
    const plannedEta=Math.max(1,Number(ambulancePlan.eta||0)+Number(hospitalPlan.eta||0))
    const plannedDistance=Number(ambulancePlan.distance||0)+Number(hospitalPlan.distance||0)
    const rerouteGain=current.rerouteCount?Math.min(3,Math.max(1,current.rerouteCount*2)):0
    const actualEta=Number(current.actualEta||Math.max(1,plannedEta-rerouteGain+(current.rerouteCount?0:1)))
    const actualDistance=Number(current.actualDistance||Number(ambulanceActual.distance||0)+Number(hospitalPlan.distance||0)||plannedDistance)
    const hospital=healthCenters.find(item=>item.id===(current.hospitalId||current.recommendedHospitalId))
    const initialRoute=[ambulancePlan.name,hospitalPlan.name].filter(Boolean).join(' puis ')||'Itinéraire initial'
    const finalRoute=[ambulanceActual.name,hospitalPlan.name].filter(Boolean).join(' puis ')||'Itinéraire final'
    const stages=current.stageHistory||[]
    const stageHistory=stages.at(-1)?.status==='Terminée'?stages:[...stages,{status:'Terminée',at:new Date().toISOString(),actor:operator.name}]
    return {id:current.id,incidentId:current.alertId,alertId:current.alertId,ambulanceId:current.ambulanceId,hospitalId:hospital?.id||current.hospitalId||current.recommendedHospitalId,hospitalName:hospital?.name||'',createdAt:current.createdAt,completedAt:new Date().toISOString(),status:'Terminée',plannedEta,actualEta,etaDelta:actualEta-plannedEta,plannedDistance:Number(plannedDistance.toFixed(1)),actualDistance:Number(actualDistance.toFixed(1)),distanceDelta:Number((actualDistance-plannedDistance).toFixed(1)),initialRoute,finalRoute,routeName:finalRoute,rerouteCount:current.rerouteCount||0,ambulanceValidation:current.ambulanceValidation,orientationValidation:current.orientationValidation,stageHistory,dataMode:current.dataMode||dataModeRef.current,fogEvents:fog.queue.filter(item=>item.payload?.missionId===current.id).length}
  }

  const advanceMission=(requestedStatus=null)=>{
    if(!mission) return
    if(!requireOperate('faire évoluer une mission')) return
    if(['En route','Vers le centre de santé'].includes(mission.status)&&!movementCompleted(mission)){
      notify(mission.status==='En route'?'L’ambulance est toujours en déplacement vers l’incident.':'L’ambulance est toujours en déplacement vers l’hôpital.','blue')
      return
    }
    const currentIndex=Math.max(0,MISSION_STAGES.indexOf(mission.status))
    const next=requestedStatus||MISSION_STAGES[Math.min(MISSION_STAGES.length-1,currentIndex+1)]
    if(next==='Orientation hospitalière'&&!mission.incidentArrivedAt){
      notify('L’ambulance doit d’abord arriver sur les lieux de l’incident.','red')
      return
    }
    if(next==='Vers le centre de santé'&&!mission.hospitalId){
      notify('L’hôpital d’accueil doit être confirmé avant le transfert.','red')
      return
    }
    if(['Pris en charge','Terminée'].includes(next)&&mission.leg==='hospital'&&!movementCompleted(mission)){
      notify('La réception hospitalière ne peut être confirmée avant l’arrivée de l’ambulance.','red')
      return
    }
    transitionMission(next)
  }

  useEffect(()=>{
    if(!mission) return undefined
    if(demoMode) return undefined
    let delay=null,next=null
    if(mission.status==='Affectée'&&mission.routeState!=='loading'){delay=Math.max(0,(mission.departureAt||Date.now())-Date.now());next='En route'}
    if(mission.status==='En route'){delay=Math.max(0,mission.duration-(Date.now()-(mission.startedAt||Date.now())));next='Sur place'}
    if(mission.status==='Sur place'){delay=6000;next='Orientation hospitalière'}
    if(mission.status==='Orientation hospitalière'&&mission.hospitalId){delay=6000;next='Vers le centre de santé'}
    if(mission.status==='Vers le centre de santé'){delay=Math.max(0,mission.duration-(Date.now()-(mission.startedAt||Date.now())));next='Pris en charge'}
    if(mission.status==='Pris en charge'){delay=6000;next='Terminée'}
    if(delay===null||!next) return undefined
    const timer=setTimeout(()=>transitionMission(next),delay)
    return ()=>clearTimeout(timer)
  },[mission?.id,mission?.status,mission?.startedAt,mission?.departureAt,mission?.routeState,mission?.duration,mission?.hospitalId,demoMode])

  useEffect(()=>{
    if(!mission) return
    const key=`${mission.id}:${mission.status}:${mission.leg||'incident'}`
    if(missionStatusKeyRef.current===key) return
    missionStatusKeyRef.current=key
    const hospital=healthCenters.find(item=>item.id===(mission.hospitalId||mission.recommendedHospitalId))
    const ambulanceStatus=mission.status==='Terminée'?'Disponible':mission.status
    const alertStatuses={
      'Analyse trafic':'Analyse trafic','Affectée':'Ambulance affectée','En route':'Ambulance en route','Sur place':'Secours sur place','Orientation hospitalière':'Orientation hospitalière','Vers le centre de santé':'Transfert hospitalier','Pris en charge':'Victime prise en charge','Terminée':'Clôturée',
    }
    setAmbulanceFleet(current=>current.map(item=>item.id===mission.ambulanceId?{...item,status:ambulanceStatus,updated:"à l'instant"}:item))
    setAlerts(current=>current.map(item=>item.id===mission.alertId?{...item,status:alertStatuses[mission.status]||mission.status,messageState:`Mission ${mission.status.toLowerCase()} · mise à jour automatique`}:item))
    notify(`Mission : ${mission.status}`,mission.status==='Terminée'?'green':mission.status==='Analyse trafic'?'blue':'blue')
    recordAudit(`Mission : ${mission.status}`,`${mission.ambulanceId} · ${mission.alertId}${hospital?` · ${hospital.name}`:''}`,{category:'mission',tone:mission.status==='Terminée'?'green':mission.status==='Analyse trafic'?'blue':'blue',reference:mission.id,actor:'Suivi automatique'})
    fog.enqueue('mission.status',{missionId:mission.id,status:mission.status,leg:mission.leg,updatedAt:new Date().toISOString()},'Suivi opérationnel')
    publishRealtime('mission:status:update',{missionId:mission.id,incidentId:mission.alertId,ambulanceId:mission.ambulanceId,status:mission.status,leg:mission.leg})
    if(!demoMode){
      if(mission.status==='En route') announceAmbulanceAssignment({ambulanceId:mission.ambulanceId,location:alerts.find(item=>item.id===mission.alertId)?.location,eta:mission.ambulanceRouteMeta?.eta||mission.routeMeta?.eta})
      else announceMissionStage({
        status:mission.status,
        ambulanceId:mission.ambulanceId,
        hospital:hospital?.name,
        arrived:mission.status==='Sur place'?Boolean(mission.incidentArrivedAt):['Pris en charge','Terminée'].includes(mission.status)?Boolean(mission.hospitalArrivedAt):true,
      })
    }
    if(mission.status==='Terminée'){
      const report=buildMissionReport(mission)
      setMissionHistory(current=>current.some(item=>item.id===report.id)?current:[report,...current].slice(0,50))
      recordMetric('Durée opérationnelle observée',report.actualEta,'min',report.dataMode==='test'?'Mode test isolé':'Télémétrie réelle',`Prévision ${report.plannedEta} min · écart ${report.etaDelta} min`)
    }
  },[mission?.id,mission?.status,mission?.leg,demoMode])

  useEffect(()=>{
    if(!fog.lastSync||!fog.stats.lastDuration) return
    recordMetric('Synchronisation Fog-Cloud',fog.stats.lastDuration,'ms',import.meta.env.VITE_API_URL?'API NestJS':'Cloud simulé du prototype',`${fog.stats.synced} donnée(s) acquittée(s) · taux ${fog.stats.syncRate} %`)
  },[fog.lastSync])

  const simulateCongestion=()=>{
    if(!requireOperate('simuler ou appliquer un reroutage')) return
    if(!mission||mission.routeState==='loading'){
      notify('Attendez la fin du calcul des itinéraires avant de simuler une nouvelle congestion.','red')
      return
    }
    const started=performance.now()
    const alternatives=mission.alternatives?.length?mission.alternatives:[mission.route]
    const nextIndex=(mission.rerouteCount+1)%alternatives.length
    const nextRoute=alternatives[nextIndex]||mission.route
    const nextMeta=mission.routeMeta?.alternativesMeta?.[nextIndex]
    setMission(current=>({...current,route:nextRoute,startedAt:Date.now(),duration:demoMode?DEMO_INCIDENT_TRAVEL_MS:42000,animationDuration:demoMode?DEMO_INCIDENT_TRAVEL_MS:42000,status:'En route',leg:'incident',congestion:true,rerouteCount:(current.rerouteCount||0)+1,routeMeta:{...current.routeMeta,...nextMeta,alternativesMeta:current.routeMeta?.alternativesMeta,engine:'OSRM · itinéraire recalculé'}}))
    notify('Congestion détectée : l’ambulance est redirigée','red')
    announceCongestion({road:nextMeta?.name||mission.routeMeta?.name,eta:nextMeta?.eta||mission.routeMeta?.eta})
    recordAudit('Reroutage automatique','Un axe congestionné a été évité et un trajet alternatif activé.',{category:'mission',tone:'red',reference:mission.id,actor:'Moteur de routage'})
    fog.enqueue('traffic.reroute',{missionId:mission.id,reroute:(mission.rerouteCount||0)+1,detectedAt:new Date().toISOString()},'Moteur trafic')
    publishRealtime('mission:rerouted',{missionId:mission.id,ambulanceId:mission.ambulanceId,reroute:(mission.rerouteCount||0)+1,reason:'congestion'})
    recordMetric('Recalcul après congestion',performance.now()-started,'ms','Moteur de routage','Sélection d’une alternative évitant l’axe dense')
  }

  const updateHealthCenter=(id,changes)=>{
    if(!requireOperate('modifier la capacité d’un hôpital')) return
    const center=healthCenters.find(item=>item.id===id)
    setHealthCenters(current=>current.map(item=>item.id===id?{...item,...changes,lastCapacityUpdate:"à l'instant"}:item))
    notify(`Capacité de ${center?.name||'ce centre de santé'} mise à jour`,'green')
    recordAudit('Capacité mise à jour',`${center?.name||id} · ${changes.beds??center?.beds} place(s) disponible(s).`,{category:'system',tone:'green',reference:id,actor:'Centre de santé'})
    fog.enqueue('health-center.capacity',{id,...changes,updatedAt:new Date().toISOString()},'Portail centre de santé')
    publishRealtime('hospital:capacity:update',{hospitalId:id,...changes})
  }

  const performOrientation=(hospital,validation={})=>{
    if(!requireOperate('confirmer une orientation hospitalière')) return
    const alert=alerts.find(item=>item.id===mission?.alertId)
    const missionId=mission?.id
    if(mission&&alert){
      const fallback=localRoutePlan(alert,hospital)
      setMission(current=>({...current,hospitalId:hospital.id,recommendedHospitalId:hospital.id,hospitalRoute:fallback.coordinates,hospitalRouteMeta:fallback,orientationValidation:{operator:validation.operator||operator.name,operatorId:validation.operatorId||operator.id,role:validation.role||operator.role,note:validation.note||'Orientation confirmée par l’opérateur.',confirmedAt:new Date().toISOString()},stageHistory:[...(current.stageHistory||[]),{status:'Orientation hospitalière validée',at:new Date().toISOString(),actor:validation.operator||operator.name}]}))
      getRoadRoute(alert,hospital).then(plan=>setMission(current=>current?.id===missionId&&current.hospitalId===hospital.id?{...current,hospitalRoute:plan.coordinates,hospitalRouteMeta:plan}:current))
    }
    notify(`Orientation confirmée vers ${hospital.name}`,'green')
    recordAudit('Orientation validée par l’opérateur',`${hospital.name} · ${hospital.beds} place(s) disponible(s) · ${validation.note||'Recommandation conforme.'}`,{category:'security',tone:'green',reference:mission?.id||hospital.id,actor:validation.operator||operator.name,operatorId:validation.operatorId||operator.id,operatorRole:validation.role||operator.role})
    fog.enqueue('mission.orientation',{missionId:mission?.id,hospitalId:hospital.id,places:hospital.beds,confirmedAt:new Date().toISOString()},'Opérateur LOTISEC')
    publishRealtime('mission:orientation',{missionId:mission?.id,incidentId:mission?.alertId,hospitalId:hospital.id,availableBeds:hospital.beds,status:'confirmed',operatorId:validation.operatorId||operator.id})
  }

  const confirmOrientation=(hospital,options={})=>{
    if(!requireOperate('confirmer une orientation hospitalière')) return
    if(!mission) return notify('Affectez d’abord une ambulance avant de confirmer l’hôpital','red')
    if(!['Sur place','Orientation hospitalière'].includes(mission.status)||!mission.incidentArrivedAt) return notify('L’ambulance doit arriver sur les lieux avant l’orientation hospitalière.','red')
    const alert=alerts.find(item=>item.id===mission?.alertId)||activeAlert
    const ranking=rankHospitals(alert,healthCenters)
    const candidate=hospital||ranking.find(item=>item.recommended)||ranking[0]
    if(!candidate) return notify('Aucun hôpital disponible pour cette orientation','red')
    if(options.autoApprove||!securityConfig.requireHumanValidation) return performOrientation(candidate,{operator:options.operator||operator.name,operatorId:options.operatorId||operator.id,role:options.role||operator.role,note:options.note||'Validation opérateur du mode test contrôlé.'})
    setDecisionReview({type:'orientation',alert,candidate,ranking,defaultNote:'Capacité d’accueil vérifiée. Orientation confirmée par l’opérateur.'})
    recordAudit('Orientation soumise à validation',`${candidate.name} est proposé selon le délai, la capacité et les services disponibles.`,{category:'security',tone:'blue',reference:mission?.id||alert?.id})
  }

  const confirmDecisionReview=note=>{
    const review=decisionReview
    if(!review) return
    setDecisionReview(null)
    if(review.type==='assignment'){
      if(review.alert.status!=='Validée') updateAlert(review.alert.id,'Validée',{silent:true})
      performAssignment(review.candidate,review.alert.id,{operator:operator.name,operatorId:operator.id,role:operator.role,note})
      if(demoMode&&demoDecisionPending==='assignment'){
        setDemoDecisionPending(null)
        setDemoStep(current=>Math.max(current,3))
        setActivePage('map')
        speakOperational(`Affectation confirmée pour l'ambulance ${review.candidate.id}. Analyse du trafic et préparation de l'itinéraire.`,{rate:.91})
      }
    }else{
      performOrientation(review.candidate,{operator:operator.name,operatorId:operator.id,role:operator.role,note})
      if(demoMode&&demoDecisionPending==='orientation'){
        setDemoDecisionPending(null)
        setDemoStep(current=>Math.max(current,6))
        setActivePage('map')
        transitionMission('Vers le centre de santé')
        announceMissionStage({status:'Vers le centre de santé',ambulanceId:mission?.ambulanceId,hospital:review.candidate.name})
      }
    }
  }

  const cancelDecisionReview=reason=>{
    if(decisionReview) recordAudit('Décision non exécutée',`${decisionReview.type==='assignment'?'Affectation':'Orientation'} : ${reason||'validation annulée'}.`,{category:'security',tone:'amber',reference:decisionReview.alert?.id})
    setDecisionReview(null)
    setDemoDecisionPending(null)
  }

  const runSystemHealthCheck=async()=>{
    setSystemHealth(current=>({...current,checking:true}))
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),4500)
    const backend=await probeBackendHealth(controller.signal)
    clearTimeout(timeout)
    const now=new Date().toLocaleTimeString('fr-FR')
    const routeEngine=mission?.routeMeta?.engine
    const services=[
      {id:'mobile',name:'Passerelle application mobile',status:mobileFeedStatus==='connected'?'operational':mobileConfig.socketUrl?'degraded':'ready',detail:mobileFeedStatus==='connected'?'Canal réel authentifié et événements écoutés.':mobileConfig.socketUrl?'Configuration présente, connexion indisponible.':'Adaptateur prêt ; URL Socket.IO non renseignée.',lastSignal:mobileFeedStatus==='connected'?now:'-'},
      {id:'realtime',name:'Socket.IO temps réel',status:mobileFeedStatus==='connected'?'operational':mobileConfig.socketUrl?'degraded':'ready',detail:`Namespace ${mobileConfig.namespace} · chemin ${mobileConfig.socketPath} · reconnexion automatique.`,lastSignal:mobileFeedStatus==='connected'?now:'-'},
      {id:'api',name:'API métier NestJS',status:backend.ok?'operational':backend.configured?'degraded':'ready',detail:backend.ok?'Endpoint /health accessible et réponse valide.':backend.configured?(backend.error||`Réponse HTTP ${backend.status||'indisponible'}.`):'VITE_API_URL à renseigner pour activer la vérification réelle.',lastSignal:backend.ok?now:'-',latency:backend.latency},
      {id:'database',name:'PostgreSQL + PostGIS',status:backend.ok&&(backend.components.postgis?.ok||backend.components.database?.ok)?'operational':backend.ok?'degraded':'ready',detail:backend.ok?'État dérivé du health-check backend ; aucune connexion SQL directe depuis le navigateur.':'La base géographique sera supervisée uniquement via l’API sécurisée.',lastSignal:backend.ok?now:'-'},
      {id:'routing',name:'Moteur de routage',status:routeEngine?'operational':'ready',detail:routeEngine?`${routeEngine} · dernier itinéraire ${mission.routeMeta?.distance||'-'} km.`:'OSRM et moteur de repli local prêts pour le prochain calcul.',lastSignal:routeEngine?now:'-'},
      {id:'fog',name:'Continuité Fog locale',status:fog.effectiveMode==='offline'?'degraded':'operational',detail:`Mode ${fog.quality.label.toLowerCase()} · ${fog.queue.length} élément(s) dans la file persistante.`,lastSignal:fog.lastSync||now},
      {id:'audit',name:'Journal de traçabilité',status:securityConfig.auditEnabled?'operational':'offline',detail:`${auditLog.length} événement(s) horodaté(s), actions sensibles attribuées à un rôle.`,lastSignal:auditLog[0]?.time||'-'},
    ]
    setSystemHealth({checking:false,lastCheckedAt:now,backendLatency:backend.latency,backendVersion:backend.version,services})
    return {backend,services}
  }

  const changeOperatorRole=role=>{
    const nextRole=ROLE_ACTIONS[role]?role:'Observateur'
    const previous=operator.role
    setOperator(current=>({...current,id:current.id==='USR-GUEST'?'USR-OP-001':current.id,name:current.authenticated?current.name:'Opérateur LOTISEC',role:nextRole,authenticated:true,sessionStartedAt:current.sessionStartedAt||new Date().toISOString()}))
    recordAudit('Rôle de session modifié',`${previous} → ${nextRole} dans l’environnement ${dataModeRef.current}.`,{category:'security',tone:'blue',reference:operator.id,operatorRole:nextRole})
    notify(`Session active : rôle ${nextRole}`,'blue')
  }

  const handleLogout=()=>{
    try{
      sessionStorage.removeItem('lotisec-access-token')
      localStorage.removeItem('lotisec-access-token')
      localStorage.setItem('lotisec-auth','false')
    }catch{}
    recordAudit('Déconnexion de session',`L'opérateur ${operator.name} s'est déconnecté.`,{category:'security',tone:'blue',reference:operator.id})
    setOperator({id:'USR-GUEST',name:'Session déconnectée',role:'Observateur',authenticated:false,sessionStartedAt:null})
    setIsAuthenticated(false)
  }

  const handleLoginSuccess=(user,mode='real')=>{
    try{localStorage.setItem('lotisec-auth','true')}catch{}
    setOperator({
      id:user.id||'ADM-005',
      name:user.name||'Administrateur LOTISEC',
      role:user.role||'Administrateur',
      authenticated:true,
      sessionStartedAt:new Date().toISOString()
    })
    setIsAuthenticated(true)
    notify(`Bienvenue, ${user.name||'Opérateur'}`,'green')
  }

  const handleStartDemoFromLogin=()=>{
    try{localStorage.setItem('lotisec-auth','true')}catch{}
    setOperator({
      id:'USR-DEMO',
      name:'Opérateur Démo',
      role:'Administrateur',
      authenticated:true,
      sessionStartedAt:new Date().toISOString()
    })
    setIsAuthenticated(true)
    notify('Mode Démo Sandbox activé','green')
  }

  const updateSecurity=(key,value)=>{
    if(['requireHumanValidation','auditEnabled','isolateTestData'].includes(key)) return notify('Cette politique est verrouillée dans LOTISEC','amber')
    setSecurityConfig(current=>({...current,[key]:value}))
    recordAudit('Politique de confidentialité modifiée',`${key} = ${value}`,{category:'security',tone:'blue',reference:'SECURITY'})
  }

  useEffect(()=>{runSystemHealthCheck()},[mobileFeedStatus,dataMode,fog.effectiveMode])

  const queueTestEvent=()=>fog.enqueue('telemetry.test',{network:fog.effectiveMode,position:{lat:6.1414,lng:1.2187},capturedAt:new Date().toISOString()},'Terminal Edge du mode test')

  const resetCurrentMission=()=>{
    if(!mission){notify('Aucune mission active à réinitialiser','blue');return}
    const current=mission
    stopOperationalAudio()
    setMission(null)
    missionStatusKeyRef.current=''
    setAmbulanceFleet(items=>items.map(item=>item.id===current.ambulanceId?{...item,status:'Disponible',updated:"à l'instant"}:item))
    setAlerts(items=>items.map(item=>item.id===current.alertId?{...item,status:'Validée',messageState:'Incident validé · prêt pour une nouvelle affectation'}:item))
    recordAudit('Mission réinitialisée',`${current.id} a été remise à zéro par l’opérateur.`,{category:'mission',tone:'amber',reference:current.id})
    notify('Mission réinitialisée : ambulance, itinéraires et statuts remis à zéro','blue')
    setActivePage('map')
  }

  const resetOperationalState=async({keepMetrics=false}={})=>{
    stopOperationalAudio()
    setAlerts(initialAlerts);setAmbulanceFleet(initialAmbulances);setHealthCenters(initialHospitals)
    seenIncidentIds.current=new Set(initialAlerts.map(item=>item.id))
    setMission(null);setMissionHistory([]);setDecisionReview(null);setDemoDecisionPending(null);missionStatusKeyRef.current='';setSelectedAlertId(initialAlerts[0].id);setAuditLog(INITIAL_AUDIT);setActivePage('dashboard')
    if(!keepMetrics) setMetrics([])
    await fog.reset()
    notify('Mode test LOTISEC réinitialisé et prêt','blue')
  }

  const startDemo=async()=>{
    if(dataModeRef.current!=='test') changeDataMode('test')
    if(operator.role==='Observateur') setOperator(current=>({...current,role:'Opérateur'}))
    demoBusyRef.current=false
    setDemoMode(true);setDemoStep(0);setDemoBusy(false);setDemoDecisionPending(null)
    await resetOperationalState()
    notify('Mode test prêt : utilisez Étape suivante pour piloter la démonstration','blue')
  }

  const runNextDemoStep=async()=>{
    if(demoBusyRef.current||demoStep>=DEMO_STEPS.length) return
    demoBusyRef.current=true
    setDemoBusy(true)
    const step=demoStep
    let advanceStep=true
    try{
      if(step===0){
        setActivePage('map')
        simulateMobileAlert()
      }
      if(step===1){
        const incident=alerts.find(item=>item.id===selectedAlertId)||alerts[0]
        if(incident) updateAlert(incident.id,'Validée',{actor:'Opérateur du mode test'})
        setActivePage('alerts')
        speakOperational(`Le signalement de ${incident?.location||'la zone indiquée'} est vérifié et validé.`,{rate:.91})
      }
      if(step===2){
        const incident=alerts.find(item=>item.id===selectedAlertId)||alerts[0]
        const ranking=rankAmbulances(incident,ambulanceFleet)
        const recommended=ranking.find(item=>item.recommended)||ranking[0]
        setActivePage('map')
        setDemoDecisionPending('assignment')
        assignAmbulance(recommended,incident.id)
        speakOperational(`L'ambulance ${recommended.id} est proposée. L'opérateur peut confirmer cette affectation ou choisir une autre ambulance.`,{rate:.9})
        advanceStep=false
      }
      if(step===3){
        if(!mission||mission.routeState==='loading'){
          notify('Le calcul de l’itinéraire doit être terminé avant le départ','blue')
          advanceStep=false
        }else{
          transitionMission('En route')
          setActivePage('map')
          const incident=alerts.find(item=>item.id===mission.alertId)
          if(mission.congestion){
            const road=mission.preDeparture?.congestedRoad
            const route=mission.preDeparture?.selectedRouteName||mission.routeMeta?.name
            speakOperational(`Trafic dense${road?` sur ${road}`:''}. L'itinéraire${route?` par ${route}`:''} est retenu. Ambulance ${mission.ambulanceId} en route vers l'incident.`,{delay:220,rate:.9})
          }else announceAmbulanceAssignment({ambulanceId:mission.ambulanceId,location:incident?.location,eta:mission.ambulanceRouteMeta?.eta||mission.routeMeta?.eta})
        }
      }
      if(step===4){
        const duration=mission?.animationDuration||mission?.duration||DEMO_INCIDENT_TRAVEL_MS
        const arrived=mission?.startedAt&&Date.now()-mission.startedAt>=duration
        if(!arrived){
          notify('L’ambulance est encore en déplacement vers l’incident','blue')
          advanceStep=false
        }else{
          transitionMission('Sur place')
          setActivePage('map')
          announceMissionStage({status:'Sur place',ambulanceId:mission.ambulanceId,arrived:true})
        }
      }
      if(step===5){
        const incident=alerts.find(item=>item.id===mission?.alertId)||activeAlert
        const ranking=rankHospitals(incident,healthCenters)
        const recommended=ranking.find(item=>item.id===mission?.recommendedHospitalId)||ranking.find(item=>item.recommended)||ranking[0]
        transitionMission('Orientation hospitalière')
        setActivePage('map')
        setDemoDecisionPending('orientation')
        if(recommended) confirmOrientation(recommended)
        speakOperational(`${recommended?.name||'Le centre de santé le plus proche'} est recommandé selon le délai, la capacité d'accueil et les services disponibles. Validation attendue.`,{rate:.89})
        advanceStep=false
      }
      if(step===6){
        if(!mission?.hospitalId){
          notify('L’orientation hospitalière doit être confirmée avant le transfert','blue')
          advanceStep=false
        }else{
          transitionMission('Vers le centre de santé')
          setActivePage('map')
          const hospital=healthCenters.find(item=>item.id===mission.hospitalId)
          announceMissionStage({status:'Vers le centre de santé',ambulanceId:mission.ambulanceId,hospital:hospital?.name})
        }
      }
      if(step===7){
        if(mission?.status==='Terminée'){
          setActivePage('mission-reports')
        }else{
          const duration=mission?.animationDuration||mission?.duration||DEMO_HOSPITAL_TRAVEL_MS
          const arrived=mission?.startedAt&&Date.now()-mission.startedAt>=duration
          if(!arrived){
            notify('L’ambulance est encore en déplacement vers l’hôpital recommandé','blue')
            advanceStep=false
          }else{
            const hospital=healthCenters.find(item=>item.id===mission.hospitalId)
            transitionMission('Pris en charge')
            announceMissionStage({status:'Pris en charge',ambulanceId:mission.ambulanceId,hospital:hospital?.name,arrived:true})
            await new Promise(resolve=>setTimeout(resolve,1800))
            transitionMission('Terminée')
            announceMissionStage({status:'Terminée',ambulanceId:mission.ambulanceId,hospital:hospital?.name,arrived:true})
            setActivePage('mission-reports')
          }
        }
      }
      if(advanceStep) setDemoStep(current=>Math.min(DEMO_STEPS.length,current+1))
    }finally{demoBusyRef.current=false;setDemoBusy(false)}
  }

  useEffect(()=>{
    if(!demoMode||!mission) return undefined
    let timer=null
    const waitUntil=(deadline,action)=>{
      timer=setTimeout(action,Math.max(0,deadline-Date.now()))
    }
    if(mission.status==='En route'&&mission.startedAt){
      const duration=mission.animationDuration||mission.duration||DEMO_INCIDENT_TRAVEL_MS
      waitUntil(mission.startedAt+duration,()=>{
        transitionMission('Sur place')
        setActivePage('map')
        announceMissionStage({status:'Sur place',ambulanceId:mission.ambulanceId,arrived:true})
      })
    }else if(mission.status==='Sur place'&&mission.incidentArrivedAt){
      waitUntil(new Date(mission.incidentArrivedAt).getTime()+DEMO_ON_SCENE_MS,()=>{
        const incident=alerts.find(item=>item.id===mission.alertId)||activeAlert
        const ranking=rankHospitals(incident,healthCenters)
        const recommended=ranking.find(item=>item.id===mission.recommendedHospitalId)||ranking.find(item=>item.recommended)||ranking[0]
        transitionMission('Orientation hospitalière')
        setDemoStep(current=>Math.max(current,5))
        setActivePage('map')
        setDemoDecisionPending('orientation')
        if(recommended) confirmOrientation(recommended)
        speakOperational(`${recommended?.name||'Le centre de santé le plus proche'} est proposé pour l'accueil. Validation de l'opérateur attendue.`,{rate:.89})
      })
    }else if(mission.status==='Vers le centre de santé'&&mission.startedAt){
      const duration=mission.animationDuration||mission.duration||DEMO_HOSPITAL_TRAVEL_MS
      waitUntil(mission.startedAt+duration,()=>{
        const hospital=healthCenters.find(item=>item.id===mission.hospitalId)
        transitionMission('Pris en charge')
        setDemoStep(current=>Math.max(current,7))
        setActivePage('map')
        announceMissionStage({status:'Pris en charge',ambulanceId:mission.ambulanceId,hospital:hospital?.name,arrived:true})
      })
    }else if(mission.status==='Pris en charge'&&mission.hospitalArrivedAt){
      waitUntil(new Date(mission.hospitalArrivedAt).getTime()+1200,()=>{
        const hospital=healthCenters.find(item=>item.id===mission.hospitalId)
        transitionMission('Terminée')
        setDemoStep(current=>Math.max(current,7))
        setActivePage('mission-reports')
        announceMissionStage({status:'Terminée',ambulanceId:mission.ambulanceId,hospital:hospital?.name,arrived:true})
      })
    }
    return ()=>{if(timer)clearTimeout(timer)}
  },[demoMode,mission?.id,mission?.status,mission?.startedAt,mission?.incidentArrivedAt,mission?.hospitalArrivedAt])

  const openDemoStep=stepIndex=>{
    if(demoBusy||stepIndex>demoStep+1) return
    if(stepIndex>=demoStep){runNextDemoStep();return}
    const reviewPages=['map','alerts','map','map','map','map','map','mission-reports']
    setActivePage(reviewPages[stepIndex]||'dashboard')
    notify(`Étape ${stepIndex+1} ouverte pour vérification`,'blue')
  }

  const toggleDemo=()=>demoMode?setDemoMode(false):startDemo()

  let content
  if(portal==='health'){
    content=<HealthPortal view={activePage} hospitals={healthCenters} alerts={alerts} mission={mission} auditLog={auditLog} mobileFeedStatus={mobileFeedStatus} onUpdateHospital={updateHealthCenter} onPublishEvent={publishRealtime} onNotify={notify}/>
  }else if(portal==='national'){
    content=<NationalPilotage view={activePage} alerts={alerts} ambulances={ambulanceFleet} hospitals={healthCenters} missionHistory={missionHistory} metrics={metrics} auditLog={auditLog} fog={fog} mobileFeedStatus={mobileFeedStatus} onPublishEvent={publishRealtime} onNotify={notify}/>
  }else switch(activePage){
    case 'alerts': content=<Alerts alerts={alerts} ambulances={ambulanceFleet} onSimulateMobile={simulateMobileAlert} onOpenMap={openAlertOnMap} onAssign={assignAmbulance} onUpdateAlert={updateAlert}/>; break
    case 'interventions': content=<Interventions alerts={alerts} ambulances={ambulanceFleet} hospitals={healthCenters} mission={mission} auditLog={auditLog} onAssign={assignAmbulance} onAdvanceMission={advanceMission} onNavigate={setActivePage} onNotify={notify}/>; break
    case 'map': content=<OperationalMap alerts={alerts} ambulances={ambulanceFleet} hospitals={healthCenters} selectedAlertId={selectedAlertId} onSelectAlert={alert=>setSelectedAlertId(alert.id)} mission={mission} ambulanceRanking={ambulanceRanking} hospitalRanking={hospitalRanking} onAssign={assignAmbulance} onAdvanceMission={advanceMission} onResetMission={resetCurrentMission} onSimulateCongestion={simulateCongestion} onConfirmOrientation={confirmOrientation} onNavigate={setActivePage} onSimulateMobile={simulateMobileAlert} mobileFeedStatus={mobileFeedStatus} dataMode={dataMode}/>; break
    case 'ambulances': content=<Ambulances ambulances={ambulanceRanking} mission={mission} onNavigate={setActivePage} onNotify={notify}/>; break
    case 'hospitals': content=<Hospitals hospitals={hospitalRanking} onUpdateHospital={updateHealthCenter} onNavigate={setActivePage} onNotify={notify}/>; break
    case 'routing': content=<Routing alerts={alerts} ambulances={ambulanceFleet} mission={mission} onReroute={simulateCongestion} onNavigate={setActivePage} onNotify={notify}/>; break
    case 'orientation': content=<Orientation alerts={alerts} ambulances={ambulanceFleet} hospitals={healthCenters} mission={mission} onConfirm={confirmOrientation} onNotify={notify}/>; break
    case 'statistics': content=<Statistics alerts={alerts} ambulances={ambulanceFleet} hospitals={healthCenters} mission={mission} missionHistory={missionHistory} auditLog={auditLog} metrics={metrics} fog={fog} mobileFeedStatus={mobileFeedStatus} dataMode={dataMode} onNotify={notify}/>; break
    case 'mission-reports': content=<MissionReports missions={missionHistory} mission={mission} onNavigate={setActivePage}/>; break
    case 'evaluation': content=<Evaluation metrics={metrics} fog={fog} onRunDemo={startDemo} onResetMetrics={()=>setMetrics([])}/>; break
    case 'fog': content=<Fog fog={fog} onQueueTest={queueTestEvent} onNotify={notify}/>; break
    case 'system-health': content=<SystemHealth health={systemHealth} mobileFeedStatus={mobileFeedStatus} dataMode={dataMode} realQueueCount={realEventQueue.length} fog={fog} onRefresh={runSystemHealthCheck} onNavigate={setActivePage}/>; break
    case 'security': content=<Security operator={operator} securityConfig={securityConfig} onUpdateSecurity={updateSecurity} onChangeRole={changeOperatorRole} auditLog={auditLog} onNavigate={setActivePage} dataMode={dataMode}/>; break
    case 'settings': content=<Settings onNotify={notify} mobileFeedStatus={mobileFeedStatus} dataMode={dataMode} onChangeDataMode={changeDataMode} realQueueCount={realEventQueue.length} mobileConfig={mobileConfig} fog={fog} onRunHealthCheck={runSystemHealthCheck}/>; break
    case 'audit': content=<Audit events={auditLog}/>; break
    default: content=<Dashboard alerts={alerts} ambulances={ambulanceFleet} hospitals={healthCenters} hospitalRanking={hospitalRanking} mission={mission} onNavigate={setActivePage} onSimulateMobile={simulateMobileAlert} onOpenAlert={openAlertOnMap} onStartDemo={startDemo} fog={fog}/>; break
  }

  const incidentMovement=demoStep===4&&mission?.status==='En route'
  const onScenePause=demoStep===4&&mission?.status==='Sur place'
  const hospitalMovement=demoStep===6&&mission?.status==='Vers le centre de santé'
  const hospitalHandoff=demoStep===7&&mission?.status==='Pris en charge'
  const movementStep=incidentMovement||hospitalMovement
  const demoBlockedUntil=incidentMovement&&mission?.startedAt
    ?mission.startedAt+(mission.animationDuration||mission.duration||DEMO_INCIDENT_TRAVEL_MS)
    :onScenePause&&mission?.incidentArrivedAt
      ?new Date(mission.incidentArrivedAt).getTime()+DEMO_ON_SCENE_MS
      :hospitalMovement&&mission?.startedAt
        ?mission.startedAt+(mission.animationDuration||mission.duration||DEMO_HOSPITAL_TRAVEL_MS)
        :hospitalHandoff&&mission?.hospitalArrivedAt
          ?new Date(mission.hospitalArrivedAt).getTime()+1200
          :null
  const demoBlocked=Boolean(demoDecisionPending)||(demoStep===3&&mission?.routeState==='loading')
  const demoBlockedMessage=demoDecisionPending?'Validation opérateur attendue':demoStep===3&&mission?.routeState==='loading'?'Calcul de l’itinéraire en cours':onScenePause?'Intervention sur les lieux en cours':hospitalHandoff?'Remise à l’hôpital en cours':movementStep?'Déplacement de l’ambulance en cours':null

  if(!isAuthenticated){
    return <Login onLoginSuccess={handleLoginSuccess} onStartDemo={handleStartDemoFromLogin}/>
  }

  return <><Layout activePage={activePage} onNavigate={setActivePage} portal={portal} onChangePortal={changePortal} notice={notice} onDismissNotice={()=>setNotice(null)} soundsEnabled={soundsEnabled} onToggleSounds={toggleSounds} mobileFeedStatus={mobileFeedStatus} dataMode={dataMode} operator={operator} fog={fog} onLogout={handleLogout} demo={{active:demoMode,busy:demoBusy,blocked:demoBlocked,blockedUntil:demoBlockedUntil,blockedMessage:demoBlockedMessage,step:demoStep,steps:DEMO_STEPS,onToggle:toggleDemo,onNext:runNextDemoStep,onStepClick:openDemoStep,onReset:()=>{setDemoStep(0);setDemoDecisionPending(null);resetOperationalState()}}}>{content}</Layout><DecisionReviewDialog review={decisionReview} operator={operator} onSelectCandidate={candidate=>setDecisionReview(current=>current?{...current,candidate}:current)} onConfirm={confirmDecisionReview} onCancel={cancelDecisionReview}/></>
}
