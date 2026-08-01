// Offline support.
//
// NETWORK-FIRST, falling back to the cache. Cache-first would load a shade
// faster, but a phone that has added this to its Home Screen would then keep
// serving yesterday's build and no fix would ever appear to arrive. While the
// game is being changed between sessions, "always current, still works with no
// signal" is worth more than fifty milliseconds.
//
// Swap the order if this ever stops changing weekly.
const CACHE = 'grandiose-v22';
const FILES = [
  './',
  './index.html',
  './ui.js',
  './engine.js',
  './data.js',
  './score.js',
  './galaxy.js',
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
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request)
        .then(hit => hit || caches.match('./index.html')))
  );
});
