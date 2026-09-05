const CACHE_NAME = 'giustizia-riparativa-pwa-v21-pager-v43-mobile';

const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=43',
  './app.js?v=38',
  './manifest.webmanifest?v=39',
  './icons/bilancia-192-v2.png',
  './icons/bilancia-512-v2.png',
  './icons/apple-touch-bilancia-v2.png',
  './icons/favicon-bilancia-v2.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Non intercettare Google Apps Script o altre risorse esterne.
  if (url.origin !== self.location.origin) return;

  // Navigazione: prima rete, poi fallback alla copia locale.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Asset statici: cache-first, con aggiornamento in background.
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
