import { useEffect, useMemo, useState } from 'react'
import { Activity, BedDouble, Check, Clock3, Hospital, MapPin, RefreshCw, Stethoscope, Users } from 'lucide-react'
import LomeMap from '../components/LomeMap'
import { PageTitle, Status } from '../components/UI'
import { rankHospitals } from '../services/decision'

export default function Orientation({ alerts, ambulances, hospitals, mission, onConfirm, onNotify }) {
  const [selectedId, setSelectedId] = useState(hospitals[0]?.id)
  const [specialty, setSpecialty] = useState('Toutes les spécialités')
  const [sort, setSort] = useState('Meilleur score')
  const [sync, setSync] = useState(0)
  const alert = alerts.find(item => item.id === mission?.alertId) || alerts[0]
  const ambulance = ambulances.find(item => item.id === mission?.ambulanceId) || ambulances[0]

  const candidates = useMemo(() => {
    const filtered = hospitals.filter(item => specialty === 'Toutes les spécialités' || item.specialty.includes(specialty) || item.services?.includes(specialty))
    return rankHospitals(alert,filtered).sort((a, b) => {
      if (sort === 'Capacité disponible') return b.beds - a.beds
      if (sort === 'Temps d’arrivée') return a.decisionEta - b.decisionEta
      return b.decisionScore - a.decisionScore
    })
  }, [hospitals, specialty, sort, sync, alert])

  const selected = candidates.find(item => item.id === selectedId) || candidates[0] || hospitals[0]
  useEffect(()=>{const recommended=candidates.find(item=>item.id===(mission?.hospitalId||mission?.recommendedHospitalId))||candidates.find(item=>item.recommended);if(recommended)setSelectedId(recommended.id)},[mission?.hospitalId,mission?.recommendedHospitalId,alert?.id])
  const refresh = () => {
    setSync(value => value + 1)
    onNotify?.('Capacités des centres de santé actualisées', 'green')
  }

  if (!selected) return <div className="surface p-8 text-center muted">Aucun centre de santé disponible.</div>

  return <>
    <PageTitle title="Aide à l’orientation vers un centre de santé" subtitle="Choisir la destination selon le trajet, les services requis et la capacité d’accueil en temps réel." action={<Status tone="blue">{mission?.id || 'AIDE À LA DÉCISION'}</Status>}/>

    <section className="surface mb-4 grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-5">
      <Meta label="Intervention" value={mission?.id || 'En attente'} icon={Activity}/>
      <Meta label="Incident" value={alert?.id || 'Non sélectionné'} icon={MapPin}/>
      <Meta label="Victimes" value={`${alert?.victims || 0} personne${(alert?.victims || 0) > 1 ? 's' : ''}`} icon={Users}/>
      <Meta label="Gravité" value={alert?.severity || 'À qualifier'} icon={Stethoscope} danger={alert?.severity === 'Critique'}/>
      <Meta label="Ambulance" value={ambulance?.id || 'Non affectée'} icon={Hospital}/>
    </section>

    <section className="surface mb-4 grid gap-3 p-3 md:grid-cols-[1fr_1fr_auto]">
      <select value={specialty} onChange={event => setSpecialty(event.target.value)} className="input"><option>Toutes les spécialités</option><option>Traumatologie</option><option>Urgences</option><option>Chirurgie</option></select>
      <select value={sort} onChange={event => setSort(event.target.value)} className="input"><option>Meilleur score</option><option>Temps d’arrivée</option><option>Capacité disponible</option></select>
      <button type="button" onClick={refresh} className="btn-secondary"><RefreshCw size={16}/>Actualiser les capacités</button>
    </section>

    <div className="lotisec-fixed-split grid gap-4 2xl:h-[calc(100vh-20rem)] 2xl:min-h-[540px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
      <div className="space-y-4">
        <section className="surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Carte d’aide à l’orientation</h3><p className="mt-1 text-xs muted">Cliquez sur un centre de santé pour afficher sa capacité et le sélectionner.</p></div><Status>{candidates.length} CENTRES CONNECTÉS</Status></div>
          <LomeMap alerts={alert ? [alert] : []} ambulances={ambulance ? [ambulance] : []} hospitals={candidates} mission={mission} height={535} onSelectHospital={hospital => setSelectedId(hospital.id)}/>
        </section>
        <ComparisonTable candidates={candidates} selectedId={selected.id} onSelect={setSelectedId}/>
      </div>

      <aside className="space-y-4">
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800"><h3 className="font-semibold">Centres de santé disponibles</h3><p className="mt-1 text-xs muted">Classés selon la distance, les services et les places déclarées.</p></div>
          <div className="max-h-[650px] space-y-3 overflow-y-auto p-3">{candidates.map(hospital => <HealthCard key={hospital.id} hospital={hospital} recommended={hospital.recommended} selected={hospital.id === selected.id} onSelect={() => setSelectedId(hospital.id)}/>)}</div>
        </section>

        <section className="surface p-5">
          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-600">Orientation sélectionnée</div>
          <div className="mt-3 flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 font-black text-white">H</span><div><h3 className="font-semibold">{selected.name}</h3><p className="mt-1 text-xs muted">{selected.specialty}</p></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Summary value={`${selected.decisionEta||selected.eta} min`} label="ETA"/><Summary value={selected.beds} label="Places"/><Summary value={`${selected.decisionScore || 90}%`} label="Score"/></div>
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300"><b>Pourquoi cette recommandation ?</b><div>{selected.decisionReason}</div></div>
          {selected.scoreBreakdown&&<DecisionBreakdown item={selected}/>}
          <button type="button" onClick={() => onConfirm?.(selected)} className="btn-primary mt-4 w-full"><Check size={17}/>Valider l’orientation</button>
          <button type="button" onClick={refresh} className="btn-secondary mt-2 w-full"><RefreshCw size={16}/>Recalculer les itinéraires</button>
        </section>
      </aside>
    </div>
  </>
}

