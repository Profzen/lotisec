import { Ambulance, BellRing, Building2, Clock3, CloudCog, MonitorPlay, Smartphone } from 'lucide-react'
import { interventions, routes } from '../data/demo'
import LomeMap from '../components/LomeMap'
import { Kpi, MiniRoute, PageTitle, SectionHeader, Status } from '../components/UI'

export default function Dashboard({alerts,ambulances,hospitals,hospitalRanking,mission,onNavigate,onSimulateMobile,onOpenAlert,onStartDemo,fog}){
  const recommendedId=mission?.hospitalId||mission?.recommendedHospitalId||hospitalRanking?.find(item=>item.recommended)?.id
  const criticalCount=alerts.filter(item=>['Critique','Élevée','Haute'].includes(item.severity)&&!['Clôturée','Rejetée'].includes(item.status)).length
  return <>
    <PageTitle title="Tableau de bord opérationnel" subtitle="Vue synthétique de la situation et aide à la décision." action={<div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={()=>onStartDemo(true)}><MonitorPlay size={17}/>Lancer le mode test</button><button type="button" className="btn-primary" onClick={onSimulateMobile}><Smartphone size={17}/>Simuler un signalement mobile</button></div>}/>
    <section className="surface mb-4 flex flex-col justify-between gap-3 border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 md:flex-row md:items-center dark:border-blue-900 dark:from-blue-950/25 dark:to-[#0b1e2d]"><div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${fog.effectiveMode==='offline'?'bg-red-100 text-red-700':fog.effectiveMode==='degraded'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}><CloudCog size={19}/></span><div><b className="text-sm">Continuité opérationnelle : {fog.quality.label}</b><p className="mt-1 text-xs muted">{fog.storage} · {fog.queue.length} donnée(s) en attente · synchronisation automatique au retour du réseau</p></div></div><button type="button" onClick={()=>onNavigate('fog')} className="btn-secondary">Superviser le Fog</button></section>
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <Kpi label="Alertes actives" value={alerts.filter(item=>!['Clôturée','Rejetée'].includes(item.status)).length} icon={BellRing} tone="red" hint={`${criticalCount} critique(s) · temps réel`}/>
      <Kpi label="Interventions en cours" value={mission?1:interventions.length} icon={Clock3} tone="blue" hint={mission?`${mission.ambulanceId} · ${mission.status}`:'mise à jour dynamique'}/>
      <Kpi label="Ambulances disponibles" value={ambulances.filter(a=>a.status==='Disponible').length} icon={Ambulance} tone="green" hint={`${ambulances.length} unités suivies`}/>
      <Kpi label="Hôpitaux connectés" value={hospitals.length} icon={Building2} tone="violet" hint="capacités déclarées"/>
    </div>
    <div className="lotisec-fixed-split mt-4 grid gap-4 2xl:h-[calc(100vh-19rem)] 2xl:min-h-[520px] 2xl:grid-cols-[1.5fr_.9fr]">
      <section className="surface p-4"><SectionHeader title="Carte opérationnelle" link="Ouvrir la carte" onClick={()=>onNavigate('map')}/><LomeMap alerts={alerts} ambulances={ambulances} hospitals={hospitals} mission={mission} height={430} onSelectAlert={onOpenAlert}/></section>
      <div className="space-y-4">
        <section className="surface p-4"><SectionHeader title="Alertes prioritaires" link="Tout afficher" onClick={()=>onNavigate('alerts')}/>{alerts.slice(0,3).map(a=><button type="button" onClick={()=>onOpenAlert(a)} key={a.id} className="mb-3 block w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-400 hover:shadow-sm dark:border-slate-700"><div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{a.type}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{a.location}</div></div><Status tone={a.severity==='Critique'?'red':'amber'}>{a.severity}</Status></div><div className="mt-2 text-xs text-slate-400">{a.source} · {a.received}</div></button>)}</section>
        <section className="surface p-4"><SectionHeader title="Routage" link="Comparer" onClick={()=>onNavigate('routing')}/><div className="space-y-2">{routes.slice(0,2).map(r=><MiniRoute key={r.id} {...r} onClick={()=>onNavigate('routing')}/>)}</div></section>
      </div>
    </div>
    <section className="surface mt-4 p-4"><SectionHeader title="Orientation hospitalière" link="Voir tous" onClick={()=>onNavigate('orientation')}/><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{hospitals.map(h=>{const ranked=hospitalRanking?.find(item=>item.id===h.id)||h,recommended=h.id===recommendedId;return <button type="button" onClick={()=>onNavigate('orientation')} key={h.id} className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${recommended?'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20':'border-slate-200 dark:border-slate-700'}`}><div className="flex justify-between gap-2"><div className="font-semibold">{h.name}</div>{recommended&&<Status>Recommandé · {ranked.decisionScore||'—'}%</Status>}</div><div className="mt-2 text-xs text-slate-500 dark:text-slate-400">ETA {ranked.decisionEta||h.eta} min · {h.beds} places · {h.specialty}</div></button>})}</div></section>
  </>
}
