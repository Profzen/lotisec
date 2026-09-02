import { Activity, Ambulance, BellRing, Building2, FileSpreadsheet, Radio } from 'lucide-react'
import { Kpi, PageTitle, Status } from '../components/UI'
import { downloadLotisecReport } from '../lib/xlsxReport'

const closedStatuses=['Clôturée','Rejetée']

export default function Statistics({alerts=[],ambulances=[],hospitals=[],mission,missionHistory=[],metrics=[],auditLog=[],fog={},mobileFeedStatus,dataMode='test',onNotify}){
  const activeAlerts=alerts.filter(item=>!closedStatuses.includes(item.status))
  const critical=activeAlerts.filter(item=>['Critique','Élevée','Haute'].includes(item.severity)).length
  const available=ambulances.filter(item=>item.status==='Disponible').length
  const availability=ambulances.length?Math.round(available/ambulances.length*100):0
  const availableBeds=hospitals.reduce((sum,item)=>sum+(Number(item.beds)||0),0)
  const victims=activeAlerts.reduce((sum,item)=>sum+(Number(item.victims)||0),0)
  const typeCounts=Object.entries(alerts.reduce((result,item)=>{
    const key=item.type||'Autre urgence'
    result[key]=(result[key]||0)+1
    return result
  },{})).sort((a,b)=>b[1]-a[1])
  const maxType=Math.max(1,...typeCounts.map(([,value])=>value))
  const latestMobile=alerts.find(item=>String(item.source||'').toLowerCase().includes('mobile'))
  const updatedAt=auditLog[0]?.time||new Date().toLocaleTimeString('fr-FR')

  const exportXlsx=()=>{
    downloadLotisecReport({alerts,ambulances,hospitals,mission,missionReports:missionHistory,metrics,auditLog,fog,dataMode})
    onNotify('Rapport XLSX complet généré avec 8 feuilles et des en-têtes clairs','green')
  }

  return <>
    <PageTitle title="Statistiques en temps réel" subtitle="Les indicateurs sont recalculés automatiquement à chaque signalement, affectation, position GPS et changement de capacité." action={<button type="button" onClick={exportXlsx} className="btn-primary"><FileSpreadsheet size={17}/>Télécharger le rapport XLSX</button>}/>
    <section className="surface mb-4 flex flex-col justify-between gap-3 border-blue-200 bg-blue-50/60 p-4 md:flex-row md:items-center dark:border-blue-900 dark:bg-blue-950/20"><div><div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-100"><FileSpreadsheet size={18}/>Rapport opérationnel structuré</div><p className="mt-1 text-xs muted">Le classeur contient une synthèse et des feuilles séparées pour les incidents, missions, ambulances, centres de santé, mesures, événements Fog et journal opérationnel.</p></div><Status tone="blue">8 FEUILLES</Status></section>
    <section className="surface mb-4 flex flex-col justify-between gap-3 border-emerald-200 bg-emerald-50/60 p-4 md:flex-row md:items-center dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white"><Radio size={18} className={mobileFeedStatus==='connected'?'animate-pulse':''}/></span><div><div className="font-semibold">Mise à jour automatique active</div><div className="mt-1 text-xs muted">Dernière activité à {updatedAt} · {mobileFeedStatus==='connected'?'backend temps réel connecté':'adaptateur prêt, données du mode test actives'}</div></div></div>
      <Status tone={dataMode==='real'&&mobileFeedStatus==='connected'?'green':'blue'}>{dataMode==='real'?'FLUX RÉEL':'MODE TEST ISOLÉ'}</Status>
    </section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Alertes actives" value={activeAlerts.length} icon={BellRing} tone="red" hint={`${critical} critique(s) · ${victims} victime(s)`}/>
      <Kpi label="Mission en cours" value={mission?1:0} icon={Activity} tone="blue" hint={mission?`${mission.ambulanceId} · ${mission.status}`:'En attente d’affectation'}/>
      <Kpi label="Ambulances disponibles" value={`${available}/${ambulances.length}`} icon={Ambulance} tone="green" hint={`${availability}% de disponibilité`}/>
      <Kpi label="Capacité hospitalière" value={availableBeds} icon={Building2} tone="violet" hint={`${hospitals.length} hôpital(aux) suivi(s)`}/>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_.9fr]">
      <section className="surface p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Répartition des incidents reçus</h3><p className="mt-1 text-xs muted">Calculée à partir du flux actuellement chargé dans la plateforme.</p></div><Status tone="blue">{alerts.length} TOTAL</Status></div><div className="mt-5 space-y-4">{typeCounts.length?typeCounts.map(([label,value])=><div key={label}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate">{label}</span><b>{value}</b></div><div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2.5 rounded-full bg-gradient-to-r from-blue-700 to-sky-400 transition-all" style={{width:`${Math.max(8,value/maxType*100)}%`}}/></div></div>):<div className="rounded-xl bg-slate-50 p-6 text-center text-sm muted dark:bg-slate-900">Aucun incident reçu.</div>}</div></section>
      <section className="surface overflow-hidden"><div className="border-b border-slate-100 p-5 dark:border-slate-800"><h3 className="font-semibold">Activité opérationnelle récente</h3><p className="mt-1 text-xs muted">Le journal et les compteurs se rafraîchissent sans recharger la page.</p></div><div className="lotisec-scroll-panel max-h-[340px] overflow-y-auto p-3">{auditLog.slice(0,8).map(event=><div key={event.id} className="flex gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-900"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${event.tone==='red'?'bg-red-500':event.tone==='green'?'bg-emerald-500':'bg-blue-500'}`}/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><b className="text-sm">{event.action}</b><span className="shrink-0 text-[10px] muted">{event.time}</span></div><p className="mt-1 text-xs leading-5 muted">{event.details}</p></div></div>)}</div></section>
    </div>
    {latestMobile&&<section className="surface mt-4 p-4"><div className="text-[10px] font-black uppercase tracking-[.14em] text-red-600">Dernier signalement mobile intégré aux statistiques</div><div className="mt-2 flex flex-col justify-between gap-2 md:flex-row md:items-center"><div><b>{latestMobile.type}</b><p className="mt-1 text-xs muted">{latestMobile.location} · {latestMobile.victims} victime(s) · reçu à {latestMobile.received}</p></div><Status tone="red">{latestMobile.severity}</Status></div></section>}
  </>
}
