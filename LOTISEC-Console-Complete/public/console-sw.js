const CACHE = 'lotisec-console-shell-v2';
const SHELL = ['/console.html','/console.css','/console.js','/config.js','/assets/logo-lotisec.png','/assets/favicon-32.png'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy=response.clone(); caches.open(CACHE).then((cache)=>cache.put(event.request,copy)); return response;
  }).catch(()=>caches.match(event.request)));
});
