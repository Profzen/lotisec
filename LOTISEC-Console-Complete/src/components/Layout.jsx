import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, Ambulance, BarChart3, Bell, Building2, CloudCog,
  ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, Database, FileBarChart, Gauge, HeartPulse, Home, Hospital, Landmark, LineChart, MapPinned, MonitorPlay, Moon, Network, Pause, Play, RotateCcw, Route, Settings, ShieldCheck, Stethoscope, Sun, Target,
  TriangleAlert, UsersRound, Volume2, VolumeX, FileClock, PhoneCall, Siren, ArrowRightLeft, BedDouble, LogOut
} from 'lucide-react'
import { applyTheme, initialTheme } from '../lib/theme'

const operationsNav = [
  { section:'OPÉRATIONS', items:[
    {to:'/', label:'Tableau de bord', icon:Home},
    {to:'/alerts', label:'Alertes & incidents', icon:TriangleAlert, badge:null},
    {to:'/interventions', label:'Interventions', icon:Activity},
    {to:'/map', label:'Carte opérationnelle', icon:MapPinned},
  ]},
  { section:'RESSOURCES', items:[
    {to:'/ambulances', label:'Ambulances', icon:Ambulance},
    {to:'/hospitals', label:'Hôpitaux & capacités', icon:Building2},
  ]},
  { section:'GÉODÉCISION', items:[
    {to:'/routing', label:'Routage', icon:Route},
    {to:'/orientation', label:'Orientation hospitalière', icon:Hospital},
  ]},
  { section:'PILOTAGE', items:[
    {to:'/statistics', label:'Statistiques', icon:BarChart3},
    {to:'/mission-reports', label:'Bilans de mission', icon:ClipboardCheck},
    {to:'/evaluation', label:'Évaluation du prototype', icon:Gauge},
    {to:'/audit', label:'Journal de traçabilité', icon:FileClock},
  ]},
  { section:'SYSTÈME', items:[
    {to:'/system-health', label:'État du système', icon:HeartPulse},
    {to:'/security', label:'Sécurité & accès', icon:ShieldCheck},
    {to:'/fog', label:'Fog & synchronisation', icon:CloudCog},
    {to:'/settings', label:'Paramètres', icon:Settings},
  ]}
]

const healthNav = [
  {section:'ESPACE SANTÉ',items:[
    {to:'/health-dashboard',label:'Vue d’ensemble',icon:Home},
    {to:'/health-admissions',label:'Réceptions d’urgence',icon:Stethoscope,badge:2},
    {to:'/health-capacity',label:'Capacités d’accueil',icon:BedDouble},
    {to:'/health-transfers',label:'Transferts entrants',icon:ArrowRightLeft},
  ]},
  {section:'SUIVI & QUALITÉ',items:[
    {to:'/health-records',label:'Historique anonymisé',icon:ClipboardList},
    {to:'/health-network',label:'Réseau hospitalier',icon:Network},
    {to:'/health-settings',label:'Connexion LOTISEC',icon:Settings},
  ]},
]

const nationalNav = [
  {section:'PILOTAGE NATIONAL',items:[
    {to:'/national-dashboard',label:'Vue nationale',icon:Landmark},
    {to:'/national-territories',label:'Territoires & zones',icon:MapPinned},
    {to:'/national-performance',label:'Performance des secours',icon:Target},
    {to:'/national-analytics',label:'Analyses & tendances',icon:LineChart},
  ]},
  {section:'GOUVERNANCE',items:[
    {to:'/national-reports',label:'Rapports décisionnels',icon:FileBarChart},
    {to:'/national-data',label:'Qualité des données',icon:Database},
    {to:'/national-governance',label:'Confidentialité & accès',icon:ShieldCheck},
  ]},
]

const portalMeta={
  operations:{label:'Centre opérationnel',short:'Opérations',role:'Poste opérateur',subtitle:'Centre de coordination',tone:'blue'},
  health:{label:'Professionnels de santé',short:'Espace santé',role:'Équipe hospitalière',subtitle:'Réseau hospitalier',tone:'emerald'},
  national:{label:'Pilotage national',short:'Ministères',role:'Décision publique',subtitle:'Pilotage national',tone:'violet'},
}

const navFor=portal=>portal==='health'?healthNav:portal==='national'?nationalNav:operationsNav

