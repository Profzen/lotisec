import { useEffect, useMemo, useRef, useState } from 'react'
import Layout from './components/Layout'
import Login from './components/Login'
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
import { api, getAuthToken, setAuthToken } from './services/api'
import { subscribeToRealtime } from './services/realtime'
import { useFogEngine } from './hooks/useFogEngine'
import { announceAmbulanceAssignment, announceCongestion, announceMissionStage, announceNewIncident, announcePreDepartureDecision, getSoundsEnabled, playTargetLock, setSoundsEnabled as persistSounds, stopOperationalAudio, unlockSound } from './lib/sound'

const MISSION_STAGES=['Analyse trafic','Affectée','En route','Sur place','Orientation hospitalière','Vers le centre de santé','Pris en charge','Terminée']
const DEMO_STEPS=[
  {label:'Signalement',detail:'Réception mobile, alerte sonore et localisation'},
  {label:'Validation',detail:'Contrôle humain et validation traçable du signalement'},
  {label:'Affectation & trafic',detail:'Ambulance recommandée, congestion détectée avant départ'},
  {label:'Départ guidé',detail:'Itinéraire alternatif retenu et déplacement de l’ambulance'},
  {label:'Décision hôpital',detail:'Recommandation et validation humaine de l’hôpital'},
  {label:'Fog hors ligne',detail:'Coupure réseau et conservation locale des données'},
  {label:'Synchronisation',detail:'Retour du réseau et reprise Fog–Cloud'},
  {label:'Bilan',detail:'Mission clôturée et comparaison prévision/réalité'},
]
const DEMO_INTERVAL_SECONDS=10
const INITIAL_AUDIT=[
  {id:'AUD-3',time:'18:42:20',actor:'Système GPS',category:'mission',tone:'green',action:'Position ambulance synchronisée',details:'AMB-07 a transmis une nouvelle position terrain.',reference:'AMB-07'},
  {id:'AUD-2',time:'18:41:08',actor:'Centre de santé',category:'system',tone:'green',action:'Capacité mise à jour',details:'Le CHU Tokoin déclare 5 places disponibles.',reference:'HSP-01'},
  {id:'AUD-1',time:'18:40:12',actor:'Application mobile',category:'mobile',tone:'red',action:'Urgence reçue',details:'Accident de la route localisé au Boulevard du 13 Janvier.',reference:'ALT-2026-081'},
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

function normalizeBackendIncident(inc) {
  const lat = Number(inc.latitude || inc.lat || 6.1375)
  const lng = Number(inc.longitude || inc.lng || 1.2125)
  const statusMap = {
    new: 'Nouveau',
    validated: 'Validée',
    rejected: 'Rejetée',
    assigned: 'Affectée',
    en_route: 'En route',
    on_scene: 'Sur place',
    transporting: 'Vers le centre de santé',
    admitted: 'Pris en charge',
    closed: 'Terminée',
  }
  return {
    id: String(inc.id || `INC-${Date.now()}`),
    externalId: String(inc.client_event_id || inc.id || ''),
    type: inc.type || 'Urgence signalée depuis le mobile',
    severity: inc.severity === 'critical' ? 'Critique' : inc.severity === 'high' ? 'Élevée' : 'Moyenne',
    location: inc.address || `Lomé (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    victims: Number(inc.victims || 1),
    vehicles: Number(inc.vehicles || 1),
    lat,
    lng,
    accuracy: inc.accuracy ? `${inc.accuracy} m` : 'GPS mobile',
    status: statusMap[inc.status] || inc.status || 'Nouveau',
    source: inc.source === 'mobile' ? 'Application mobile réelle' : 'Web Citoyen',
    receivedAt: inc.created_at || new Date().toISOString(),
    received: new Date(inc.created_at || Date.now()).toLocaleTimeString('fr-FR'),
    messageState: inc.status === 'new' ? 'Reçu · en attente de validation' : 'Validé · en cours',
    connectionState: 'Temps réel Supabase / API',
    raw: inc,
  }
}

function normalizeBackendResource(res) {
  const lat = Number(res.latitude || 6.137)
  const lng = Number(res.longitude || 1.212)
  return {
    id: String(res.call_sign || res.registration || res.id || 'AMB-01'),
    dbId: res.id,
    organization_id: res.organization_id,
    name: res.name || `Unité ${res.call_sign || res.registration || ''}`,
    type: res.type === 'fire_truck' ? 'Sapeurs-Pompiers' : 'Ambulance',
    status: res.status === 'available' ? 'Disponible' : res.status === 'assigned' ? 'En mission' : 'Indisponible',
    lat,
    lng,
    operator: res.organization_name || 'Service d’Urgence',
    phone: '118',
    updated: "à l'instant",
    gpsSource: 'GPS réel',
    battery: 98,
    fuel: 85,
    speed: Number(res.speed || 0),
    heading: Number(res.heading || 0),
  }
}

function normalizeBackendFacility(fac) {
  return {
    id: String(fac.id || 'HSP-01'),
    name: fac.name || 'Hôpital',
    address: fac.address || 'Lomé, Togo',
    lat: Number(fac.latitude || 6.16),
    lng: Number(fac.longitude || 1.22),
    beds: Number(fac.available_beds ?? fac.capacity?.available_beds ?? 8),
    occupancy: Number(fac.occupancy ?? 72),
    reception: fac.reception || 'Ouverte',
    type: fac.type || 'Hôpital public',
    emergencyPhone: fac.phone || '118',
    lastCapacityUpdate: "à l'instant",
  }
}

export default function App(){
  const initialLocation=useMemo(()=>initialPortalLocation(),[])
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAuthToken()))
  const [portal,setPortal]=useState(initialLocation.portal)
  const [activePage,setActivePage]=useState(initialLocation.page)
  const [mission,setMission]=useState(null)
  const [alerts,setAlerts]=useState(mobileConfig.operationMode==='real'?[]:initialAlerts)
  const [ambulanceFleet,setAmbulanceFleet]=useState(initialAmbulances)
  const [healthCenters,setHealthCenters]=useState(initialHospitals)
  const [auditLog,setAuditLog]=useState(mobileConfig.operationMode==='real'?[]:INITIAL_AUDIT)
  const [selectedAlertId,setSelectedAlertId]=useState(mobileConfig.operationMode==='real'?'':initialAlerts[0].id)
  const [notice,setNotice]=useState(null)
  const [mobileFeedStatus,setMobileFeedStatus]=useState(mobileConfig.operationMode==='real'?'connected':'demo')
  const [dataMode,setDataMode]=useState(mobileConfig.operationMode)
  const [realEventQueue,setRealEventQueue]=useState([])
  const [soundsEnabled,setSoundsEnabled]=useState(getSoundsEnabled())
  const [metrics,setMetrics]=useState([])
  const [missionHistory,setMissionHistory]=useState([])
  const [decisionReview,setDecisionReview]=useState(null)
  const [operator,setOperator]=useState(DEFAULT_OPERATOR)
  const [securityConfig,setSecurityConfig]=useState({requireHumanValidation:true,anonymizeVictims:true,auditEnabled:true,isolateTestData:true})
  const [systemHealth,setSystemHealth]=useState({checking:false,lastCheckedAt:null,backendLatency:null,backendVersion:null,services:[]})
  const [demoMode,setDemoMode]=useState(false)
  const [demoStep,setDemoStep]=useState(0)
  const [demoAuto,setDemoAuto]=useState(false)
  const [demoBusy,setDemoBusy]=useState(false)
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
    if(next!=='operations'){setDemoMode(false);setDemoAuto(false);stopOperationalAudio()}
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
    recordAudit(alreadyKnown?'Signalement mobile actualisé':real?'Urgence mobile reçue':'Signalement mobile reçu',`${enriched.type} · ${enriched.location} · ${enriched.victims} victime(s) · GPS ${enriched.accuracy}`,{category:'mobile',tone:alreadyKnown?'blue':'red',reference:enriched.id,actor:real?'Application mobile réelle':'Application mobile — mode test'})
    fog.enqueue('incident.mobile',enriched,enriched.source)
    recordMetric('Traitement du signalement',performance.now()-started,'ms','Flux mobile','Réception, normalisation, alerte sonore et ciblage cartographique')
    return enriched
  }

  const simulateMobileAlert=()=>{
    if(dataModeRef.current!=='test'){notify('Le simulateur est isolé : activez le bac à sable test pour l’utiliser','amber');return null}
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
    recordAudit('Environnement de données changé',next==='test'?'Bac à sable test restauré, sans données terrain.':`Flux réel activé · ${queued.length} événement(s) isolé(s) importé(s).`,{category:'security',tone:next==='test'?'blue':'green',reference:'DATA-MODE',dataMode:next})
    notify(next==='test'?'Bac à sable test restauré':'Flux mobile réel activé','green')
  }

  // Real Backend Synchronization & Realtime hook
  useEffect(() => {
    if (!isAuthenticated || dataMode !== 'real') return;

    let unsubscribe = null;
    const loadRealData = async () => {
      try {
        const [incRes, resRes, facRes, auditRes] = await Promise.allSettled([
          api.getIncidents(),
          api.getResources(),
          api.getFacilities(),
          api.getAudit(),
        ]);

        if (incRes.status === 'fulfilled' && incRes.value) {
          const list = Array.isArray(incRes.value) ? incRes.value : incRes.value.incidents || [];
          if (list.length > 0) {
            const normalized = list.map(normalizeBackendIncident);
            setAlerts(normalized);
            if (!selectedAlertId && normalized[0]) setSelectedAlertId(normalized[0].id);
            seenIncidentIds.current = new Set(normalized.map((i) => i.id));
          }
        }

        if (resRes.status === 'fulfilled' && resRes.value) {
          const list = Array.isArray(resRes.value) ? resRes.value : resRes.value.resources || [];
          if (list.length > 0) {
            setAmbulanceFleet(list.map(normalizeBackendResource));
          }
        }

        if (facRes.status === 'fulfilled' && facRes.value) {
          const list = Array.isArray(facRes.value) ? facRes.value : facRes.value.facilities || [];
          if (list.length > 0) {
            setHealthCenters(list.map(normalizeBackendFacility));
          }
        }

        if (auditRes.status === 'fulfilled' && auditRes.value) {
          const list = Array.isArray(auditRes.value) ? auditRes.value : auditRes.value.logs || [];
          if (list.length > 0) {
            const mapped = list.map((a) => ({
              id: String(a.id),
              time: new Date(a.created_at || Date.now()).toLocaleTimeString('fr-FR'),
              actor: a.actor_id || 'Système',
              category: 'system',
              tone: 'blue',
              action: a.action || 'Événement',
              details: JSON.stringify(a.metadata || {}),
              reference: a.entity_id || 'SYSTÈME',
            }));
            setAuditLog(mapped);
          }
        }

        setMobileFeedStatus('connected');
      } catch (err) {
        console.warn('Failed to load initial real data:', err);
      }
    };

    loadRealData();

    // Subscribe to live events
    unsubscribe = subscribeToRealtime({
      onIncident: (rawIncident) => {
        if (!rawIncident) return;
        const norm = normalizeBackendIncident(rawIncident);
        receiveIncident(norm, { real: true });
      },
      onResource: (rawResource) => {
        if (!rawResource) return;
        const norm = normalizeBackendResource(rawResource);
        setAmbulanceFleet((prev) => {
          const exists = prev.some((u) => u.id === norm.id || u.dbId === norm.dbId);
          if (exists) {
            return prev.map((u) => (u.id === norm.id || u.dbId === norm.dbId ? { ...u, ...norm } : u));
          }
          return [norm, ...prev];
        });
      },
      onAdmission: (rawFac) => {
        if (!rawFac) return;
        const norm = normalizeBackendFacility(rawFac);
        setHealthCenters((prev) => prev.map((f) => (f.id === norm.id ? { ...f, ...norm } : f)));
      },
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, dataMode]);

  const toggleSounds=()=>{
    const next=!soundsEnabled
    setSoundsEnabled(next);persistSounds(next)
    if(next) playTargetLock()
    notify(next?'Sons opérationnels activés':'Sons opérationnels coupés')
  }

  const updateAlert=async(id,status,options={})=>{
    if(!requireOperate('modifier le statut d’un signalement')) return
    setAlerts(current=>current.map(alert=>alert.id===id?{...alert,status,messageState:status==='Validée'?'Reçu · normalisé · validé par l’opérateur':status==='Rejetée'?'Reçu · contrôlé · rejeté':alert.messageState}:alert))
    if(!options.silent) notify(status==='Rejetée'?'Alerte classée comme rejetée':`Alerte ${status.toLowerCase()}` ,status==='Rejetée'?'red':'green')
    recordAudit(`Alerte ${status.toLowerCase()}`,`Le statut du signalement ${id} a été modifié par validation humaine.`,{category:'security',tone:status==='Rejetée'?'red':'green',reference:id,actor:options.actor||operator.name})
    publishRealtime('incident:status:update',{incidentId:id,status,operatorId:operator.id,operatorRole:operator.role})

    if (dataModeRef.current === 'real') {
      try {
        const dbStatus = status === 'Validée' ? 'validated' : status === 'Rejetée' ? 'rejected' : 'new';
        await api.updateIncidentStatus(id, dbStatus, 'Validé depuis la console LOTISEC PRO');
      } catch (err) {
        console.warn('Failed to update incident in backend:', err.message);
      }
    }
  }

  const performAssignment=async(ambulance,alertId=selectedAlertId,validation={})=>{
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
      duration:48000,
      animationDuration:48000,
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
    recordAudit('Affectation validée par l’opérateur',`${chosenAmbulance.id} a été affectée à ${targetId} · score ${ambulanceDecision.decisionScore} % · ${validation.note||'Recommandation conforme.'}`,{category:'security',tone:'green',reference:missionId,actor:validation.operator||operator.name,operatorId:validation.operatorId||operator.id,operatorRole:validation.role||operator.role})
    recordAudit('Analyse pré-départ lancée',`${chosenAmbulance.id} réservée pour ${targetId} · comparaison des axes avant mouvement.`,{category:'mission',tone:'blue',reference:missionId,actor:'Moteur trafic'})
    fog.enqueue('mission.assignment',{missionId,alertId:targetId,ambulanceId:chosenAmbulance.id,hospitalId:nearestHospital?.id,ambulanceScore:ambulanceDecision.decisionScore,hospitalScore:hospitalDecision?.decisionScore},'Moteur géodécisionnel')
    publishRealtime('mission:created',{missionId,incidentId:targetId,ambulanceId:chosenAmbulance.id,recommendedHospitalId:nearestHospital?.id||null,status:'Affectée',ambulanceScore:ambulanceDecision.decisionScore,hospitalScore:hospitalDecision?.decisionScore})
    recordMetric('Décision géospatiale',performance.now()-decisionStarted,'ms','Moteur de recommandation','Classement explicable des ambulances et centres de santé')
    
    // Backend mutation if in real mode
    if (dataModeRef.current === 'real') {
      try {
        await api.assignIncident(targetId, {
          organization_id: chosenAmbulance.organization_id || null,
          response_unit_id: chosenAmbulance.dbId || null,
          assigned_to: null,
        });
      } catch (err) {
        console.warn('Failed to assign incident in backend:', err.message);
      }
    }

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
      const departureDelay=demoMode?DEMO_INTERVAL_SECONDS*1000:6000
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
      if(congestionDetected) announcePreDepartureDecision({ambulanceId:chosenAmbulance.id,road:congestedRoad,route:selectedMeta.name,eta:selectedMeta.eta})
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
      const stageHistory=[...(current.stageHistory||[]),{status:next,at:new Date().toISOString(),actor:operator.name}]
      if(next==='En route') return {...current,status:next,leg:'incident',startedAt:now,duration:48000,animationDuration:48000,stageHistory}
      if(next==='Sur place') return {...current,status:next,startedAt:current.startedAt||now,stageHistory}
      if(next==='Vers le centre de santé') return {...current,status:next,leg:'hospital',route:current.hospitalRoute||current.route,routeMeta:current.hospitalRouteMeta||current.routeMeta,startedAt:now,duration:36000,animationDuration:36000,stageHistory}
      return {...current,status:next,stageHistory}
    })
  }

  const assignAmbulance=(ambulance,alertId=selectedAlertId,options={})=>{
    if(!requireOperate('affecter une ambulance')) return
    const targetAlert=alerts.find(item=>item.id===alertId)||alerts[0]
    const ranked=rankAmbulances(targetAlert,ambulanceFleet)
    const candidate=ambulance||ranked.find(item=>item.recommended)||ranked[0]
    if(!candidate) return notify('Aucune ambulance disponible pour cette affectation','red')
    if(options.autoApprove||!securityConfig.requireHumanValidation) return performAssignment(candidate,alertId,{operator:options.operator||operator.name,operatorId:options.operatorId||operator.id,role:options.role||operator.role,note:options.note||'Validation opérateur du mode test contrôlé.'})
    setDecisionReview({type:'assignment',alert:targetAlert,candidate,ranking:ranked,defaultNote:'Ambulance la plus rapide selon le trafic pré-départ et la disponibilité déclarée.'})
    recordAudit('Affectation soumise à validation',`${candidate.id} est proposée avec un score de ${candidate.decisionScore} %.`,{category:'security',tone:'blue',reference:alertId})
  }

  const advanceMission=nextStatus=>{
    if(!requireOperate('faire progresser une mission')) return
    if(!mission) return notify('Aucune mission active à faire progresser','red')
    const currentIndex=MISSION_STAGES.indexOf(mission.status)
    const next=nextStatus||MISSION_STAGES[Math.min(MISSION_STAGES.length-1,currentIndex+1)]
    if(next===mission.status) return
    transitionMission(next)
    announceMissionStage({ambulanceId:mission.ambulanceId,stage:next})
    recordAudit('Statut de mission mis à jour',`${mission.ambulanceId} → ${next}`,{category:'mission',tone:'green',reference:mission.id})
    notify(`Mission ${mission.ambulanceId} : ${next}`,'green')
    publishRealtime('mission:status:update',{missionId:mission.id,ambulanceId:mission.ambulanceId,status:next})
    if(next==='Terminée'){
      const closedAt=Date.now()
      const durationSeconds=Math.max(12,Math.round((closedAt-(mission.createdAt||closedAt))/1000))
      const completedMission={...mission,status:'Terminée',closedAt,durationSeconds,plannedDistance:mission.plannedDistance||mission.routeMeta?.distance||14.2,actualDistance:mission.actualDistance||mission.routeMeta?.distance||14.8,plannedDuration:mission.plannedEta?`${mission.plannedEta} min`:'18 min',actualDuration:`${Math.max(1,Math.round(durationSeconds/60))} min`,summary:'Mission clôturée avec succès.'}
      setMissionHistory(current=>[completedMission,...current])
      setAmbulanceFleet(current=>current.map(item=>item.id===mission.ambulanceId?{...item,status:'Disponible',updated:"à l'instant"}:item))
      setAlerts(current=>current.map(item=>item.id===mission.alertId?{...item,status:'Terminée',messageState:'Mission terminée · dossier clôturé'}:item))
      fog.enqueue('mission.completion',{missionId:mission.id,alertId:mission.alertId,ambulanceId:mission.ambulanceId,durationSeconds},'Opérateur LOTISEC')
    }
  }

  const simulateCongestion=()=>{
    if(!requireOperate('simuler une congestion')) return
    if(!mission) return notify('Affectez d’abord une ambulance pour simuler un reroutage','red')
    if(!mission.alternatives?.length) return notify('Aucun itinéraire alternatif disponible pour ce tronçon','amber')
    const nextRoute=mission.alternatives[0]
    const remainingAlternatives=mission.alternatives.slice(1)
    const nextRerouteCount=(mission.rerouteCount||0)+1
    const congestedRoad=mission.routeMeta?.steps?.find(step=>!['Point de départ','Zone de destination','Voie locale non nommée'].includes(step.road))?.road||'Boulevard principal'
    announceCongestion({ambulanceId:mission.ambulanceId,road:congestedRoad,eta:Math.round((mission.plannedEta||18)*1.25)})
    setMission(current=>current?{...current,congestion:true,rerouteCount:nextRerouteCount,route:nextRoute,alternatives:remainingAlternatives,routeMeta:{...current.routeMeta,engine:`${current.routeMeta?.engine||'OSRM'} · reroutage dynamique #${nextRerouteCount}`}}:current)
    recordAudit('Reroutage dynamique appliqué',`${congestedRoad} bloqué · passage sur itinéraire de dégagement.`,{category:'mission',tone:'red',reference:mission.id,actor:'Moteur trafic'})
    notify(`Trafic dense sur ${congestedRoad} : itinéraire de dégagement activé`,'red')
    publishRealtime('mission:rerouted',{missionId:mission.id,ambulanceId:mission.ambulanceId,rerouteCount:nextRerouteCount,reason:`Congestion sur ${congestedRoad}`})
  }

  const updateHealthCenter=async(id,changes)=>{
    if(!requireOperate('modifier la capacité d’un hôpital')) return
    const center=healthCenters.find(item=>item.id===id)
    setHealthCenters(current=>current.map(item=>item.id===id?{...item,...changes,lastCapacityUpdate:"à l'instant"}:item))
    notify(`Capacité de ${center?.name||'ce centre de santé'} mise à jour`,'green')
    recordAudit('Capacité mise à jour',`${center?.name||id} · ${changes.beds??center?.beds} place(s) disponible(s).`,{category:'system',tone:'green',reference:id,actor:'Centre de santé'})
    fog.enqueue('health-center.capacity',{id,...changes,updatedAt:new Date().toISOString()},'Portail centre de santé')
    publishRealtime('hospital:capacity:update',{hospitalId:id,...changes})

    if (dataModeRef.current === 'real') {
      try {
        await api.updateCapacities(id, {
          available_beds: changes.beds,
          icu_beds: changes.icuBeds,
        });
      } catch (err) {
        console.warn('Failed to update capacities in backend:', err.message);
      }
    }
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
    const alert=alerts.find(item=>item.id===mission?.alertId)||activeAlert
    const ranking=rankHospitals(alert,healthCenters)
    const candidate=hospital||ranking.find(item=>item.recommended)||ranking[0]
    if(!candidate) return notify('Aucun hôpital disponible pour cette orientation','red')
    if(options.autoApprove||!securityConfig.requireHumanValidation) return performOrientation(candidate,{operator:options.operator||operator.name,operatorId:options.operatorId||operator.id,role:options.role||operator.role,note:options.note||'Validation opérateur du mode test contrôlé.'})
    setDecisionReview({type:'orientation',alert,candidate,ranking,defaultNote:'Hôpital retenu selon le délai, la capacité et la spécialité requise.'})
    recordAudit('Orientation soumise à validation',`${candidate.name} est proposé avec un score de ${candidate.decisionScore} %.`,{category:'security',tone:'blue',reference:mission?.id||alert?.id})
  }

  const confirmDecisionReview=note=>{
    const review=decisionReview
    if(!review) return
    setDecisionReview(null)
    if(review.type==='assignment'){
      if(review.alert.status!=='Validée') updateAlert(review.alert.id,'Validée',{silent:true})
      performAssignment(review.candidate,review.alert.id,{operator:operator.name,operatorId:operator.id,role:operator.role,note})
    }else performOrientation(review.candidate,{operator:operator.name,operatorId:operator.id,role:operator.role,note})
  }

  const cancelDecisionReview=reason=>{
    if(decisionReview) recordAudit('Décision non exécutée',`${decisionReview.type==='assignment'?'Affectation':'Orientation'} : ${reason||'validation annulée'}.`,{category:'security',tone:'amber',reference:decisionReview.alert?.id})
    setDecisionReview(null)
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
      {id:'mobile',name:'Passerelle application mobile',status:mobileFeedStatus==='connected'?'operational':mobileConfig.socketUrl?'degraded':'ready',detail:mobileFeedStatus==='connected'?'Canal réel authentifié et événements écoutés.':mobileConfig.socketUrl?'Configuration présente, connexion indisponible.':'Adaptateur prêt ; URL Socket.IO non renseignée.',lastSignal:mobileFeedStatus==='connected'?now:'—'},
      {id:'realtime',name:'Socket.IO / Supabase temps réel',status:mobileFeedStatus==='connected'?'operational':mobileConfig.socketUrl?'degraded':'ready',detail:`Namespace ${mobileConfig.namespace} · chemin ${mobileConfig.socketPath} · reconnexion automatique.`,lastSignal:mobileFeedStatus==='connected'?now:'—'},
      {id:'api',name:'API Backend Express / Node.js',status:backend.ok?'operational':backend.configured?'degraded':'ready',detail:backend.ok?'Endpoint /health accessible et réponse valide.':backend.configured?(backend.error||`Réponse HTTP ${backend.status||'indisponible'}.`):'Backend LOTISEC connecté.',lastSignal:backend.ok?now:'—',latency:backend.latency},
      {id:'database',name:'Supabase PostgreSQL + PostGIS',status:backend.ok&&(backend.components?.postgis?.ok||backend.components?.database?.ok||backend.db==='up')?'operational':backend.ok?'operational':'ready',detail:backend.ok?'Base opérationnelle active.':'La base géographique est synchronisée via l’API sécurisée.',lastSignal:backend.ok?now:'—'},
      {id:'routing',name:'Moteur de routage OSRM',status:routeEngine?'operational':'ready',detail:routeEngine?`${routeEngine} · dernier itinéraire ${mission.routeMeta?.distance||'—'} km.`:'OSRM et moteur de repli local prêts pour le prochain calcul.',lastSignal:routeEngine?now:'—'},
      {id:'fog',name:'Continuité Fog locale',status:fog.effectiveMode==='offline'?'degraded':'operational',detail:`Mode ${fog.quality.label.toLowerCase()} · ${fog.queue.length} élément(s) dans la file persistante.`,lastSignal:fog.lastSync||now},
      {id:'audit',name:'Journal de traçabilité',status:securityConfig.auditEnabled?'operational':'offline',detail:`${auditLog.length} événement(s) horodaté(s), actions sensibles attribuées à un rôle.`,lastSignal:auditLog[0]?.time||'—'},
    ]
    setSystemHealth({checking:false,lastCheckedAt:now,backendLatency:backend.latency,backendVersion:backend.version,services})
    return {backend,services}
  }

  const changeOperatorRole=role=>{
    const nextRole=ROLE_ACTIONS[role]?role:'Observateur'
    const previous=operator.role
    setOperator(current=>({...current,role:nextRole}))
    recordAudit('Rôle de session modifié',`${previous} → ${nextRole} dans l’environnement ${dataModeRef.current}.`,{category:'security',tone:'blue',reference:operator.id,operatorRole:nextRole})
    notify(`Session active : rôle ${nextRole}`,'blue')
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
    setMission(null);setMissionHistory([]);setDecisionReview(null);missionStatusKeyRef.current='';setSelectedAlertId(initialAlerts[0].id);setAuditLog(INITIAL_AUDIT);setActivePage('dashboard')
    if(!keepMetrics) setMetrics([])
    await fog.reset()
    notify('Mode test LOTISEC réinitialisé et prêt','blue')
  }

  const startDemo=async(auto=true)=>{
    if(dataModeRef.current!=='test') changeDataMode('test')
    if(operator.role==='Observateur') setOperator(current=>({...current,role:'Opérateur'}))
    setDemoMode(true);setDemoStep(0);setDemoAuto(Boolean(auto));setDemoBusy(false)
    await resetOperationalState()
    notify(auto?'Mode test automatique activé':'Mode test manuel activé','blue')
  }

  const runNextDemoStep=async()=>{
    if(demoBusy||demoStep>=DEMO_STEPS.length) return
    setDemoBusy(true)
    const step=demoStep
    try{
      if(step===0) simulateMobileAlert()
      if(step===1){
      const incident=alerts.find(item=>item.id===selectedAlertId)||alerts[0]
      if(incident) updateAlert(incident.id,'Validée',{actor:'Opérateur du mode test'})
      setActivePage('alerts')
      }
      if(step===2){
      const incident=alerts.find(item=>item.id===selectedAlertId)||alerts[0]
      const recommended=rankAmbulances(incident,ambulanceFleet).find(item=>item.recommended)||rankAmbulances(incident,ambulanceFleet)[0]
      assignAmbulance(recommended,incident.id,{autoApprove:true,operator:'Opérateur du mode test',operatorId:'USR-TEST-001',role:'Opérateur',note:'Ambulance recommandée confirmée après comparaison des scores.'})
      }
      if(step===3){
      if(['Analyse trafic','Affectée'].includes(mission?.status)) transitionMission('En route')
      setActivePage('map')
      }
      if(step===4){
      const incident=alerts.find(item=>item.id===mission?.alertId)||activeAlert
      const recommended=rankHospitals(incident,healthCenters).find(item=>item.id===mission?.recommendedHospitalId)||rankHospitals(incident,healthCenters).find(item=>item.recommended)
      if(recommended) confirmOrientation(recommended,{autoApprove:true,operator:'Opérateur du mode test',operatorId:'USR-TEST-001',role:'Opérateur',note:'Hôpital confirmé selon ETA, capacité disponible et spécialité.'})
      setActivePage('map')
      }
      if(step===5){
      fog.setNetworkMode('offline')
      await fog.enqueue('ambulance.position',{missionId:mission?.id,lat:6.1531,lng:1.2117,capturedAt:new Date().toISOString()},'GPS ambulance hors ligne')
      setActivePage('fog')
      }
      if(step===6){
      fog.setNetworkMode('normal')
      setActivePage('fog')
      await fog.syncNow(true)
      }
      if(step===7){
      advanceMission('Terminée')
      setActivePage('mission-reports')
      }
      setDemoStep(current=>Math.min(DEMO_STEPS.length,current+1))
      if(step===DEMO_STEPS.length-1){setDemoAuto(false);setDemoMode(false)}
    }finally{setDemoBusy(false)}
  }

  useEffect(()=>{
    if(!demoMode||!demoAuto||demoBusy||demoStep>=DEMO_STEPS.length) return undefined
    const timer=setTimeout(()=>runNextDemoStep(),DEMO_INTERVAL_SECONDS*1000)
    return ()=>clearTimeout(timer)
  },[demoMode,demoAuto,demoBusy,demoStep])

  const toggleDemo=()=>demoMode?setDemoMode(false):startDemo(false)

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setMission(null);
    notify('Déconnexion réussie', 'blue');
  };

  // If user is not authenticated, show Login screen
  if (!isAuthenticated) {
    return (
      <Login
        onLoginSuccess={(user, mode = 'real') => {
          setOperator(user);
          setIsAuthenticated(true);
          setDataMode(mode);
          dataModeRef.current = mode;
          notify(`Bienvenue, ${user.name} (${user.role})`, 'green');
        }}
        onStartDemo={() => {
          setOperator({ id: 'DEMO-USER', name: 'Opérateur Démo', role: 'Administrateur', authenticated: true });
          setIsAuthenticated(true);
          setDataMode('test');
          dataModeRef.current = 'test';
          startDemo(false);
        }}
      />
    );
  }

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

  return <><Layout activePage={activePage} onNavigate={setActivePage} portal={portal} onChangePortal={changePortal} notice={notice} onDismissNotice={()=>setNotice(null)} soundsEnabled={soundsEnabled} onToggleSounds={toggleSounds} mobileFeedStatus={mobileFeedStatus} dataMode={dataMode} operator={operator} fog={fog} demo={{active:demoMode,auto:demoAuto,busy:demoBusy,step:demoStep,steps:DEMO_STEPS,intervalSeconds:DEMO_INTERVAL_SECONDS,onToggle:toggleDemo,onNext:runNextDemoStep,onAuto:()=>setDemoAuto(value=>!value),onReset:()=>{setDemoAuto(false);setDemoStep(0);resetOperationalState()}}} onLogout={handleLogout}>{content}</Layout><DecisionReviewDialog review={decisionReview} operator={operator} onConfirm={confirmDecisionReview} onCancel={cancelDecisionReview}/></>
}
