import { useMemo, useState } from 'react'
import { Building2, Search, RefreshCw } from 'lucide-react'
import LomeMap from '../components/LomeMap'
import { Kpi, PageTitle, Status } from '../components/UI'

export default function Hospitals({hospitals,onUpdateHospital,onNavigate,onNotify}){
  const [query,setQuery]=useState('')
  const [selectedId,setSelectedId]=useState(hospitals[0].id)
  const liveHospitals=useMemo(()=>hospitals,[hospitals])
  const visible=liveHospitals.filter(h=>`${h.name} ${h.specialty}`.toLowerCase().includes(query.toLowerCase()))
  const selected=liveHospitals.find(h=>h.id===selectedId)||liveHospitals[0]
  const totalBeds=liveHospitals.reduce((s,h)=>s+h.beds,0)
  const avg=Math.round(liveHospitals.reduce((s,h)=>s+h.occupancy,0)/liveHospitals.length)
  return <>
    <PageTitle title="Hôpitaux & capacités" subtitle="Disponibilités déclarées et centres de santé connectés."/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Centres de santé connectés" value={hospitals.length} icon={Building2} tone="blue"/><Kpi label="Places disponibles" value={totalBeds} icon={Building2} tone="green"/><Kpi label="Occupation moyenne" value={`${avg}%`} icon={Building2} tone="amber"/><Kpi label="Dernière synchronisation" value="18 s" icon={Building2} tone="violet"/></div>
    <div className="lotisec-fixed-split mt-4 grid gap-4 2xl:h-[calc(100vh-17rem)] 2xl:min-h-[520px] 2xl:grid-cols-[1.1fr_.9fr]">
      <section className="surface p-4"><div className="mb-3 flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={event=>setQuery(event.target.value)} className="input pl-9" placeholder="Rechercher un centre de santé..."/></div><button type="button" className="btn-secondary" onClick={()=>onUpdateHospital(selected.id,{beds:selected.beds+1})}><RefreshCw size={15}/>+1 place</button></div><div className="grid gap-3 md:grid-cols-2">{visible.map(h=><button type="button" onClick={()=>setSelectedId(h.id)} key={h.id} className={`rounded-xl border p-4 text-left transition ${h.recommended?'border-emerald-400 bg-gradient-to-br from-emerald-700 to-emerald-500 text-white shadow-lg':h.id===selected.id?'border-emerald-400 bg-emerald-50/40 shadow-sm dark:bg-emerald-950/20':'border-slate-200 hover:border-emerald-300 dark:border-slate-700'}`}><div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{h.name}</div><div className={`mt-1 text-xs ${h.recommended?'text-emerald-50':'muted'}`}>{h.specialty}</div></div>{h.recommended?<span className="rounded-full border border-white/30 bg-white/15 px-2 py-1 text-[9px] font-black">✓ RECOMMANDÉ · {h.decisionScore}%</span>:<Status tone="blue">{h.status}</Status>}</div><div className="mt-4 grid grid-cols-3 gap-2 text-sm"><Info label="Places" value={h.beds}/><Info label="Occupation" value={`${h.occupancy}%`}/><Info label="ETA" value={`${h.decisionEta||h.eta} min`}/></div><div className={`mt-2 text-[11px] ${h.recommended?'text-emerald-50':'muted'}`}>{h.decisionReason}<br/>Capacité actualisée {h.lastCapacityUpdate}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25 dark:bg-slate-800"><div className={`h-full ${h.occupancy>85?'bg-red-500':h.occupancy>70?'bg-amber-400':'bg-emerald-300'}`} style={{width:`${h.occupancy}%`}}/></div></button>)}</div></section>
      <section className="surface p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Carte des centres de santé</h3><Status>{selected.beds} places à {selected.name}</Status></div><LomeMap hospitals={liveHospitals} height={470} showRoute={false} onSelectHospital={hospital=>setSelectedId(hospital.id)}/><button type="button" onClick={()=>onNavigate('orientation')} className="btn-primary mt-3 w-full">Ouvrir l’orientation hospitalière</button></section>
    </div>
  </>
}
function Info({label,value}){return <div><div className="text-xs text-slate-400">{label}</div><div className="mt-1 font-medium">{value}</div></div>}
