// The lava field's territories in docs/dusk/ (chapter step 4): the basalt forest, the lava lake, the rift, the delta.
// Built as territories from the start, after Sam called the ice's first version "little demo areas".
//
// Asserts that the land beyond the walker's feet is filled and shared and blended, that each territory does its job (the
// columns leave gaps to weave, the lake is lava with islands each holding a battery, the rift hides you from guns on its
// rims, the delta is braided), that the bases are walled with guns inside and kept off the lava, and that the walker's
// own ground and its towers' patches are exactly as they were.
//
//   node test/dusk-lavafield.mjs

import { chromium } from 'playwright';
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
const allErrors = [];
async function run(code) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', e => allErrors.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  await page.evaluate(() => window.__t(`
    renderer.render = function () {}; wxHold = 'clear'; chapterHold = 2;
    var seed = 909; Math.random = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    M.blocked = function (a, b) { for (var u = 0.02; u < 0.98; u += 0.01) { var x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u, y = a.y + (b.y - a.y) * u; if (height(x, z) > y) return true; } return false; };
    damage = function () {}; eruptT = 1e9; 1`));
  const r = await page.evaluate(c => window.__t(c), code);
  await page.close();
  return JSON.parse(r);
}

console.log('\n— today\'s size, and the walker\'s ground —');
{
  const r = await run(`var o = {}; scaleHold = 1; startRound(4); o.none = lavaLayout() === null;
    [[1, 9], [3, 19]].forEach(function (p) { scaleHold = scaleOf(p[0]); startRound(p[1]); var worst = 0, w = [0, 0, 0, 0];
      for (var q = 0; q < 4000; q++) { var a = Math.random() * 6.283, rr = Math.random() * 155, x = Math.cos(a) * rr, z = Math.sin(a) * rr; worst = Math.max(worst, Math.abs(heightLava(x, z) - lavaRock(x, z))); }
      var towers = WK_TOWERS.map(function (t) { return lavaWeights(t[0], t[1], w); });
      o[p[0]] = { worst: worst, towers: Math.max.apply(null, towers) }; });
    JSON.stringify(o)`);
  check(r.none, 'at today\'s size there is no room for territories, and the lava field is as it was', JSON.stringify(r));
  check([1, 3].every(c => r[c].worst === 0 && r[c].towers === 0), 'at every size the walker\'s ground, to 155 out, and its towers\' patches are exactly as they were', JSON.stringify(r));
}

for (const [nm, sc, n, camps] of [['chapter 2', 'scaleOf(1)', 9, 3], ['full size', 'scaleOf(3)', 19, 5]]) {
  console.log(`\n— ${nm} —`);
  const r = await run(`scaleHold = ${sc}; startRound(${n}); M.step(30); var L = lavaLayout(), o = {}, w = [0, 0, 0, 0];
    var n = 0, claimed = 0, mixed = 0, dom = [0, 0, 0, 0];
    for (var q = 0; q < 6000; q++) { var x = (Math.random() * 2 - 1) * L.outer, z = (Math.random() * 2 - 1) * L.outer, d = Math.hypot(x, z);
      if (d < 205 || d > L.outer - 45) continue; if (WK_TOWERS.some(function (t) { return Math.hypot(t[0] - x, t[1] - z) < 32; })) continue;
      n++; var rad = lavaWeights(x, z, w), mx = Math.max.apply(null, w); if (rad > 0.95) claimed++; if (mx < 0.8 * rad) mixed++; dom[w.indexOf(mx)]++; }
    o.claimed = claimed / n; o.mixed = mixed / n; o.dom = dom.map(function (v) { return v / n; });
    var moat = 0, mN = 0; for (var a = 0; a < 6.283; a += 0.02) { var x2 = Math.cos(a) * 205, z2 = Math.sin(a) * 205; if (WK_TOWERS.some(function (t) { return Math.hypot(t[0] - x2, t[1] - z2) < 32; })) continue; mN++; if (lavaWeights(x2, z2, w) > 0.9) moat++; }
    o.moat = moat / mN;
    var prev = -1, turns = 0; for (a = 0; a < 6.283; a += 0.01) { lavaWeights(Math.cos(a) * L.rc, Math.sin(a) * L.rc, w); var k = w.indexOf(Math.max.apply(null, w)); if (prev >= 0 && k !== prev) turns++; prev = k; } o.turns = turns;
    function heart(k, f) { var out = []; for (var q = 0; q < 30000 && out.length < 1500; q++) { var x = (Math.random() * 2 - 1) * L.outer, z = (Math.random() * 2 - 1) * L.outer; lavaWeights(x, z, w); if (w[k] > 0.85) { var v = f(x, z); if (v !== null) out.push(v); } } return out; }
    function nearBase(x, z) { return L.bases.some(function (b) { return Math.abs(x - b.x) < b.half + b.wallT + 8 && Math.abs(z - b.z) < b.half + b.wallT + 8; }); }
    // the forest: between two neighbouring columns, how wide the low ground is
    var gaps = [], S = LAVA_COL_GAP, tops = [];
    for (q = 0; q < 4000 && gaps.length < 80; q++) { var gx = Math.round((Math.random() * 2 - 1) * L.outer / S), gz = Math.round((Math.random() * 2 - 1) * L.outer / (S * 0.866));
      var cx = (gx + gz * 0.5) * S, cz = gz * S * 0.866, nx = cx + S, nz = cz; lavaWeights(cx, cz, w);
      // not beside a base, whose walls stand where a column's neighbour would
      if (w[0] < 0.85 || L.bases.some(function (b) { return Math.abs(cx + S / 2 - b.x) < b.half + b.wallT + 8 + S && Math.abs(cz - b.z) < b.half + b.wallT + 8 + 8; })) continue;
      var t1 = heightLava(cx, cz), t2 = heightLava(nx, nz), b1 = lavaGroundNoBases(cx, cz); if (t1 < 14 || t2 < 14) continue; tops.push(t1);
      var flat = 0; for (var u = -3; u <= 3; u += 1.5) for (var v2 = -3; v2 <= 3; v2 += 1.5) flat = Math.max(flat, Math.abs(heightLava(cx + u, cz + v2) - t1));
      if (flat > 0.3) continue; var lo = Math.min(t1, t2) - 6, run = 0, best = 0; for (u = 0; u <= S; u += 0.25) { if (heightLava(cx + u, cz) < lo) { run += 0.25; best = Math.max(best, run); } else run = 0; } gaps.push(best); }
    gaps.sort(function (a3, b3) { return a3 - b3; }); o.colGap = gaps[0]; o.cols = gaps.length; o.tallest = Math.max.apply(null, tops);
    // the lake: lava, islands with a battery each
    var lake = heart(1, function (x, z) { if (nearBase(x, z) || L.islands.some(function (is) { return Math.hypot(x - is.x, z - is.z) < is.r + 4; })) return null; return heightLava(x, z); });
    o.lakeLava = lake.filter(function (h) { return h < 0; }).length / lake.length;
    o.islands = L.islands.map(function (is) { var top = heightLava(is.x, is.z), guns = ground.filter(function (g) { return g.alive && Math.hypot(g.pos.x - is.x, g.pos.z - is.z) < is.r && Math.abs(g.pos.y - (heightLava(g.pos.x, g.pos.z) + 1.9)) < 0.05; }).length; return { top: +top.toFixed(2), guns: guns }; });
    o.lakeDrones = drones.filter(function (d) { return d.alive && Math.hypot(d.c.x - L.lake.x, d.c.z - L.lake.z) < L.lake.R; }).length; o.drones = drones.filter(function (d) { return d.alive; }).length;
    // the rift: rims, a floor, the lava thread, and cover from guns on its rims
    var R = L.rift, rims = [], floors = [], seen = 0, hid = 0, lifted = 0;
    for (q = 0; q < 300; q++) { var al = (Math.random() - 0.5) * 2 * L.rc * 0.5, px = R.x + R.ux * al, pz = R.z + R.uz * al; lavaWeights(px, pz, w); if (w[2] < 0.85) continue;
      // at the rift's own scale (R.k): a first version measured at full size's widths, and at chapter 2's put its floor on the rims
      var off = Math.sin(al * 0.03) * 14 * R.k, fx = px + R.uz * off, fz = pz - R.ux * off;
      floors.push(heightLava(fx + R.uz * 6 * R.k, fz - R.ux * 6 * R.k)); var rx = fx + R.uz * 22 * R.k, rz = fz - R.ux * 22 * R.k; rims.push(heightLava(rx, rz));
      var gun = new THREE.Vector3(rx, heightLava(rx, rz) + 1.9, rz), ship = new THREE.Vector3(fx - R.uz * 4 * R.k + R.ux * 40, 12, fz + R.ux * 4 * R.k + R.uz * 40);
      if (gun.distanceTo(ship) > 125) continue; seen++; if (M.blocked(gun, ship)) hid++; ship.y = 40; if (M.blocked(gun, ship)) lifted++; }
    floors.sort(function (a3, b3) { return a3 - b3; }); rims.sort(function (a3, b3) { return a3 - b3; });
    o.riftFloor = floors[Math.floor(floors.length / 2)]; o.riftRim = rims[Math.floor(rims.length / 2)]; o.riftHid = hid / Math.max(1, seen); o.riftLifted = lifted / Math.max(1, seen); o.riftLines = seen;
    // the delta: braided, lava and rock both
    var delta = heart(3, function (x, z) { return nearBase(x, z) ? null : heightLava(x, z); }); o.deltaLava = delta.filter(function (h) { return h < 0; }).length / delta.length;
    // the bases
    o.bases = L.bases.map(function (b) { var mid = b.half + b.wallT / 2, sides = [];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (sd) { var hs = []; for (var t = -b.half + 2; t <= b.half - 2; t += 1) hs.push(heightLava(b.x + sd[0] * mid + (sd[0] ? 0 : t), b.z + sd[1] * mid + (sd[1] ? 0 : t)) - b.floor);
        var gate = Math.abs(b.gx) > Math.abs(b.gz) ? sd[0] === Math.sign(b.gx) : sd[1] === Math.sign(b.gz); sides.push({ gate: gate, low: hs.filter(function (h) { return h < 2; }).length, high: hs.filter(function (h) { return h > b.wallH - 2; }).length, n: hs.length }); });
      var guns = ground.filter(function (g) { return g.alive && Math.abs(g.pos.x - b.x) < b.half && Math.abs(g.pos.z - b.z) < b.half && Math.abs(g.pos.y - (b.floor + 1.9)) < 0.05; }).length;
      return { big: b.guns === 8, floor: b.floor, onGround: Math.abs(b.floor - Math.max(4, lavaGroundNoBases(b.x, b.z, true))) < 0.01, sides: sides, guns: guns, want: b.guns, tower: Math.min.apply(null, WK_TOWERS.map(function (t) { return Math.hypot(t[0] - b.x, t[1] - b.z) - b.half - b.wallT; })) }; });
    JSON.stringify(o)`);
  console.log(`  the land beyond the walker's feet: ${Math.round(100 * r.claimed)}% claimed by a territory; forest / lake / rift / delta ${r.dom.map(v => Math.round(100 * v) + '%').join(' / ')}; ${Math.round(100 * r.mixed)}% a blend; the leader changes ${r.turns} times round a circle`);
  console.log(`  forest: ${r.cols} pairs of columns measured, the narrowest gap ${r.colGap}, the tallest ${r.tallest.toFixed(0)}; lake ${Math.round(100 * r.lakeLava)}% lava, ${r.islands.length} islands, guns ${r.islands.map(i => i.guns).join(',')}; ${r.lakeDrones} of ${r.drones} drones over it`);
  console.log(`  rift: floor ${r.riftFloor.toFixed(1)}, rims ${r.riftRim.toFixed(1)}; a rim gun's line to a ship down in it blocked ${Math.round(100 * r.riftHid)}%, lifted over the rims ${Math.round(100 * r.riftLifted)}% (${r.riftLines} lines); delta ${Math.round(100 * r.deltaLava)}% lava`);
  check(r.claimed >= 0.75 && r.moat >= 0.9, `${nm}: the land beyond the walker's feet is the territories': ${Math.round(100 * r.claimed)}% of it, and right in to 205 all round`, JSON.stringify([r.claimed, r.moat]));
  check(r.dom.every(v => v >= 0.15 && v <= 0.4) && r.mixed >= 0.1 && r.turns >= 4 && r.turns <= 16, `${nm}: four territories share it, their borders blending`, JSON.stringify([r.dom, r.mixed, r.turns]));
  check(r.cols >= 5 && r.colGap >= 12 && r.tallest >= 30, `${nm}: the basalt columns stand flat-topped and tall, at least 12 between neighbours`, JSON.stringify([r.cols, r.colGap, r.tallest]));
  check(r.lakeLava >= 0.7 && r.islands.length >= 3 && r.islands.every(i => Math.abs(i.top - 8) < 0.01 && i.guns >= 2), `${nm}: the lake is lava, with islands each holding a battery`, JSON.stringify([r.lakeLava, r.islands]));
  check(r.lakeDrones >= Math.min(12, Math.floor(r.drones / 3)), `${nm}: a third of the drones, up to twelve, gather over the lake`, JSON.stringify([r.lakeDrones, r.drones]));
  check(r.riftRim - r.riftFloor >= 18 && r.riftHid >= 0.6 && r.riftHid - r.riftLifted >= 0.5, `${nm}: the rift is deep, and down in it its rims' guns mostly cannot see you`, JSON.stringify(r));
  check(r.deltaLava >= 0.25 && r.deltaLava <= 0.75, `${nm}: the delta is braided: lava and rock both`, JSON.stringify(r.deltaLava));
  check(r.bases.length === camps + 1 && r.bases.filter(b => b.big).length === 1, `${nm}: one large base and ${camps} small camps`, JSON.stringify(r.bases.length));
  check(r.bases.every(b => b.floor >= 4 && b.onGround && b.guns >= b.want && b.tower > 20 && b.sides.filter(s => !s.gate).every(s => s.high >= s.n - 2) && b.sides.filter(s => s.gate).every(s => s.low >= (b.big ? 16 : 12))), `${nm}: each on the rock beneath it (not on a column), walled on three sides with a gate, its guns inside, clear of the towers`, JSON.stringify(r.bases));
}

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
