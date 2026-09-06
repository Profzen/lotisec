import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { BedDouble, Crosshair, MapPin, Minus, Plus, X } from 'lucide-react'
import { playTargetLock } from '../lib/sound'
import { useMissionProgress } from '../hooks/useMissionProgress'

const EMPTY=[]
const OSM_STYLE={
  version:8,
  sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},
  layers:[{id:'osm',type:'raster',source:'osm'}],
}

const ROUTE_COLORS=['#2563eb','#f59e0b','#64748b']

function routeFor(ambulance,alert,variant=0){
  const routes=[
    [[ambulance.lng,ambulance.lat],[1.2112,6.1471],[1.2137,6.1498],[1.2162,6.1510],[1.2181,6.1470],[alert.lng,alert.lat]],
    [[ambulance.lng,ambulance.lat],[1.2078,6.1438],[1.2118,6.1403],[1.2170,6.1394],[alert.lng,alert.lat]],
    [[ambulance.lng,ambulance.lat],[1.2144,6.1552],[1.2216,6.1557],[1.2240,6.1490],[alert.lng,alert.lat]],
  ]
  return routes[variant]||routes[0]
}

function routeOptionsFor(ambulance,alert,mission,includeAlternatives=false){
  if(mission?.route?.length){
    const options=[mission.route,...(mission.alternatives||[]).filter(route=>route!==mission.route)]
    return includeAlternatives?options.slice(0,3):[mission.route]
  }
  return Array.from({length:includeAlternatives?3:1},(_,index)=>routeFor(ambulance,alert,index))
}

function splitRoute(points,progress){
  const lengths=points.slice(1).map((point,index)=>Math.hypot(point[0]-points[index][0],point[1]-points[index][1]))
  const total=lengths.reduce((sum,length)=>sum+length,0)
  let distance=total*progress
  const travelled=[points[0]]
  for(let index=0;index<lengths.length;index++){
    const start=points[index],end=points[index+1],length=lengths[index]
    if(distance<=length){
      const ratio=length===0?0:distance/length
      const current=[start[0]+(end[0]-start[0])*ratio,start[1]+(end[1]-start[1])*ratio]
      travelled.push(current)
      return {current,travelled,remaining:[current,...points.slice(index+1)],next:end}
    }
    travelled.push(end); distance-=length
  }
  const last=points[points.length-1]
  return {current:last,travelled:points,remaining:[last,last],next:last}
}

function routePointAtFraction(points,fraction){
  if(!points?.length) return null
  const lengths=points.slice(1).map((point,index)=>Math.hypot(point[0]-points[index][0],point[1]-points[index][1]))
  const total=lengths.reduce((sum,length)=>sum+length,0)
  let distance=total*fraction
  for(let index=0;index<lengths.length;index++){
    const start=points[index],end=points[index+1],length=lengths[index]
    if(distance<=length){
      const ratio=length?distance/length:0
      return {point:[start[0]+(end[0]-start[0])*ratio,start[1]+(end[1]-start[1])*ratio],bearing:Math.atan2(end[0]-start[0],end[1]-start[1])*180/Math.PI}
    }
    distance-=length
  }
  return {point:points.at(-1),bearing:0}
}

const lineFeature=coordinates=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates}})

const escapeHTML=value=>String(value??'—').replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[character]))

function calloutHTML(kind,title,rows,side='right'){
  return `<span aria-hidden="true" class="lotisec-map-callout ${kind} side-${side}"><strong>${escapeHTML(title)}</strong>${rows.map(([label,value])=>`<span><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></span>`).join('')}</span>`
}

function incidentElement(alert,onClick,featured=false,side='right'){
  const el=document.createElement('button')
  el.type='button'; el.className=`lotisec-map-anchor lotisec-incident-anchor${featured?' is-featured':''}`; el.setAttribute('aria-label',`Agrandir l'incident ${alert.id}`)
  el.innerHTML=`<span class="lotisec-incident-marker"><span class="incident-ring"></span><span class="incident-core">!</span></span>${calloutHTML('incident-callout',`INCIDENT · ${alert.id}`,[["Gravité",alert.severity],["Victimes",alert.victims],["Type",alert.type]],side)}`
  el.addEventListener('click',onClick)
  return el
}

