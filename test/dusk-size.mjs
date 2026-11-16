// The arenas' sizes in docs/dusk/: each chapter's arena "new and larger" (Sam), big enough to keep the spacing round 4
// has, and no bigger from chapter 4 on.
//
// Builds every landscape at every size and asserts: the spacing, the ground's detail and that every point is where the
// game thinks the ground is, that nothing spawns in rock, over the edge or on the lava, that what stands outside the
// map stays outside it, that the ice wall's collapse rebuilds only its strip and leaves no seam, and that a new run
// comes back to today's map exactly. Prints the cost: points, and how long a rebuild takes here.
//
//   node test/dusk-size.mjs

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
const SPAWN0 = 205;
const allErrors = [];
async function run(code) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', e => allErrors.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  await page.evaluate(() => window.__t(`
    renderer.render = function () {}; wxHold = 'clear';
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    damage = function () {}; 1`));
  const r = await page.evaluate(c => window.__t(c), code);
  await page.close();
  return JSON.parse(r);
}

console.log('\n— how big, and what it costs —');
const SZ = await run(`var o = [];
  // the snapshot of today's map, to come back to
  startRound(1); var snapN = terrainGeo.attributes.position.count, snap = Array.prototype.slice.call(terrainGeo.attributes.position.array);
  for (var c = 0; c < 5; c++) { chapterHold = 0; var t0 = performance.now(); startRound(c * 5 + 4); var t1 = performance.now();
    var pos = terrainGeo.attributes.position, off = 0;
    for (var i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - height(pos.getX(i), pos.getZ(i))) > 1e-4) off++;
    var n = c * 5 + 4, enemies = 11 * n, flyable = Math.PI * Math.pow(EDGE * SCALE, 2);
    o.push({ chapter: c + 1, scale: +SCALE.toFixed(3), points: pos.count, cell: +CELL.toFixed(3), off: off, across: Math.round(2 * EDGE * SCALE), perEnemy: Math.round(flyable / enemies), ms: Math.round(t1 - t0) }); }
  startRound(1); var back = terrainGeo.attributes.position, diff = 0; for (i = 0; i < back.array.length; i++) if (Math.abs(back.array[i] - snap[i]) > 1e-6) diff++;
  JSON.stringify({ rows: o, back: { n: back.count, snapN: snapN, diff: diff, scale: SCALE } })`);
console.log('  chapter   scale   width you can fly   room per enemy, by its last ordinary round   ground points   one point every   round start here');
for (const x of SZ.rows) console.log(`  ${String(x.chapter).padStart(7)}   ${x.scale.toFixed(2).padStart(5)}   ${String(x.across).padStart(17)}   ${String(x.perEnemy).padStart(42)}   ${String(x.points).padStart(13)}   ${x.cell.toFixed(2).padStart(15)}   ${(x.ms + ' ms').padStart(16)}`);
const r0 = SZ.rows[0].perEnemy;
check(SZ.rows.slice(0, 4).every(x => Math.abs(x.perEnemy / r0 - 1) < 0.02), 'chapters 1 to 4 each keep the room round 4 has: within 2% for each enemy', JSON.stringify(SZ.rows));
check(SZ.rows[4].scale === SZ.rows[3].scale, 'and from chapter 4 on the arena grows no more', JSON.stringify(SZ.rows));
check(SZ.rows.every(x => Math.abs(x.cell - SZ.rows[0].cell) < 0.02), `the ground keeps its detail at every size: one point every ${SZ.rows[0].cell}`, JSON.stringify(SZ.rows));
check(SZ.rows.every(x => x.off === 0), 'and at every size every point of the mesh is where the game thinks the ground is', JSON.stringify(SZ.rows.map(x => x.off)));
check(SZ.back.scale === 1 && SZ.back.n === SZ.back.snapN && SZ.back.diff === 0, `a new run comes back to today's map exactly: ${SZ.back.n} points, not one coordinate different`, JSON.stringify(SZ.back));

