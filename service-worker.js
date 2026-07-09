const APP_CACHE = 'linhavoz-app-v2';
const SHARE_CACHE = 'linhavoz-share-cache-v2';
const SHARE_IDB_NAME = 'linhavoz-share-v2';
const SHARE_IDB_STORE = 'zips';
const SHARED_ZIP_KEY = '/__linhavoz_shared_zip__';
const ASSETS = ['index.html', 'manifest.json', 'share.html', 'icon-192.png', 'icon-512.png', 'favicon.png', 'logo-linhavoz.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(ASSETS)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isShare = (url.pathname.endsWith('/share-target') || url.pathname.endsWith('/share.html')) && event.request.method === 'POST';

  if (isShare) {
    event.respondWith(handleShare(event.request));
    return;
  }

  if(event.request.method === 'GET'){
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(r => r || caches.match('index.html'))));
  }
});

async function handleShare(request){
  try{
    const formData = await request.formData();
    const zip = formData.get('zip') || formData.get('file') || [...formData.values()].find(v => v instanceof File && /zip/i.test(`${v.type || ''} ${v.name || ''}`));
    if(!zip) return Response.redirect(new URL('index.html?erro=zip-nao-encontrado', self.registration.scope).href, 303);

    await saveToIdb('latest', { blob: zip, name: zip.name || 'conversa-whatsapp.zip', type: zip.type || 'application/zip', createdAt: Date.now() });
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(SHARED_ZIP_KEY, new Response(zip, { headers: { 'Content-Type': zip.type || 'application/zip' } }));

    return Response.redirect(new URL('index.html?shared=1', self.registration.scope).href, 303);
  }catch(err){
    return Response.redirect(new URL('index.html?erro=share-falhou', self.registration.scope).href, 303);
  }
}

function openDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(SHARE_IDB_STORE)) db.createObjectStore(SHARE_IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIdb(key, value){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_IDB_STORE, 'readwrite');
    tx.objectStore(SHARE_IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
