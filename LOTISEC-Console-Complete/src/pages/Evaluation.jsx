import { Activity, CheckCircle2, Clock3, Cloud, Database, Gauge, Play, Route, Smartphone, WifiOff } from 'lucide-react'
import { Kpi, PageTitle, Status } from '../components/UI'

const targetRows=[
  ['Réception mobile','Signalement reçu, normalisé et affiché sur la carte','Implémenté'],
  ['Aide à la décision','Classement explicable des ambulances et centres de santé','Implémenté'],
  ['Navigation dynamique','Instruction suivante, vitesse, distance restante et ETA actualisée','Implémenté'],
  ['Routage','OSRM avec voies nommées, alternatives et itinéraire local de secours','Implémenté'],
  ['Trafic routier','Congestion injectée pour vérifier le mécanisme de reroutage','Scénario simulé'],
  ['Continuité locale','File IndexedDB persistante en cas de coupure','Implémenté'],
  ['Reprise Fog–Cloud','Synchronisation, acquittement et suppression après succès','Implémenté'],
  ['Nœud Fog physique','Équipement de proximité réellement déployé sur le terrain','Non déployé'],
]

export default function Evaluation({metrics,fog,onRunDemo,onResetMetrics}){
  const latest=name=>metrics.find(metric=>metric.name===name)
  const mobile=latest('Traitement du signalement')
  const routing=latest('Calcul des itinéraires')
  const decision=latest('Décision géospatiale')
  const sync=latest('Synchronisation Fog–Cloud')

  return <>
    <PageTitle title="Évaluation du prototype" subtitle="Mesures générées pendant le mode test et périmètre réel de validation." action={<div className="flex gap-2"><button type="button" onClick={onResetMetrics} className="btn-secondary">Réinitialiser les mesures</button><button type="button" onClick={()=>onRunDemo(true)} className="btn-primary"><Play size={16}/>Lancer le mode test</button></div>}/>

    <section className="surface mb-4 overflow-hidden border-blue-200 dark:border-blue-900">
      <div className="grid md:grid-cols-[1fr_auto] md:items-center">
        <div className="p-5"><div className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Protocole du mode test</div><h3 className="mt-2 text-xl font-bold">Une chaîne complète, mesurée et traçable</h3><p className="mt-2 max-w-3xl text-sm leading-6 muted">Les temps ci-dessous proviennent des opérations exécutées dans cette session. Ils évaluent le prototype logiciel ; ils ne constituent pas une mesure de latence d’un nœud Fog physique.</p></div>
        <div className="border-t border-slate-100 bg-slate-50 p-5 text-center md:border-l md:border-t-0 dark:border-slate-800 dark:bg-slate-900"><div className="text-3xl font-black text-blue-600">{metrics.length}</div><div className="mt-1 text-xs font-semibold muted">mesures enregistrées</div></div>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Traitement du signalement" value={formatMetric(mobile)} icon={Smartphone} tone="red" hint="Réception et normalisation web"/>
      <Kpi label="Décision géospatiale" value={formatMetric(decision)} icon={Gauge} tone="violet" hint="Classement ambulance + centre"/>
      <Kpi label="Calcul des itinéraires" value={formatMetric(routing)} icon={Route} tone="blue" hint="OSRM ou repli local"/>
      <Kpi label="Dernière synchronisation" value={sync?formatMetric(sync):fog.stats.lastDuration?`${fog.stats.lastDuration} ms`:'À mesurer'} icon={Cloud} tone="green" hint={`${fog.stats.syncRate}% d’acquittements`}/>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
      <section className="surface overflow-hidden"><div className="border-b border-slate-100 p-4 dark:border-slate-800"><h3 className="font-semibold">Périmètre de validation</h3><p className="mt-1 text-xs muted">Ce que le test permet d’affirmer sans surévaluer le prototype.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="p-3">Mécanisme</th><th>Preuve dans la plateforme</th><th>État</th></tr></thead><tbody>{targetRows.map(row=><tr key={row[0]} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-semibold">{row[0]}</td><td className="muted">{row[1]}</td><td><Status tone={row[2]==='Implémenté'?'green':'amber'}>{row[2]}</Status></td></tr>)}</tbody></table></div><div className="border-t border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300"><b>Lecture scientifique :</b> les mesures valident le comportement logiciel du prototype. Elles ne démontrent ni un gain réel de latence Fog, ni l’usage d’un trafic terrain continu sans déploiement physique et source de trafic partenaire.</div></section>

      <section className="surface p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Matrice des scénarios réseau</h3><p className="mt-1 text-xs muted">Comportement attendu et mécanisme observé.</p></div><Status tone={fog.effectiveMode==='offline'?'red':fog.effectiveMode==='degraded'?'amber':'green'}>{fog.quality.label}</Status></div><div className="mt-4 space-y-3"><Scenario icon={Activity} title="Connexion normale" detail="Transmission directe, synchronisation automatique et acquittement." active={fog.networkMode==='normal'} tone="green"/><Scenario icon={Clock3} title="Connexion dégradée" detail="Calcul local maintenu, file persistante et envoi temporisé." active={fog.networkMode==='degraded'} tone="amber"/><Scenario icon={WifiOff} title="Perte temporaire" detail="Conservation locale, aucune suppression, reprise au retour du réseau." active={fog.networkMode==='offline'} tone="red"/></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Mini label="En attente" value={fog.queue.length}/><Mini label="Synchronisées" value={fog.stats.synced}/><Mini label="Échecs" value={fog.stats.failures}/></div></section>
    </div>

    <section className="surface mt-4 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800"><div><h3 className="font-semibold">Journal des mesures</h3><p className="mt-1 text-xs muted">Valeurs horodatées produites par les actions du prototype.</p></div><Status tone="blue"><Database size={13}/>{metrics.length} TRACES</Status></div>{metrics.length?<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="p-3">Heure</th><th>Mesure</th><th>Valeur</th><th>Moteur</th><th>Détail</th></tr></thead><tbody>{metrics.map(metric=><tr key={metric.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 text-xs muted">{metric.time}</td><td className="font-semibold">{metric.name}</td><td><b className="text-blue-600">{metric.value} {metric.unit}</b></td><td>{metric.source}</td><td className="muted">{metric.detail}</td></tr>)}</tbody></table></div>:<div className="p-8 text-center text-sm muted"><CheckCircle2 className="mx-auto mb-2 text-slate-300"/>Lancez le mode test pour générer les premières mesures.</div>}</section>
  </>
}

function formatMetric(metric){return metric?`${metric.value} ${metric.unit}`:'À mesurer'}
function Scenario({icon:Icon,title,detail,active,tone}){const color=tone==='green'?'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20':tone==='amber'?'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20':'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20';return <div className={`flex gap-3 rounded-xl border p-3 ${active?color:'border-slate-200 dark:border-slate-700'}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active?'bg-white/80 text-blue-600 dark:bg-slate-900':'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}><Icon size={17}/></span><div><div className="flex items-center gap-2"><b className="text-sm">{title}</b>{active&&<span className="h-2 w-2 animate-pulse rounded-full bg-blue-600"/>}</div><p className="mt-1 text-xs muted">{detail}</p></div></div>}
function Mini({label,value}){return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><b className="block text-lg">{value}</b><span className="text-[10px] muted">{label}</span></div>}