console.log('\n— nothing in the wrong place, in any landscape, at any size —');
{
  const rows = [];
  for (const a of [0, 1, 2]) for (const c of [0, 1, 3]) {
    const r = await run(`chapterHold = ${a}; startRound(${c * 5 + 4}); var o = { arena: arena, scale: +SCALE.toFixed(2) }, edge = EDGE * SCALE;
      var g = ground.filter(function (x) { return x.alive; }), d = drones.filter(function (x) { return x.alive; });
      o.ground = g.length; o.groundBad = g.filter(function (x) { var h = height(x.pos.x, x.pos.z); return h < 2.5 || Math.abs(x.group.position.y - (h - 0.25)) > 0.01 || Math.hypot(x.pos.x, x.pos.z) > edge; }).length; // its body on the ground: a lancer is shot at the top of its mast
      o.drones = d.length; o.dronesBad = d.filter(function (x) { if (Math.hypot(x.c.x, x.c.z) + x.r > edge) return true; for (var q = 0; q < 6.3; q += 0.2) if (x.c.y - 4 < Math.max(height(x.c.x + Math.cos(q) * x.r, x.c.z + Math.sin(q) * x.r), 0) + 2) return true; return false; }).length;
      o.ships = fleet.filter(function (f) { return !f.boss && f.gone <= 0; }).map(function (f) { var w = 1e9; for (var q = 0; q < 1500; q++) { var t = q / 1500 * 6.283, cx = Math.cos(t) * f.radius * SCALE, cz = Math.sin(t) * f.radius * SCALE;
        for (var k = -2; k <= 2; k++) w = Math.min(w, f.flyAlt - Math.max(height(cx - Math.sin(t) * k * 14 * f.scale, cz + Math.cos(t) * k * 14 * f.scale), 0)); } return { clear: w, out: f.radius * SCALE > edge }; });
      o.shipsBad = o.ships.filter(function (x) { return x.clear < 8 || x.out; }).length; o.shipN = o.ships.length; delete o.ships;
      // outside the map, and staying there
      var near = 1e9; ridgeCones.forEach(function (rc) { near = Math.min(near, Math.hypot(rc.position.x, rc.position.z) - rc.geometry.parameters.radius * SCALE); }); o.ridgeIn = near;
      var vc = volcTop(new THREE.Vector3()); o.volcFlank = Math.hypot(vc.x, vc.z) - 290 * SCALE;
      o.dog = Math.hypot(DOG_C.x, DOG_C.z) - DOG_R; o.veil = 260 * wxVeil.scale.x; o.edge = edge;
      o.groundFar = Math.max.apply(null, g.map(function (x) { return Math.hypot(x.pos.x, x.pos.z); })); o.droneFar = Math.max.apply(null, d.map(function (x) { return Math.hypot(x.c.x, x.c.z); }));
      // where the ships really are, a few seconds in: a first version read the circle each was meant to fly, and passed with them flying today's
      M.step(60); o.shipFar = Math.max.apply(null, fleet.filter(function (f) { return !f.boss && f.gone <= 0; }).map(function (f) { return Math.hypot(f.ship.position.x, f.ship.position.z); }));
      // the ground's mean height on a ring at 60% of the edge, and at 95%: the crags belong at the rim
      function ring(k) { var s = 0; for (var q = 0; q < 360; q++) s += Math.max(height(Math.cos(q / 57.3) * edge * k, Math.sin(q / 57.3) * edge * k), 0); return s / 360; }
      o.mid = +ring(0.6).toFixed(1); o.rim = +ring(0.95).toFixed(1);
      JSON.stringify(o)`);
    rows.push(r);
  }
  console.log('  landscape   scale   ground units wrong   drones wrong   ships wrong   nearest ridge   far fight   veil   (the edge)');
  for (const r of rows) console.log(`  ${['dusk hills', 'ice field ', 'lava field'][r.arena]}  ${r.scale.toFixed(2).padStart(5)}   ${(r.groundBad + ' of ' + r.ground).padStart(18)}   ${(r.dronesBad + ' of ' + r.drones).padStart(12)}   ${(r.shipsBad + ' of ' + r.shipN).padStart(11)}   ${Math.round(r.ridgeIn).toString().padStart(13)}   ${Math.round(r.dog).toString().padStart(9)}   ${Math.round(r.veil).toString().padStart(4)}   (${Math.round(r.edge)})`);
  check(rows.every(r => r.groundBad === 0 && r.ground > 0), 'every ground unit stands on rock, at ground level, inside the edge', JSON.stringify(rows));
  check(rows.every(r => r.dronesBad === 0 && r.drones > 0), 'every drone circles inside the edge, clear of the ground all the way round', JSON.stringify(rows));
  check(rows.every(r => r.shipsBad === 0), 'every capital ship circles inside the edge, its hull 8 clear of the ground the whole way', JSON.stringify(rows));
  // (a first version asked the ridges for 1.2 times the edge: they are the ring at the rim, and today's nearest is 238 against 222)
  check(rows.every(r => r.ridgeIn > r.edge && r.dog > r.edge * 1.2 && r.veil > r.edge), 'the far ridges stay beyond the edge, the far fight well beyond, and the weather\'s veil beyond it, at every size', JSON.stringify(rows));
  check(rows.every(r => r.groundFar > 0.85 * SPAWN0 * r.scale && r.droneFar > 0.85 * SPAWN0 * r.scale), 'the enemies spread across the whole arena: the furthest ground unit and drone are out near the edge of where things are put, at every size', JSON.stringify(rows.map(r => [r.scale, r.groundFar, r.droneFar])));
  check(rows.every(r => r.shipFar > 0.75 * r.edge), 'and the capital ships\' circles widen with it', JSON.stringify(rows.map(r => [r.scale, r.shipFar, r.edge])));
  check(rows.filter(r => r.arena !== 0).every(r => r.rim - r.mid > 15), 'on the ice and the lava the crags stay at the rim, not in the middle of a bigger map', JSON.stringify(rows.map(r => [r.arena, r.scale, r.mid, r.rim])));
  check(rows.filter(r => r.arena !== 2).every(r => r.volcFlank > r.edge), 'the volcano on the horizon stays beyond the edge of the dusk hills and the ice', JSON.stringify(rows.map(r => r.volcFlank)));
}

