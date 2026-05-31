// B HAN - Service Worker v5 (Network First + Offline Fallback + Relative Paths)
const CACHE = 'bhan-v6';
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './data.js',
  './firebase-config.js',
  './products-data.js',
  './skin-camera.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE).catch(err => console.warn('Pre-cache partial:', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  // Skip admin panel and external/Firebase URLs
  if (url.includes('control-bhan-2025') || url.includes('admin')) return;
  if (url.includes('firebaseio.com') || url.includes('googleapis.com') ||
      url.includes('gstatic.com') || url.includes('googletagmanager.com')) return;

  // Network first, fallback to cache, then offline page
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(cached => {
          if (cached) return cached;
          // SPA navigation fallback — try index.html
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html')
              .then(idx => idx || caches.match('./'))
              .then(any => any || new Response(
                '<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Offline</title><style>body{font-family:system-ui;text-align:center;padding:60px 20px;background:#efe7dc;color:#2a221a}h1{font-size:24px;margin-bottom:8px}p{color:#8a7d6a}</style></head><body><h1>You\'re offline</h1><p>Check your connection and try again.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              ));
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
      )
  );
});
