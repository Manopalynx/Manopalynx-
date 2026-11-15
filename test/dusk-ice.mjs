// The ice field's regions in docs/dusk/ (chapter step 3): crevasses, a frozen lake, ice spires, an outpost.
// Sam: "an opportunity to try and add some variety rather than copy and paste an open empty landscape".
//
// Each region is checked for the thing it is for, not only that it is there: that the crevasses hide you from the guns
// on their shelf, that the lake is open, that the spires leave room to weave, that the outpost's guns are inside walls
// with a way in. And that none of it is where the ice wall's own towers stand.
//
//   node test/dusk-ice.mjs

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
    renderer.render = function () {}; wxHold = 'clear'; chapterHold = 1;
    var seed = 777; Math.random = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    // is anything solid on the straight line from a to b (the same test a shot meets: the ground below it)
    M.blocked = function (a, b) { for (var u = 0.02; u < 0.98; u += 0.01) { var x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u, y = a.y + (b.y - a.y) * u; if (Math.max(height(x, z), 0) > y) return true; } return false; };
    damage = function () {}; 1`));
  const r = await page.evaluate(c => window.__t(c), code);
  await page.close();
  return JSON.parse(r);
}

const SIZES = [['chapter 2', 'scaleOf(1)', 9], ['full size', 'scaleOf(3)', 19]];

console.log('\n— where they are —');
{
  const r = await run(`var o = {};
    scaleHold = 1; startRound(4); o.today = iceRegions() === null;
    [[1, 9], [3, 19]].forEach(function (p) { scaleHold = scaleOf(p[0]); startRound(p[1]); var G = iceRegions(), out = [];
      ['crev', 'lake', 'spires', 'outpost'].forEach(function (k) { var g = G[k], d = Math.hypot(g.x, g.z);
        var tw = WALL_TOWERS.map(function (t) { return Math.hypot(t[0] - g.x, t[1] - g.z) - g.R; });
        out.push({ k: k, inner: Math.round(d - g.R), outer: Math.round(d + g.R), crags: Math.round(170 * SCALE), tower: Math.round(Math.min.apply(null, tw)) }); });
      o[p[0]] = out; });
    JSON.stringify(o)`);
  check(r.today, 'at today\'s size there is no room for them, and the ice is as it was', JSON.stringify(r));
  for (const [c, nm] of [[1, 'chapter 2'], [3, 'full size']]) {
    console.log(`  ${nm}: ` + r[c].map(x => `${x.k} ${x.inner}–${x.outer}`).join(', ') + `  (the wall's band ends at 140; the crags begin at ${r[c][0].crags})`);
    check(r[c].every(x => x.inner >= 140 && x.outer <= x.crags), `${nm}: every region lies between the wall and the crags at the rim`, JSON.stringify(r[c]));
    check(r[c].every(x => x.tower > 15), `${nm}: and none comes within 15 of where the wall's guard towers stand  [nearest ${Math.min(...r[c].map(x => x.tower))}]`, JSON.stringify(r[c]));
  }
}

