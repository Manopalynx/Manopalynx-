// Offline support. Cache-first for the handful of files the game is made of,
// so once it has been opened it works on a train with no signal.
//
// Bump CACHE whenever a file changes, or phones will keep serving the old copy
// from their cache and you will wonder why a fix did not arrive.
const CACHE = 'grandiose-v1';
const FILES = [
  './',
  './index.html',
  './ui.js',
  './engine.js',
  './data.js',
  './score.js',
  './manifest.webmanifest',
  './icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // a failed precache must not block install
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      // Keep the cache warm for anything served successfully from the network.
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
