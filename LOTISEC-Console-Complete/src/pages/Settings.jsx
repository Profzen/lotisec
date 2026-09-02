import { useEffect, useState } from 'react'
import { CheckCircle2, LockKeyhole, PlugZap, Radio, Save, ShieldCheck, Smartphone, Volume2, VolumeX } from 'lucide-react'
import { PageTitle, Status } from '../components/UI'
import { getAfricanVoiceInfo, getVoiceProfile, setVoiceProfile, speakOperational, stopOperationalAudio } from '../lib/sound'

export default function Settings({
  onNotify,
  mobileFeedStatus='unconfigured',
  dataMode='test',
  onChangeDataMode,
  realQueueCount=0,
  mobileConfig={},
  fog={},
  onRunHealthCheck,
}){
  const stored=(()=>{try{return JSON.parse(localStorage.getItem('lotisec-interface-settings')||'{}')}catch{return {}}})()
  const [language,setLanguage]=useState(stored.language||'Français')
  const [timezone,setTimezone]=useState(stored.timezone||'GMT — Lomé')
  const [pageSize,setPageSize]=useState(stored.pageSize||'10')
  const [voiceProfile,setVoiceProfileState]=useState(stored.voiceProfile||getVoiceProfile())
  const [tested,setTested]=useState(false)
  const [africanVoice,setAfricanVoice]=useState(getAfricanVoiceInfo())

  useEffect(()=>{
    const update=()=>setAfricanVoice(getAfricanVoiceInfo())
    update()
    window.speechSynthesis?.addEventListener?.('voiceschanged',update)
    return()=>window.speechSynthesis?.removeEventListener?.('voiceschanged',update)
  },[])

  const save=()=>{
    localStorage.setItem('lotisec-interface-settings',JSON.stringify({language,timezone,pageSize,voiceProfile}))
    setVoiceProfile(voiceProfile)
    onNotify('Préférences enregistrées sur cet appareil','green')
  }
  const testVoice=()=>{
    setVoiceProfile(voiceProfile)
    speakOperational('Guidage vocal LOTISEC activé. Les annonces opérationnelles sont prêtes.')
    onNotify('Test du guidage vocal lancé','blue')
  }
  const stopVoice=()=>{
    stopOperationalAudio()
    onNotify('Annonces vocales arrêtées','blue')
  }
  const testConnections=async()=>{
    setTested(true)
    await onRunHealthCheck?.()
    const result=await fog?.syncNow?.()
    const online=mobileFeedStatus==='connected'||result?.ok
    onNotify(
      mobileFeedStatus==='connected'?'Flux mobile réel et synchronisation accessibles':result?.ok?'Bac à sable et moteur Fog local vérifiés':'Connectivité indisponible · file Fog locale active',
      online?'green':'amber',
    )
  }

  const events=[
    ['incident:new','Entrant','Backend / mobile','id, type, severity, lat, lng, accuracy, victims, vehicles, timestamp, correlationId','Normaliser · isoler/tester · alerter · accuser réception'],
    ['incident:web:ack','Sortant','Plateforme web','incidentId, correlationId, status, receivedAt','Confirmer la réception et éviter les doublons'],
    ['ambulance:position','Entrant','GPS ambulance','ambulanceId, missionId, lat, lng, heading, speed, capturedAt','Déplacer l’ambulance et actualiser la télémétrie'],
    ['hospital:capacity','Entrant','Hôpital','hospitalId, beds, occupancy, reception, updatedAt','Recalculer la recommandation hospitalière'],
    ['mission:created','Sortant','Plateforme web','missionId, incidentId, ambulanceId, score, operatorId','Notifier le mobile et les équipes terrain'],
    ['mission:status:update','Sortant','Plateforme web','missionId, status, timestamp','Synchroniser le cycle de prise en charge'],
    ['mission:orientation','Sortant','Plateforme web','missionId, hospitalId, availableBeds, operatorId','Confirmer la destination retenue'],
  ]

  return <>
    <PageTitle title="Paramètres" subtitle="Préférences, séparation stricte des environnements et contrat de connexion mobile." action={<button type="button" onClick={save} className="btn-primary"><Save size={16}/>Enregistrer</button>}/>

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="surface p-5">
        <h3 className="font-semibold">Interface et guidage vocal</h3>
        <div className="mt-4 space-y-4">
          <Field label="Langue"><select value={language} onChange={event=>setLanguage(event.target.value)} className="input"><option>Français</option><option>English</option></select></Field>
          <Field label="Fuseau horaire"><select value={timezone} onChange={event=>setTimezone(event.target.value)} className="input"><option>GMT — Lomé</option><option>UTC</option></select></Field>
          <Field label="Éléments par page"><select value={pageSize} onChange={event=>setPageSize(event.target.value)} className="input"><option>10</option><option>20</option><option>50</option></select></Field>
          <Field label="Voix des annonces"><select value={voiceProfile} onChange={event=>setVoiceProfileState(event.target.value)} className="input"><option value="africaine">Voix africaine — français</option><option value="calme">Voix africaine calme</option><option value="systeme">Voix française du système</option></select></Field>
          <div className={`rounded-xl border p-3 text-xs ${africanVoice.available?'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300':'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300'}`}>
            <b>{africanVoice.available?'Voix française d’Afrique détectée':'Voix d’Afrique non installée sur cet appareil'}</b>
            <div className="mt-1 opacity-80">{africanVoice.available?`${africanVoice.name} · ${africanVoice.lang}`:'La meilleure voix française disponible sera utilisée. Les bips d’urgence restent locaux et fonctionnent hors connexion.'}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={testVoice} className="btn-secondary"><Volume2 size={16}/>Tester la voix</button><button type="button" onClick={stopVoice} className="btn-secondary"><VolumeX size={16}/>Arrêter les annonces</button></div>
        </div>
      </section>

      <section className="surface p-5">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Environnement de données</h3><Status tone={dataMode==='real'?'green':'blue'}>{dataMode==='real'?'RÉEL':'TEST ISOLÉ'}</Status></div>
        <p className="mt-2 text-xs leading-5 muted">Le mode test et le flux réel utilisent deux canaux séparés. Les événements terrain reçus pendant un test sont conservés dans une file indépendante et ne modifient jamais le scénario.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeCard icon={Smartphone} title="Bac à sable test" detail="Incidents, GPS, capacités et statistiques simulés localement." active={dataMode==='test'} status="Toujours disponible" onClick={()=>onChangeDataMode?.('test')}/>
          <ModeCard icon={Radio} title="Flux mobile réel" detail="Événements validés et diffusés par le backend NestJS." active={dataMode==='real'} status={mobileFeedStatus==='connected'?'Connecté':mobileFeedStatus==='offline'?'Hors ligne':'À configurer'} onClick={()=>onChangeDataMode?.('real')}/>
        </div>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300"><b>{realQueueCount} événement(s) réel(s) isolé(s).</b> Ils ne modifieront pas le mode test.</div>
        <button type="button" onClick={testConnections} className="btn-secondary mt-4 w-full"><PlugZap size={16}/>{tested?'Revérifier les connexions':'Tester les connexions'}</button>
      </section>
    </div>

    <section className="surface mt-4 p-5">
      <div className="flex items-center gap-2"><PlugZap size={18} className="text-blue-600"/><h3 className="font-semibold">Branchement de l’application mobile réelle</h3></div>
      <p className="mt-2 max-w-4xl text-sm leading-6 muted">Le téléphone envoie l’urgence au backend NestJS. Celui-ci valide le schéma, applique l’authentification Keycloak, enregistre la géométrie dans PostgreSQL/PostGIS, puis diffuse l’événement au web. Aucune connexion directe téléphone–navigateur n’est requise.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><IntegrationStep index="1" title="Authentifier" text="Jeton Keycloak et identifiant du terminal transmis au backend."/><IntegrationStep index="2" title="Valider" text="Schéma versionné, coordonnées, précision, victimes et corrélation."/><IntegrationStep index="3" title="Diffuser" text="Le backend émet incident:new et attend incident:web:ack."/><IntegrationStep index="4" title="Synchroniser" text="Missions, GPS, capacités et statistiques sont actualisés en temps réel."/></div>
    </section>

    <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <section className="surface p-5">
        <div className="flex items-center gap-2"><LockKeyhole size={18} className="text-emerald-600"/><h3 className="font-semibold">Champs de configuration prévus</h3></div>
        <div className="mt-4 space-y-3">
          <Config label="API NestJS" value={mobileConfig.apiUrl||'VITE_API_URL — à configurer'}/>
          <Config label="Socket.IO" value={mobileConfig.socketUrl||'VITE_SOCKET_URL — à configurer'}/>
          <Config label="Namespace / chemin" value={`${mobileConfig.namespace||'/lotisec'} · ${mobileConfig.socketPath||'/socket.io'}`}/>
          <Config label="OSRM" value={mobileConfig.osrmUrl||import.meta.env.VITE_OSRM_URL||'VITE_OSRM_URL — repli local actif'}/>
          <Config label="Tenant" value={mobileConfig.tenantId||'lotisec'}/>
          <Config label="Keycloak" value={mobileConfig.keycloakUrl?`${mobileConfig.keycloakUrl} · ${mobileConfig.keycloakRealm}`:'VITE_KEYCLOAK_URL — à configurer'}/>
          <Config label="Client public" value={mobileConfig.keycloakClientId||'lotisec-web'}/>
        </div>
        <div className="mt-4 flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200"><ShieldCheck size={16} className="shrink-0"/><span>Aucun secret, mot de passe ou jeton statique n’est prévu dans les variables <code>VITE_*</code>.</span></div>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800"><h3 className="font-semibold">Contrat d’événements temps réel</h3><p className="mt-1 text-xs muted">Noms personnalisables dans <code>.env</code> sans modifier les pages.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="p-3">Événement</th><th>Sens</th><th>Émetteur</th><th>Champs principaux</th><th>Traitement web</th></tr></thead><tbody>{events.map(row=><tr key={row[0]} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-mono text-xs font-bold text-blue-600">{row[0]}</td><td><Status tone={row[1]==='Entrant'?'green':'blue'}>{row[1]}</Status></td><td className="text-xs">{row[2]}</td><td className="text-xs muted">{row[3]}</td><td className="text-xs muted">{row[4]}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  </>
}

function Field({label,children}){return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}<div className="mt-1.5">{children}</div></label>}
function IntegrationStep({index,title,text}){return <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">{index}</span><b className="mt-3 block text-sm">{title}</b><p className="mt-1 text-xs leading-5 muted">{text}</p></div>}
function ModeCard({icon:Icon,title,detail,active,status,onClick}){return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active?'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10 dark:bg-blue-950/25':'border-slate-200 hover:border-blue-300 dark:border-slate-700'}`}><div className="flex items-center justify-between gap-2"><span className={`grid h-10 w-10 place-items-center rounded-xl ${active?'bg-blue-600 text-white':'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}><Icon size={19}/></span>{active&&<CheckCircle2 size={18} className="text-blue-600"/>}</div><b className="mt-3 block text-sm">{title}</b><p className="mt-1 text-xs leading-5 muted">{detail}</p><span className="mt-2 block text-[10px] font-bold text-blue-600">{status}</span></button>}
function Config({label,value}){return <div className="grid gap-1 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-[120px_1fr] dark:bg-slate-900"><span className="muted">{label}</span><b className="break-all">{value}</b></div>}
