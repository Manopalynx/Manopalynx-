// Does each published app still work with no signal — and does shipping one of them
// break the others?
//
// GitHub Pages serves /docs from main as the root of one site, so everything published
// shares a single origin and a single folder:
//
//     https://manopalynx.github.io/Manopalynx-/               index.html   Grandiose
//     https://manopalynx.github.io/Manopalynx-/matchbox.html               Matchbox
//
// A service worker's scope is the folder its script sits in, so docs/sw.js is in charge
// of every URL on the site, not only Grandiose's. And Cache Storage is per ORIGIN, not
// per scope — so one app's housekeeping can reach another app's saved files.
//
// Two things worth asserting rather than assuming, neither of which throws, warns or
// looks wrong on screen:
//
//   1. An app opened with no signal must serve ITSELF. A fallback at the end of a fetch
//      handler is the right answer for the app that owns it and the wrong answer for
//      everything else on the site — and handing back a working game that is not the
//      one that was tapped is worse than an error page.
//   2. Shipping a new build of one app must not delete another app's saved files.
//      `caches.keys()` returns every cache on the origin, so a filter that keeps only
//      "the one I just made" throws the neighbours away.
//
// Written against the MECHANISM rather than against Matchbox, because a third app is
// coming and a check naming Matchbox would only ever have caught Matchbox.
//
// HOW "OFFLINE" IS DONE HERE, AND WHY NOT THE OBVIOUS WAY
// ------------------------------------------------------
// The first version of this file used Playwright's `context.setOffline(true)` and
// reported six passes against code that had both faults. That emulation is applied to
// the page, and a service worker is a separate target: `fetch()` inside the worker went
// out to the real server and came back with the real file, so every check was measuring
// a page that was never offline. The server logged the hits.
//
// So the network is taken away at the server instead — the socket is destroyed, which
// nothing in the browser can be exempt from. Check 0 exists to keep it that way: it
// asserts the harness can still tell offline from online at all. If check 0 ever passes
// while the rest do, believe check 0.
//
// Run:  node test/offline.mjs

import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, extname, join, normalize } from 'path';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = resolve(ROOT, 'docs');

// Every app published under docs/, and how to recognise its own page on screen.
// A new app adds a row here and is covered by everything below.
const APPS = [
  { name: 'Grandiose', url: '/index.html',    title: 'Grandiose — The Ledger' },
  { name: 'Matchbox',  url: '/matchbox.html', title: 'Matchbox' },
  { name: 'The Column', url: '/column/index.html', title: 'Grandiose — The Column' }
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8'
};

let netDown = false;
let served = [];                     // what the server actually handed over
const sockets = new Set();
const override = new Map();          // serve a modified file without touching the tree

const server = createServer((req, res) => {
  if (netDown) return req.socket.destroy();
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  served.push(p);
  if (override.has(p)) {
    res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' });
    return res.end(override.get(p));
  }
  const file = join(DOCS, p);
  if (!file.startsWith(DOCS) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not found');
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  res.end(readFileSync(file));
});
server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });

// Keep-alive means a connection opened while online outlives the switch, so the open
// ones are cut as well as the door being shut.
const goOffline = () => { netDown = true; sockets.forEach(s => s.destroy()); served = []; };
const goOnline = () => { netDown = false; };

let passed = 0, failed = 0;
const note = s => console.log(`        · ${s}`);
const ok = s => { passed++; console.log(` ok   ${s}`); };
const bad = (s, why) => { failed++; console.log(`FAIL  ${s}`); (why || []).forEach(note); };

async function freshContext(browser) {
  const ctx = await browser.newContext();
  // The suites block http(s) beyond the fixture: a CDN fetch that never resolves
  // stalls the load event indefinitely.
  await ctx.route('**', route => {
    const h = new URL(route.request().url()).hostname;
    return (h === '127.0.0.1' || h === 'localhost') ? route.continue() : route.abort();
  });
  return ctx;
}