console.log('\n— the ice wall falls in strips, at full size —');
{
  // each of its eight steps rebuilds only its strip; that strip must come out exactly as a whole rebuild would make it
  const r = await run(`chapterHold = 1; scaleHold = scaleOf(3); bossForce = 'wall'; startRound(20); var o = {};
    var tf = performance.now(); buildTerrain(); o.full = performance.now() - tf;
    var steps = [], t0, bt = buildTerrain; buildTerrain = function (a) { t0 = performance.now(); bt.apply(null, arguments); if (a !== undefined) steps.push(performance.now() - t0); }; // all its arguments: a first version passed two, and timed a rebuild the game never asks for
    hitCrack(wallSecs[1], 1e6); M.step(70); buildTerrain = bt;
    var cols = Array.prototype.slice.call(terrainGeo.attributes.color.array), ys = Array.prototype.slice.call(terrainGeo.attributes.position.array);
    buildTerrain(); var c2 = terrainGeo.attributes.color.array, y2 = terrainGeo.attributes.position.array, worst = 0, ywor = 0;
    for (var i = 0; i < c2.length; i++) { worst = Math.max(worst, Math.abs(c2[i] - cols[i])); ywor = Math.max(ywor, Math.abs(y2[i] - ys[i])); }
    o.steps = steps.length; o.stepMs = steps.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, steps.length); o.worstColour = worst; o.worstY = ywor; o.down = wallDown[1];
    JSON.stringify(o)`);
  console.log(`  at full size: a whole rebuild ${r.full.toFixed(0)} ms here; each of the collapse's ${r.steps} steps ${r.stepMs.toFixed(1)} ms`);
  // (a first version asked only for under a quarter of a whole rebuild, and passed with every step recomputing the whole
  // mesh's normals, 19 ms at this size: a step is a patch now, the same few milliseconds on any size of map)
  check(r.down === 1 && r.steps === 8 && r.stepMs < r.full / 30, 'the section falls in eight steps, each rebuilding only the patch where the ground moves, not the map', JSON.stringify(r));
  check(r.worstY < 1e-6 && r.worstColour < 1e-6, 'and the ground it leaves is exactly what a whole rebuild makes: no seam in height or colour', JSON.stringify(r));
}

console.log('\n— a round at full size —');
{
  const r = await run(`chapterHold = 2; scaleHold = scaleOf(3); startRound(18); var o = { bombsOut: 0, bombs: 0, icNear: 1e9 };
    shipPos.set(0, 90, 0); eruptT = 0.01; var w = lavaVolley; lavaVolley = function (n) { w(n); lavaBombs.forEach(function (b) { if (b.t >= 0) { o.bombs++; if (Math.hypot(b.to.x, b.to.z) > EDGE * SCALE) o.bombsOut++; } }); };
    // the interceptors still find you, from a far fight moved out with the map
    M.step(30 * 40, function () { if (shipPos.length() > 150) shipPos.set(0, 90, 0); ics.forEach(function (ic) { if (ic.alive) o.icNear = Math.min(o.icNear, ic.pos.distanceTo(shipPos)); }); });
    JSON.stringify(o)`);
  check(r.bombs > 0 && r.bombsOut === 0, `on the full-size lava field the volcano's bombs land inside the edge  [${r.bombs} thrown]`, JSON.stringify(r));
  check(r.icNear < 40, `and the interceptors, coming from the far fight now further out, still reach you  [nearest ${r.icNear.toFixed(0)}]`, JSON.stringify(r));
}

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