const pageId=to=>to==='/'?'dashboard':to.slice(1)
const emergencyContacts=[
  {name:'Sapeurs-pompiers',detail:'Urgence publique',number:'118'},
  {name:'Togo Assistance',detail:'Ambulance privée',number:'8200'},
  {name:'Secours Abalo',detail:'Ambulance privée',number:'8880'},
]

export default function Layout({activePage,onNavigate,portal='operations',onChangePortal,notice,onDismissNotice,soundsEnabled,onToggleSounds,mobileFeedStatus,dataMode,operator,fog,demo,onLogout,alertsCount,children}){
  const [theme,setTheme] = useState(initialTheme())
  const [notificationsOpen,setNotificationsOpen]=useState(false)
  const [emergencyOpen,setEmergencyOpen]=useState(false)
  const [portalOpen,setPortalOpen]=useState(false)
  const mainRef=useRef(null)
  const baseNav=navFor(portal)
  const nav=useMemo(()=>{
    if(portal==='operations'&&typeof alertsCount==='number'){
      return baseNav.map(group=>{
        if(group.section==='OPÉRATIONS'){
          return {
            ...group,
            items:group.items.map(item=>item.to==='/alerts'?{...item,badge:alertsCount>0?alertsCount:null}:item)
          }
        }
        return group
      })
    }
    return baseNav
  },[baseNav,portal,alertsCount])
  const meta=portalMeta[portal]||portalMeta.operations
  const activeNavClass=portal==='health'?'bg-emerald-600 text-white':portal==='national'?'bg-violet-700 text-white':'bg-blue-600 text-white'
  const notificationItems=portal==='health'
    ?[{label:'AMB-07 annoncée dans 6 minutes',target:'health-transfers'},{label:'Accueil critique à confirmer',target:'health-admissions'},{label:'Capacité CHU Tokoin synchronisée',target:'health-capacity'}]
    :portal==='national'
      ?[{label:'Indicateurs nationaux consolidés',target:'national-dashboard'},{label:'Alerte de couverture dans les Savanes',target:'national-territories'},{label:'Rapport semestriel disponible',target:'national-reports'}]
      :[{label:'Signalement mobile reçu à GTA',target:'alerts'},{label:'Capacité CHU Tokoin mise à jour',target:'hospitals'},{label:'AMB-07 synchronisée il y a 20 s',target:'ambulances'}]
  const activeLabel=nav.flatMap(group=>group.items).find(item=>pageId(item.to)===activePage)?.label||'Poste opérateur'
  useEffect(()=>{applyTheme(theme)},[theme])
  useEffect(()=>{mainRef.current?.scrollTo({top:0})},[activePage])
  useEffect(()=>{if(!emergencyOpen)return undefined;const close=event=>{if(event.key==='Escape')setEmergencyOpen(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[emergencyOpen])
  useEffect(()=>{
    if(!notice) return undefined
    const timer=setTimeout(onDismissNotice,4200)
    return ()=>clearTimeout(timer)
  },[notice?.id])

  return <div className="h-screen overflow-hidden bg-[#f7f9fc] text-slate-900 dark:bg-[#061522] dark:text-slate-100">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-[#071829] xl:flex">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-slate-100 px-6 dark:border-slate-800">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-blue-100 bg-white p-1 shadow-sm dark:border-slate-700"><img src="/lotisec-logo.png" alt="Logo LOTISEC" className="h-full w-full object-contain"/></div>
        <div><div className="font-extrabold tracking-wide">LOTISEC</div><div className="text-xs text-slate-500 dark:text-slate-400">{meta.subtitle}</div></div>
      </div>
      <div className="shrink-0 px-3 pt-3"><button type="button" onClick={()=>setPortalOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900"><span className={`grid h-8 w-8 place-items-center rounded-lg ${portal==='health'?'bg-emerald-100 text-emerald-700':portal==='national'?'bg-violet-100 text-violet-700':'bg-blue-100 text-blue-700'}`}>{portal==='health'?<Stethoscope size={16}/>:portal==='national'?<Landmark size={16}/>:<Activity size={16}/>}</span><span className="min-w-0 flex-1"><b className="block truncate text-xs">{meta.short}</b><span className="block truncate text-[9px] text-slate-400">Changer d’espace</span></span><ChevronDown size={15} className="text-slate-400"/></button></div>
      <nav className="lotisec-scroll-panel min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {nav.map(group=><div key={group.section} className="mb-5">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-[0.16em] text-slate-400">{group.section}</div>
          <div className="space-y-1">
            {group.items.map(item=>{
              const Icon = item.icon
              const isActive=activePage===pageId(item.to)
              return <button key={item.to} type="button" onClick={()=>onNavigate(pageId(item.to))} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${isActive?activeNavClass:'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <Icon size={18}/><span className="flex-1">{item.label}</span>{item.badge&&<span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">{item.badge}</span>}
              </button>
            })}
          </div>
        </div>)}
      </nav>
      <div className="shrink-0 space-y-2 border-t border-slate-100 p-3 dark:border-slate-800">
        {portal==='operations'&&<button type="button" onClick={()=>setEmergencyOpen(true)} className="flex w-full items-center gap-3 rounded-xl bg-red-600 px-3 py-3 text-left text-sm font-bold text-white shadow-lg shadow-red-900/15 transition hover:bg-red-700"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15"><PhoneCall size={17}/></span><span className="flex-1">Contacter les urgences</span><ChevronRight size={16}/></button>}
        <div className={`rounded-xl border p-3 text-xs ${fog?.effectiveMode==='offline'?'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300':fog?.effectiveMode==='degraded'?'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300':'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
          <div className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${fog?.effectiveMode==='offline'?'bg-red-500':fog?.effectiveMode==='degraded'?'bg-amber-500':'bg-emerald-500'}`}/> {fog?.effectiveMode==='offline'?'Continuité locale active':fog?.effectiveMode==='degraded'?'Réseau dégradé':'Système opérationnel'}</div>
          <div className="mt-1 opacity-80">File Fog : {fog?.queue?.length||0} donnée(s)</div>
        </div>
      </div>
    </aside>

    <div className="h-screen xl:pl-64">
      <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-7 dark:border-slate-800 dark:bg-[#071829]/90">
        <div><div className={`text-[10px] font-black uppercase tracking-[.18em] ${portal==='health'?'text-emerald-600':portal==='national'?'text-violet-600':'text-blue-600'}`}>{meta.role}</div><h1 className="mt-1 text-lg font-bold md:text-xl">{activeLabel}</h1></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>setPortalOpen(true)} className="btn-secondary hidden lg:inline-flex"><span>{meta.short}</span><ChevronDown size={15}/></button>
          {portal==='operations'&&<button type="button" onClick={demo.onToggle} className={`btn-secondary hidden md:inline-flex ${demo.active?'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30':''}`}><MonitorPlay size={17}/>{demo.active?'Test en cours':'Mode test'}</button>}
          <span className={`hidden rounded-xl border px-3 py-2 text-xs font-semibold md:inline-flex ${dataMode==='real'&&mobileFeedStatus==='connected'?'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300':dataMode==='real'&&mobileFeedStatus==='offline'?'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300':'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'}`}>● {dataMode==='test'?(portal==='health'?'Données santé test':portal==='national'?'Données agrégées test':'Bac à sable test'):mobileFeedStatus==='connected'?'Flux réel connecté':mobileFeedStatus==='connecting'?'Connexion réelle…':'Flux réel hors ligne'}</span>
          {portal==='operations'&&<button type="button" className="btn-secondary !border-red-200 !p-2.5 text-red-600 hover:!bg-red-50 dark:!border-red-900 dark:hover:!bg-red-950/30" onClick={()=>setEmergencyOpen(true)} aria-label="Contacter les urgences"><PhoneCall size={18}/></button>}
          <div className="relative"><button type="button" className="btn-secondary relative !p-2.5" onClick={()=>setNotificationsOpen(value=>!value)} aria-label="Notifications"><Bell size={18}/><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-[#071829]"/></button>{notificationsOpen&&<div className="absolute right-0 top-12 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-[#0b1e2d]"><div className="mb-2 flex items-center justify-between"><b className="text-sm">Notifications</b><span className="chip bg-red-100 text-red-700">3 nouvelles</span></div>{notificationItems.map(item=><button type="button" key={item.label} onClick={()=>{setNotificationsOpen(false);onNavigate(item.target)}} className="block w-full rounded-xl px-3 py-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800">{item.label}</button>)}</div>}</div>
          {portal==='operations'&&<button type="button" className={`btn-secondary !p-2.5 ${soundsEnabled?'text-blue-600':''}`} onClick={onToggleSounds} aria-label={soundsEnabled?'Couper les sons opérationnels':'Activer les sons opérationnels'}>{soundsEnabled?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>}
          <button className="btn-secondary !p-2.5" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label="Changer le thème">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
          <button type="button" onClick={()=>portal==='operations'&&onNavigate('security')} className="hidden rounded-xl bg-slate-100 px-3 py-2 text-left text-xs font-semibold md:block dark:bg-slate-800"><span className="block">{portal==='health'?'Dr K. Amégan':portal==='national'?'Cellule interministérielle':operator?.name||'Opérateur LOTISEC'}</span><span className="mt-0.5 block text-[9px] font-medium text-slate-400">{portal==='health'?'Médecin régulateur':portal==='national'?'Analyste national':operator?.role||'Opérateur'}</span></button>
          {onLogout&&<button type="button" onClick={onLogout} className="btn-secondary !p-2.5 text-slate-500 hover:text-red-500 hover:!border-red-300 dark:hover:text-red-400" title="Déconnexion / Changer de compte"><LogOut size={18}/></button>}
        </div>
      </header>
      <nav className="sticky top-20 z-10 flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#071829] xl:hidden" aria-label="Navigation principale">
        {nav.flatMap(group=>group.items).map(item=>{
          const Icon = item.icon
          const isActive=activePage===pageId(item.to)
          return <button key={item.to} type="button" onClick={()=>onNavigate(pageId(item.to))} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${isActive?activeNavClass:'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
            <Icon size={16}/><span>{item.label}</span>
          </button>
        })}
      </nav>
      <main ref={mainRef} data-lotisec-main className={`lotisec-scroll-panel h-[calc(100vh-9.25rem)] overflow-y-auto overscroll-contain p-4 md:p-6 xl:h-[calc(100vh-5rem)] ${demo.active?'pb-64':''}`}>{children}</main>
    </div>
    {notice&&<div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl ${notice.tone==='red'?'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200':notice.tone==='green'?'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200':'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200'}`}>{notice.message}<button type="button" className="ml-3 opacity-60 hover:opacity-100" onClick={onDismissNotice} aria-label="Fermer">×</button></div>}
    {emergencyOpen&&<EmergencyDialog onClose={()=>setEmergencyOpen(false)}/>}
    {portalOpen&&<PortalSwitcher active={portal} onSelect={value=>{setPortalOpen(false);onChangePortal?.(value)}} onClose={()=>setPortalOpen(false)}/>}
    {portal==='operations'&&demo.active&&<DemoDock demo={demo}/>}
  </div>
}

function PortalSwitcher({active,onSelect,onClose}){
  const options=[
    {id:'operations',title:'Centre opérationnel',role:'Régulation, dispatch et suivi des missions',icon:Activity,tone:'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-200'},
    {id:'health',title:'Professionnels de santé',role:'Réception, capacités et transferts hospitaliers',icon:Stethoscope,tone:'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200'},
    {id:'national',title:'Pilotage national',role:'Indicateurs, territoires et politiques publiques',icon:Landmark,tone:'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/25 dark:text-violet-200'},
  ]
  return <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section role="dialog" aria-modal="true" aria-labelledby="portal-title" className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#0b1e2d]"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Architecture multi-acteurs</div><h2 id="portal-title" className="mt-1 text-2xl font-bold">Choisir un espace LOTISEC</h2><p className="mt-1 text-sm muted">Les espaces partagent le même système sécurisé, mais leurs données et actions sont adaptées à chaque métier.</p></div><div className="mt-5 grid gap-3 md:grid-cols-3">{options.map(option=>{const Icon=option.icon;return <button type="button" key={option.id} onClick={()=>onSelect(option.id)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${option.tone} ${active===option.id?'ring-2 ring-current ring-offset-2 dark:ring-offset-[#0b1e2d]':''}`}><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70 dark:bg-slate-950/30"><Icon size={21}/></span><b className="mt-4 block">{option.title}</b><span className="mt-1 block text-xs leading-5 opacity-80">{option.role}</span>{active===option.id&&<span className="mt-3 inline-flex rounded-full bg-white/70 px-2 py-1 text-[9px] font-black uppercase dark:bg-slate-950/30">Espace actif</span>}</button>})}</div><button type="button" onClick={onClose} className="btn-secondary mt-4 w-full">Fermer</button></section></div>
}

function DemoDock({demo}){
  const completed=Math.min(demo.step,demo.steps.length)
  const finished=completed>=demo.steps.length
  const interval=demo.intervalSeconds||10
  const [seconds,setSeconds]=useState(interval)
  useEffect(()=>{
    setSeconds(interval)
    if(!demo.auto||demo.busy||finished) return undefined
    const timer=setInterval(()=>setSeconds(value=>Math.max(0,value-1)),1000)
    return ()=>clearInterval(timer)
  },[demo.step,demo.auto,demo.busy,finished,interval])
  if(finished) return null
  const current=demo.steps[completed]
  return <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-6xl overflow-hidden rounded-2xl border border-blue-300 bg-[#072b4d] text-white shadow-2xl shadow-blue-950/35 xl:left-72">
    <div className="h-1 bg-white/15"><div className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all" style={{width:`${completed/demo.steps.length*100}%`}}/></div>
    <div className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-lg font-black">{completed+1}</span><div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[.18em] text-sky-200">Flux du mode test · étape {completed+1} sur {demo.steps.length}</div><div className="mt-1 text-base font-bold">{demo.busy?'Exécution en cours…':current.label}</div><div className="mt-0.5 text-xs text-blue-100">{current.detail}</div></div></div><div className="flex items-center gap-2"><span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold">{demo.auto?`Prochaine action dans ${seconds} s`:'Contrôle manuel'}</span><button type="button" onClick={demo.onReset} className="btn !bg-white/10 !px-3 text-white hover:!bg-white/20"><RotateCcw size={15}/>Recommencer</button><button type="button" onClick={demo.onAuto} className={`btn !px-3 text-white ${demo.auto?'!bg-amber-500 hover:!bg-amber-600':'!bg-white/10 hover:!bg-white/20'}`}>{demo.auto?<><Pause size={15}/>Pause</>:<><Play size={15}/>Lecture auto</>}</button><button type="button" disabled={demo.busy||demo.auto} onClick={demo.onNext} className="btn !bg-white !px-4 !text-blue-800 hover:!bg-blue-50">{demo.busy?'Patientez':'Exécuter'}<ChevronRight size={16}/></button></div></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{demo.steps.map((step,index)=>{const isCurrent=index===completed,done=index<completed;return <div key={step.label} className={`min-w-[145px] flex-1 rounded-xl border px-3 py-2 transition ${isCurrent?'border-sky-300 bg-sky-400/15 ring-1 ring-sky-300/40':done?'border-emerald-400/40 bg-emerald-400/10':'border-white/10 bg-white/5'}`}><div className={`text-[9px] font-black uppercase tracking-wider ${isCurrent?'text-sky-200':done?'text-emerald-300':'text-slate-400'}`}>{done?'✓ Validée':`Étape ${index+1}`}</div><div className="mt-1 text-xs font-semibold">{step.label}</div></div>})}</div>
    </div>
  </div>
}

function EmergencyDialog({onClose}){
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section role="dialog" aria-modal="true" aria-labelledby="emergency-title" className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl dark:border-red-900 dark:bg-[#0b1e2d]"><div className="bg-gradient-to-r from-red-700 to-red-500 p-5 text-white"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Siren size={23}/></span><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-red-100">Assistance immédiate</div><h2 id="emergency-title" className="mt-1 text-xl font-bold">Contacter les urgences</h2></div></div><p className="mt-3 text-sm text-red-50">Sélectionnez un service pour lancer l’appel depuis l’appareil de l’opérateur.</p></div><div className="space-y-2 p-4">{emergencyContacts.map(contact=><a key={contact.number} href={`tel:${contact.number}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-red-300 hover:bg-red-50 dark:border-slate-700 dark:hover:border-red-800 dark:hover:bg-red-950/20"><span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 font-black text-red-700 dark:bg-red-950/40 dark:text-red-300">{contact.number}</span><span className="min-w-0 flex-1"><b className="block text-sm">{contact.name}</b><span className="text-xs muted">{contact.detail}</span></span><span className="btn-primary !bg-red-600 !px-3 !py-2"><PhoneCall size={15}/>Appeler</span></a>)}</div><div className="border-t border-slate-100 p-4 dark:border-slate-800"><button type="button" onClick={onClose} className="btn-secondary w-full">Fermer</button></div></section></div>
}
