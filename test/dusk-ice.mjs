// The ice field's territories in docs/dusk/ (chapter step 3, second version). Sam, of the first, four stamped shapes on
// a plain: "it also looks like little demo areas around the map". Now four territories fill the plain round the wall,
// their borders wandering and blending, with one large base and small camps scattered through them.
//
// Asserts that the plain is filled and the territories share it and blend, that each does the thing it is for (the
// canyons hide you from the shelf's guns, the lake is open, the spires leave room to weave, the ridges give relief, the
// bases are walled with a gate and guns inside), and that the wall's towers keep their ground.
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


const SIZES = [['chapter 2', 'scaleOf(1)', 9, 3], ['full size', 'scaleOf(3)', 19, 5]];

console.log('\n— today\'s size is as it was —');
{
  const r = await run(`scaleHold = 1; startRound(4); JSON.stringify({ none: iceLayout() === null })`);
  check(r.none, 'at today\'s size there is no room for territories, and the ice is as it always was', JSON.stringify(r));
}

for (const [nm, sc, n, camps] of SIZES) {
  console.log(`\n— ${nm} —`);
  const r = await run(`scaleHold = ${sc}; startRound(${n}); M.step(30); var L = iceLayout(), o = {}, w = [0, 0, 0, 0];
    // the band the territories are meant to fill: away from the wall's moat and short of the crags
    var pts = [], dom = [0, 0, 0, 0], mixed = 0, changed = 0;
    for (var q = 0; q < 6000; q++) { var x = (Math.random() * 2 - 1) * L.outer, z = (Math.random() * 2 - 1) * L.outer, d = Math.hypot(x, z);
      var wx = Math.max(0, Math.abs(x) - 135), wz = Math.max(0, Math.abs(z) - 50); if (Math.hypot(wx, wz) < 80 || d > L.outer - 50) continue;
      var near = WALL_TOWERS.some(function (t) { return Math.hypot(t[0] - x, t[1] - z) < 32; }); if (near) continue;
      iceWeights(x, z, w); var mx = Math.max.apply(null, w); var k = w.indexOf(mx); dom[k]++; if (mx < 0.8) mixed++;
      // empty plain: nothing within 20 rising 6 over the plain, and not the lake, which is open on purpose. (A first version
      // counted any point within 2 of the plain's height, so a canyon floor or the ground between spires read as plain.)
      var hasFeature = w[1] > 0.5; for (var a4 = 0; a4 < 6.283 && !hasFeature; a4 += 0.785) for (var r4 = 0; r4 <= 20 && !hasFeature; r4 += 10) { var px = x + Math.cos(a4) * r4, pz = z + Math.sin(a4) * r4; if (Math.abs(height(px, pz) - icePlain(px, pz)) > 6) hasFeature = true; }
      if (hasFeature) changed++; pts.push(1); }
    // and right round the wall, just outside its moat, the territories are there: a ring round a plain would leave this empty
    var moat = 0, moatN = 0; for (var a5 = 0; a5 < 6.283; a5 += 0.02) { var px5 = Math.cos(a5) * 400, pz5 = Math.sin(a5) * 400;
      // walk in from far out to the first point 85 from the wall's box
      for (var t5 = 1; t5 > 0; t5 -= 0.005) { var x5 = px5 * t5, z5 = pz5 * t5, dw5 = Math.hypot(Math.max(0, Math.abs(x5) - 135), Math.max(0, Math.abs(z5) - 50)); if (dw5 <= 85) { if (!WALL_TOWERS.some(function (t) { return Math.hypot(t[0] - x5, t[1] - z5) < 32; })) { moatN++; if (iceWeights(x5, z5, w) > 0.5) moat++; } break; } } }
    o.moat = moat / Math.max(1, moatN);
    o.n = pts.length; o.changed = changed / o.n; o.dom = dom.map(function (v) { return v / o.n; }); o.mixed = mixed / o.n;
    // round a circle through the band, how often the leading territory changes
    var prev = -1, turns = 0; for (var a = 0; a < 6.283; a += 0.01) { var rr = L.rc; iceWeights(Math.cos(a) * rr, Math.sin(a) * rr, w); var kk = w.indexOf(Math.max.apply(null, w)); if (prev >= 0 && kk !== prev) turns++; prev = kk; }
    o.turns = turns;
    // each territory where it is strongest
    function heart(k, f) { var out = []; for (var q = 0; q < 20000 && out.length < 1500; q++) { var x = (Math.random() * 2 - 1) * L.outer, z = (Math.random() * 2 - 1) * L.outer; iceWeights(x, z, w); if (w[k] > 0.85) out.push(f(x, z)); } return out; }
    var crev = heart(0, function (x, z) { return { x: x, z: z, h: height(x, z) }; });
    var shelf = crev.filter(function (p) { return p.h > 28; }), floor = crev.filter(function (p) { return p.h < 14; });
    o.shelfH = shelf.reduce(function (s2, p) { return s2 + p.h; }, 0) / Math.max(1, shelf.length); o.shelfShare = shelf.length / Math.max(1, crev.length); o.floorShare = floor.length / Math.max(1, crev.length);
    // a canyon's width: from points on a canyon floor, the narrowest run of low ground through them, over all directions
    var widths = []; for (q = 0; q < 60 && q < floor.length; q++) { var f = floor[q * 7 % floor.length], best = 1e9;
      for (var a2 = 0; a2 < 3.1416; a2 += 0.1) { var run = 0.5; for (var u = 0.5; u < 40; u += 0.5) { if (height(f.x + Math.cos(a2) * u, f.z + Math.sin(a2) * u) < 20) run += 0.5; else break; } for (u = 0.5; u < 40; u += 0.5) { if (height(f.x - Math.cos(a2) * u, f.z - Math.sin(a2) * u) < 20) run += 0.5; else break; } best = Math.min(best, run); }
      widths.push(best); }
    widths.sort(function (a3, b3) { return a3 - b3; }); o.canyonP10 = widths[Math.floor(widths.length * 0.1)]; o.canyonMed = widths[Math.floor(widths.length / 2)];
    var seen = 0, blocked = 0, lifted = 0;
    for (q = 0; q < 400 && shelf.length && floor.length; q++) { var g = shelf[Math.floor(Math.random() * shelf.length)], t2 = floor[Math.floor(Math.random() * floor.length)];
      var from = new THREE.Vector3(g.x, g.h + 1.9, g.z), to = new THREE.Vector3(t2.x, t2.h + 10, t2.z); if (from.distanceTo(to) < 25 || from.distanceTo(to) > 125) continue; // within a flak gun's reach: a first version drew lines to 200, over other blocks and territories
      seen++; if (M.blocked(from, to)) blocked++; if (M.blocked(from, new THREE.Vector3(t2.x, ICE_SHELF + 10, t2.z))) lifted++; }
    o.cover = blocked / Math.max(1, seen); o.liftedCover = lifted / Math.max(1, seen); o.pairs = seen;
    // (the lake where no base stands: a camp can land on the lake, its walls 11 high, and that is not an island)
    var lake = heart(1, function (x, z) { return L.bases.some(function (b) { return Math.abs(x - b.x) < b.half + b.wallT + 8 && Math.abs(z - b.z) < b.half + b.wallT + 8; }) ? null : height(x, z); }).filter(function (h) { return h !== null; }); o.lakeFlat = lake.filter(function (h) { return Math.abs(h - ICE_LAKE_H) < 0.05; }).length / lake.length; o.lakeMax = Math.max.apply(null, lake);
    var ridge = heart(3, function (x, z) { return height(x, z) - icePlain(x, z); }); o.ridgeRelief = Math.max.apply(null, ridge) - Math.min.apply(null, ridge);
    // the spires: the stored ones, their gaps, how tall, and denser in the forest's heart than at its edge
    var S = Object.keys(L.spires).map(function (k2) { return L.spires[k2]; }), gap = 1e9;
    for (var i = 0; i < S.length; i++) for (var j = i + 1; j < S.length; j++) { var dd = Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z); if (dd < 60) gap = Math.min(gap, dd - S[i].r - S[j].r - 4); }
    o.spires = S.length; o.gap = gap; o.tallest = Math.max.apply(null, S.map(function (p) { return height(p.x, p.z) - icePlain(p.x, p.z); }));
    var inHeart = 0, heartN = 0, atEdge = 0, edgeN = 0; S.forEach(function (p) { iceWeights(p.x, p.z, w); }); // (weights at each spire)
    for (q = 0; q < 8000; q++) { var gx = Math.round(((Math.random() * 2 - 1) * L.outer) / ICE_SPIRE_GAP), gz = Math.round(((Math.random() * 2 - 1) * L.outer) / ICE_SPIRE_GAP);
      iceWeights(gx * ICE_SPIRE_GAP, gz * ICE_SPIRE_GAP, w); var has = !!L.spires[gx + ',' + gz]; if (w[2] > 0.75) { heartN++; if (has) inHeart++; } else if (w[2] > 0.2 && w[2] < 0.45) { edgeN++; if (has) atEdge++; } }
    o.heartDensity = inHeart / Math.max(1, heartN); o.edgeDensity = atEdge / Math.max(1, edgeN);
    // the bases
    o.bases = L.bases.map(function (b) { var mid = b.half + b.wallT / 2, sides = [];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (sd) { var hs = []; for (var t = -b.half + 2; t <= b.half - 2; t += 1) { var x = b.x + sd[0] * mid + (sd[0] ? 0 : t), z = b.z + sd[1] * mid + (sd[1] ? 0 : t); hs.push(height(x, z) - b.floor); }
        var gateSide = Math.abs(b.gx) > Math.abs(b.gz) ? sd[0] === Math.sign(b.gx) : sd[1] === Math.sign(b.gz);
        sides.push({ gate: gateSide, low: hs.filter(function (h) { return h < 2; }).length, high: hs.filter(function (h) { return h > b.wallH - 2; }).length, n: hs.length }); });
      var yard = []; for (var q2 = 0; q2 < 100; q2++) yard.push(height(b.x + (Math.random() - 0.5) * 2 * (b.half - 1), b.z + (Math.random() - 0.5) * 2 * (b.half - 1)) - b.floor);
      var guns = ground.filter(function (g) { return g.alive && Math.abs(g.pos.x - b.x) < b.half && Math.abs(g.pos.z - b.z) < b.half && Math.abs(g.pos.y - (b.floor + 1.9)) < 0.05; }).length;
      var tower = Math.min.apply(null, WALL_TOWERS.map(function (t) { return Math.hypot(t[0] - b.x, t[1] - b.z) - b.half - b.wallT; }));
      return { big: b.guns === 8, sides: sides, yard: Math.max.apply(null, yard) - Math.min.apply(null, yard), guns: guns, want: b.guns, tower: tower }; });
    o.lakeDrones = drones.filter(function (d) { return d.alive && Math.hypot(d.c.x - L.lake.x, d.c.z - L.lake.z) < L.lake.R; }).length; o.drones = drones.filter(function (d) { return d.alive; }).length;
    JSON.stringify(o)`);
  console.log(`  the band round the wall: ${Math.round(100 * (1 - r.changed))}% of it empty plain; its territories ${r.dom.map(v => Math.round(100 * v) + '%').join(' / ')} (crevasses / lake / spires / ridges); ${Math.round(100 * r.mixed)}% of it a blend; the leader changes ${r.turns} times round a circle`);
  console.log(`  crevasse country: shelf ${Math.round(100 * r.shelfShare)}% at ${r.shelfH.toFixed(0)}, canyon ${Math.round(100 * r.floorShare)}%, canyons ${r.canyonP10} wide at the narrowest tenth, ${r.canyonMed} typically; a shelf gun's line to a ship in a canyon blocked ${Math.round(100 * r.cover)}%, lifted over the shelf ${Math.round(100 * r.liftedCover)}% (${r.pairs} lines)`);
  console.log(`  lake ${Math.round(100 * r.lakeFlat)}% flat, islands up to ${r.lakeMax.toFixed(1)}; ridges ${r.ridgeRelief.toFixed(0)} of relief; ${r.spires} spires, tallest ${r.tallest.toFixed(0)}, narrowest gap ${r.gap.toFixed(1)}, ${Math.round(100 * r.heartDensity)}% of places taken in the forest's heart, ${Math.round(100 * r.edgeDensity)}% at its edge`);
  console.log(`  bases: ${r.bases.length} (${r.bases.filter(b => b.big).length} large), guns ${r.bases.map(b => b.guns).join(', ')}; ${r.lakeDrones} of ${r.drones} drones over the lake`);
  check(r.changed >= 0.75, `${nm}: the plain round the wall is filled: only ${Math.round(100 * (1 - r.changed))}% of it is empty plain`, JSON.stringify(r));
  check(r.moat >= 0.9, `${nm}: the territories come right in to the wall's moat all the way round  [${Math.round(100 * r.moat)}% of the way]`, JSON.stringify(r.moat));
  check(r.dom.every(v => v >= 0.15 && v <= 0.4), `${nm}: four territories share it, none under 15% or over 40%`, JSON.stringify(r.dom));
  check(r.mixed >= 0.1 && r.turns >= 4 && r.turns <= 16, `${nm}: their borders blend and wander rather than meeting at a line`, JSON.stringify([r.mixed, r.turns]));
  check(r.shelfH > 30 && r.shelfShare > 0.25 && r.floorShare > 0.2 && r.canyonP10 >= 16, `${nm}: crevasse country is a shelf cut by canyons wide enough to fly down`, JSON.stringify(r));
  // the difference is the claim: bumps on the shelf beside a gun block some lines to a ship above it too
  check(r.cover >= 0.6 && r.cover - r.liftedCover >= 0.5, `${nm}: down in a canyon the shelf's guns mostly cannot see you; climb out and they can`, JSON.stringify([r.cover, r.liftedCover, r.pairs]));
  check(r.lakeFlat >= 0.7 && r.lakeMax <= 10, `${nm}: the lake basin is flat and open, its islands low`, JSON.stringify([r.lakeFlat, r.lakeMax]));
  check(r.spires >= 8 && r.tallest >= 40 && r.gap >= 8 && r.heartDensity > r.edgeDensity + 0.2, `${nm}: the spire forest is tall, room to weave, and thicker in its heart than at its edges`, JSON.stringify(r));
  check(r.ridgeRelief >= 15, `${nm}: the pressure ridges rise and fall`, JSON.stringify(r.ridgeRelief));
  check(r.bases.length === camps + 1 && r.bases.filter(b => b.big).length === 1, `${nm}: one large base and ${camps} small camps`, JSON.stringify(r.bases.length));
  check(r.bases.every(b => b.sides.filter(s => !s.gate).every(s => s.high >= s.n - 2) && b.sides.filter(s => s.gate).every(s => s.low >= (b.big ? 16 : 12))), `${nm}: each is walled on three sides with a gate facing the middle`, JSON.stringify(r.bases.map(b => b.sides)));
  check(r.bases.every(b => b.yard < 0.01 && b.guns >= b.want && b.tower > 20), `${nm}: each yard is flat, its guns inside, and clear of the wall's towers`, JSON.stringify(r.bases));
  check(r.lakeDrones >= Math.min(12, Math.floor(r.drones / 3)), `${nm}: a third of the drones, up to twelve, gather over the lake`, JSON.stringify([r.lakeDrones, r.drones]));
}

console.log('\n— the wall\'s own round, among them —');
{
  const r = await run(`scaleHold = scaleOf(1); bossForce = 'wall'; startRound(10); var o = { towers: [] };
    ground.filter(function (g) { return g.alive && g.tower; }).forEach(function (g) { o.towers.push(+(g.pos.y - 28 - 1.9 - icePlain(g.tower.x, g.tower.z)).toFixed(2)); });
    o.wallOn = wallOn; o.secs = wallStanding(); JSON.stringify(o)`);
  check(r.wallOn && r.secs === 4 && r.towers.length === 6 && r.towers.every(d => Math.abs(d) < 0.01), 'at chapter 2\'s size the wall\'s round is as it was: four sections, six towers each on its patch of plain', JSON.stringify(r));
}

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