function hospitalElement(hospital,onClick,side='right',recommended=false,routeMeta=null){
  const el=document.createElement('button')
  el.type='button'; el.className=`lotisec-map-anchor lotisec-hospital-anchor${recommended?' is-featured is-recommended':''}`; el.setAttribute('aria-label',`Voir ${hospital.name}, ${hospital.beds} places`)
  el.innerHTML=`<span class="lotisec-hospital-marker"><span>H</span><b>${escapeHTML(hospital.beds)}</b></span>${calloutHTML('hospital-callout',recommended?'HÔPITAL RECOMMANDÉ · H':`HÔPITAL H · ${hospital.name}`,[["Nom",hospital.name],["Distance",`${routeMeta?.distance??hospital.distance??(Number(hospital.eta||0)*.45).toFixed(1)} km`],["ETA",`${routeMeta?.eta??hospital.decisionEta??hospital.eta} min`],["Disponibilité",`${hospital.beds} places`],["Score",hospital.decisionScore?`${hospital.decisionScore} %`:'À calculer']],side)}`
  el.addEventListener('click',()=>{
    el.closest('.maplibregl-map')?.querySelectorAll('.lotisec-hospital-anchor.is-selected').forEach(marker=>marker.classList.remove('is-selected'))
    if(!recommended) el.classList.add('is-selected')
    onClick()
  })
  return el
}

function ambulanceElement(ambulance,assigned=false,featured=false,side='right',congestion=false){
  const el=document.createElement('div')
  el.className=`lotisec-map-anchor lotisec-ambulance-anchor${featured?' is-featured':''}`
  el.innerHTML=`<span class="lotisec-ambulance-marker${assigned?' is-live':''}"><span class="ambulance-beacon"></span><img src="/ambulance-map-sprite.png" alt=""/><b>${escapeHTML(ambulance.id)}</b></span>${calloutHTML('ambulance-callout',`AMBULANCE · ${ambulance.id}`,[["ETA",`${ambulance.decisionEta||ambulance.eta||'—'} min`],["Trafic",congestion?'Dense':ambulance.traffic||'Fluide'],["Équipement",ambulance.equipment||'Standard'],["Score",ambulance.decisionScore?`${ambulance.decisionScore} %`:'À calculer']],side)}`
  return el
}

function routeStepElement(step,index){
  const el=document.createElement('div')
  el.className='lotisec-route-step'
  el.setAttribute('aria-label',`Point ${index+1} : ${step.road}`)
  el.innerHTML=`<span class="lotisec-route-step-number">${index+1}</span><span class="lotisec-route-step-label">${escapeHTML(step.road)}</span>`
  return el
}

function routeArrowElement(bearing,color='#2563eb'){
  const el=document.createElement('div')
  el.className='lotisec-route-arrow'
  el.innerHTML=`<span style="--route-bearing:${bearing}deg;--route-arrow-color:${color}"></span>`
  return el
}

