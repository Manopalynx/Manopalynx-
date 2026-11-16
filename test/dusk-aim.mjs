// How the guns aim, in docs/dusk/ (build aim-1).
//
// Sam asked whether enemies shoot "where you are or where they think you are going to be". They aimed only part of the
// way ahead, so a ship flying straight was missed behind it and a weaving one was hit about twice as often. Now every
// gun aims fully at where you will be if you fly on as you are, with its scatter on top: flying straight gets you hit,
// turning gets you out. This suite asserts that, one gun at a time on flat ground, the ship passing 40 off for 20
// seconds, four seeds.
//
//   node test/dusk-aim.mjs

import { chromium } from 'playwright';
import { seedPage } from './dusk-seed.mjs';
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'docs/dusk/index.html'), 'utf8');
const HOOK = '  requestAnimationFrame(tick);\n})();';
if (src.split(HOOK).length !== 2) { console.log('FAIL  the hook point is not there exactly once'); process.exit(1); }
const dir = mkdtempSync(join(tmpdir(), 'dusk-'));
writeFileSync(join(dir, 'index.html'), src.replace(HOOK, '  window.__t = function (code) { return eval(code); };\n' + HOOK));
copyFileSync(join(root, 'docs/dusk/three.min.js'), join(dir, 'three.min.js'));

let passed = 0, failed = 0;
const ok = n => { passed++; console.log(` ok   ${n}`); };
const bad = (n, why) => { failed++; console.log(`FAIL  ${n}`); [].concat(why).forEach(w => console.log(`        · ${w}`)); };
const check = (cond, n, why) => cond ? ok(n) : bad(n, why);
const errorsSeen = [];

const browser = await chromium.launch();

const J = s => `JSON.stringify((function () { ${s} })())`;
async function run(code) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', e => errorsSeen.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await seedPage(page, { seed: 4711 });   // seeded from before the page loads, and silent: see dusk-seed.mjs
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  const out = await page.evaluate(c => window.__t(c), `
    renderer.render = function () {}; scaleHold = 1; wxHold = 'clear'; muted = true;
    window.M = { now: performance.now(), dmg: [] };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    // a round in one arena (0 the dusk hills, 1 the ice, 2 the lava), the hull held and every hit on it written down
    M.go = function (arenaN, round) { chapterHold = arenaN; startRound(round); M.dmg = []; damage = function (n) { M.dmg.push(n); }; time = 0; last = M.now; };
    M.kinds = function () { var o = { lance: 0, crawl: 0, plain: 0, all: 0 }; ground.forEach(function (g) { if (!g.alive) return; o.all++; o[g.kind || 'plain']++; }); o.embers = emberWant; o.left = remaining(); return o; };
    // nothing else alive: only the one kind is being looked at
    M.only = function (kind) { var i; for (i = 0; i < drones.length; i++) { drones[i].alive = false; drones[i].mesh.visible = false; } for (i = 0; i < fleet.length; i++) { fleet[i].gone = Infinity; fleet[i].ship.visible = false; }
      ground.forEach(function (g) { if (g.alive && g.kind !== kind) { g.alive = false; g.group.visible = false; } }); icReset(1); };
    M.of = function (kind) { return ground.filter(function (g) { return g.alive && g.kind === kind; }); };
    M.step(3);
  ` + code);
  await page.close();
  return JSON.parse(out);
}

const MODES = { straight: 'speed = 25;', weave: 'yaw = Math.PI + 0.45 * Math.sin(time * 1.6); basis();' };
const R = {};
for (const kind of ['drone', 'turret']) for (const mode of Object.keys(MODES)) {
  let fired = 0, hits = 0;
  for (const sd of [11, 22, 33, 44]) {
    const r = await run(J(`
      window.__reseed(${sd}); scaleHold = 2.18; chapterHold = 0; startRound(2); height = function () { return 5; };
      var i; for (i = 0; i < drones.length; i++) { drones[i].alive = false; drones[i].mesh.visible = false; }
      for (i = 0; i < ground.length; i++) { ground[i].alive = false; ground[i].group.visible = false; }
      for (i = 0; i < fleet.length; i++) { fleet[i].gone = Infinity; fleet[i].ship.visible = false; }
      var src = new THREE.Vector3();
      if ('${kind}' === 'drone') { var d = drones[0]; spawnDrone(d); d.c.set(0, 60, 0); d.r = 0.5; d.clear = 55; d.off.set(0, 0, 0); d.fireT = 1; src.set(0, 60, 0); }
      else { var f = fleet[0]; reviveShip(f, true); f.gone = 0; f.radius = 0; f.speed = 0; f.angle = 0; M.step(1); src.copy(f.ship.position); }
      var hits = 0, fired = 0, s0 = sfx; sfx = function (n, p) { if (n === 'eshot') fired++; return s0(n, p); };
      damage = function () { hits++; };
      shipPos.set(40, src.y, -260); yaw = Math.PI; pitch = 0; bank = 0; speed = 25; basis(); time = 0; last = M.now;
      M.step(30 * 20, function () { ${MODES[mode]} pitch = 0; shipPos.y = src.y; basis(); });
      return { fired: fired, hits: hits };
    `));
    fired += r.fired; hits += r.hits;
  }
  R[kind + ' ' + mode] = { fired, hits, rate: hits / Math.max(1, fired) };
}
const pc = k => `${R[k].hits} of ${R[k].fired}`;
check(Object.values(R).every(r => r.fired >= 8), 'every gun fired enough to measure', JSON.stringify(R));
check(R['drone straight'].rate >= 0.5, `a drone hits a ship flying straight past it more often than not  [${pc('drone straight')}]`, JSON.stringify(R));
check(R['drone straight'].rate > R['drone weave'].rate && R['turret straight'].rate > R['turret weave'].rate,
  `flying straight is hit more than weaving, by a drone [${pc('drone straight')} against ${pc('drone weave')}] and a turret [${pc('turret straight')} against ${pc('turret weave')}]`, JSON.stringify(R));
check(errorsSeen.length === 0, 'nothing threw', errorsSeen.slice(0, 5));
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
