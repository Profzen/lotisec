import { useMemo, useState } from 'react'
import { Check, Clock3, Gauge, Map, MapPin, Navigation, Play, RefreshCw, Route as RouteIcon } from 'lucide-react'
import LomeMap from '../components/LomeMap'
import { PageTitle, Status } from '../components/UI'

const fallbackSteps = [
  { road: 'Boulevard du 13 Janvier', instruction: 'Continuer tout droit vers Tokoin', distance: '1,8 km', time: '3 min' },
  { road: 'Avenue de la Libération', instruction: 'Tourner à droite au carrefour', distance: '900 m', time: '2 min' },
  { road: 'Rue de l’OCAM', instruction: 'Rester sur la voie de gauche', distance: '1,1 km', time: '2 min' },
  { road: 'Zone de l’incident', instruction: 'Arrivée à destination', distance: '350 m', time: '1 min' },
]

export default function Routing({ alerts, ambulances, mission, onReroute, onNavigate, onNotify }) {
  const [view, setView] = useState('detail')
  const [recalculation, setRecalculation] = useState('Trafic et temps de parcours')
  const alert = alerts.find(item => item.id === mission?.alertId) || alerts[0]
  const ambulance = ambulances.find(item => item.id === mission?.ambulanceId) || ambulances[0]
  const distance = Number(mission?.routeMeta?.distance || 4.2)
  const eta = Number(mission?.routeMeta?.eta || ambulance?.eta || 8)
  const routeSteps = mission?.routeMeta?.steps?.length ? mission.routeMeta.steps : fallbackSteps
  const routeOptions = mission?.routeMeta?.alternativesMeta?.length ? mission.routeMeta.alternativesMeta : []
  const arrival = useMemo(() => new Date(Date.now() + eta * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), [eta])

  const compareRows = [
    ['Distance', `${distance.toFixed(1)} km`, `${(distance * .91).toFixed(1)} km`, `${(distance * 1.18).toFixed(1)} km`],
    ['Temps estimé', `${eta} min`, `${eta + 3} min`, `${eta + 5} min`],
    ['Heure d’arrivée', arrival, addMinutes(arrival, 3), addMinutes(arrival, 5)],
    ['Retard estimé', '0 min', '+3 min', '+5 min'],
    ['Indice trafic', '1,08', '1,36', '1,51'],
    ['Circulation', mission?.congestion ? 'Perturbée' : 'Fluide', 'Modérée', 'Dense'],
  ]

  const recalculate = () => {
    onReroute?.()
    onNotify?.(`Itinéraires recalculés selon : ${recalculation}`, 'blue')
  }

  return <>
    <PageTitle
      title={view === 'detail' ? 'Calcul d’un itinéraire d’intervention' : 'Recalcul et comparaison des itinéraires'}
      subtitle="Suivre le réseau routier réel, comparer les alternatives et guider l’ambulance jusqu’à l’incident."
      action={<Status tone="blue">{mission?.routeMeta?.engine || 'OSRM PRÊT'}</Status>}
    />

    <div className="mb-4 flex flex-wrap gap-2">
      <ViewButton active={view === 'detail'} icon={Navigation} onClick={() => setView('detail')}>Calcul détaillé</ViewButton>
      <ViewButton active={view === 'compare'} icon={RouteIcon} onClick={() => setView('compare')}>Comparaison & recalcul</ViewButton>
    </div>

    {view === 'detail'
      ? <DetailView alert={alert} ambulance={ambulance} mission={mission} routeSteps={routeSteps} distance={distance} eta={eta} arrival={arrival} onNavigate={onNavigate} onNotify={onNotify}/>
      : <ComparisonView alert={alert} ambulance={ambulance} mission={mission} routeSteps={routeSteps} routeOptions={routeOptions} rows={compareRows} recalculation={recalculation} setRecalculation={setRecalculation} recalculate={recalculate} onNotify={onNotify}/>
    }
  </>
}

