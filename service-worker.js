/* ============================================================
   BARONGSUKMA — Service Worker
   Meng-cache app-shell (index.html, manifest, icons) supaya:
   1. App bisa dibuka offline setelah kunjungan pertama.
   2. Saat dibuka dari homescreen, browser langsung menyajikan
      index.html dari cache secepat mungkin — jadi splash screen
      custom di dalam index.html (bukan splash putih Android)
      yang muncul duluan.

   CATATAN VERSI: setiap kali index.html diubah dan di-deploy ulang,
   naikkan angka di CACHE_NAME (mis. 'v1' -> 'v2') supaya service
   worker tahu harus mengambil ulang file-file baru, bukan
   menyajikan versi lama dari cache.
   ============================================================ */

const CACHE_NAME = 'barongsukma-cache-v1';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ---- INSTALL: simpan app-shell ke cache ---- */
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL);
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

/* ---- ACTIVATE: bersihkan cache versi lama ---- */
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(cacheNames){
      return Promise.all(
        cacheNames
          .filter(function(name){ return name !== CACHE_NAME; })
          .map(function(name){ return caches.delete(name); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

/* ---- FETCH: cache-first untuk app-shell, network-first untuk sisanya ----
   Strategi ini memastikan index.html (dan splash custom di dalamnya)
   tersaji instan dari cache, sambil tetap mengambil data terbaru
   untuk request lain saat online. */
self.addEventListener('fetch', function(event){
  var req = event.request;

  /* Hanya tangani GET; biarkan request lain (POST dll) lewat apa adanya */
  if(req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;

      return fetch(req).then(function(response){
        /* Simpan salinan response ke cache untuk kunjungan berikutnya,
           hanya untuk response yang valid (status 200, same-origin) */
        if(response && response.status === 200 && response.type === 'basic'){
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache){
            cache.put(req, responseClone);
          });
        }
        return response;
      }).catch(function(){
        /* Offline dan tidak ada di cache — untuk navigasi halaman,
           fallback ke index.html supaya app tetap terbuka */
        if(req.mode === 'navigate'){
          return caches.match('./index.html');
        }
      });
    })
  );
});
