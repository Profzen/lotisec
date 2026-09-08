import { useEffect, useState } from 'react'
import { CheckCircle2, MonitorPlay, PlugZap, Radio, Save, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
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
  const [timezone,setTimezone]=useState(stored.timezone||'GMT - Lomé')
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
      mobileFeedStatus==='connected'?'Flux mobile réel et synchronisation accessibles':result?.ok?'Mode test et continuité locale vérifiés':'Connectivité indisponible · conservation locale active',
      online?'green':'amber',
    )
  }

  const events=[
    ['Nouveau signalement','Entrant','Application de signalement','Localisation, gravité et nombre de victimes','Afficher l’urgence, alerter et demander une validation'],
    ['Confirmation de réception','Sortant','Centre opérationnel','Référence et heure de réception','Confirmer la prise en compte et éviter les doublons'],
    ['Position de l’ambulance','Entrant','Équipe terrain','Position et état de la mission','Déplacer l’ambulance sur la carte'],
    ['Capacité d’accueil','Entrant','Centre de santé','Places, occupation et disponibilité','Actualiser l’orientation hospitalière'],
    ['Ordre de mission','Sortant','Centre opérationnel','Incident, ambulance et destination','Informer les équipes engagées'],
    ['Avancement de la mission','Sortant','Centre opérationnel','Étape et heure de mise à jour','Actualiser les trois espaces LOTISEC'],
  ]

  return <>
    <PageTitle title="Paramètres" subtitle="Préférences, mode test et préparation des connexions terrain." action={<button type="button" onClick={save} className="btn-primary"><Save size={16}/>Enregistrer</button>}/>

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="surface p-5">
        <h3 className="font-semibold">Interface et guidage vocal</h3>
        <div className="mt-4 space-y-4">
          <Field label="Langue"><select value={language} onChange={event=>setLanguage(event.target.value)} className="input"><option>Français</option><option>English</option></select></Field>
          <Field label="Fuseau horaire"><select value={timezone} onChange={event=>setTimezone(event.target.value)} className="input"><option>GMT - Lomé</option><option>UTC</option></select></Field>
          <Field label="Éléments par page"><select value={pageSize} onChange={event=>setPageSize(event.target.value)} className="input"><option>10</option><option>20</option><option>50</option></select></Field>
          <Field label="Voix des annonces"><select value={voiceProfile} onChange={event=>setVoiceProfileState(event.target.value)} className="input"><option value="africaine">Voix africaine - français</option><option value="calme">Voix africaine calme</option><option value="systeme">Voix française du système</option></select></Field>
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
          <ModeCard icon={MonitorPlay} title="Mode test" detail="Incidents, déplacements, capacités et statistiques simulés sans modifier les données réelles." active={dataMode==='test'} status="Toujours disponible" onClick={()=>onChangeDataMode?.('test')}/>
          <ModeCard icon={Radio} title="Flux mobile réel" detail="Événements validés et diffusés par le backend NestJS." active={dataMode==='real'} status={mobileFeedStatus==='connected'?'Connecté':mobileFeedStatus==='offline'?'Hors ligne':'À configurer'} onClick={()=>onChangeDataMode?.('real')}/>
        </div>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300"><b>{realQueueCount} événement(s) réel(s) isolé(s).</b> Ils ne modifieront pas le mode test.</div>
        <button type="button" onClick={testConnections} className="btn-secondary mt-4 w-full"><PlugZap size={16}/>{tested?'Revérifier les connexions':'Tester les connexions'}</button>
      </section>
    </div>

    <section className="surface mt-4 p-5">
      <div className="flex items-center gap-2"><PlugZap size={18} className="text-blue-600"/><h3 className="font-semibold">Branchement de l’application mobile réelle</h3></div>
      <p className="mt-2 max-w-4xl text-sm leading-6 muted">Le téléphone envoie l’urgence au backend NestJS. Celui-ci valide le schéma, applique l’authentification Keycloak, enregistre la géométrie dans PostgreSQL/PostGIS, puis diffuse l’événement au web. Aucune connexion directe téléphone-navigateur n’est requise.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><IntegrationStep index="1" title="Authentifier" text="L’application transmet l’identité du terminal de manière sécurisée."/><IntegrationStep index="2" title="Vérifier" text="La localisation et les informations de l’urgence sont contrôlées."/><IntegrationStep index="3" title="Transmettre" text="Le serveur relaie le signalement au centre opérationnel et confirme sa réception."/><IntegrationStep index="4" title="Synchroniser" text="Missions, positions, capacités et statistiques sont actualisées en temps réel."/></div>
    </section>

    <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <section className="surface p-5">
        <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-600"/><h3 className="font-semibold">État de préparation des connexions</h3></div>
        <div className="mt-4 space-y-3">
          <ConnectionRow label="Serveur métier" ready={Boolean(mobileConfig.apiUrl)} detail="Réception et validation des signalements"/>
          <ConnectionRow label="Mises à jour en direct" ready={Boolean(mobileConfig.socketUrl)} detail="Incidents, positions et capacités"/>
          <ConnectionRow label="Calcul des itinéraires" ready={Boolean(mobileConfig.osrmUrl||import.meta.env.VITE_OSRM_URL)} detail="Routage routier et itinéraires alternatifs"/>
          <ConnectionRow label="Authentification" ready={Boolean(mobileConfig.keycloakUrl)} detail="Accès sécurisé selon le rôle"/>
          <ConnectionRow label="Organisation LOTISEC" ready detail="Environnement fonctionnel séparé du mode test"/>
        </div>
        <div className="mt-4 flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200"><ShieldCheck size={16} className="shrink-0"/><span>Les identifiants sensibles restent protégés côté serveur et ne sont pas enregistrés dans le navigateur.</span></div>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800"><h3 className="font-semibold">Échanges avec le terrain</h3><p className="mt-1 text-xs muted">Vue métier des informations partagées entre les applications et la plateforme.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="p-3">Information</th><th>Sens</th><th>Origine</th><th>Contenu</th><th>Résultat</th></tr></thead><tbody>{events.map(row=><tr key={row[0]} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 text-xs font-bold text-blue-600">{row[0]}</td><td><Status tone={row[1]==='Entrant'?'green':'blue'}>{row[1]}</Status></td><td className="text-xs">{row[2]}</td><td className="text-xs muted">{row[3]}</td><td className="text-xs muted">{row[4]}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  </>
}

