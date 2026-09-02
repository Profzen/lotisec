const SHELL_CACHE='lotisec-shell-v19'
const MAP_CACHE='lotisec-map-tiles-v19'
const SHELL=['/','/lotisec-logo.png','/ambulance-map-sprite.png','/manifest.webmanifest']

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))
})

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>![SHELL_CACHE,MAP_CACHE].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))
})

async function trimMapCache(cache,maxEntries=120){
  const keys=await cache.keys()
  if(keys.length>maxEntries) await Promise.all(keys.slice(0,keys.length-maxEntries).map(key=>cache.delete(key)))
}

self.addEventListener('fetch',event=>{
  const request=event.request
  if(request.method!=='GET') return
  const url=new URL(request.url)
  if(url.hostname==='tile.openstreetmap.org'){
    event.respondWith(caches.open(MAP_CACHE).then(async cache=>{
      const cached=await cache.match(request)
      if(cached) return cached
      try{const response=await fetch(request);cache.put(request,response.clone());trimMapCache(cache);return response}catch{return new Response('',{status:503})}
    }))
    return
  }
  if(url.origin===self.location.origin){
    event.respondWith(fetch(request).then(response=>{const clone=response.clone();caches.open(SHELL_CACHE).then(cache=>cache.put(request,clone));return response}).catch(async()=>await caches.match(request)||await caches.match('/')))
  }
})
