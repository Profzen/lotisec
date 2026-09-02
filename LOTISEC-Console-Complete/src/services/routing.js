const OSRM_URL=(import.meta.env.VITE_OSRM_URL||'https://router.project-osrm.org').replace(/\/$/,'')

export function fallbackRoutes(start,end){
  const midLng=(start.lng+end.lng)/2
  const midLat=(start.lat+end.lat)/2
  return [
    [[start.lng,start.lat],[midLng-.002,midLat+.003],[midLng+.002,midLat+.001],[end.lng,end.lat]],
    [[start.lng,start.lat],[midLng-.004,midLat-.002],[midLng+.004,midLat-.003],[end.lng,end.lat]],
    [[start.lng,start.lat],[midLng+.001,midLat+.006],[midLng+.006,midLat+.003],[end.lng,end.lat]],
  ]
}

function routeLengthKm(points){
  return points.slice(1).reduce((total,point,index)=>{
    const previous=points[index]
    const latKm=(point[1]-previous[1])*111.32
    const lngKm=(point[0]-previous[0])*111.32*Math.cos(point[1]*Math.PI/180)
    return total+Math.hypot(latKm,lngKm)
  },0)
}

function formatDistance(meters=0){
  if(meters>=1000) return `${(meters/1000).toFixed(meters>=10000?0:1).replace('.',',')} km`
  return `${Math.max(10,Math.round(meters/10)*10)} m`
}

function formatDuration(seconds=0){
  return `${Math.max(1,Math.round(seconds/60))} min`
}

function roadName(step){
  const parts=[step.name,step.ref].filter(Boolean)
  const unique=[...new Set(parts)]
  if(unique.length) return unique.join(' · ')
  if(step.maneuver?.type==='depart') return 'Point de départ'
  if(step.maneuver?.type==='arrive') return 'Zone de destination'
  return 'Voie locale non nommée'
}

function maneuverInstruction(step,road){
  const type=step.maneuver?.type
  const modifier=step.maneuver?.modifier
  const directions={
    left:'à gauche',right:'à droite',straight:'tout droit',
    'slight left':'légèrement à gauche','slight right':'légèrement à droite',
    'sharp left':'fortement à gauche','sharp right':'fortement à droite',
    uturn:'en faisant demi-tour',
  }
  const direction=directions[modifier]||''
  if(type==='depart') return `Démarrer sur ${road}`
  if(type==='arrive') return 'Arrivée à destination'
  if(type==='roundabout'||type==='rotary') return `Prendre le rond-point${step.maneuver?.exit?` · sortie ${step.maneuver.exit}`:''}`
  if(type==='merge') return `Rejoindre ${road}${direction?` ${direction}`:''}`
  if(type==='fork') return `Rester ${direction||'sur la voie principale'} vers ${road}`
  if(type==='on ramp'||type==='off ramp') return `Emprunter la bretelle${direction?` ${direction}`:''} vers ${road}`
  if(type==='continue'||type==='new name'||type==='notification') return `Continuer ${direction||'sur'} ${road}`
  if(type==='turn'||type==='end of road') return `Tourner ${direction||'vers'} ${road}`
  return `Suivre ${road}${direction?` ${direction}`:''}`
}

function selectKeySteps(steps){
  if(steps.length<=6) return steps
  const middle=steps.slice(1,-1)
  const selected=[steps[0]]
  for(let index=0;index<4;index++) selected.push(middle[Math.round(index*(middle.length-1)/3)])
  selected.push(steps.at(-1))
  return selected.filter((step,index,array)=>index===0||step!==array[index-1])
}

function routeMetadata(route,index=0){
  const rawSteps=(route.legs||[]).flatMap(leg=>leg.steps||[])
  const detailed=rawSteps.map(step=>{
    const road=roadName(step)
    return {
      road,
      instruction:maneuverInstruction(step,road),
      distance:formatDistance(step.distance),
      time:formatDuration(step.duration),
      location:step.maneuver?.location,
      maneuver:step.maneuver?.type||'continue',
    }
  }).filter((step,stepIndex,array)=>{
    const important=step.maneuver==='depart'||step.maneuver==='arrive'||step.road!=='Voie locale non nommée'
    return important&&(stepIndex===0||step.instruction!==array[stepIndex-1]?.instruction)
  })
  const steps=selectKeySteps(detailed)
  const namedRoads=[...new Set(steps.map(step=>step.road).filter(name=>!['Point de départ','Zone de destination','Voie locale non nommée'].includes(name)))]
  return {
    name:namedRoads.length?namedRoads.slice(0,3).join(' → '):`Itinéraire ${index===0?'recommandé':`alternatif ${index}`}`,
    coordinates:route.geometry.coordinates,
    distance:Number((route.distance/1000).toFixed(1)),
    eta:Math.max(1,Math.round(route.duration/60)),
    steps,
  }
}

function localMetadata(coordinates,index=0){
  const distance=Number(routeLengthKm(coordinates).toFixed(1))
  const checkpoints=[coordinates[0],coordinates[Math.max(1,Math.floor(coordinates.length/3))],coordinates[Math.max(1,Math.floor(coordinates.length*2/3))],coordinates.at(-1)]
  const labels=['Point de départ','Axe principal de Lomé','Voie d’accès locale','Zone de destination']
  const instructions=['Démarrer et rejoindre l’axe principal','Continuer vers le carrefour intermédiaire','Suivre la voie d’accès à la destination','Arrivée à destination']
  const steps=checkpoints.map((location,stepIndex)=>({
    road:labels[stepIndex],instruction:instructions[stepIndex],location,
    distance:stepIndex===0?'0 m':formatDistance(distance*1000/3),
    time:stepIndex===0?'1 min':formatDuration(distance/3/28*3600),
    maneuver:stepIndex===0?'depart':stepIndex===3?'arrive':'continue',
  }))
  return {
    name:`Itinéraire local de secours${index?` · option ${index+1}`:''}`,
    coordinates,distance,eta:Math.max(3,Math.round(distance/28*60)),steps,
  }
}

export function localRoutePlan(start,end){
  const alternatives=fallbackRoutes(start,end)
  const alternativesMeta=alternatives.map(localMetadata)
  return {...alternativesMeta[0],alternatives,alternativesMeta,engine:'Routage local de secours · voies indicatives'}
}

export async function getRoadRoute(start,end){
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),5000)
  try{
    const url=`${OSRM_URL}/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`
    const response=await fetch(url,{signal:controller.signal})
    if(!response.ok) throw new Error(`OSRM ${response.status}`)
    const data=await response.json()
    if(data.code!=='Ok'||!data.routes?.[0]?.geometry?.coordinates?.length) throw new Error('Itinéraire OSRM indisponible')
    const routes=data.routes.slice(0,3)
    const alternativesMeta=routes.map(routeMetadata)
    return {
      ...alternativesMeta[0],
      alternatives:routes.map(route=>route.geometry.coordinates),
      alternativesMeta,
      engine:'OSRM · réseau routier réel',
    }
  }catch{
    return localRoutePlan(start,end)
  }finally{
    clearTimeout(timeout)
  }
}