function Field({label,children}){return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}<div className="mt-1.5">{children}</div></label>}
function IntegrationStep({index,title,text}){return <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">{index}</span><b className="mt-3 block text-sm">{title}</b><p className="mt-1 text-xs leading-5 muted">{text}</p></div>}
function ModeCard({icon:Icon,title,detail,active,status,onClick}){return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active?'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10 dark:bg-blue-950/25':'border-slate-200 hover:border-blue-300 dark:border-slate-700'}`}><div className="flex items-center justify-between gap-2"><span className={`grid h-10 w-10 place-items-center rounded-xl ${active?'bg-blue-600 text-white':'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}><Icon size={19}/></span>{active&&<CheckCircle2 size={18} className="text-blue-600"/>}</div><b className="mt-3 block text-sm">{title}</b><p className="mt-1 text-xs leading-5 muted">{detail}</p><span className="mt-2 block text-[10px] font-bold text-blue-600">{status}</span></button>}
function ConnectionRow({label,ready,detail}){return <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ready?'bg-emerald-500':'bg-amber-500'}`}/><div className="min-w-0 flex-1"><b>{label}</b><p className="mt-0.5 muted">{detail}</p></div><Status tone={ready?'green':'amber'}>{ready?'Prêt':'À relier'}</Status></div>}
