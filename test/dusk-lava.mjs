// The lava field and the walker in docs/dusk/: step one of the third boss. The place and the walk, no fight.
//
// A walk cannot be asserted to look alive. What can be asserted is everything that would make it look broken: a foot
// in the air that should be down, a foot under the ground, a leg stretched past its own length, a body dragging its
// belly, two sets of legs off the ground at once. Those, the landscape, and the trip back to dusk.
//
//   node test/dusk-lava.mjs

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
const check = (cond, n, why) => { if (cond) { passed++; console.log(` ok   ${n}`); } else { failed++; console.log(`FAIL  ${n}`); [].concat(why).forEach(w => console.log(`        · ${w}`)); } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
await seedPage(page);   // seeded from before the page loads, and silent: see dusk-seed.mjs
await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
await page.mouse.click(196, 426);
const r = JSON.parse(await page.evaluate(() => window.__t(`
  chapterHold = 0; scaleHold = 1; wxHold = 'clear'; wxStart(round); // the chapters and the weather vary; these checks are about other things, so hold them: dusk hills, clear
  renderer.render = function () {};
  var now = performance.now(); function st(n, each) { for (var i = 0; i < n; i++) { now += 1000 / 30; tick(now); if (each) each(); } }
  st(3); damage = function () {};
  var pos = terrainGeo.attributes.position, snap = Array.prototype.slice.call(pos.array), o = {};
  function meshOff() { var n = 0; for (var i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - height(pos.getX(i), pos.getZ(i))) > 1e-4) n++; return n; }
  startRound(3); st(30); o.volFar = volcGroup.position.length();
  lavaPreview(true); st(2);
  o.arena = arena; o.meshOff = meshOff(); o.props = duskProps.visible; o.readout = readoutEl.textContent;
  o.enemies = drones.filter(function (d) { return d.alive; }).length + ground.filter(function (g) { return g.alive; }).length + fleet.filter(function (f) { return f.gone <= 0; }).length + ics.filter(function (c) { return c.alive; }).length;
  o.volNear = Math.round(Math.sqrt(Math.pow(VOLC.x + volcGroup.position.x, 2) + Math.pow(VOLC.z + volcGroup.position.z, 2))); o.embers = embers.position.equals(volcGroup.position);
  var under = 0, n = 0; for (var i = 0; i < pos.count; i++) { var x = pos.getX(i), z = pos.getZ(i); if (x * x + z * z < 200 * 200) { n++; if (pos.getY(i) < 0) under++; } }
  o.lavaPct = Math.round(100 * under / n); o.lavaGlow = water.material.emissive.getHex(); o.ship = shipPos.y - Math.max(height(shipPos.x, shipPos.z), 0);
  var onPath = 0; for (var a = 0; a < 6.283; a += 0.02) if (height(Math.cos(a) * WK_R, Math.sin(a) * WK_R) < 0) onPath++; o.pathLava = Math.round(100 * onPath / 315);

  // THE WALK: 150 seconds, a little over two laps, looked at every tick
  var w = walker, W = { ticks: 0, floatFoot: 0, sunkFoot: 0, stretched: 0, crushed: 0, boneOff: 0, kneeUnder: 0, twoTripods: 0, maxAir: 0, minBelly: 1e9, minY: 1e9, maxY: -1e9, noneDown: 0, maxLag: 0 }, a0 = w.ang;
  st(30 * 150, function () {
    W.ticks++;
    var air = 0, trip = {};
    w.legs.forEach(function (lg) {
      var gy = wkGround(lg.foot.x, lg.foot.z);
      if (lg.t >= 0) { air++; trip[lg.tripod] = 1; if (lg.foot.y < gy - 0.5) W.sunkFoot++; }
      else { if (lg.foot.y > gy + 0.01) W.floatFoot++; if (lg.foot.y < gy - 0.01) W.sunkFoot++; }
      var d = lg.foot.distanceTo(lg.hip);
      if (d > WK_L1 + WK_L2 - 0.5) W.stretched++; if (d < Math.abs(WK_L1 - WK_L2) + 0.5) W.crushed++;
      if (Math.abs(lg.hip.distanceTo(lg.kneeAt) - WK_L1) > 0.05 || Math.abs(lg.kneeAt.distanceTo(lg.foot) - WK_L2) > 0.05) W.boneOff++;
      if (lg.kneeAt.y < wkGround(lg.kneeAt.x, lg.kneeAt.z) + 2) W.kneeUnder++;
      var rest = wkRest(lg, 0, new THREE.Vector3()); W.maxLag = Math.max(W.maxLag, Math.sqrt(Math.pow(lg.foot.x - rest.x, 2) + Math.pow(lg.foot.z - rest.z, 2)));
    });
    if (trip[0] && trip[1]) W.twoTripods++; if (air > W.maxAir) W.maxAir = air; if (air === 6) W.noneDown++;
    var belly = w.g.position.y - 9.5 - wkGround(w.pos.x, w.pos.z); if (belly < W.minBelly) W.minBelly = belly;
    if (w.g.position.y < W.minY) W.minY = w.g.position.y; if (w.g.position.y > W.maxY) W.maxY = w.g.position.y;
  });
  W.laps = (w.ang - a0) / 6.283; W.steps = w.legs.map(function (l) { return l.steps; }); W.visible = w.g.visible && w.legs.every(function (l) { return l.upper.visible && l.pad.visible; });
  o.walk = W;

  lavaPreview(false); st(2);
  o.back = { arena: arena, meshOff: meshOff(), props: duskProps.visible, vol: volcGroup.position.length(), walker: walker.g.visible || walker.legs.some(function (l) { return l.upper.visible; }), hold: arenaHold, left: remaining() };
  var diff = 0; for (i = 0; i < snap.length; i++) if (Math.abs(snap[i] - pos.array[i]) > 1e-6) diff++; o.back.diff = diff;
  // dying during a look-round must not leave you on the lava
  lavaPreview(true); st(2); respawn(); st(2); o.afterDeath = { arena: arena, hold: arenaHold, walker: walker.on };
  JSON.stringify(o)`)));
await browser.close();

console.log('\n— the lava field —');
check(r.arena === 2 && r.meshOff === 0 && !r.props, 'the ground you see is the ground the game uses, and the dusk scenery is put away', JSON.stringify(r));
check(r.lavaPct >= 8 && r.lavaPct <= 45, `lava runs through it without drowning it  [${r.lavaPct}% of the field is below the surface]`, `${r.lavaPct}%`);
check(r.lavaGlow === 0xff3c00, 'and what was the sea glows', r.lavaGlow.toString(16));
check(r.volNear < 480 && r.volFar === 0 && r.embers, `the volcano has come up to the rim, embers and all  [its centre is ${r.volNear} from the middle; it was 703]`, JSON.stringify([r.volNear, r.volFar, r.embers]));
check(r.enemies === 0 && /look/.test(r.readout), 'nothing is here to fight, and the readout says it is a look', JSON.stringify([r.enemies, r.readout]));
check(r.ship > 20, `you arrive clear of the ground  [by ${r.ship.toFixed(0)}]`, `${r.ship}`);

console.log('\n— the walk: 150 seconds, every tick —');
const W = r.walk;
console.log(`  laps ${W.laps.toFixed(2)}   steps by leg ${W.steps.join(' ')}   most feet in the air at once ${W.maxAir}   body height ${W.minY.toFixed(1)} to ${W.maxY.toFixed(1)}   least clearance under the belly ${W.minBelly.toFixed(1)}   ${r.pathLava}% of its route is over lava   furthest a foot fell behind ${W.maxLag.toFixed(1)}`);
check(W.visible && W.laps > 2, `it goes all the way round, twice  [${W.laps.toFixed(2)} laps]`, JSON.stringify(W));
check(W.floatFoot === 0 && W.sunkFoot === 0, `no planted foot is ever off the ground or under it  [${W.ticks * 6} foot-ticks]`, `${W.floatFoot} floating, ${W.sunkFoot} sunk`);
check(W.stretched === 0 && W.crushed === 0 && W.boneOff === 0, 'no leg is ever stretched past its length or folded short, and every bone keeps its length', `${W.stretched} stretched, ${W.crushed} crushed, ${W.boneOff} bones off length`);
check(W.kneeUnder === 0, 'no knee goes into the ground', `${W.kneeUnder}`);
check(W.twoTripods === 0 && W.maxAir === 3 && W.noneDown === 0, 'it walks on three while three step: never both sets off the ground', JSON.stringify([W.twoTripods, W.maxAir, W.noneDown]));
check(W.steps.every(s => s >= 40) && Math.max(...W.steps) - Math.min(...W.steps) <= 6, `all six legs do their share  [${W.steps.join(', ')} steps]`, W.steps.join(' '));
check(W.minBelly > 18, `there is room to fly under it the whole way round  [never less than ${W.minBelly.toFixed(0)}]`, `${W.minBelly}`);

console.log('\n— and back —');
check(r.back.arena === 0 && r.back.diff === 0 && r.back.meshOff === 0 && r.back.props, 'dusk comes back exactly as it was', JSON.stringify(r.back));
check(r.back.vol === 0 && !r.back.walker && !r.back.hold, 'the volcano is back on the horizon and the walker is gone, legs and all', JSON.stringify(r.back));
check(r.back.left === 33, 'and the round you were in starts again  [33 to go at round 3]', `${r.back.left}`);
check(r.afterDeath.arena === 0 && !r.afterDeath.hold && !r.afterDeath.walker, 'dying while looking round puts you back at dusk, not on the lava', JSON.stringify(r.afterDeath));
check(errors.length === 0, 'nothing threw', errors);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
