let audioContext=null
const speechTimers=new Set()

export function getSoundsEnabled(){
  if(typeof window==='undefined') return true
  return localStorage.getItem('lotisec-sounds')!=='off'
}

export function setSoundsEnabled(enabled){
  localStorage.setItem('lotisec-sounds',enabled?'on':'off')
  if(enabled) unlockSound()
}

export function getVoiceProfile(){
  if(typeof window==='undefined') return 'africaine'
  const stored=localStorage.getItem('lotisec-voice-profile')||'africaine'
  return stored==='operationnelle'?'africaine':stored
}

export function setVoiceProfile(profile){
  localStorage.setItem('lotisec-voice-profile',profile)
}

export function stopOperationalAudio(){
  speechTimers.forEach(timer=>clearTimeout(timer));speechTimers.clear()
  try{window.speechSynthesis?.cancel()}catch{}
}

function getContext(){
  if(!getSoundsEnabled()) return null
  const AudioContext=window.AudioContext||window.webkitAudioContext
  if(!AudioContext) return null
  if(!audioContext) audioContext=new AudioContext()
  return audioContext
}

export function unlockSound(){
  try{
    const context=getContext()
    if(context?.state==='suspended') context.resume()
  }catch{}
}

function tone(frequency,start,duration,{type='sine',gain=.06,endFrequency=frequency}={}){
  const context=getContext()
  if(!context) return
  try{
    const oscillator=context.createOscillator()
    const volume=context.createGain()
    oscillator.type=type
    oscillator.frequency.setValueAtTime(frequency,context.currentTime+start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40,endFrequency),context.currentTime+start+duration)
    volume.gain.setValueAtTime(.0001,context.currentTime+start)
    volume.gain.exponentialRampToValueAtTime(gain,context.currentTime+start+.025)
    volume.gain.exponentialRampToValueAtTime(.0001,context.currentTime+start+duration)
    oscillator.connect(volume);volume.connect(context.destination)
    oscillator.start(context.currentTime+start)
    oscillator.stop(context.currentTime+start+duration+.02)
  }catch{}
}

let lastAlertSoundTime = 0
let lastLockSoundTime = 0

export function playEmergencyAlert(){
  unlockSound()
  const now = Date.now()
  if(now - lastAlertSoundTime < 2500) return
  lastAlertSoundTime = now
  tone(840, 0, 0.16, {type:'sine', gain:0.042, endFrequency:1080})
}

export function playTargetLock(){
  unlockSound()
  const now = Date.now()
  if(now - lastLockSoundTime < 1500) return
  lastLockSoundTime = now
  tone(520, 0, 0.12, {type:'sine', gain:0.035, endFrequency:820})
}

export function playMapExpand(){
  unlockSound()
  tone(260,0,.14,{type:'sine',gain:.03,endFrequency:520})
  tone(520,.09,.18,{type:'triangle',gain:.035,endFrequency:980})
}

export function playDispatchConfirmation(){
  unlockSound()
  tone(460,0,.12,{type:'sine',gain:.035,endFrequency:680})
  tone(680,.11,.14,{type:'triangle',gain:.04,endFrequency:920})
  tone(920,.25,.2,{type:'sine',gain:.045,endFrequency:1180})
}

function preferredFrenchVoice(profile=getVoiceProfile()){
  if(typeof window==='undefined'||!window.speechSynthesis) return null
  const voices=window.speechSynthesis.getVoices().filter(voice=>String(voice.lang).toLowerCase().startsWith('fr'))
  const africanLocales=['fr-tg','fr-bj','fr-ci','fr-sn','fr-cm','fr-cd','fr-ma','fr-dz','fr-tn']
  const africanNames=['afrique','africa','dakar','abidjan','awa','aminata','mariam','fatou']
  const african=voices.filter(voice=>africanLocales.includes(String(voice.lang).toLowerCase())||africanNames.some(name=>voice.name.toLowerCase().includes(name)))
  const preferred=['denise','audrey','hortense','julie','marie','amélie','amelie','virginie','google français','google francais']
  if(profile==='systeme') return voices[0]||null
  const ranked=preferred.map(name=>voices.find(voice=>voice.name.toLowerCase().includes(name))).filter(Boolean)
  return (profile==='calme'?african[1]:african[0])||african[0]||(profile==='calme'?ranked[1]:ranked[0])||ranked[0]||voices[0]||null
}