for (const [nm, sc, n] of SIZES) {
  console.log(`\n— the regions, ${nm} —`);
  const r = await run(`scaleHold = ${sc}; startRound(${n}); M.step(30); var G = iceRegions(), o = {};
    // the crevasses: the shelf's height, the canyons' floor and width, and whether guns up on the shelf can see a ship down in one
    var c = G.crev, shelf = [], floor = [];
    for (var q = 0; q < 5000; q++) { var a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * (c.R - 18), x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr, h = height(x, z);
      if (h > 28) shelf.push({ x: x, z: z, h: h }); else if (h < 14) floor.push({ x: x, z: z, h: h }); }
    o.shelfShare = shelf.length / 5000; o.floorShare = floor.length / 5000; o.shelfH = shelf.reduce(function (s, p) { return s + p.h; }, 0) / shelf.length;
    // canyon width: across each canyon, at right angles, where the ground is under 20
    o.widths = c.canyons.map(function (cy) { var w = []; for (var t = -0.5; t <= 0.5; t += 0.25) { var px = c.x + cy.ux * t * c.R, pz = c.z + cy.uz * t * c.R, run = 0, best = 0;
      for (var u = -30; u <= 30; u += 0.5) { var hx = px - cy.uz * (u + cy.off), hz = pz + cy.ux * (u + cy.off); if (height(hx, hz) < 20) { run += 0.5; best = Math.max(best, run); } else run = 0; } w.push(best); } return Math.min.apply(null, w); });
    var seen = 0, blocked = 0, openSeen = 0, openBlocked = 0;
    for (q = 0; q < 400; q++) { var g = shelf[Math.floor(Math.random() * shelf.length)], f = floor[Math.floor(Math.random() * floor.length)];
      var from = new THREE.Vector3(g.x, g.h + 1.9, g.z), to = new THREE.Vector3(f.x, f.h + 10, f.z); if (from.distanceTo(to) < 25) continue;
      seen++; if (M.blocked(from, to)) blocked++;
      // the control: the same gun, the same spot, the ship lifted out of the canyon to 10 over the shelf's top. (A first
      // version used a spot out on the plain beyond the shelf; the line to it crosses the shelf, and was blocked too.)
      var to2 = new THREE.Vector3(f.x, ICE_SHELF + 10, f.z); openSeen++; if (M.blocked(from, to2)) openBlocked++; }
    o.cover = blocked / seen; o.openCover = openBlocked / openSeen; o.pairs = seen;
    // the lake: flat and open
    var L = G.lake, lh = []; for (q = 0; q < 800; q++) { a = Math.random() * 6.283; rr = Math.sqrt(Math.random()) * L.R * 0.75; lh.push(height(L.x + Math.cos(a) * rr, L.z + Math.sin(a) * rr)); }
    o.lakeMin = Math.min.apply(null, lh); o.lakeMax = Math.max.apply(null, lh);
    // the spires: how many, how tall, and how wide the gaps between them
    var S = G.spires.list, gap = 1e9; for (var i = 0; i < S.length; i++) for (var j = i + 1; j < S.length; j++) gap = Math.min(gap, Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) - S[i].r - S[j].r - 4);
    o.spires = S.length; o.tallest = Math.max.apply(null, S.map(function (p) { return height(p.x, p.z) - 2; })); o.gap = gap;
    // the outpost: its walls on every side but the gate, the gate open, the yard flat, and the guns inside
    var P = G.outpost, mid = P.half + P.wallT / 2, sides = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (sd) { var hs = []; for (var t = -P.half + 2; t <= P.half - 2; t += 2) { var x = P.x + sd[0] * mid + (sd[0] ? 0 : t), z = P.z + sd[1] * mid + (sd[1] ? 0 : t); hs.push(height(x, z) - P.floor); }
      sides.push({ sd: sd, gateSide: Math.sign(P.gx) === sd[0] && Math.abs(P.gx) > Math.abs(P.gz) || Math.sign(P.gz) === sd[1] && Math.abs(P.gz) >= Math.abs(P.gx), low: hs.filter(function (h) { return h < 2; }).length * 2, high: hs.filter(function (h) { return h > 14; }).length * 2, n: hs.length * 2 }); });
    o.sides = sides;
    var yard = []; for (q = 0; q < 300; q++) yard.push(height(P.x + (Math.random() - 0.5) * 2 * (P.half - 1), P.z + (Math.random() - 0.5) * 2 * (P.half - 1)) - P.floor);
    o.yard = [Math.min.apply(null, yard), Math.max.apply(null, yard)];
    var inYard = ground.filter(function (g) { return g.alive && Math.abs(g.pos.x - P.x) < P.half && Math.abs(g.pos.z - P.z) < P.half && Math.abs(g.pos.y - (P.floor + 1.9)) < 0.05; });
    o.guns = inYard.length;
    o.lakeDrones = drones.filter(function (d) { return d.alive && Math.hypot(d.c.x - L.x, d.c.z - L.z) < L.R; }).length; o.drones = drones.filter(function (d) { return d.alive; }).length;
    JSON.stringify(o)`);
  console.log(`  crevasses: shelf ${Math.round(100 * r.shelfShare)}% at ${r.shelfH.toFixed(0)} high, canyon floor ${Math.round(100 * r.floorShare)}%, narrowest canyon ${Math.min(...r.widths)} wide`);
  console.log(`  a shelf gun's line to a ship 10 over a canyon floor: blocked ${Math.round(100 * r.cover)}% of ${r.pairs}; to the same ship lifted to 10 over the shelf: ${Math.round(100 * r.openCover)}%`);
  console.log(`  lake ${r.lakeMin.toFixed(2)} to ${r.lakeMax.toFixed(2)} high; ${r.spires} spires, the tallest ${r.tallest.toFixed(0)}, the narrowest gap ${r.gap.toFixed(1)}; ${r.guns} guns in the outpost; ${r.lakeDrones} of ${r.drones} drones over the lake`);
  check(r.shelfH > 30 && r.shelfShare > 0.3 && r.floorShare > 0.2, `${nm}: the crevasses are a shelf 34 high with canyons cut down to the plain`, JSON.stringify(r));
  check(r.widths.every(w => w >= 18 && w <= 32), `${nm}: every canyon is wide enough to fly down, all along: 18 to 32  [${r.widths.join(', ')}]`, JSON.stringify(r.widths));
  check(r.cover >= 0.6 && r.openCover <= 0.1, `${nm}: down in a canyon, the shelf's guns mostly cannot see you; climb out over the shelf and they can`, JSON.stringify(r));
  check(r.lakeMax - r.lakeMin < 0.01 && r.lakeMax < 2, `${nm}: the frozen lake is flat and open: nothing on it to hide behind`, JSON.stringify([r.lakeMin, r.lakeMax]));
  // (at least eight: a field. The first guess asked for ten, a number nobody chose; spaced to leave 8 between bases,
  // chapter 2's field holds nine)
  check(r.spires >= 8 && r.tallest >= 40 && r.gap >= 8, `${nm}: the spires stand tall, ${r.spires} of them, at least 8 clear between any two`, JSON.stringify(r));
  const gate = r.sides.filter(s => s.gateSide), walls = r.sides.filter(s => !s.gateSide);
  check(walls.length === 3 && walls.every(s => s.high >= s.n - 2), `${nm}: the outpost's walls stand on three sides`, JSON.stringify(r.sides));
  check(gate.length === 1 && gate[0].low >= 16, `${nm}: and the side facing the middle has a gate at least 16 wide  [${gate.length ? gate[0].low : 0}]`, JSON.stringify(r.sides));
  check(r.yard[1] - r.yard[0] < 0.01 && r.guns >= 8, `${nm}: its yard is flat, with eight guns standing in it (more if others land there)`, JSON.stringify(r));
  check(r.lakeDrones >= Math.min(12, Math.floor(r.drones / 3)), `${nm}: a third of the drones, up to twelve, gather over the lake`, JSON.stringify(r));
}

console.log('\n— the wall\'s own round, among them —');
{
  const r = await run(`scaleHold = scaleOf(1); bossForce = 'wall'; startRound(10); var o = { towers: [] };
    ground.filter(function (g) { return g.alive && g.tower; }).forEach(function (g) { var plain = 2 + fbm(g.tower.x * 0.03 + 11.1, g.tower.z * 0.03 + 4.4) * 9; o.towers.push(+(g.pos.y - 28 - 1.9 - plain).toFixed(2)); });
    o.wallOn = wallOn; o.secs = wallStanding(); JSON.stringify(o)`);
  check(r.wallOn && r.secs === 4 && r.towers.length === 6 && r.towers.every(d => Math.abs(d) < 0.01), 'at chapter 2\'s size the wall\'s round is as it was: four sections, six towers each on the plain', JSON.stringify(r));
}

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
