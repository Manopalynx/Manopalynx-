// The dusk hills' territories in docs/dusk/ (chapter step 5): the river canyon, the mesas, the hills, the range. They
// come when the dusk hills come round again at full size; chapter 1 stays the open introduction.
//
// Asserts that the middle (the landing pad and its town) is untouched, that the land beyond is filled and shared and
// blended, that each territory does its job (the canyon hides you from guns on its rims, the mesas are ragged, not round,
// flat-topped with a battery each, the range has peaks and passes), that the bases are walled with guns inside, and that
// the pylons out in the hills stand on the ground or are not there.
//
//   node test/dusk-hills.mjs

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
    renderer.render = function () {}; wxHold = 'clear'; chapterHold = 0;
    var seed = 313; Math.random = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    M.blocked = function (a, b) { for (var u = 0.02; u < 0.98; u += 0.01) { var x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u, y = a.y + (b.y - a.y) * u; if (Math.max(height(x, z), 0) > y) return true; } return false; };
    damage = function () {}; eruptT = 1e9; 1`));
  const r = await page.evaluate(c => window.__t(c), code);
  await page.close();
  return JSON.parse(r);
}


console.log('\n— today\'s size, and the middle —');
{
  const r = await run(`var o = {}; scaleHold = 1; startRound(4); o.none = duskLayout() === null;
    [[1, 9], [3, 19]].forEach(function (p) { scaleHold = scaleOf(p[0]); startRound(p[1]); var worst = 0;
      for (var q = 0; q < 4000; q++) { var a = Math.random() * 6.283, rr = Math.random() * 148, x = Math.cos(a) * rr, z = Math.sin(a) * rr; worst = Math.max(worst, Math.abs(heightDusk(x, z) - duskHills(x, z))); }
      var py = duskPylons.filter(function (p2) { return p2.py.visible; }), bad = py.filter(function (p2) { return Math.abs(p2.py.position.y - (heightDusk(p2.x, p2.z) + 4.5)) > 0.01; }).length, w = [0, 0, 0, 0];
      var inTerr = py.filter(function (p2) { return duskWeights(p2.x, p2.z, w) > 0.02; }).length;
      o[p[0]] = { worst: worst, pylons: py.length, bad: bad, inTerr: inTerr, all: duskPylons.length }; });
    JSON.stringify(o)`);
  check(r.none, 'at today\'s size there is no room for territories, and chapter 1 is as it always was', JSON.stringify(r));
  check([1, 3].every(c => r[c].worst === 0), 'at every size the landing pad, its town and the hills to 148 out are exactly as they were', JSON.stringify(r));
  check([1, 3].every(c => r[c].bad === 0 && r[c].inTerr === 0 && r[c].pylons > 0), `the pylons out in the hills stand on the ground, and none where a territory has taken its spot  [${r[3].pylons} of ${r[3].all} standing at full size]`, JSON.stringify(r));
}

for (const [nm, sc, n, camps] of [['size 1.5', 'scaleOf(1)', 9, 3], ['full size', 'scaleOf(3)', 19, 5]]) {
  console.log(`\n— ${nm} —`);
  const r = await run(`scaleHold = ${sc}; startRound(${n}); M.step(30); var L = duskLayout(), o = {}, w = [0, 0, 0, 0];
    var n = 0, claimed = 0, mixed = 0, dom = [0, 0, 0, 0];
    for (var q = 0; q < 6000; q++) { var x = (Math.random() * 2 - 1) * L.outer, z = (Math.random() * 2 - 1) * L.outer, d = Math.hypot(x, z);
      if (d < 185 || d > L.outer - 30) continue; n++; var rad = duskWeights(x, z, w), mx = Math.max.apply(null, w); if (rad > 0.95) claimed++; if (mx < 0.8 * rad) mixed++; dom[w.indexOf(mx)]++; }
    o.claimed = claimed / n; o.mixed = mixed / n; o.dom = dom.map(function (v) { return v / n; });
    var prev = -1, turns = 0; for (var a = 0; a < 6.283; a += 0.01) { duskWeights(Math.cos(a) * L.rc, Math.sin(a) * L.rc, w); var k = w.indexOf(Math.max.apply(null, w)); if (prev >= 0 && k !== prev) turns++; prev = k; } o.turns = turns;
    // the river canyon: water at its floor, rims well above, and cover from guns on the rims
    var R = L.river, floors = [], rims = [], seen = 0, hid = 0, lifted = 0;
    for (q = 0; q < 300; q++) { var al = (Math.random() - 0.5) * L.rc * 0.8, px = R.x + R.ux * al, pz = R.z + R.uz * al; duskWeights(px, pz, w); if (w[0] < 0.85) continue;
      var off = Math.sin(al * 0.022) * 26, fx = px + R.uz * off, fz = pz - R.ux * off; floors.push(heightDusk(fx, fz));
      var rx = fx + R.uz * 24, rz = fz - R.ux * 24; rims.push(heightDusk(rx, rz));
      // the ship over the canyon's own middle 40 further along: it meanders, and a first version put the ship at a fixed
      // offset that was often over the rim or the hills beside it
      var al3 = al + 40, off3 = Math.sin(al3 * 0.022) * 26, sx = R.x + R.ux * al3 + R.uz * off3, sz = R.z + R.uz * al3 - R.ux * off3;
      var gun = new THREE.Vector3(rx, heightDusk(rx, rz) + 1.9, rz), ship = new THREE.Vector3(sx, 8, sz);
      if (gun.distanceTo(ship) > 125) continue; seen++; if (M.blocked(gun, ship)) hid++; ship.y = 60; if (M.blocked(gun, ship)) lifted++; } // lifted well clear: at 50 it was barely over the far rim
    floors.sort(function (a3, b3) { return a3 - b3; }); rims.sort(function (a3, b3) { return a3 - b3; });
    o.floor = floors[Math.floor(floors.length / 2)]; o.rim = rims[Math.floor(rims.length / 2)]; o.hid = hid / Math.max(1, seen); o.lifted = lifted / Math.max(1, seen); o.lines = seen;
    // the mesas: flat-topped, steep, ragged (not round), a battery on each
    o.mesas = L.mesas.map(function (m) { var top = heightDusk(m.x, m.z), flat = 0, radii = [];
      for (var u = -2; u <= 2; u += 1) for (var v = -2; v <= 2; v += 1) flat = Math.max(flat, Math.abs(heightDusk(m.x + u, m.z + v) - top));
      var drops = [];
      for (var a2 = 0; a2 < 6.283; a2 += 0.2) { var rr = 0; while (rr < 60 && heightDusk(m.x + Math.cos(a2) * rr, m.z + Math.sin(a2) * rr) > top - 12) rr += 0.5; radii.push(rr);
        drops.push(top - heightDusk(m.x + Math.cos(a2) * (rr + 6), m.z + Math.sin(a2) * (rr + 6))); }
      drops.sort(function (p3, q3) { return p3 - q3; });
      var guns = ground.filter(function (g) { return g.alive && Math.hypot(g.pos.x - m.x, g.pos.z - m.z) < m.r && Math.abs(g.pos.y - (heightDusk(g.pos.x, g.pos.z) + 1.9)) < 0.05; }).length;
      // the drop just outside its own edge, the middle of all directions: a first version measured at a fixed 2.2 radii,
      // which on a stretched mesa was still on it and beside a taller one was on that
      return { flat: flat, drop: drops[Math.floor(drops.length / 2)], shape: Math.max.apply(null, radii) / Math.max(1, Math.min.apply(null, radii)), guns: guns }; });
    // the range: peaks along it, and passes between
    var G = L.range, crest = []; for (var al2 = -L.rc * 0.6; al2 <= L.rc * 0.6; al2 += 2) { var cx = G.x + G.ux * al2, cz = G.z + G.uz * al2; duskWeights(cx, cz, w); if (w[3] < 0.85) continue;
      var best = 0; for (var pp = -40; pp <= 40; pp += 2) { var offr = Math.sin(al2 * 0.012) * 20 + pp; best = Math.max(best, heightDusk(cx + G.uz * offr, cz - G.ux * offr)); } crest.push(best); }
    o.peak = Math.max.apply(null, crest); o.pass = Math.min.apply(null, crest);
    o.hillDrones = drones.filter(function (d) { return d.alive && Math.hypot(d.c.x - L.hills.x, d.c.z - L.hills.z) < L.hills.R; }).length; o.drones = drones.filter(function (d) { return d.alive; }).length;
    o.bases = L.bases.map(function (b) { var mid = b.half + b.wallT / 2, sides = [];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (sd) { var hs = []; for (var t = -b.half + 2; t <= b.half - 2; t += 1) hs.push(heightDusk(b.x + sd[0] * mid + (sd[0] ? 0 : t), b.z + sd[1] * mid + (sd[1] ? 0 : t)) - b.floor);
        var gate = Math.abs(b.gx) > Math.abs(b.gz) ? sd[0] === Math.sign(b.gx) : sd[1] === Math.sign(b.gz); sides.push({ gate: gate, low: hs.filter(function (h) { return h < 2; }).length, high: hs.filter(function (h) { return h > b.wallH - 2; }).length, n: hs.length }); });
      var guns = ground.filter(function (g) { return g.alive && Math.abs(g.pos.x - b.x) < b.half && Math.abs(g.pos.z - b.z) < b.half && Math.abs(g.pos.y - (b.floor + 1.9)) < 0.05; }).length;
      return { big: b.guns === 8, floor: b.floor, sides: sides, guns: guns, want: b.guns }; });
    JSON.stringify(o)`);
  console.log(`  the land beyond the town: ${Math.round(100 * r.claimed)}% claimed; river / mesas / hills / range ${r.dom.map(v => Math.round(100 * v) + '%').join(' / ')}; ${Math.round(100 * r.mixed)}% a blend; the leader changes ${r.turns} times round a circle`);
  console.log(`  river canyon: floor ${r.floor.toFixed(1)}, rims ${r.rim.toFixed(1)}; a rim gun's line to a ship down in it blocked ${Math.round(100 * r.hid)}%, lifted ${Math.round(100 * r.lifted)}% (${r.lines})`);
  console.log(`  ${r.mesas.length} mesas: widest over narrowest ${r.mesas.map(m => m.shape.toFixed(1)).join(' ')}; the range's highest crest ${r.peak.toFixed(0)}, its lowest pass ${r.pass.toFixed(0)}; ${r.hillDrones} of ${r.drones} drones over the hills`);
  check(r.claimed >= 0.75 && r.dom.every(v => v >= 0.15 && v <= 0.4) && r.mixed >= 0.1 && r.turns >= 4 && r.turns <= 16, `${nm}: the land beyond the town is the territories', shared four ways and blended`, JSON.stringify([r.claimed, r.dom, r.mixed, r.turns]));
  check(r.floor < 0 && r.rim - r.floor >= 25 && r.hid >= 0.6 && r.hid - r.lifted >= 0.5, `${nm}: the river canyon has water at its floor, and down in it its rims' guns mostly cannot see you`, JSON.stringify(r));
  check(r.mesas.length >= 5 && r.mesas.every(m => m.flat < 0.3 && m.drop >= 18 && m.guns >= 2), `${nm}: the mesas are flat-topped and steep, a battery on each`, JSON.stringify(r.mesas.filter(m => !(m.flat < 0.3 && m.drop >= 18 && m.guns >= 2))));
  check(r.mesas.filter(m => m.shape >= 1.3).length >= r.mesas.length * 0.7, `${nm}: and ragged, not round: most are at least 1.3 times as wide one way as another`, JSON.stringify(r.mesas.map(m => m.shape)));
  check(r.peak >= 70 && r.pass <= 0.6 * r.peak, `${nm}: the range has peaks, and passes between them`, JSON.stringify([r.peak, r.pass]));
  check(r.hillDrones >= Math.min(12, Math.floor(r.drones / 3)), `${nm}: a third of the drones, up to twelve, gather over the hills`, JSON.stringify([r.hillDrones, r.drones]));
  check(r.bases.length === camps + 1 && r.bases.every(b => b.floor >= 4 && b.guns >= b.want && b.sides.filter(s => !s.gate).every(s => s.high >= s.n - 2) && b.sides.filter(s => s.gate).every(s => s.low >= (b.big ? 16 : 12))), `${nm}: one large base and ${camps} camps, each walled with a gate, its guns inside`, JSON.stringify(r.bases));
}

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
