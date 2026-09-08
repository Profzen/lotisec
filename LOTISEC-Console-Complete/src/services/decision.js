const toRadians=value=>value*Math.PI/180

export function distanceKm(start,end){
  if(!start||!end) return 0
  const deltaLat=toRadians(end.lat-start.lat)
  const deltaLng=toRadians(end.lng-start.lng)
  const a=Math.sin(deltaLat/2)**2+Math.cos(toRadians(start.lat))*Math.cos(toRadians(end.lat))*Math.sin(deltaLng/2)**2
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}

const equipmentPriority=value=>value==='Réanimation'?0:value==='Trauma'?1:2
const isFresh=value=>!String(value||'').includes('min')

export function rankAmbulances(alert,ambulances=[]){
  if(!alert) return ambulances
  const ranked=ambulances.map(ambulance=>{
    const distance=distanceKm(ambulance,alert)
    const trafficFactor=ambulance.traffic==='Dense'?1.55:ambulance.traffic==='Modéré'?1.25:1
    const eta=Math.max(2,Math.round(distance/30*60*trafficFactor))
    return {
      ...ambulance,
      distance:Number(distance.toFixed(1)),
      decisionEta:eta,
      decisionReason:`${eta} min estimées · ${distance.toFixed(1)} km · ${ambulance.equipment||'équipe standard'} · trafic ${String(ambulance.traffic||'Fluide').toLowerCase()}`,
    }
  }).sort((a,b)=>{
    const availability=(a.status==='Disponible'?0:1)-(b.status==='Disponible'?0:1)
    if(availability) return availability
    if(a.decisionEta!==b.decisionEta) return a.decisionEta-b.decisionEta
    const equipment=equipmentPriority(a.equipment)-equipmentPriority(b.equipment)
    if(equipment) return equipment
    return Number(isFresh(b.updated))-Number(isFresh(a.updated))
  })
  const firstAvailable=ranked.findIndex(item=>item.status==='Disponible')
  return ranked.map((item,index)=>({...item,recommended:index===(firstAvailable<0?0:firstAvailable)}))
}

function specialtyPriority(alert,hospital){
  const services=(hospital.services||[]).map(item=>item.toLowerCase())
  const text=`${alert?.type||''} ${alert?.severity||''}`.toLowerCase()
  if(text.includes('accident')||text.includes('collision')) return services.some(item=>item.includes('trauma')||item.includes('chirurg'))?0:1
  return services.some(item=>item.includes('urgence'))?0:1
}

export function rankHospitals(alert,hospitals=[]){
  if(!alert) return hospitals
  const victims=Math.max(1,Number(alert.victims||1))
  const ranked=hospitals.map(hospital=>{
    const distance=distanceKm(alert,hospital)
    const eta=Math.max(3,Math.round(distance/27*60))
    return {
      ...hospital,
      distance:Number(distance.toFixed(1)),
      decisionEta:eta,
      specialtyMatched:specialtyPriority(alert,hospital)===0,
      decisionReason:`${eta} min · ${hospital.beds} place(s) · ${hospital.specialty} · accueil ${String(hospital.reception||'ouvert').toLowerCase()}`,
    }
  }).sort((a,b)=>{
    const eligibleA=a.beds>=victims&&a.reception!=='Fermée'?0:1
    const eligibleB=b.beds>=victims&&b.reception!=='Fermée'?0:1
    if(eligibleA!==eligibleB) return eligibleA-eligibleB
    if(a.specialtyMatched!==b.specialtyMatched) return Number(b.specialtyMatched)-Number(a.specialtyMatched)
    if(a.decisionEta!==b.decisionEta) return a.decisionEta-b.decisionEta
    return b.beds-a.beds
  })
  const firstAvailable=ranked.findIndex(item=>item.beds>=victims&&item.reception!=='Fermée')
  return ranked.map((item,index)=>({...item,recommended:index===(firstAvailable<0?0:firstAvailable)}))
}
