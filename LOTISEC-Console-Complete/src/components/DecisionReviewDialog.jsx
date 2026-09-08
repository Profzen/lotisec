import { Ambulance, BedDouble, CheckCircle2, Clock3, MapPin, Stethoscope, X } from 'lucide-react'

export default function DecisionReviewDialog({review,operator,onSelectCandidate,onConfirm,onCancel}){
  if(!review) return null
  const isAssignment=review.type==='assignment'
  const candidate=review.candidate
  const alternatives=(review.ranking||[]).filter(item=>item.id!==candidate?.id).slice(0,3)
  const ResourceIcon=isAssignment?Ambulance:Stethoscope
  const heading=isAssignment?'AFFECTATION D’UNE AMBULANCE':'ORIENTATION HOSPITALIÈRE'
  const title=isAssignment?'Confirmer l’ambulance':'Confirmer l’hôpital d’accueil'
  const selectedName=isAssignment?candidate?.id:candidate?.name
  const selectedDetails=isAssignment
    ?`${candidate?.provider||'Unité disponible'} · ${candidate?.equipment||'Équipement standard'}`
    :`${candidate?.specialty||'Urgences'} · ${candidate?.beds||0} place(s) disponible(s)`
  const facts=isAssignment
    ?[
      {label:'Arrivée estimée',value:`${candidate?.decisionEta||candidate?.eta||'-'} min`,icon:Clock3},
      {label:'Distance',value:`${candidate?.distance||'-'} km`,icon:MapPin},
      {label:'Équipement',value:candidate?.equipment||'Standard',icon:Ambulance},
      {label:'État',value:candidate?.status||'À confirmer',icon:CheckCircle2},
    ]
    :[
      {label:'Arrivée estimée',value:`${candidate?.decisionEta||candidate?.eta||'-'} min`,icon:Clock3},
      {label:'Distance',value:`${candidate?.distance||'-'} km`,icon:MapPin},
      {label:'Places disponibles',value:`${candidate?.beds||0}`,icon:BedDouble},
      {label:'Service',value:candidate?.specialty||'Urgences',icon:Stethoscope},
    ]
  const headerClass=isAssignment?'bg-blue-700':'bg-emerald-700'
  const selectedClass=isAssignment?'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30':'border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30'
  const selectedTextClass=isAssignment?'text-blue-700 dark:text-blue-300':'text-emerald-700 dark:text-emerald-300'
  const confirmClass=isAssignment?'bg-blue-700 hover:bg-blue-800':'bg-emerald-700 hover:bg-emerald-800'

  return <div className="fixed inset-0 z-[140] grid place-items-center overflow-y-auto bg-slate-950/70 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel?.('Validation annulée')}}>
    <section role="dialog" aria-modal="true" aria-labelledby="decision-title" className="my-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0b1e2d]">
      <header className={`flex items-start justify-between gap-4 px-5 py-4 text-white ${headerClass}`}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-900"><ResourceIcon size={23}/></span>
          <div><div className="text-[10px] font-black tracking-[.16em] text-white">{heading}</div><h2 id="decision-title" className="mt-1 text-xl font-bold">{title}</h2><p className="mt-1 text-xs text-white">Vérifiez le choix proposé puis confirmez l’opération.</p></div>
        </div>
        <button type="button" onClick={()=>onCancel?.('Validation annulée')} className="grid h-9 w-9 place-items-center rounded-lg border border-white bg-transparent hover:bg-white hover:text-slate-900" aria-label="Fermer"><X size={18}/></button>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.08fr_.92fr]">
        <div className="space-y-4">
          <section className={`rounded-xl border-2 p-4 ${selectedClass}`}>
            <div className="flex items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white ${selectedTextClass}`}><ResourceIcon size={20}/></span><div className="min-w-0"><div className={`text-[10px] font-black tracking-wider ${selectedTextClass}`}>RESSOURCE SÉLECTIONNÉE</div><div className="mt-0.5 truncate text-lg font-bold">{selectedName}</div><div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{selectedDetails}</div></div></div>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700">Informations opérationnelles</div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">{facts.map(({label,value,icon:Icon})=><div key={label} className="flex items-center gap-3 rounded-lg bg-slate-100 p-3 dark:bg-slate-900"><Icon size={17} className={selectedTextClass}/><div className="min-w-0"><div className="text-[10px] font-semibold text-slate-500">{label}</div><b className="block truncate text-sm">{value}</b></div></div>)}</div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="text-sm font-bold">{isAssignment?'Autres ambulances disponibles':'Autres hôpitaux disponibles'}</div>
            <p className="mt-1 text-xs text-slate-500">Vous pouvez modifier la sélection avant de confirmer.</p>
            <div className="mt-3 space-y-2">{alternatives.map(item=><button type="button" key={item.id} onClick={()=>onSelectCandidate?.(item)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-blue-500 dark:border-slate-700"><span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-400"/><div className="min-w-0 flex-1"><b className="block truncate text-sm">{isAssignment?item.id:item.name}</b><span className="block truncate text-[10px] text-slate-500">{isAssignment?(item.equipment||item.provider):(item.specialty||'Urgences')}</span></div><b className="shrink-0 text-sm">{item.decisionEta||item.eta||'-'} min</b></button>)}</div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="text-sm font-bold">Validation opérateur</div>
            <div className="mt-3 grid grid-cols-[92px_1fr] gap-y-1.5 text-xs"><span className="text-slate-500">Opérateur</span><b>{operator?.name}</b><span className="text-slate-500">Fonction</span><b>{operator?.role}</b><span className="text-slate-500">Incident</span><b>{review.alert?.id}</b><span className="text-slate-500">Heure</span><b>{new Date().toLocaleTimeString('fr-FR')}</b></div>
          </section>

          <label className="block text-xs font-semibold">Note d’exploitation<textarea id="decision-note" defaultValue={review.defaultNote||''} rows="2" className="input mt-2 resize-none"/></label>
        </div>
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end dark:border-slate-700"><button type="button" onClick={()=>onCancel?.('Validation annulée')} className="btn-secondary">Annuler</button><button type="button" onClick={()=>onConfirm?.(document.getElementById('decision-note')?.value||'Validation opérateur')} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white ${confirmClass}`}><CheckCircle2 size={17}/>{isAssignment?'Affecter cette ambulance':'Confirmer cet hôpital'}</button></footer>
    </section>
  </div>
}