// Loads Grandiose and waits until its service worker is not merely registered but
// actually in charge of the page. `ready` resolves on an active registration, which is
// one step short: until a controller exists nothing is being intercepted, and an
// offline check would be measuring the browser's own HTTP cache instead.
async function installServiceWorker(page, base) {
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(r =>
        navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
}

// Read from docs/sw.js rather than restated here — this file must not become the
// second copy of a name that lives in sw.js.
function swSource() { return readFileSync(join(DOCS, 'sw.js'), 'utf8'); }
function currentCacheName() {
  const m = swSource().match(/^const CACHE = '([^']+)';$/m);
  if (!m) throw new Error('docs/sw.js: could not read the CACHE constant');
  return m[1];
}
// Every './…' path the worker names, which is what it is promising to hold offline.
function promisedFiles() {
  // COMMENTS STRIPPED FIRST. This reads every './…' string in the file as a
  // promise, so a comment that names a path — one explaining why a path is NOT
  // in the list, for instance — was read as a promise and failed the check on a
  // file the worker had never claimed. A check that goes red for a comment
  // teaches you to read red as noise.
  const src = swSource().replace(/\/\/[^\n]*/g, '');
  return [...new Set([...src.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]))];
}

const run = async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  // ---------------------------------------------------------------------------
  // 0. CONTROL. Can this harness tell offline from online at all? A page with no
  //    service worker must fail outright once the network is gone. Without this,
  //    every check below can pass on a page that was never offline — which is
  //    exactly what the first version of this file did.
  // ---------------------------------------------------------------------------
  {
    const ctx = await freshContext(browser);
    const page = await ctx.newPage();
    let online = null, offline = null;
    try {
      await page.goto(base + '/matchbox.html', { waitUntil: 'load' });  // registers no worker
      online = await page.title();
      goOffline();
      try { await page.goto(base + '/matchbox.html', { waitUntil: 'load' }); offline = await page.title(); }
      catch { offline = null; }
    } finally { goOnline(); await ctx.close(); }

    if (online && offline === null) ok(`the harness can tell offline from online  [online: ${JSON.stringify(online)}, offline: navigation failed]`);
    else bad(`the harness can tell offline from online`, [
      online === null ? 'could not load the page even while online' :
        `an unregistered page still loaded with the network down, titled ${JSON.stringify(offline)}`,
      'every offline result below is void until this passes'
    ]);
  }

  // ---------------------------------------------------------------------------
  // 1. Every app serves its own page with no signal, having been opened once with
  //    one. This is the situation the offline support exists for: it was visited,
  //    then the train went into a tunnel.
  // ---------------------------------------------------------------------------
  for (const app of APPS) {
    const ctx = await freshContext(browser);
    const page = await ctx.newPage();
    let title = null, err = null;
    try {
      await installServiceWorker(page, base);
      await page.goto(base + app.url, { waitUntil: 'load' });   // the online visit
      goOffline();
      try { await page.goto(base + app.url, { waitUntil: 'load' }); title = await page.title(); }
      catch (e) { err = e.message.split('\n')[0]; }
    } finally { goOnline(); await ctx.close(); }

    const label = `${app.name} still serves itself offline after being opened once`;
    if (title === app.title) ok(`${label}  [visited, then offline]`);
    else bad(label, [
      err ? `the navigation failed: ${err.slice(0, 70)}` : `came back titled ${JSON.stringify(title)}`,
      `expected ${JSON.stringify(app.title)} — ${app.url}`
    ]);
  }

  // ---------------------------------------------------------------------------
  // 2. An app opened offline for the first time must not be handed a DIFFERENT
  //    app's page. Failing outright is honest; showing the wrong game is not.
  // ---------------------------------------------------------------------------
  for (const app of APPS) {
    const ctx = await freshContext(browser);
    const page = await ctx.newPage();
    let title = null, failedToLoad = false;
    try {
      await installServiceWorker(page, base);
      goOffline();
      try { await page.goto(base + app.url, { waitUntil: 'load' }); title = await page.title(); }
      catch { failedToLoad = true; }
    } finally { goOnline(); await ctx.close(); }

    const label = `${app.name} offline is never answered with another app's page`;
    const other = APPS.find(a => a !== app && a.title === title);
    if (other) bad(label, [
      `${app.url} was answered with ${other.name}'s page, titled ${JSON.stringify(title)}`,
      `the fallback in docs/sw.js is scoped to the whole site, not to one app`
    ]);
    else if (title === app.title) ok(`${label}  [never visited, offline — served its own page]`);
    else if (failedToLoad) ok(`${label}  [never visited, offline — failed outright, which is honest]`);
    else bad(label, [`came back titled ${JSON.stringify(title)}, which is neither app`]);
  }

  // ---------------------------------------------------------------------------
  // 2b. The same, with the app's page EVICTED from the cache — which is the state
  //     a neighbour was actually left in every time the other app shipped, and so
  //     the state the reported fault happened in. Precaching an app makes check 2
  //     pass without ever reaching the fallback, so without this the fallback is
  //     unguarded: mutation-testing it here is what turns it red.
  // ---------------------------------------------------------------------------
  for (const app of APPS) {
    const ctx = await freshContext(browser);
    const page = await ctx.newPage();
    let title = null, failedToLoad = false, err = null;
    try {
      await installServiceWorker(page, base);
      await page.evaluate(async ({ cache, url }) => {
        const c = await caches.open(cache);
        for (const k of await c.keys()) {
          if (new URL(k.url).pathname.endsWith(url)) await c.delete(k);
        }
      }, { cache: currentCacheName(), url: app.url });
      goOffline();
      try { await page.goto(base + app.url, { waitUntil: 'load' }); title = await page.title(); }
      catch { failedToLoad = true; }
    } catch (e) { err = e.message.split('\n')[0]; }
    finally { goOnline(); await ctx.close(); }

    const label = `${app.name} with nothing saved is not answered with another app's page`;
    const other = APPS.find(a => a !== app && a.title === title);
    if (err) bad(label, [`the check could not run: ${err}`]);
    else if (other) bad(label, [
      `${app.url} was answered with ${other.name}'s page, titled ${JSON.stringify(title)}`,
      `the fallback in docs/sw.js is scoped to the whole site, not to one app`
    ]);
    else if (failedToLoad) ok(`${label}  [evicted, offline — failed outright, which is honest]`);
    else if (title === app.title) ok(`${label}  [evicted, offline — recovered its own page]`);
    else bad(label, [`came back titled ${JSON.stringify(title)}, which is neither app`]);
  }

  // ---------------------------------------------------------------------------
  // 3. Shipping a new build of one app must leave the other apps' saved files
  //    alone. Cache Storage is per origin, so `caches.keys()` hands one app every
  //    other app's caches and a filter of "keep mine" deletes them.
  //
  //    Getting the moment right took two goes. Waiting for the new cache to APPEAR
  //    only proves the worker installed — the deletion runs in activate. Waiting on
  //    `controllerchange` is closer but still early: the event fired while the
  //    deletes were in flight, and reading the keys there reported the neighbour
  //    alive on code that was about to remove it. So the settle signal is the
  //    behaviour itself — the app's OWN previous cache going away, which is the
  //    cleanup demonstrably having run. That holds before and after the fix, since
  //    tidying up its own old builds is the part that was always correct.
  // ---------------------------------------------------------------------------
  {
    const ctx = await freshContext(browser);
    const page = await ctx.newPage();
    let keys = null, err = null;
    const was = currentCacheName();
    const next = was.replace(/(\d+)$/, (_, n) => String(Number(n) + 1));
    try {
      if (next === was) throw new Error(`could not bump a version out of ${was}`);
      await installServiceWorker(page, base);

      await page.evaluate(async () => {
        const c = await caches.open('neighbour-v1');
        await c.put('/neighbour/marker', new Response('kept'));
      });

      // Ship a new build. Assert the substitution applied — a mutation that
      // silently does nothing looks exactly like evidence.
      const src = swSource();
      const hits = src.split(`'${was}'`).length - 1;
      if (hits !== 1) throw new Error(`expected one '${was}' in docs/sw.js, found ${hits}`);
      override.set('/sw.js', Buffer.from(src.replace(`'${was}'`, `'${next}'`)));

      await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const claimed = new Promise(r =>
          navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
        await reg.update();
        await claimed;
      });
      // The cleanup has run once the app's own previous cache is gone. Polled from
      // here rather than with waitForFunction: an async predicate hands that a
      // Promise, a Promise is truthy, and it returns on the first frame having
      // waited for nothing — which reported this check green against code that
      // deletes the neighbour.
      for (let i = 0; i < 100 && (keys === null || keys.includes(was)); i++) {
        if (i) await new Promise(r => setTimeout(r, 200));
        keys = await page.evaluate(() => caches.keys());
      }
      if (keys.includes(was)) throw new Error(`${was} was never cleaned up; activate cannot have run`);
    } catch (e) {
      err = e.message.split('\n')[0];
    } finally { override.delete('/sw.js'); await ctx.close(); }

    const label = `shipping ${next} does not delete another app's saved files`;
    if (keys && keys.includes('neighbour-v1')) {
      ok(`${label}  [caches after activation: ${keys.join(', ')}]`);
    } else if (keys) {
      bad(label, [
        `'neighbour-v1' was deleted when ${next} activated`,
        `caches left: ${keys.length ? keys.join(', ') : '(none)'}`,
        `docs/sw.js deletes every key that is not its own, and keys are origin-wide`
      ]);
    } else {
      bad(label, [`the check could not run: ${err}`]);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Whatever the worker promises to hold offline, it must actually be holding.
  //    A precached path that 404s takes the whole addAll down, and install
  //    swallows that on purpose so a bad list cannot brick the app — which means
  //    a typo in that list is silent by design.
  // ---------------------------------------------------------------------------
  {
    const ctx = await freshContext(browser);
    const page = await ctx.newPage();
    let missing = null, err = null;
    const promised = promisedFiles();
    try {
      await installServiceWorker(page, base);
      missing = await page.evaluate(async ({ files, cache }) => {
        const c = await caches.open(cache);
        const out = [];
        for (const f of files) if (!await c.match('./' + f)) out.push(f);
        return out;
      }, { files: promised, cache: currentCacheName() });
    } catch (e) { err = e.message.split('\n')[0]; }
    finally { await ctx.close(); }

    const label = `every file docs/sw.js names is actually saved offline`;
    if (missing && missing.length === 0) ok(`${label}  [${promised.length}: ${promised.join(', ')}]`);
    else if (missing) bad(label, [`named but not saved: ${missing.join(', ')}`]);
    else bad(label, [`the check could not run: ${err}`]);
  }

  // ---------------------------------------------------------------------------
  // 5. Every module the pages actually import must be named in docs/sw.js.
  //    Check 4 asks whether what the worker PROMISES is held; this asks whether
  //    it promised everything. A module added to the graph and not to the list
  //    opens fine online and paints an empty screen on a train, which is the
  //    worst shape a fault can have: invisible to everyone who can see it.
  //    Found by hand once -- glyphs.js -- which is once too often.
  // ---------------------------------------------------------------------------
  {
    const named = new Set(promisedFiles());
    const seen = new Set();
    const missing = [];
    const walk = (rel) => {
      if (seen.has(rel)) return;
      seen.add(rel);
      const file = join(DOCS, rel);
      if (!existsSync(file)) return;
      const src = readFileSync(file, 'utf8');
      const dir = dirname(rel);
      // A page enters its module graph through a <script src>, not through an
      // import statement. The first version of this matched only imports, so it
      // followed three files, stopped at the page, and would have passed with
      // every module in the game missing from the list.
      const refs = rel.endsWith('.html')
        ? src.matchAll(/(?:src|href)=["'](\.[^"']+)["']/g)
        : src.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g);
      for (const m of refs) {
        const target = normalize(join(dir, m[1])).replace(/\\/g, '/');
        if (!named.has(target)) missing.push(`${rel} imports ${target}`);
        walk(target);
      }
    };
    for (const app of APPS) walk(app.url.replace(/^\//, ''));

    const label = 'every module a page imports is named in docs/sw.js';
    if (!missing.length) ok(`${label}  [${seen.size} files followed]`);
    else bad(label, [...new Set(missing)]);
  }

  await browser.close();
  server.close();
  sockets.forEach(s => s.destroy());

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
};

run().catch(e => { console.error(e); server.close(); process.exit(1); });
