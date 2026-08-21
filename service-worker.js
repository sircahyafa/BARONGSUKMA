/* ============================================================
   BARONGSUKMA — Service Worker
   Strategi cache:
   - App shell kecil (manifest, icon) di-precache saat install.
   - Dokumen HTML utama (index.html) pakai network-first:
     saat online selalu ambil versi terbaru & simpan ke cache,
     saat offline fallback ke versi terakhir yang tersimpan.
     (index.html berisi seluruh app termasuk video base64,
     jadi TIDAK di-precache saat install agar instalasi SW tetap
     cepat — ia otomatis ter-cache begitu pertama kali dibuka.)
   - Asset statis lain pakai cache-first, fallback ke network.

   PENTING: setiap kali index.html diupdate signifikan,
   naikkan SW_VERSION di bawah ini supaya cache lama dibuang
   dan pengguna mendapat app-shell yang bersih.
   ============================================================ */

const SW_VERSION = 'v2';
const CACHE_NAME = 'barongsukma-cache-' + SW_VERSION;

const PRECACHE_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function (err) {
        console.warn('[SW] Sebagian precache gagal:', err);
      });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;

  if (req.method !== 'GET') return;

  const isHTMLRequest =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isHTMLRequest) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, resClone);
          });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  const isVideoRequest = req.url.indexOf('.mp4') !== -1;

  if (isVideoRequest) {
    /* Network-first khusus file video: selalu coba ambil versi
       terbaru dari GitHub Pages dulu. Kalau berhasil, perbarui cache.
       Kalau gagal (offline / 404 sementara), baru fallback ke cache
       lama jika ada. Ini mencegah video yang sempat gagal di-fetch
       (mis. path lama yang 404) "terkunci" selamanya di cache-first. */
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, resClone);
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req)
        .then(function (res) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, resClone);
          });
          return res;
        })
        .catch(function () {
          return cached;
        });
    })
  );
});