export default function LomeMap({
  alerts=EMPTY,ambulances=EMPTY,hospitals=EMPTY,height=360,showRoute=true,mission=null,
  routeVariants=false,focusAlertId=null,followAmbulance=false,showTraffic=true,onSelectAlert,onSelectHospital,
}){
  const containerRef=useRef(null)
  const shellRef=useRef(null)
  const [fallback,setFallback]=useState(false)
  const [detail,setDetail]=useState(null)
  const focusAlert=alerts.find(a=>a.id===focusAlertId)

  useEffect(()=>{
    const shell=shellRef.current
    if(!shell) return undefined
    const containWheel=event=>event.preventDefault()
    shell.addEventListener('wheel',containWheel,{passive:false})
    return ()=>shell.removeEventListener('wheel',containWheel)
  },[])

  const selectAlert=(alert,map=null)=>{
    setDetail({type:'alert',item:alert})
    onSelectAlert?.(alert)
    if(map) map.easeTo({center:[alert.lng,alert.lat],zoom:17,duration:900})
  }
  const selectHospital=(hospital,map=null)=>{
    setDetail({type:'hospital',item:hospital})
    onSelectHospital?.(hospital)
    if(map) map.easeTo({center:[hospital.lng,hospital.lat],zoom:15.2,duration:700})
  }

  useEffect(()=>{
    if(!containerRef.current||fallback) return undefined
    if(window.location.hostname==='terminal.local'){setFallback(true);return undefined}
    let map,loaded=false,animationFrame=null
    const markers=[]
    const fail=()=>setFallback(true)
    try{
      map=new maplibregl.Map({
        container:containerRef.current,
        style:OSM_STYLE,
        center:[1.2123,6.1432],
        zoom:12.8,
        attributionControl:true,
        scrollZoom:true,
        doubleClickZoom:true,
        dragPan:true,
      })
    }catch{fail(); return undefined}
    const timeout=setTimeout(()=>{if(!loaded) fail()},1600)
    map.on('error',event=>{if(!loaded||String(event?.error?.message||'').includes('WebGL')) fail()})
    map.on('load',()=>{
      loaded=true; clearTimeout(timeout)
      try{
        map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right')
        const target=alerts.find(a=>a.id===mission?.alertId)||focusAlert||alerts[0]
        const destinationHospital=hospitals.find(hospital=>hospital.id===(mission?.hospitalId||mission?.recommendedHospitalId))
        alerts.forEach((alert,index)=>{
          const side=alert.lng>1.2123?'left':'right'
          const marker=new maplibregl.Marker({element:incidentElement(alert,()=>selectAlert(alert,map),alert.id===target?.id,side)}).setLngLat([alert.lng,alert.lat]).addTo(map)
          markers.push(marker)
        })
        hospitals.forEach(hospital=>{
          const side=hospital.lng>1.2123?'left':'right'
          const marker=new maplibregl.Marker({element:hospitalElement(hospital,()=>selectHospital(hospital,map),side,hospital.id===destinationHospital?.id||hospital.recommended,mission?.hospitalRouteMeta)}).setLngLat([hospital.lng,hospital.lat]).addTo(map)
          markers.push(marker)
        })
        let liveMarker=null,liveElement=null,assigned=null
        ambulances.forEach((ambulance,index)=>{
          const isAssigned=mission?.ambulanceId===ambulance.id
          const featured=!mission&&index===0
          const side=ambulance.lng>1.2123?'left':'right'
          const element=ambulanceElement(ambulance,isAssigned,featured,side,isAssigned&&mission?.congestion)
          const marker=new maplibregl.Marker({element,rotationAlignment:'map'}).setLngLat([ambulance.lng,ambulance.lat]).addTo(map)
          markers.push(marker)
          if(isAssigned){liveMarker=marker; liveElement=element; assigned=ambulance}
        })

        if(showRoute&&target&&ambulances[0]){
          const routeOptions=routeOptionsFor(assigned||ambulances[0],target,mission,routeVariants)
          for(let index=routeOptions.length-1;index>=0;index--){
            const route=routeOptions[index]
            const id=`route-${index}`
            map.addSource(id,{type:'geojson',data:lineFeature(route)})
            map.addLayer({id:`${id}-casing`,type:'line',source:id,paint:{'line-color':'rgba(255,255,255,.96)','line-width':index===0?11:8,'line-opacity':index===0?.96:.78}})
            const routeColor=mission?.preDeparture?.state==='rerouted'&&index===1?'#dc2626':ROUTE_COLORS[index]
            map.addLayer({id,type:'line',source:id,paint:{'line-color':routeColor,'line-width':index===0?6:4,'line-opacity':index===0?.95:.7}})
          }
          const primary=routeOptions[0]
          ;[.28,.55,.82].map(fraction=>routePointAtFraction(primary,fraction)).filter(Boolean).forEach(({point,bearing})=>{
            const marker=new maplibregl.Marker({element:routeArrowElement(bearing),anchor:'center'}).setLngLat(point).addTo(map)
            markers.push(marker)
          })
          mission?.routeMeta?.steps?.filter(step=>Array.isArray(step.location)&&step.location.length===2).slice(0,6).forEach((step,index)=>{
            const marker=new maplibregl.Marker({element:routeStepElement(step,index),anchor:'center'}).setLngLat(step.location).addTo(map)
            markers.push(marker)
          })
          const hospitalRoute=mission?.leg!=='hospital'&&mission?.hospitalRoute?.length>1?mission.hospitalRoute:null
          if(hospitalRoute){
            map.addSource('hospital-route',{type:'geojson',data:lineFeature(hospitalRoute)})
            map.addLayer({id:'hospital-route-casing',type:'line',source:'hospital-route',paint:{'line-color':'rgba(255,255,255,.96)','line-width':10,'line-opacity':.94}})
            map.addLayer({id:'hospital-route',type:'line',source:'hospital-route',paint:{'line-color':'#059669','line-width':6,'line-opacity':.9,'line-dasharray':[2,1.3]}})
            ;[.35,.7].map(fraction=>routePointAtFraction(hospitalRoute,fraction)).filter(Boolean).forEach(({point,bearing})=>{
              const marker=new maplibregl.Marker({element:routeArrowElement(bearing,'#059669'),anchor:'center'}).setLngLat(point).addTo(map)
              markers.push(marker)
            })
          }
          if(showTraffic&&mission?.congestion&&(mission.originalRoute||primary).length>3){
            const congested=mission.originalRoute||primary
            const start=Math.max(0,Math.floor(congested.length*.2)),end=Math.max(start+2,Math.floor(congested.length*.65))
            map.addSource('traffic-congestion',{type:'geojson',data:lineFeature(congested.slice(start,end))})
            map.addLayer({id:'traffic-congestion',type:'line',source:'traffic-congestion',paint:{'line-color':'#dc2626','line-width':11,'line-opacity':.86}})
          }
          if(mission&&liveMarker&&assigned){
            map.addSource('route-travelled',{type:'geojson',data:lineFeature([primary[0],primary[0]])})
            map.addLayer({id:'route-travelled',type:'line',source:'route-travelled',paint:{'line-color':'#0ea5e9','line-width':7,'line-opacity':1}})
            let lastCameraUpdate=0
            const animate=()=>{
              const timestamp=Date.now()
              const progress=Math.max(0,Math.min(1,(timestamp-(mission.startedAt||timestamp))/mission.duration))
              const state=splitRoute(primary,progress)
              liveMarker.setLngLat(state.current)
              const bearing=Math.atan2(state.next[0]-state.current[0],state.next[1]-state.current[1])*180/Math.PI
              liveElement?.querySelector('.lotisec-ambulance-marker')?.style.setProperty('--ambulance-bearing',`${bearing}deg`)
              map.getSource('route-travelled')?.setData(lineFeature(state.travelled))
              map.getSource('route-0')?.setData(lineFeature(state.remaining))
              if(followAmbulance&&timestamp-lastCameraUpdate>600){map.easeTo({center:state.current,duration:520,essential:true});lastCameraUpdate=timestamp}
              if(progress<1) animationFrame=requestAnimationFrame(animate)
              else liveElement?.classList.add('is-arrived')
            }
            animate()
          }
          const bounds=new maplibregl.LngLatBounds()
          primary.forEach(point=>bounds.extend(point))
          hospitalRoute?.forEach(point=>bounds.extend(point))
          map.fitBounds(bounds,{padding:70,maxZoom:14,duration:500})
        }
        if(focusAlert&&!mission) setDetail({type:'alert',item:focusAlert})
      }catch{fail()}
    })
    return ()=>{
      clearTimeout(timeout)
      if(animationFrame) cancelAnimationFrame(animationFrame)
      markers.forEach(marker=>{try{marker.remove()}catch{}})
      try{map.remove()}catch{}
    }
  },[alerts,ambulances,hospitals,mission,showRoute,showTraffic,routeVariants,followAmbulance,fallback,focusAlertId])

  const closeDetail=()=>setDetail(null)
  return <div ref={shellRef} className="lotisec-map-shell relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900" style={{height}} aria-label="Carte OpenStreetMap opérationnelle en direct">
    {fallback
      ?<OSMTileMap alerts={alerts} ambulances={ambulances} hospitals={hospitals} mission={mission} showRoute={showRoute} showTraffic={showTraffic} routeVariants={routeVariants} followAmbulance={followAmbulance} focusAlert={focusAlert} selectedHospitalId={detail?.type==='hospital'?detail.item.id:null} onAlert={alert=>selectAlert(alert)} onHospital={hospital=>selectHospital(hospital)}/>
      :<div ref={containerRef} className="h-full w-full"/>}
    <MapLegend mission={mission}/>
    {mission?.routeMeta&&<RouteNameCard mission={mission} routeMeta={mission.routeMeta}/>}
    {detail&&<MapDetail detail={detail} onClose={closeDetail}/>} 
  </div>
}