function HealthCard({ hospital, recommended, selected, onSelect }) {
  const distance = hospital.distance??(hospital.eta * .45).toFixed(1)
  const cardStyle=recommended?'border-emerald-300 bg-gradient-to-br from-emerald-700 to-emerald-500 text-white shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-300/40':selected?'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/15 dark:bg-emerald-950/20':'border-slate-200 hover:border-emerald-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900'
  const capacityStale=String(hospital.lastCapacityUpdate).includes('min')
  const freshnessStyle=recommended?'text-white':capacityStale?'text-amber-600':'text-emerald-600'
  return <button type="button" onClick={onSelect} className={`w-full rounded-2xl border p-4 text-left transition ${cardStyle}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-black shadow-sm ${recommended?'bg-white text-emerald-700':'bg-emerald-600 text-white'}`}>H</span><div><div className="font-semibold leading-tight">{hospital.name}</div><div className={`mt-1 text-xs ${recommended?'text-emerald-50':'muted'}`}>{distance} km · {hospital.decisionEta||hospital.eta} min</div></div></div>{recommended && <span className="rounded-full border border-white/40 bg-white/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">✓ Recommandé · {hospital.decisionScore}%</span>}</div>
    <div className={`mt-3 text-[10px] leading-4 ${recommended?'text-emerald-50':'muted'}`}>{hospital.decisionReason}</div>
    <div className="mt-3 flex flex-wrap gap-1.5">{hospital.services?.slice(0, 3).map(service => <span key={service} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${recommended?'bg-white/20 text-white ring-1 ring-white/25':'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-300'}`}>{service}</span>)}</div>
    <div className={`mt-3 flex items-center justify-between border-t pt-3 text-xs ${recommended?'border-white/25':'border-slate-100 dark:border-slate-800'}`}><span className={`flex items-center gap-1.5 ${recommended?'text-white':'text-emerald-700 dark:text-emerald-300'}`}><BedDouble size={15}/><b>{hospital.beds} places disponibles</b></span><span className={`font-semibold ${freshnessStyle}`}>{capacityStale?'Capacité à vérifier':'Capacité à jour'}</span></div>
  </button>
}

function ComparisonTable({ candidates, selectedId, onSelect }) {
  return <section className="surface overflow-hidden">
    <div className="border-b border-slate-100 p-4 dark:border-slate-800"><h3 className="font-semibold">Comparaison des centres de santé</h3><p className="mt-1 text-xs muted">Synthèse des critères utilisés pour l’aide à la décision.</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="p-3">Centre de santé</th><th>Distance</th><th>ETA</th><th>Services</th><th>Capacité</th><th>Score</th></tr></thead><tbody>{candidates.map(hospital => <tr key={hospital.id} onClick={() => onSelect(hospital.id)} className={`cursor-pointer border-t border-slate-100 dark:border-slate-800 ${hospital.id === selectedId ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}><td className="p-3 font-semibold">{hospital.name}</td><td>{hospital.distance} km</td><td><span className="inline-flex items-center gap-1"><Clock3 size={14}/>{hospital.decisionEta} min</span></td><td><div className="flex gap-1">{hospital.services?.slice(0, 3).map(service => <span key={service} title={service} className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/35"><Stethoscope size={14}/></span>)}</div></td><td><b className="text-emerald-600">{hospital.beds} places</b></td><td><b className="text-blue-600">{hospital.decisionScore}%</b></td></tr>)}</tbody></table></div>
  </section>
}

function Meta({ label, value, icon: Icon, danger = false }) { return <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${danger ? 'bg-red-100 text-red-600 dark:bg-red-950/40' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40'}`}><Icon size={16}/></span><div className="min-w-0"><div className="text-[9px] font-bold uppercase tracking-wider muted">{label}</div><div className={`truncate text-xs font-semibold ${danger ? 'text-red-600' : ''}`}>{value}</div></div></div> }
function Summary({ value, label }) { return <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900"><b className="block text-sm">{value}</b><span className="text-[10px] muted">{label}</span></div> }
function DecisionBreakdown({item}){return <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20"><div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Composition du score</div><div className="mt-2 space-y-2">{Object.entries(item.scoreBreakdown).map(([label,value])=><div key={label}><div className="flex justify-between text-[10px]"><span>{label} · poids {item.scoreWeights?.[label]}</span><b>{value}/100</b></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-900"><div className="h-full rounded-full bg-emerald-600" style={{width:`${value}%`}}/></div></div>)}</div></div>}
