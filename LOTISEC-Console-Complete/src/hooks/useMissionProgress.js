import { useEffect, useMemo, useState } from 'react'

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value))

export function useMissionProgress(mission){
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{
    if(!mission) return undefined
    setNow(Date.now())
    const timer=setInterval(()=>setNow(Date.now()),500)
    return ()=>clearInterval(timer)
  },[mission?.id,mission?.startedAt])

  return useMemo(()=>{
    if(!mission) return null
    const animationDuration=mission.animationDuration||mission.duration||48000
    const elapsed=Math.max(0,now-(mission.startedAt||now))
    const forcedComplete=['Sur place','Orientation hospitalière','Pris en charge','Terminée'].includes(mission.status)
    const ratio=forcedComplete?1:clamp(elapsed/animationDuration)
    const progress=Math.round(ratio*100)
    const distance=Number(mission.routeMeta?.distance||0)
    const operationalEta=Math.max(1,Number(mission.routeMeta?.eta||1))
    const distanceRemaining=Number(Math.max(0,distance*(1-ratio)).toFixed(1))
    const etaRemaining=ratio>=1?0:Math.max(1,Math.ceil(operationalEta*(1-ratio)))
    const animationRemaining=Math.max(0,Math.ceil((animationDuration-elapsed)/1000))
    const steps=mission.routeMeta?.steps||[]
    const stepIndex=steps.length?Math.min(steps.length-1,Math.floor(ratio*steps.length)):0
    const currentStep=steps[stepIndex]||null
    const nextStep=steps[Math.min(steps.length-1,stepIndex+1)]||currentStep
    const remainingSteps=Math.max(1,steps.length-stepIndex)
    const nextDistance=distanceRemaining?Math.max(.1,distanceRemaining/remainingSteps):0
    const acceleration=Math.max(1,Math.round((operationalEta*60)/(animationDuration/1000)))
    const speed=ratio>=1?0:mission.congestion?18:Number(mission.liveSpeed||32)
    return {ratio,progress,distanceRemaining,etaRemaining,animationRemaining,operationalEta,animationDuration,acceleration,speed,stepIndex,currentStep,nextStep,nextDistance}
  },[mission,now])
}
