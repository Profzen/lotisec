import { Activity, Cloud, CloudOff, Database, HardDrive, RefreshCw, Server, ShieldCheck, Signal, Wifi, WifiOff } from 'lucide-react'
import { Kpi, PageTitle, Status } from '../components/UI'

const modeCopy={
  normal:{label:'Connexion normale',description:'Échanges directs et synchronisation automatique.',tone:'green',icon:Wifi},
  degraded:{label:'Connexion dégradée',description:'Traitements locaux maintenus, transmission ralentie.',tone:'amber',icon:Signal},
  offline:{label:'Perte temporaire',description:'Données protégées dans la file locale persistante.',tone:'red',icon:WifiOff},
}

export default function Fog({fog,onQueueTest,onNotify}){
  const current=modeCopy[fog.effectiveMode]
  const CurrentIcon=current.icon
  const lastSync=fog.lastSync?new Date(fog.lastSync).toLocaleTimeString('fr-FR'):'Aucune'
  const queueTest=async()=>{
    await onQueueTest?.()
    onNotify?.('Événement de télémétrie enregistré dans la file Fog','amber')
  }
  const synchronize=async()=>{
    const result=await fog.syncNow()
    onNotify?.(result?.ok?'Synchronisation vérifiée':'Synchronisation différée : connexion indisponible',result?.ok?'green':'red')
  }

  return <>
    <PageTitle title="Fog & synchronisation" subtitle="Mécanismes locaux exécutés dans le prototype : file persistante, reprise réseau et acquittement Cloud." action={<Status tone={current.tone}><CurrentIcon size={14}/>{current.label}</Status>}/>

    <section className="surface mb-4 overflow-hidden border-blue-200 dark:border-blue-900">
      <div className="grid lg:grid-cols-[1.2fr_.8fr]">
        <div className="bg-gradient-to-br from-[#072b4d] to-[#0d4d7d] p-5 text-white">
          <div className="text-[10px] font-black uppercase tracking-[.18em] text-sky-200">Prototype Fog fonctionnel</div>
          <h3 className="mt-2 text-xl font-bold">Continuité de service en connectivité dégradée</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Les opérations sont placées dans une file IndexedDB persistante. À la reprise, le moteur les transmet, attend un acquittement puis les retire de la file.</p>
          <div className="mt-4 flex flex-wrap gap-2"><span className="chip bg-white/10 text-white"><HardDrive size={13}/>{fog.storage}</span><span className="chip bg-white/10 text-white"><ShieldCheck size={13}/>Aucune donnée supprimée avant acquittement</span></div>
        </div>
        <div className="p-5">
          <div className="text-xs font-bold uppercase tracking-wider muted">Scénarios réseau</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">{Object.entries(modeCopy).map(([mode,item])=>{const Icon=item.icon;return <button type="button" key={mode} onClick={()=>fog.setNetworkMode(mode)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${fog.networkMode===mode?'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10 dark:bg-blue-950/25':'border-slate-200 hover:border-blue-300 dark:border-slate-700'}`}><span className={`grid h-9 w-9 place-items-center rounded-xl ${mode==='normal'?'bg-emerald-100 text-emerald-700':mode==='degraded'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}><Icon size={17}/></span><span><b className="block text-sm">{item.label}</b><span className="text-[10px] muted">{item.description}</span></span></button>})}</div>
        </div>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="État réseau" value={fog.quality.label} icon={CurrentIcon} tone={current.tone} hint={`${fog.quality.latency} · pertes ${fog.quality.loss}`}/>
      <Kpi label="File locale" value={fog.queue.length} icon={Database} tone={fog.queue.length?'amber':'green'} hint={fog.queue.length?'Données persistées':'File synchronisée'}/>
      <Kpi label="Dernière synchronisation" value={lastSync} icon={RefreshCw} tone="blue" hint={fog.syncing?'Transmission en cours':'Acquittement vérifié'}/>
      <Kpi label="Taux de synchronisation" value={`${fog.stats.syncRate}%`} icon={Cloud} tone="violet" hint={`${fog.stats.synced} donnée(s) acquittée(s)`}/>
    </div>

    <section className={`surface mt-4 overflow-hidden ${fog.effectiveMode==='offline'?'border-red-300':fog.effectiveMode==='degraded'?'border-amber-300':'border-emerald-300'}`}>
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center dark:border-slate-800"><div><div className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">Continuité fonctionnelle observable</div><h3 className="mt-1 font-semibold">Ce qui reste disponible pendant la dégradation réseau</h3></div><Status tone={fog.effectiveMode==='offline'?'red':fog.effectiveMode==='degraded'?'amber':'green'}>{fog.effectiveMode==='offline'?'MODE LOCAL ACTIF':fog.effectiveMode==='degraded'?'TRANSMISSION RALENTIE':'SYNCHRONISATION DIRECTE'}</Status></div>
      <div className="grid gap-3 p-4 md:grid-cols-3"><ContinuityItem icon={Activity} title="Signalement et décision locale" text="Réception, validation et classement des ressources restent utilisables." active/><ContinuityItem icon={HardDrive} title="Stockage temporaire" text={`${fog.queue.length} événement(s) protégé(s) dans la file persistante.`} active/><ContinuityItem icon={RefreshCw} title="Reprise Fog–Cloud" text={fog.effectiveMode==='offline'?'En attente du retour réseau avant acquittement.':fog.syncing?'Transmission progressive en cours.':'Synchronisation automatique prête.'} active={fog.effectiveMode!=='offline'}/></div>
      <div className="grid grid-cols-3 border-t border-slate-100 text-center text-[10px] font-bold dark:border-slate-800"><div className="bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/20">1 · Détecter la coupure</div><div className="bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/20">2 · Conserver localement</div><div className="bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/20">3 · Synchroniser et acquitter</div></div>
    </section>

    <section className="surface mt-4 p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h3 className="font-semibold">Chaîne Edge → Fog local → Cloud</h3><p className="mt-1 text-xs muted">Le nœud Fog physique reste non déployé ; ses mécanismes fonctionnels sont reproduits sur le terminal du prototype.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={queueTest} className="btn-secondary"><Database size={16}/>Ajouter une donnée test</button><button type="button" disabled={fog.syncing} onClick={synchronize} className="btn-primary"><RefreshCw size={16} className={fog.syncing?'animate-spin':''}/>{fog.syncing?'Synchronisation…':'Synchroniser maintenant'}</button></div></div>
      <div className="mt-5 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Node icon={Activity} title="Edge" state="Applications terrain" text="Signalement, GPS et saisie locale" tone="blue"/>
        <Arrow active={fog.effectiveMode!=='offline'}/>
        <Node icon={Server} title="Fog local" state={fog.storage} text={`${fog.queue.length} donnée(s) en attente`} tone={fog.queue.length?'amber':'green'}/>
        <Arrow active={fog.effectiveMode!=='offline'}/>
        <Node icon={fog.effectiveMode==='offline'?CloudOff:Cloud} title="Cloud" state={fog.effectiveMode==='offline'?'Inaccessible':'Prêt à acquitter'} text={fog.lastSync?`Dernière reprise ${lastSync}`:'En attente de la première reprise'} tone={fog.effectiveMode==='offline'?'red':'violet'}/>
      </div>
    </section>

    <div className="lotisec-fixed-split mt-4 grid gap-4 2xl:h-[430px] xl:grid-cols-[.8fr_1.2fr]">
      <section className="surface p-4"><h3 className="font-semibold">File persistante</h3><p className="mt-1 text-xs muted">Les éléments restent disponibles après actualisation de la page.</p><div className="mt-4 space-y-2">{fog.queue.length?fog.queue.slice(0,6).map(item=><div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"><div className="flex items-center justify-between gap-2"><b className="text-xs text-amber-900 dark:text-amber-200">{item.type}</b><span className="text-[10px] text-amber-700 dark:text-amber-300">{new Date(item.createdAt).toLocaleTimeString('fr-FR')}</span></div><div className="mt-1 truncate text-[10px] text-amber-700/80 dark:text-amber-300/75">{item.source}</div></div>):<div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-5 text-center text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300"><ShieldCheck className="mx-auto mb-2" size={22}/>Toutes les données ont été acquittées.</div>}</div></section>
      <section className="surface p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Journal de synchronisation</h3><p className="mt-1 text-xs muted">Preuves horodatées des mises en attente, reprises et acquittements.</p></div><Status tone="blue">{fog.history.length} ÉVÉNEMENTS</Status></div><div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">{fog.history.length?fog.history.map(event=><div key={event.id} className="flex gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${event.tone==='green'?'bg-emerald-500':event.tone==='amber'?'bg-amber-500':event.tone==='red'?'bg-red-500':'bg-blue-500'}`}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{event.title}</b><span className="text-[10px] muted">{event.time}</span></div><p className="mt-1 text-xs muted">{event.detail}</p></div></div>):<div className="rounded-xl bg-slate-50 p-6 text-center text-sm muted dark:bg-slate-900">Choisissez un scénario réseau pour commencer le mode test.</div>}</div></section>
    </div>
  </>
}

function Node({icon:Icon,title,state,text,tone}){const colors={blue:'bg-blue-50 text-blue-700 dark:bg-blue-950/30',green:'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30',amber:'bg-amber-50 text-amber-700 dark:bg-amber-950/30',red:'bg-red-50 text-red-700 dark:bg-red-950/30',violet:'bg-violet-50 text-violet-700 dark:bg-violet-950/30'};return <div className={`rounded-2xl border border-current/15 p-5 text-center ${colors[tone]}`}><Icon className="mx-auto" size={25}/><div className="mt-3 font-bold">{title}</div><div className="mt-1 text-xs font-semibold">{state}</div><div className="mt-2 text-[10px] opacity-75">{text}</div></div>}
function Arrow({active}){return <div className="grid place-items-center"><span className={`h-1 w-full min-w-8 rounded-full ${active?'bg-gradient-to-r from-blue-400 to-emerald-400':'bg-slate-200 dark:bg-slate-700'}`}/></div>}
function ContinuityItem({icon:Icon,title,text,active}){return <div className={`rounded-2xl border p-4 ${active?'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20':'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}><div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-xl ${active?'bg-emerald-600 text-white':'bg-slate-200 text-slate-500 dark:bg-slate-800'}`}><Icon size={16}/></span><b className="text-sm">{title}</b></div><p className="mt-2 text-xs leading-5 muted">{text}</p></div>}
