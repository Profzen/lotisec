import { ArrowRight, CheckCircle2, Clock3, MapPin } from 'lucide-react'

export function PageTitle({title,subtitle,action}){
  return <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
    <div><h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p></div>
    {action}
  </div>
}

export function Kpi({label,value,icon:Icon,tone='blue',hint}){
  const tones={blue:'bg-blue-50 text-blue-600 dark:bg-blue-950/50',green:'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40',red:'bg-red-50 text-red-600 dark:bg-red-950/40',amber:'bg-amber-50 text-amber-600 dark:bg-amber-950/40',violet:'bg-violet-50 text-violet-600 dark:bg-violet-950/40'}
  return <div className="surface p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p><div className="mt-2 text-2xl font-bold">{value}</div>{hint&&<div className="mt-1 text-xs text-slate-400">{hint}</div>}</div>{Icon&&<div className={`grid h-11 w-11 place-items-center rounded-2xl ${tones[tone]}`}><Icon size={21}/></div>}</div>
  </div>
}

export function Status({children,tone='green'}){
  const tones={green:'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',red:'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',amber:'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',blue:'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',violet:'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',gray:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}
  return <span className={`chip ${tones[tone]}`}>{children}</span>
}

export function EmptyHint({children}){ return <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{children}</div> }

export function MiniRoute({distance,eta,traffic,recommended,onClick,active=false}){
  const Tag=onClick?'button':'div'
  return <Tag type={onClick?'button':undefined} onClick={onClick} className={`w-full rounded-xl border p-3 text-left transition ${active?'ring-2 ring-blue-500':recommended?'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20':'border-slate-200 dark:border-slate-700'} ${onClick?'hover:-translate-y-0.5 hover:shadow-md':''}`}>
    <div className="flex items-center justify-between"><div className="text-sm font-semibold">{recommended?'Itinéraire recommandé':'Alternative'}</div>{recommended&&<Status>Recommandé</Status>}</div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><MapPin size={14} className="mb-1"/><b>{distance} km</b></div><div><Clock3 size={14} className="mb-1"/><b>{eta} min</b></div><div><CheckCircle2 size={14} className="mb-1"/><b>{traffic}</b></div></div>
  </Tag>
}

export function SectionHeader({title,link,onClick}){return <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{title}</h3>{link&&<button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">{link}<ArrowRight size={14}/></button>}</div>}