export function getAfricanVoiceInfo(){
  if(typeof window==='undefined'||!window.speechSynthesis) return {available:false,name:null,lang:null}
  const locales=['fr-tg','fr-bj','fr-ci','fr-sn','fr-cm','fr-cd','fr-ma','fr-dz','fr-tn']
  const names=['afrique','africa','dakar','abidjan','awa','aminata','mariam','fatou']
  const voice=window.speechSynthesis.getVoices().find(item=>locales.includes(String(item.lang).toLowerCase())||names.some(name=>item.name.toLowerCase().includes(name)))
  return {available:Boolean(voice),name:voice?.name||null,lang:voice?.lang||null}
}

export function speakOperational(message,{delay=0,rate,pitch,interrupt=false}={}){
  if(!getSoundsEnabled()||typeof window==='undefined'||!window.speechSynthesis||!window.SpeechSynthesisUtterance) return
  const timer=setTimeout(()=>{
    speechTimers.delete(timer)
    try{
      if(interrupt) window.speechSynthesis.cancel()
      const profile=getVoiceProfile()
      const preset=profile==='calme'?{rate:.84,pitch:1}:profile==='systeme'?{rate:.96,pitch:1}:{rate:.9,pitch:1.01}
      const utterance=new window.SpeechSynthesisUtterance(message)
      utterance.rate=rate??preset.rate
      utterance.pitch=pitch??preset.pitch
      utterance.volume=.96
      const voice=preferredFrenchVoice(profile)
      utterance.lang=voice?.lang||'fr-SN'
      if(voice) utterance.voice=voice
      window.speechSynthesis.speak(utterance)
    }catch{}
  },delay)
  speechTimers.add(timer)
}

export function announceNewIncident(incident){
  playEmergencyAlert()
  speakOperational(`Nouvel accident signalé à ${incident?.location||'la position transmise'}.`,{delay:1050,rate:.94})
}

export function announceAmbulanceAssignment({ambulanceId,location,eta}){
  playDispatchConfirmation()
  speakOperational(`Ambulance ${ambulanceId||''} affectée. Départ vers ${location||'le lieu de l’incident'}. Itinéraire recommandé, arrivée estimée dans ${eta||'quelques'} minutes.`,{delay:520,rate:.95})
}

export function announceCongestion({road,eta}){
  playEmergencyAlert()
  speakOperational(`Trafic congestionné détecté${road?` sur ${road}`:''}. Un autre itinéraire plus fluide est proposé${eta?`. Nouveau temps estimé, ${eta} minutes`:''}.`,{delay:980,rate:.94})
}

export function announcePreDepartureDecision({ambulanceId,road,route,eta}){
  playEmergencyAlert()
  speakOperational(`Attention. Trafic congestionné détecté${road?` sur ${road}`:''}. L'ambulance ${ambulanceId||''} reste à l'arrêt pendant l'analyse. Itinéraire alternatif recommandé${route?` par ${route}`:''}${eta?`. Temps estimé, ${eta} minutes`:''}. Départ après validation.`,{delay:980,rate:.9})
}

export function announceMissionStage({status,ambulanceId,hospital,arrived=false}){
  if(['Sur place','Pris en charge','Terminée'].includes(status)&&!arrived) return
  const messages={
    'En route':`Ambulance ${ambulanceId||''} en route vers le lieu de l'urgence.`,
    'Sur place':`Ambulance ${ambulanceId||''} arrivée sur le lieu de l'urgence. Les secours commencent la prise en charge.`,
    'Orientation hospitalière':`Évaluation hospitalière en cours. ${hospital?`${hospital} est recommandé selon la capacité et la distance.`:''}`,
    'Vers le centre de santé':`Transfert engagé vers ${hospital||'le centre de santé confirmé'}. L'ambulance est en déplacement.`,
    'Pris en charge':`L'ambulance est arrivée à ${hospital||'destination'}. La réception de la victime est confirmée.`,
    'Terminée':'Mission clôturée après confirmation de la réception hospitalière.',
  }
  if(messages[status]) speakOperational(messages[status],{delay:180,rate:.91})
}
