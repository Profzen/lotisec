const toRadians=value=>value*Math.PI/180

export function distanceKm(start,end){
  if(!start||!end) return 0
  const deltaLat=toRadians(end.lat-start.lat)
  const deltaLng=toRadians(end.lng-start.lng)
  const a=Math.sin(deltaLat/2)**2+Math.cos(toRadians(start.lat))*Math.cos(toRadians(end.lat))*Math.sin(deltaLng/2)**2
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}

const clamp=value=>Math.max(0,Math.min(100,Math.round(value)))

export function rankAmbulances(alert,ambulances=[]){
  if(!alert) return ambulances
  const ranked=ambulances.map(ambulance=>{
    const distance=distanceKm(ambulance,alert)
    const trafficFactor=ambulance.traffic==='Dense'?1.55:ambulance.traffic==='Modéré'?1.25:1
    const eta=Math.max(2,Math.round(distance/30*60*trafficFactor))
    const availability=ambulance.status==='Disponible'?100:ambulance.status==='Affectée'?35:15
    const response=clamp(100-eta*6)
    const equipment=ambulance.equipment==='Réanimation'?100:ambulance.equipment==='Trauma'?92:78
    const freshness=String(ambulance.updated||'').includes('min')?78:96
    const score=clamp(response*.45+availability*.30+equipment*.15+freshness*.10)
    return {
      ...ambulance,
      distance:Number(distance.toFixed(1)),
      decisionEta:eta,
      decisionScore:score,
      scoreBreakdown:{'Temps d’arrivée':response,Disponibilité:availability,Équipement:equipment,'Fraîcheur GPS':freshness},
      scoreWeights:{'Temps d’arrivée':'45 %',Disponibilité:'30 %',Équipement:'15 %','Fraîcheur GPS':'10 %'},
      decisionReason:`${eta} min estimées · ${distance.toFixed(1)} km · ${ambulance.equipment||'équipe standard'} · trafic ${String(ambulance.traffic||'Fluide').toLowerCase()}`,
    }
  }).sort((a,b)=>b.decisionScore-a.decisionScore)
  return ranked.map((item,index)=>({...item,recommended:index===0&&item.status==='Disponible'}))
}

function specialtyFit(alert,hospital){
  const services=(hospital.services||[]).map(item=>item.toLowerCase())
  const text=`${alert?.type||''} ${alert?.severity||''}`.toLowerCase()
  if(text.includes('accident')||text.includes('collision')) return services.some(item=>item.includes('trauma')||item.includes('chirurg'))?100:76
  return services.some(item=>item.includes('urgence'))?96:78
}

export function rankHospitals(alert,hospitals=[]){
  if(!alert) return hospitals
  const victims=Math.max(1,Number(alert.victims||1))
  const ranked=hospitals.map(hospital=>{
    const distance=distanceKm(alert,hospital)
    const eta=Math.max(3,Math.round(distance/27*60))
    const travel=clamp(100-eta*4.5)
    const capacity=hospital.beds<=0?0:clamp(65+Math.min(35,(hospital.beds/victims)*12))
    const specialty=specialtyFit(alert,hospital)
    const reception=hospital.reception==='Ouverte'?100:hospital.reception==='Limitée'?62:15
    const score=clamp(travel*.38+capacity*.32+specialty*.20+reception*.10)
    return {
      ...hospital,
      distance:Number(distance.toFixed(1)),
      decisionEta:eta,
      decisionScore:score,
      scoreBreakdown:{'Temps de trajet':travel,Capacité:capacity,Spécialité:specialty,Accueil:reception},
      scoreWeights:{'Temps de trajet':'38 %',Capacité:'32 %',Spécialité:'20 %',Accueil:'10 %'},
      decisionReason:`${eta} min · ${hospital.beds} place(s) · ${hospital.specialty} · accueil ${String(hospital.reception||'ouvert').toLowerCase()}`,
    }
  }).sort((a,b)=>b.decisionScore-a.decisionScore)
  const firstAvailable=ranked.findIndex(item=>item.beds>=victims&&item.reception!=='Fermée')
  return ranked.map((item,index)=>({...item,recommended:index===(firstAvailable<0?0:firstAvailable)}))
}
