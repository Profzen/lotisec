const DB_NAME='lotisec-fog-prototype'
const STORE_NAME='outbox'
const FALLBACK_KEY='lotisec-fog-outbox'

const browserReady=()=>typeof window!=='undefined'

function fallbackRead(){
  if(!browserReady()) return []
  try{return JSON.parse(localStorage.getItem(FALLBACK_KEY)||'[]')}catch{return []}
}

function fallbackWrite(entries){
  if(browserReady()) localStorage.setItem(FALLBACK_KEY,JSON.stringify(entries))
}

function openDatabase(){
  return new Promise((resolve,reject)=>{
    if(!browserReady()||!('indexedDB' in window)){reject(new Error('IndexedDB indisponible'));return}
    const request=indexedDB.open(DB_NAME,1)
    request.onupgradeneeded=()=>{
      const db=request.result
      if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME,{keyPath:'id'})
    }
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
  })
}

async function withStore(mode,operation){
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(STORE_NAME,mode)
    const store=transaction.objectStore(STORE_NAME)
    const request=operation(store)
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
    transaction.oncomplete=()=>db.close()
  })
}

export async function listFogItems(){
  try{return await withStore('readonly',store=>store.getAll())}
  catch{return fallbackRead()}
}

export async function enqueueFogItem(type,payload,source='Plateforme web'){
  const entry={id:`FOG-${Date.now()}-${Math.random().toString(16).slice(2)}`,type,payload,source,createdAt:new Date().toISOString(),status:'pending'}
  try{await withStore('readwrite',store=>store.put(entry))}
  catch{fallbackWrite([...fallbackRead(),entry])}
  return entry
}

export async function removeFogItems(ids=[]){
  try{
    const db=await openDatabase()
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE_NAME,'readwrite')
      const store=transaction.objectStore(STORE_NAME)
      ids.forEach(id=>store.delete(id))
      transaction.oncomplete=resolve
      transaction.onerror=()=>reject(transaction.error)
    })
    db.close()
  }catch{
    fallbackWrite(fallbackRead().filter(item=>!ids.includes(item.id)))
  }
}

export async function clearFogItems(){
  try{await withStore('readwrite',store=>store.clear())}
  catch{fallbackWrite([])}
}

export function fogStorageLabel(){
  return browserReady()&&'indexedDB' in window?'IndexedDB opérationnel':'Stockage local de secours'
}
