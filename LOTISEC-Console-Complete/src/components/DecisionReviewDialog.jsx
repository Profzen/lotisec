import { CheckCircle2, Scale, ShieldCheck, X } from 'lucide-react'
import { Status } from './UI'

export default function DecisionReviewDialog({review,operator,onConfirm,onCancel}){
  if(!review) return null
  const isAssignment=review.type==='assignment'
  const candidate=review.candidate
  const breakdown=Object.entries(candidate?.scoreBreakdown||{})
  const alternatives=(review.ranking||[]).slice(0,3)
  const title=isAssignment?'Valider l’affectation humaine':'Valider l’orientation hospitalière'
  return <div className="fixed inset-0 z-[140] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel?.('Décision laissée en attente')}}>
    <section role="dialog" aria-modal="true" aria-labelledby="decision-title" className="my-4 w-full max-w-4xl overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0b1e2d]">
      <header className="flex items-start justify-between gap-4 bg-gradient-to-r from-[#073b67] to-blue-600 p-5 text-white">
        <div className="flex gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Scale size={23}/></span><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-blue-100">Assistance à la décision · validation obligatoire</div><h2 id="decision-title" className="mt-1 text-xl font-bold">{title}</h2><p className="mt-1 text-xs text-blue-100">Le système recommande. L’opérateur conserve la décision finale et sa justification est tracée.</p></div></div>
        <button type="button" onClick={()=>onCancel?.('Décision laissée en attente')} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Fermer"><X size={18}/></button>
      </header>
      <div className="grid gap-4 p-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/25">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-wider text-blue-600">Recommandation sélectionnée</div><div className="mt-1 text-lg font-bold">{isAssignment?candidate?.id:candidate?.name}</div><div className="mt-1 text-xs muted">{isAssignment?`${candidate?.provider} · ${candidate?.equipment}`:`${candidate?.specialty} · ${candidate?.beds} places disponibles`}</div></div><Status tone="blue">SCORE {candidate?.decisionScore||'—'} %</Status></div>
            <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">{candidate?.decisionReason||'Recommandation calculée à partir des critères opérationnels disponibles.'}</p>
          </div>
          <div className="surface-flat overflow-hidden"><div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-slate-800">Décomposition du score</div><div className="grid gap-3 p-4 sm:grid-cols-2">{breakdown.map(([label,value])=><div key={label}><div className="flex justify-between text-xs"><span>{label}</span><b>{value}/100 · {candidate?.scoreWeights?.[label]}</b></div><div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-gradient-to-r from-blue-700 to-sky-400" style={{width:`${value}%`}}/></div></div>)}</div></div>
        </div>
        <div className="space-y-4">
          <div className="surface-flat p-4"><div className="text-sm font-semibold">Comparaison des trois premiers choix</div><div className="mt-3 space-y-2">{alternatives.map((item,index)=><div key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 ${item.id===candidate?.id?'border-blue-400 bg-blue-50 dark:bg-blue-950/25':'border-slate-200 dark:border-slate-700'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${index===0?'bg-blue-600 text-white':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{index+1}</span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{isAssignment?item.id:item.name}</b><span className="text-[10px] muted">{item.decisionReason}</span></div><b className="text-sm text-blue-600">{item.decisionScore}%</b></div>)}</div></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"><div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200"><ShieldCheck size={17}/>Validation attribuée</div><div className="mt-2 grid grid-cols-[110px_1fr] gap-y-1 text-xs"><span className="muted">Opérateur</span><b>{operator?.name}</b><span className="muted">Rôle</span><b>{operator?.role}</b><span className="muted">Incident</span><b>{review.alert?.id}</b><span className="muted">Heure</span><b>{new Date().toLocaleTimeString('fr-FR')}</b></div></div>
          <label className="block text-xs font-semibold">Justification opérateur<textarea id="decision-note" defaultValue={review.defaultNote||'Recommandation conforme aux informations opérationnelles disponibles.'} rows="3" className="input mt-2 resize-none"/></label>
        </div>
      </div>
      <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 sm:flex-row sm:justify-end dark:border-slate-800"><button type="button" onClick={()=>onCancel?.('Décision laissée en attente')} className="btn-secondary">Revenir sans affecter</button><button type="button" onClick={()=>onConfirm?.(document.getElementById('decision-note')?.value||'Validation opérateur')} className="btn-primary"><CheckCircle2 size={17}/>Confirmer et tracer la décision</button></footer>
    </section>
  </div>
}