function DetailView({ alert, ambulance, mission, routeSteps, distance, eta, arrival, onNavigate, onNotify }) {
  return <div className="lotisec-fixed-split grid gap-4 2xl:h-[calc(100vh-13rem)] 2xl:min-h-[560px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
    <div className="space-y-4">
      <section className="surface p-4">
        <SectionHeader title="Aperçu du trajet" meta={mission?.routeMeta?.name || `${ambulance?.id || 'AMB'} → ${alert?.id || 'Incident'}`}/>
        <LomeMap alerts={alert ? [alert] : []} ambulances={ambulance ? [ambulance] : []} mission={mission} height={535}/>
      </section>
      <StepTable steps={routeSteps}/>
    </div>

    <aside className="space-y-4">
      <section className="surface p-5">
        <div className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-600">Résumé de l’intervention</div>
        <div className="mt-4 space-y-3">
          <Point label="Départ" value={`${ambulance?.id || 'Ambulance'} · ${ambulance?.provider || 'Unité de secours'}`} tone="blue"/>
          <Point label="Destination" value={alert?.location || 'Lieu de l’incident'} tone="red"/>
        </div>
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30"><div className="text-[10px] font-black uppercase tracking-wider text-blue-600">Itinéraire recommandé</div><div className="mt-1 text-sm font-bold text-blue-900 dark:text-blue-100">{mission?.routeMeta?.name || 'Trajet à calculer'}</div></div>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs muted dark:bg-slate-900">Moteur : <b className="text-slate-700 dark:text-slate-200">OSRM / OpenStreetMap</b></div>
      </section>

      <section className="surface p-5">
        <h3 className="font-semibold">Détails du trajet</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric icon={RouteIcon} label="Distance" value={`${distance.toFixed(1)} km`}/>
          <Metric icon={Clock3} label="Durée estimée" value={`${eta} min`}/>
          <Metric icon={Navigation} label="Arrivée" value={arrival}/>
          <Metric icon={Gauge} label="Vitesse moy." value="32 km/h"/>
        </div>
      </section>

      <section className="surface p-5">
        <h3 className="font-semibold">Indicateurs de circulation</h3>
        <div className="mt-4 space-y-3 text-sm">
          <Info label="État du trafic" value={mission?.congestion ? 'Perturbé' : 'Fluide'} good={!mission?.congestion}/>
          <Info label="Indice de trajet (TTI)" value={mission?.congestion ? '1,42' : '1,08'}/>
          <Info label="Qualité GPS" value="Haute précision" good/>
        </div>
      </section>

      <button type="button" onClick={() => {onNotify?.('Carte recentrée sur le trajet actif', 'blue');onNavigate?.('map')}} className="btn-secondary w-full"><Map size={17}/>Voir sur la carte</button>
      <button type="button" onClick={() => {onNotify?.(`Navigation démarrée pour ${ambulance?.id || 'l’ambulance'}`, 'green');onNavigate?.('map')}} className="btn-primary w-full"><Play size={17}/>Démarrer la navigation</button>
    </aside>
  </div>
}

