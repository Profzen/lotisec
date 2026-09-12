import { useMemo, useState } from 'react'
import { Search, MapPin, Check, X, Ambulance, BellRing } from 'lucide-react'
import LomeMap from '../components/LomeMap'
import { PageTitle, Status } from '../components/UI'

export default function Alerts({alerts,ambulances,onSimulateMobile,onOpenMap,onAssign,onUpdateAlert}){
  const [selectedId,setSelectedId]=useState(alerts[0]?.id)
  const [query,setQuery]=useState('')
  const [severity,setSeverity]=useState('Toutes gravités')
  const [source,setSource]=useState('Toutes sources')
  const selected=useMemo(()=>alerts.find(a=>a.id===selectedId)||alerts[0],[alerts,selectedId])
  const mapAlerts=useMemo(()=>selected?[selected]:[],[selected])
  const mapAmbulances=useMemo(()=>ambulances.slice(0,2),[ambulances])
  const visible=useMemo(()=>alerts.filter(alert=>{
    const matchesText=`${alert.type} ${alert.location} ${alert.id}`.toLowerCase().includes(query.toLowerCase())
    const matchesSeverity=severity==='Toutes gravités'||alert.severity===severity
    const matchesSource=source==='Toutes sources'||String(alert.source).includes(source)
    return matchesText&&matchesSeverity&&matchesSource&&alert.status!=='Rejetée'
  }),[alerts,query,severity,source])

  if(!selected) return <><PageTitle title="Alertes & incidents" subtitle="Réception, validation et suivi des signalements issus du mobile et des opérateurs."/><section className="surface p-10 text-center"><BellRing className="mx-auto text-slate-300" size={38}/><h3 className="mt-3 font-semibold">En attente d’un signalement réel</h3><p className="mt-1 text-sm muted">La nouvelle urgence apparaîtra automatiquement dès sa réception par la plateforme.</p></section></>
  const validate=alert=>onUpdateAlert(alert.id,'Validée')
  return <>
    <PageTitle title="Alertes & incidents" subtitle="Réception, validation et suivi des signalements issus du mobile et des opérateurs." action={<button type="button" className="btn-primary" onClick={onSimulateMobile}>Recevoir un signalement</button>}/>
    <div className="surface mb-4 grid gap-3 p-3 md:grid-cols-[1fr_180px_180px_auto]">
      <div className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={event=>setQuery(event.target.value)} className="input pl-9" placeholder="Rechercher une alerte..."/></div>
      <select value={severity} onChange={event=>setSeverity(event.target.value)} className="input"><option>Toutes gravités</option><option>Critique</option><option>Élevée</option><option>Modérée</option></select>
      <select value={source} onChange={event=>setSource(event.target.value)} className="input"><option>Toutes sources</option><option>Application mobile</option><option>Opérateur</option></select>
      <button type="button" className="btn-secondary" onClick={onSimulateMobile}>Nouvelle alerte</button>
    </div>
    <div className="grid gap-4 2xl:h-[calc(100vh-15rem)] 2xl:min-h-[540px] 2xl:grid-cols-[.9fr_1.1fr] 2xl:overflow-hidden">
      <section className="surface flex min-h-0 flex-col p-3">
        <div className="mb-3 flex items-center justify-between px-1 text-xs muted"><span>{visible.length} alerte(s) active(s)</span><span>Temps réel</span></div>
        <div className="lotisec-scroll-panel min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{visible.map(alert=><article key={alert.id} onClick={()=>setSelectedId(alert.id)} className={`cursor-pointer rounded-xl border p-4 transition ${alert.id===selected.id?'border-blue-500 bg-blue-50/40 shadow-sm dark:bg-blue-950/20':'border-slate-200 hover:border-blue-300 dark:border-slate-700'}`}>
          <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold">{alert.type}{alert.status==='Nouveau'&&<span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>}</div><div className="mt-1 flex items-center gap-1 text-xs muted"><MapPin size={13}/>{alert.location}</div></div><Status tone={alert.severity==='Critique'?'red':alert.severity==='Élevée'?'orange':alert.severity==='Modérée'?'amber':'blue'}>{alert.severity}</Status></div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{alert.source}</span><span>•</span><span>{typeof alert.victims === 'number' ? `${alert.victims} victime(s)` : 'Victimes : Non renseigné'}</span><span>•</span><span>{alert.received}</span>{alert.status&&<><span>•</span><b>{alert.status}</b></>}</div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={event=>{event.stopPropagation();onOpenMap(alert)}} className="btn-secondary"><MapPin size={15}/>Carte</button><button type="button" onClick={event=>{event.stopPropagation();validate(alert)}} className="btn-primary !bg-emerald-600"><Check size={15}/>Valider</button><button type="button" onClick={event=>{event.stopPropagation();onAssign(ambulances.find(a=>a.status==='Disponible')||ambulances[0],alert.id)}} className="btn-secondary"><Ambulance size={15}/>Affecter</button><button type="button" onClick={event=>{event.stopPropagation();onUpdateAlert(alert.id,'Rejetée')}} className="btn-secondary text-red-600"><X size={15}/>Rejeter</button></div>
        </article>)}</div>
      </section>
      <section className="surface lotisec-scroll-panel min-h-0 p-4 2xl:h-full 2xl:overflow-y-auto">
        <div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-bold text-blue-600">ALERTE SÉLECTIONNÉE · {selected.id}</div><h3 className="mt-1 text-xl font-semibold">{selected.type}</h3></div><Status tone={selected.severity==='Critique'?'red':selected.severity==='Élevée'?'orange':selected.severity==='Modérée'?'amber':'blue'}>{selected.severity}</Status></div>
        <div className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]"><div className="space-y-3 text-sm"><Info label="Localisation" value={selected.location}/><Info label="Victimes déclarées" value={typeof selected.victims === 'number' ? `${selected.victims} déclarée(s)` : 'Non renseigné'}/><Info label="Véhicules impliqués" value={typeof selected.vehicles === 'number' ? `${selected.vehicles} impliqué(s)` : 'Non renseigné'}/><Info label="Source" value={selected.source}/><Info label="Précision GPS" value={selected.accuracy||'8 m'}/><Info label="Horodatage de réception" value={formatReceivedAt(selected)}/><div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200"><Check size={15} className="mt-0.5 shrink-0"/><div><b>Réception confirmée</b><p className="mt-1 leading-5 opacity-80">Le signalement est localisé et prêt à être validé par l’opérateur.</p></div></div><div className="space-y-2 pt-2"><button type="button" className="btn-primary w-full" onClick={()=>{validate(selected);onAssign(ambulances.find(a=>a.status==='Disponible')||ambulances[0],selected.id)}}>Valider et créer l’intervention</button><button type="button" className="btn-secondary w-full" onClick={()=>onOpenMap(selected)}>Agrandir sur la carte</button></div></div><LomeMap alerts={mapAlerts} ambulances={mapAmbulances} height={430} focusAlertId={selected.id} onSelectAlert={alert=>{if(alert?.id&&alert.id!==selectedId)setSelectedId(alert.id)}}/></div>
      </section>
    </div>
  </>
}
function Info({label,value}){return <div><div className="text-xs text-slate-400">{label}</div><div className="mt-1 font-medium">{value}</div></div>}
function formatReceivedAt(alert){if(!alert.receivedAt)return alert.received||'À l’instant';const date=new Date(alert.receivedAt);return Number.isNaN(date.getTime())?alert.received:date.toLocaleString('fr-FR')}