function MapLegend({mission}){
  return <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden rounded-xl border border-white/60 bg-white/95 p-2.5 text-[10px] font-semibold text-slate-600 shadow-lg backdrop-blur sm:block dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
    <div className="flex flex-wrap gap-3"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500"/>Incident</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600"/>Ambulance</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"/>Hôpital · H</span>{mission&&<><span><i className="mr-1 inline-block h-1 w-4 bg-blue-600"/>Trajet restant</span><span><i className="mr-1 inline-block h-1 w-4 bg-sky-400"/>Trajet parcouru</span><span><i className="mr-1 inline-block h-1 w-4 bg-red-600"/>Congestion</span><span><i className="mr-1 inline-block h-1 w-4 bg-amber-500"/>Alternative</span><span><i className="mr-1 inline-grid h-3 w-3 place-items-center rounded-full bg-blue-700 text-[7px] text-white">1</i> Point clé</span><span><i className="mr-1 inline-block h-1 w-4 border-t-2 border-dashed border-emerald-600"/>Incident → hôpital</span></>}</div>
  </div>
}

function RouteNameCard({mission,routeMeta}){
  const telemetry=useMissionProgress(mission)
  return <div className="lotisec-route-name-card pointer-events-none absolute bottom-14 left-3 z-20 w-[min(360px,calc(100%-76px))] rounded-2xl border border-blue-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-blue-900 dark:bg-[#0b1e2d]/95">
    <div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-sm font-black text-white">R</span><div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[.13em] text-blue-600">Itinéraire recommandé</div><div className="truncate text-xs font-bold text-slate-900 dark:text-white">{routeMeta.name||'Trajet opérationnel'}</div></div>{telemetry&&<div className="shrink-0 text-right"><b className="block text-sm text-blue-700 dark:text-blue-300">{telemetry.etaRemaining} min</b><span className="text-[8px] text-slate-500 dark:text-slate-400">{telemetry.distanceRemaining} km</span></div>}</div>
    {telemetry?.nextStep&&<div className="mt-2 flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-white"><span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-blue-100">≈ {formatRemaining(telemetry.nextDistance)}</span><span className="min-w-0 flex-1 truncate text-[11px] font-bold">{telemetry.nextStep.instruction} · {telemetry.nextStep.road}</span></div>}
    {telemetry&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-700 transition-all" style={{width:`${telemetry.progress}%`}}/></div>}
  </div>
}

function formatRemaining(distance){if(!distance)return '0 m';return distance<1?`${Math.max(50,Math.round(distance*1000/50)*50)} m`:`${distance.toFixed(1).replace('.',',')} km`}

function MapDetail({detail,onClose}){
  const item=detail.item
  return <div data-map-detail className="absolute right-3 top-3 z-30 w-[min(330px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-[#0b1e2d]/95">
    <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fermer le détail"><X size={16}/></button>
    {detail.type==='alert'?<>
      <div className="text-[10px] font-bold tracking-wider text-red-600">INCIDENT MOBILE · {item.id}</div>
      <h3 className="mt-1 pr-7 text-lg font-bold">{item.type}</h3>
      <div className="mt-2 flex items-start gap-2 text-sm muted"><MapPin size={16} className="mt-0.5 shrink-0"/>{item.location}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><DetailStat label="Victimes" value={item.victims}/><DetailStat label="Véhicules" value={item.vehicles||1}/><DetailStat label="Précision" value={item.accuracy||'8 m'}/></div>
      <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">Zone encerclée · priorité {item.severity==='Critique'?'P1':'P2'}</div>
    </>:<>
      <div className="text-[10px] font-bold tracking-wider text-emerald-600">HÔPITAL CONNECTÉ · H</div>
      <h3 className="mt-1 pr-7 text-lg font-bold">{item.name}</h3>
      <div className="mt-1 text-sm muted">{item.specialty}</div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs"><DetailStat label="Places" value={item.beds}/><DetailStat label="Occupation" value={`${item.occupancy}%`}/><DetailStat label="ETA" value={`${item.decisionEta||item.eta} min`}/><DetailStat label="Score" value={item.decisionScore?`${item.decisionScore}%`:'—'}/></div>
      <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${item.beds>0?'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300':'bg-red-50 text-red-700'}`}>{item.beds>0?'Capacité d’accueil disponible':'Aucune place déclarée'}</div>
    </>}
  </div>
}

function DetailStat({label,value}){return <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900"><b className="block text-sm">{value}</b><span className="text-[10px] muted">{label}</span></div>}

function OSMTileMap({alerts,ambulances,hospitals,mission,showRoute,showTraffic,routeVariants,followAmbulance,focusAlert,selectedHospitalId,onAlert,onHospital}){
  const rootRef=useRef(null)
  const lastWheelRef=useRef(0)
  const dragRef=useRef(null)
  const [size,setSize]=useState({width:800,height:480})
  const [view,setView]=useState({center:[focusAlert?.lng||1.2123,focusAlert?.lat||6.1432],zoom:13})
  const [now,setNow]=useState(Date.now())
  const [dragging,setDragging]=useState(false)
  useEffect(()=>{
    const update=()=>rootRef.current&&setSize({width:rootRef.current.clientWidth||800,height:rootRef.current.clientHeight||480})
    update(); const observer=new ResizeObserver(update); if(rootRef.current) observer.observe(rootRef.current)
    return ()=>observer.disconnect()
  },[])
  useEffect(()=>{if(focusAlert) setView({center:[focusAlert.lng,focusAlert.lat],zoom:17})},[focusAlert?.id])
  useEffect(()=>{
    if(!mission) return undefined
    const movingAmbulance=ambulances.find(a=>a.id===mission.ambulanceId)
    const destination=alerts.find(a=>a.id===mission.alertId)
    if(!movingAmbulance||!destination) return undefined
    const route=routeOptionsFor(movingAmbulance,destination,mission,false)[0]
    const visibleRoute=[...route,...(mission.hospitalRoute||[])]
    const lngs=visibleRoute.map(point=>point[0]),lats=visibleRoute.map(point=>point[1])
    setView(followAmbulance?{center:[movingAmbulance.lng,movingAmbulance.lat],zoom:15}:{center:[(Math.min(...lngs)+Math.max(...lngs))/2,(Math.min(...lats)+Math.max(...lats))/2],zoom:14})
    setNow(Date.now())
    const timer=setInterval(()=>{const timestamp=Date.now();setNow(timestamp);if(followAmbulance){const state=splitRoute(route,Math.min(1,(timestamp-mission.startedAt)/mission.duration));setView(current=>({...current,center:state.current}))}},250)
    return ()=>clearInterval(timer)
  },[mission,alerts,ambulances,followAmbulance])
  const project=(lng,lat,zoom=view.zoom)=>{
    const scale=256*2**zoom
    const sin=Math.sin(lat*Math.PI/180)
    return {x:(lng+180)/360*scale,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale}
  }
  const unproject=(x,y,zoom=view.zoom)=>{
    const scale=256*2**zoom
    const lng=x/scale*360-180
    const lat=Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))*180/Math.PI
    return [lng,lat]
  }
  const startPan=event=>{
    if(event.button!==0||event.target.closest('button')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,center:project(view.center[0],view.center[1])}
    setDragging(true)
  }
  const movePan=event=>{
    const drag=dragRef.current
    if(!drag||drag.pointerId!==event.pointerId) return
    event.preventDefault()
    const nextX=drag.center.x-(event.clientX-drag.x)
    const nextY=drag.center.y-(event.clientY-drag.y)
    setView(current=>({...current,center:unproject(nextX,nextY,current.zoom)}))
  }
  const endPan=event=>{
    if(dragRef.current?.pointerId!==event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current=null
    setDragging(false)
  }
  const centerWorld=project(view.center[0],view.center[1])
  const toScreen=item=>{const p=project(item.lng,item.lat);return {left:size.width/2+p.x-centerWorld.x,top:size.height/2+p.y-centerWorld.y}}
  const tileSize=256,n=2**view.zoom,minX=Math.floor((centerWorld.x-size.width/2)/tileSize)-1,maxX=Math.ceil((centerWorld.x+size.width/2)/tileSize)+1,minY=Math.floor((centerWorld.y-size.height/2)/tileSize)-1,maxY=Math.ceil((centerWorld.y+size.height/2)/tileSize)+1
  const tiles=[]
  for(let x=minX;x<=maxX;x++) for(let y=minY;y<=maxY;y++) if(y>=0&&y<n) tiles.push({x,y,wrapped:(x+n)%n,left:size.width/2+x*tileSize-centerWorld.x,top:size.height/2+y*tileSize-centerWorld.y})
  const target=alerts.find(a=>a.id===mission?.alertId)||alerts[0]
  const assigned=ambulances.find(a=>a.id===mission?.ambulanceId)||ambulances[0]
  const destinationHospital=hospitals.find(h=>h.id===(mission?.hospitalId||mission?.recommendedHospitalId))
  const progress=mission?Math.max(0,Math.min(1,(now-(mission.startedAt||now))/mission.duration)):0
  const primary=showRoute&&assigned&&target?routeOptionsFor(assigned,target,mission,false)[0]:null
  const state=primary?splitRoute(primary,progress):null
  const liveBearing=state?Math.atan2(state.next[0]-state.current[0],state.next[1]-state.current[1])*180/Math.PI:0
  const linePoints=points=>points.map(([lng,lat])=>{const p=toScreen({lng,lat});return `${p.left},${p.top}`}).join(' ')
  const routes=showRoute&&assigned&&target?routeOptionsFor(assigned,target,mission,routeVariants):[]
  const hospitalRoute=showRoute&&mission?.leg!=='hospital'&&mission?.hospitalRoute?.length>1?mission.hospitalRoute:null
  const routeSteps=(mission?.routeMeta?.steps||[]).filter(step=>Array.isArray(step.location)&&step.location.length===2).slice(0,6)
  const openAlert=alert=>{setView({center:[alert.lng,alert.lat],zoom:17});onAlert(alert)}
  const openHospital=hospital=>{setView({center:[hospital.lng,hospital.lat],zoom:15});onHospital(hospital)}
  const zoomWithWheel=event=>{
    event.preventDefault()
    const timestamp=Date.now()
    if(timestamp-lastWheelRef.current<140) return
    lastWheelRef.current=timestamp
    const direction=event.deltaY<0?1:-1
    setView(current=>({...current,zoom:Math.max(11,Math.min(18,current.zoom+direction))}))
  }

  return <div ref={rootRef} onWheel={zoomWithWheel} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} className={`relative h-full w-full overflow-hidden bg-slate-200 ${dragging?'cursor-grabbing':'cursor-grab'}`} aria-label="Carte interactive : utilisez la molette pour zoomer et faites glisser pour vous déplacer">
    {tiles.map(tile=><img key={`${tile.x}-${tile.y}`} alt="" draggable="false" src={`https://tile.openstreetmap.org/${view.zoom}/${tile.wrapped}/${tile.y}.png`} className="absolute h-64 w-64 max-w-none select-none" style={{left:tile.left,top:tile.top}}/>)}
    <svg className="pointer-events-none absolute inset-0 h-full w-full" width={size.width} height={size.height}>
      {routes.slice().reverse().map((route,index)=>{const actual=routes.length-1-index,routeColor=mission?.preDeparture?.state==='rerouted'&&actual===1?'#dc2626':ROUTE_COLORS[actual];return <g key={actual}><polyline points={linePoints(route)} fill="none" stroke="rgba(255,255,255,.96)" strokeWidth={actual===0?12:9} strokeLinecap="round" strokeLinejoin="round" opacity={actual===0?.96:.8}/><polyline points={linePoints(route)} fill="none" stroke={routeColor} strokeWidth={actual===0?7:5} strokeLinecap="round" strokeLinejoin="round" opacity={actual===0?.95:.72}/></g>})}
      {hospitalRoute&&<><polyline points={linePoints(hospitalRoute)} fill="none" stroke="rgba(255,255,255,.96)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity=".94"/><polyline points={linePoints(hospitalRoute)} fill="none" stroke="#059669" strokeWidth="6" strokeDasharray="11 8" strokeLinecap="round" strokeLinejoin="round" opacity=".92"/></>}
      {showTraffic&&mission?.congestion&&(mission.originalRoute||primary)?.length>3&&<polyline points={linePoints((mission.originalRoute||primary).slice(Math.floor((mission.originalRoute||primary).length*.2),Math.max(Math.floor((mission.originalRoute||primary).length*.65),Math.floor((mission.originalRoute||primary).length*.2)+2)))} fill="none" stroke="#dc2626" strokeWidth="11" strokeLinecap="round" opacity=".86"/>}
      {mission&&state&&<><polyline points={linePoints(state.remaining)} fill="none" stroke="#2563eb" strokeWidth="7" strokeLinecap="round"/><polyline points={linePoints(state.travelled)} fill="none" stroke="#38bdf8" strokeWidth="7" strokeLinecap="round"/></>}
      {primary&&[.28,.55,.82].map(fraction=>routePointAtFraction(primary,fraction)).filter(Boolean).map(({point,bearing},index)=>{const p=toScreen({lng:point[0],lat:point[1]});return <g key={`route-arrow-${index}`} transform={`translate(${p.left} ${p.top}) rotate(${bearing})`}><path d="M 0 -8 L 5 5 L 0 2 L -5 5 Z" fill="#2563eb" stroke="white" strokeWidth="1.5"/></g>})}
      {hospitalRoute&&[.35,.7].map(fraction=>routePointAtFraction(hospitalRoute,fraction)).filter(Boolean).map(({point,bearing},index)=>{const p=toScreen({lng:point[0],lat:point[1]});return <g key={`hospital-arrow-${index}`} transform={`translate(${p.left} ${p.top}) rotate(${bearing})`}><path d="M 0 -8 L 5 5 L 0 2 L -5 5 Z" fill="#059669" stroke="white" strokeWidth="1.5"/></g>})}
    </svg>
    {routeSteps.map((step,index)=>{const p=toScreen({lng:step.location[0],lat:step.location[1]});return <div key={`${step.road}-${index}`} className="lotisec-route-step absolute z-[9] -translate-x-1/2 -translate-y-1/2" style={p} aria-label={`Point ${index+1} : ${step.road}`}><span className="lotisec-route-step-number">{index+1}</span><span className="lotisec-route-step-label">{step.road}</span></div>})}
    {hospitals.map(h=>{const p=toScreen(h),side=h.lng>view.center[0]?'left':'right',recommended=h.id===destinationHospital?.id||h.recommended,selected=h.id===selectedHospitalId,meta=recommended?mission?.hospitalRouteMeta:null;return <button type="button" key={h.id} onClick={()=>openHospital(h)} className={`lotisec-map-anchor lotisec-hospital-anchor absolute z-10 -translate-x-1/2 -translate-y-1/2${recommended?' is-featured is-recommended':selected?' is-selected':''}`} style={p} aria-label={`Voir ${h.name}, ${h.beds} places`}><span className="lotisec-hospital-marker"><span>H</span><b>{h.beds}</b></span><MapCallout kind="hospital" side={side} title={recommended?'HÔPITAL RECOMMANDÉ · H':`HÔPITAL H · ${h.name}`} rows={[["Nom",h.name],["Distance",`${meta?.distance??h.distance??(Number(h.eta||0)*.45).toFixed(1)} km`],["ETA",`${meta?.eta??h.decisionEta??h.eta} min`],["Disponibilité",`${h.beds} places`],["Score",h.decisionScore?`${h.decisionScore} %`:'À calculer']]}/></button>})}
    {alerts.map(a=>{const p=toScreen(a),side=a.lng>view.center[0]?'left':'right',featured=a.id===target?.id;return <button type="button" key={a.id} onClick={()=>openAlert(a)} className={`lotisec-map-anchor lotisec-incident-anchor absolute z-10 -translate-x-1/2 -translate-y-1/2${featured?' is-featured':''}`} style={p} aria-label={`Agrandir l'incident ${a.id}`}><span className="lotisec-incident-marker"><span className="incident-ring"/><span className="incident-core">!</span></span><MapCallout kind="incident" side={side} title={`INCIDENT · ${a.id}`} rows={[["Gravité",a.severity],["Victimes",a.victims],["Type",a.type]]}/></button>})}
    {ambulances.filter(a=>a.id!==mission?.ambulanceId).map((a,index)=>{const p=toScreen(a),side=a.lng>view.center[0]?'left':'right';return <div key={a.id} className={`lotisec-map-anchor lotisec-ambulance-anchor absolute z-10 -translate-x-1/2 -translate-y-1/2${a.recommended||(!mission&&index<2)?' is-featured':''}`} style={p}><span className="lotisec-ambulance-marker"><img src="/ambulance-map-sprite.png" alt="Ambulance"/><b>{a.id}</b></span><MapCallout kind="ambulance" side={side} title={`AMBULANCE · ${a.id}`} rows={[["ETA",`${a.decisionEta||a.eta||'—'} min`],["Trafic",a.traffic||'Fluide'],["Équipement",a.equipment||'Standard'],["Score",a.decisionScore?`${a.decisionScore} %`:'À calculer']]}/></div>})}
    {mission&&state&&assigned&&(()=>{const p=toScreen({lng:state.current[0],lat:state.current[1]}),side=state.current[0]>view.center[0]?'left':'right';return <div data-live-ambulance={assigned.id} className="lotisec-map-anchor lotisec-ambulance-anchor absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-200" style={p}><span className={`lotisec-ambulance-marker is-live ${progress>=1?'is-arrived':''}`} style={{'--ambulance-bearing':`${liveBearing}deg`}}><span className="ambulance-beacon"/><img src="/ambulance-map-sprite.png" alt="Ambulance en déplacement"/><b>{progress>=1?'SUR PLACE':assigned.id}</b></span><MapCallout kind="ambulance" side={side} title={`AMBULANCE · ${assigned.id}`} rows={[["ETA",`${mission.routeMeta?.eta||assigned.decisionEta||assigned.eta||'—'} min`],["Trafic",mission.congestion?'Dense':assigned.traffic||'Fluide'],["Statut",mission.status||'En route'],["Score",mission.ambulanceDecision?.decisionScore?`${mission.ambulanceDecision.decisionScore} %`:'—']]}/></div>})()}
    <div className="absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"><button type="button" className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={()=>setView(v=>({...v,zoom:Math.min(18,v.zoom+1)}))} aria-label="Zoom avant"><Plus size={17}/></button><button type="button" className="border-t border-slate-200 p-2.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" onClick={()=>setView(v=>({...v,zoom:Math.max(11,v.zoom-1)}))} aria-label="Zoom arrière"><Minus size={17}/></button><button type="button" className="border-t border-slate-200 p-2.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" onClick={()=>setView({center:[1.2123,6.1432],zoom:13})} aria-label="Recentrer sur Lomé"><Crosshair size={17}/></button></div>
    <div className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[9px] text-slate-600">© OpenStreetMap contributors</div>
  </div>
}

function MapCallout({kind,side,title,rows}){
  return <span aria-hidden="true" className={`lotisec-map-callout ${kind}-callout side-${side}`}><strong>{title}</strong>{rows.map(([label,value])=><span key={label}><small>{label}</small><b>{value}</b></span>)}</span>
}
