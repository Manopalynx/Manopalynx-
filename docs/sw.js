// Offline support for the whole published site.
//
// NETWORK-FIRST, falling back to the cache. Cache-first would load a shade
// faster, but a phone that has added this to its Home Screen would then keep
// serving yesterday's build and no fix would ever appear to arrive. While the
// game is being changed between sessions, "always current, still works with no
// signal" is worth more than fifty milliseconds.
//
// Swap the order if this ever stops changing weekly.
//
// SCOPE, WHICH IS THE WHOLE SITE AND NOT ONE APP
// ----------------------------------------------
// A service worker is in charge of the folder its script sits in. GitHub Pages
// serves /docs from main as the root of one site, so this file's neighbours are
// every app published here -- not only Grandiose. Two faults came of assuming
// otherwise, and both were silent:
//
//   · THE FALLBACK ANSWERED FOR EVERYONE. A navigation with nothing cached and no
//     network used to return './index.html' whatever had been asked for, so
//     opening Matchbox on a train showed Grandiose instead. A working game that
//     is not the one that was tapped is worse than an error page, because
//     nothing about it looks like a failure.
//   · THE CLEANUP DELETED THE NEIGHBOURS. Cache Storage is per ORIGIN, not per
//     scope, so caches.keys() returns every cache on the site. Removing
//     "everything that is not mine" therefore threw away every other app's saved
//     files on every single build -- which is why Matchbox worked offline right
//     up until the next time Grandiose shipped.
//
// test/offline.mjs asserts both, against the mechanism rather than against
// Matchbox, so the next app arrives already covered.
//
// Must match BUILD in data.js exactly -- test/build.test.mjs asserts it, because
// the menu shows BUILD and it would be worse than useless if it named a build
// the cache was not actually serving.
const CACHE = 'grandiose-v104';

// Previous builds of THIS app and nothing else on the origin. Derived from CACHE
// so the two cannot drift, which is the fault the name was written to avoid.
const PREFIX = CACHE.replace(/v\d+$/, '');

// Each app published under docs/: the page it owns, and what it needs to open
// with no signal. Adding an app here is what makes it work on a train -- until
// it is listed, it survives offline only by having happened to be fetched since
// the last build, which is not a promise anybody should rely on.
const APPS = [
  {
    page: './index.html',
    files: [
      './',
      './index.html',
      './ui.js',
      './engine.js',
      './data.js',
      './score.js',
      './galaxy.js',
      './audio.js',
      './manifest.webmanifest',
      './icon-180.png'
    ]
  },
  {
    // Matchbox is one self-contained file. The manifest and icon only matter once
    // it is on a Home Screen -- iOS will not take an icon from a data: URI, so it
    // has to be a real file travelling beside the page.
    page: './matchbox.html',
    files: [
      './matchbox.html',
      './matchbox.webmanifest',
      './matchbox-icon-180.png'
    ]
  },
  {
    // The Column lives in its own folder and is four ES modules deep: the page
    // alone is a blank screen offline, because a module that fails to load throws
    // no dialogue and paints nothing.
    page: './column/index.html',
    files: [
      // No bare directory entry here, unlike the site root above. addAll is ATOMIC --
      // one 404 rejects the whole precache and every app loses its files, which
      // is what happened: adding the directory form took all twenty entries down
      // together and test/offline.mjs went red on Grandiose's files, not on this
      // app's. The Column's start_url is index.html, so the directory form is not
      // needed for a Home Screen launch.
      './column/index.html',
      './column/ui.js',
      './column/render.js',
      './column/glyphs.js',
      './column/engine.js',
      './column/data.js',
      './column/column.webmanifest',
      './column/column-icon-180.png'
    ]
  }
];

const FILES = APPS.flatMap(a => a.files);

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
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
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
      .catch(() => caches.match(e.request).then(hit => {
        if (hit) return hit;
        // Nothing saved and no network. A subresource gets an honest failure:
        // handing a page back to a <script> tag only produces a syntax error a
        // long way from its cause.
        if (e.request.mode !== 'navigate') return Response.error();
        // A navigation falls back to the page of the app that OWNS the URL, so a
        // cold open of one app can never be answered with another's. Anything
        // unrecognised gets the site's front page.
        const path = new URL(e.request.url).pathname;
        const owner = APPS.find(a => new URL(a.page, self.location).pathname === path);
        return caches.match(owner ? owner.page : APPS[0].page)
          .then(page => page || Response.error());
      }))
  );
});