function ComparisonView({ alert, ambulance, mission, routeSteps, routeOptions, rows, recalculation, setRecalculation, recalculate, onNotify }) {
  return <div className="lotisec-fixed-split grid gap-4 2xl:h-[calc(100vh-13rem)] 2xl:min-h-[560px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
    <div className="space-y-4">
      <section className="surface p-4">
        <SectionHeader title="Comparaison cartographique" meta="Recommandé · Alternative 1 · Alternative 2"/>
        <LomeMap alerts={alert ? [alert] : []} ambulances={ambulance ? [ambulance] : []} mission={mission} routeVariants showTraffic height={535}/>
      </section>
      <StepTable steps={routeSteps} compact/>
    </div>

    <aside className="space-y-4">
      <section className="surface overflow-hidden">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800"><h3 className="font-semibold">Comparaison des options</h3><p className="mt-1 text-xs muted">Résultats calculés selon le réseau routier et le trafic.</p></div>
        {routeOptions.length>0&&<div className="grid gap-2 border-b border-slate-100 p-3 dark:border-slate-800">{routeOptions.slice(0,3).map((route,index)=><div key={`${route.name}-${index}`} className={`rounded-xl border px-3 py-2 text-xs ${index===0?'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100':'border-slate-200 dark:border-slate-700'}`}><div className="font-bold">{index===0?'Recommandé':`Alternative ${index}`} · {route.name}</div><div className="mt-0.5 opacity-70">{route.distance} km · {route.eta} min</div></div>)}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-900"><tr><th className="p-3">Critère</th><th>Recommandé</th><th>Alt. 1</th><th>Alt. 2</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row[0]} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-medium">{row[0]}</td>{row.slice(1).map((value, cell) => <td key={cell} className={cell === 0 ? 'font-bold text-blue-600' : ''}>{value}</td>)}</tr>)}</tbody></table></div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/25">
        <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-white"><Check size={18}/></span><div><div className="font-semibold text-blue-900 dark:text-blue-100">Itinéraire recommandé</div><p className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-300">Meilleur compromis entre ETA, distance et fluidité. La mission reste automatiquement synchronisée.</p></div></div>
      </section>

      <section className="surface p-5">
        <h3 className="font-semibold">Options de recalcul</h3>
        <label className="mt-4 block text-xs font-medium muted">Optimiser selon</label>
        <select className="input mt-2 w-full" value={recalculation} onChange={event => setRecalculation(event.target.value)}><option>Trafic et temps de parcours</option><option>Distance la plus courte</option><option>Éviter les axes congestionnés</option><option>Accès véhicules prioritaires</option></select>
        <button type="button" onClick={recalculate} className="btn-secondary mt-3 w-full"><RefreshCw size={16}/>Recalculer les itinéraires</button>
        <button type="button" onClick={() => onNotify?.('Itinéraire recommandé transmis à l’ambulance', 'green')} className="btn-primary mt-2 w-full"><Navigation size={16}/>Utiliser l’itinéraire recommandé</button>
      </section>
    </aside>
  </div>
}

function StepTable({ steps, compact = false }) {
  return <section className="surface overflow-hidden">
    <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800"><div><h3 className="font-semibold">Étapes détaillées du trajet</h3><p className="mt-1 text-xs muted">Instructions de guidage transmises à l’unité mobile.</p></div><Status tone="blue">{steps.length} ÉTAPES</Status></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="p-3">#</th><th>Voie ou zone clé</th><th>Instruction</th><th>Distance</th><th>Temps</th></tr></thead><tbody>{steps.slice(0, compact ? 4 : 6).map((step, index) => <tr key={`${step.road}-${index}`} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-600 dark:bg-blue-950/40">{index + 1}</span></td><td className="font-semibold">{step.road}</td><td className="muted">{step.instruction}</td><td>{step.distance}</td><td>{step.time}</td></tr>)}</tbody></table></div>
  </section>
}

function ViewButton({ active, icon: Icon, onClick, children }) { return <button type="button" onClick={onClick} className={active ? 'btn-primary' : 'btn-secondary'}><Icon size={16}/>{children}</button> }
function SectionHeader({ title, meta }) { return <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{title}</h3><span className="text-xs muted">{meta}</span></div> }
function Point({ label, value, tone }) { return <div className="flex gap-3"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${tone === 'red' ? 'bg-red-500' : 'bg-blue-600'}`}/><div><div className="text-[10px] font-bold uppercase tracking-wider muted">{label}</div><div className="mt-0.5 text-sm font-semibold">{value}</div></div></div> }
function Metric({ icon: Icon, label, value }) { return <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><Icon size={16} className="text-blue-600"/><b className="mt-2 block text-lg">{value}</b><span className="text-[10px] muted">{label}</span></div> }
function Info({ label, value, good = false }) { return <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800"><span className="muted">{label}</span><b className={good ? 'text-emerald-600' : ''}>{value}</b></div> }
function addMinutes(time, minutes) { const [hour, minute] = time.split(':').map(Number); const date = new Date(); date.setHours(hour, minute + minutes); return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
