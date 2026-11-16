// The region enemies in docs/dusk/: lancers on the ice, crawlers in the dusk hills, embers over the lava.
//
// Sam's ruling: "an enemy type exclusive to each region so it helps with variety". The three kinds were proposed to
// him and taken ("go with your recommendations"); every number and shape is a session's fill, his to strike.
//
// Steps the real game by hand at 30 ticks a second with drawing off, on a temp copy with one line added, seeded from
// before the page loads and with sound muted (sound draws from the game's random).
//
//   node test/dusk-regions.mjs

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

// ------------------------------------------------------------ who is where
const where = await run(J(`
  var o = {};
  [[0, 1], [0, 2], [0, 6], [1, 6], [2, 6], [1, 29], [0, 29]].forEach(function (a) { M.go(a[0], a[1]); o[a[0] + ':' + a[1]] = M.kinds(); });
  M.go(1, 6); M.go(0, 3); o.after = M.kinds();                       // the ice, then the hills: no lancer carried over
  M.go(0, 5); o.dread = M.kinds(); bossForce = 'wall'; M.go(1, 10); o.wall = M.kinds(); bossForce = 'walker'; M.go(2, 15); o.walker = M.kinds();
  return o;
`));
const K = (k, lance, crawl, embers) => where[k].lance === lance && where[k].crawl === crawl && where[k].embers === embers;
check(K('0:1', 0, 0, 0), 'round 1 has none of them: the introduction is as it was', JSON.stringify(where['0:1']));
check(K('0:2', 0, 1, 0) && K('0:6', 0, 2, 0) && K('0:29', 0, 6, 0), 'the dusk hills have crawlers and nothing else new: one in round 2, two by 6, six at most (round 29 would have ten)', JSON.stringify([where['0:2'], where['0:6'], where['0:29']]));
check(K('1:6', 2, 0, 0) && K('1:29', 6, 0, 0), 'the ice field has lancers and nothing else new: two in round 6, six at most', JSON.stringify([where['1:6'], where['1:29']]));
check(K('2:6', 0, 0, 2), 'the lava field has embers and nothing else new: two at once in round 6', JSON.stringify(where['2:6']));
check(where['0:6'].all === 30 && where['1:6'].all === 30 && where['0:6'].left === where['2:6'].left, 'they take the place of ordinary ground units: a round still has 5 to its number, and the same "to go" in every region', JSON.stringify([where['0:6'], where['1:6'], where['2:6']]));
check(where.after.lance === 0 && where.after.crawl === 1, 'a lancer from an ice round is an ordinary gun again in the hills', JSON.stringify(where.after));
check(['dread', 'wall', 'walker'].every(k => where[k].lance === 0 && where[k].crawl === 0 && where[k].embers === 0), 'a boss round has none of them', JSON.stringify([where.dread, where.wall, where.walker]));

// ------------------------------------------------------------ the lancer
const lance = await run(J(`
  M.go(1, 6); M.only('lance'); var L = M.of('lance'), g = L[0], o = { n: L.length };
  L.slice(1).forEach(function (x) { x.alive = false; x.group.visible = false; });
  o.hp = g.hp; o.up = +(g.pos.y - Math.max(height(g.pos.x, g.pos.z), 0)).toFixed(1); o.seated = Math.abs(g.group.position.y - (height(g.pos.x, g.pos.z) - 0.25)) < 0.01; o.body = g.group.visible && g.group !== g.sets.base.group && !g.sets.base.group.visible;
  var ev = [], s0 = sfx; sfx = function (n, p) { if (n === 'charge' || n === 'lance') ev.push([n, +time.toFixed(2)]); return s0(n, p); };
  // straight and level past it, 150 off, at cruise: what flying on as you are costs
  function pass(dodge, side) { M.dmg = []; ev.length = 0; g.cool = 0.5; g.charge = 0; shots.forEach(function (s) { s.life = 0; s.mesh.visible = false; });
    // a straight run found by looking, not assumed: 170 out from the lancer and flown across its front, every point of
    // nine seconds' flight inside the rim (where the game turns the ship for home, a dodge of its own), 30 clear of the
    // ground (which would lift the ship, another), and in plain sight of the gun
    // (side 1 takes the first such run round the compass, side -1 the last: two different runs, flown the same way round)
    var run0 = null, runs = [];
    for (var ai = 0; ai < 48; ai++) { var a = ai * 6.2832 / 48, sx = g.pos.x + Math.cos(a) * 170, sz = g.pos.z + Math.sin(a) * 170, sy = g.pos.y + 45, hy = a + Math.PI / 2, good = true;
      for (var ts = 0; ts <= 9 && good; ts += 0.5) { var px = sx - Math.sin(hy) * 25 * ts, pz = sz - Math.cos(hy) * 25 * ts;
        if (Math.hypot(px, pz) > EDGE * SCALE - 15 || Math.max(height(px, pz), 0) > sy - 30) good = false;
        for (var q = 1; q < 12 && good; q++) { var k = q / 12, lx = g.pos.x + (px - g.pos.x) * k, lz = g.pos.z + (pz - g.pos.z) * k; if (Math.max(height(lx, lz), 0) > g.pos.y + (sy - g.pos.y) * k - 3) good = false; } }
      if (good) runs.push({ x: sx, y: sy, z: sz, yaw: hy }); }
    run0 = side > 0 ? runs[0] : runs[runs.length - 1]; M.runsFound = runs.length;
    if (!run0) return { none: true, hits: 0, other: 0, ev: [], shots: 0 };
    shipPos.set(run0.x, run0.y, run0.z); yaw = run0.yaw; pitch = 0; speed = 25; basis(); var fired = 0;
    M.step(30 * 9, function () { pitch = 0; if (dodge) { var n = ev.filter(function (e) { return e[0] === 'lance'; }).length; if (n > fired) { fired = n; yaw += 0.9 * (n % 2 ? 1 : -1); } } basis(); });
    return { hits: M.dmg.filter(function (d) { return d === LANCE_DMG; }).length, other: M.dmg.filter(function (d) { return d !== LANCE_DMG; }).length, ev: ev.slice(0, 4), shots: ev.filter(function (e) { return e[0] === 'lance'; }).length }; }
  o.straight = pass(false, 1); o.straight2 = pass(false, -1); o.dodge = pass(true, 1); o.d0 = 170; o.runs = M.runsFound;
  // out of reach
  M.dmg = []; ev.length = 0; g.cool = 0.5; g.charge = 0; shipPos.set(g.pos.x + 400, g.pos.y + 20, g.pos.z); M.step(300, function () { shipPos.set(g.pos.x + 400, g.pos.y + 20, g.pos.z); }); o.farShots = ev.length;
  // shot at the top of its mast, not at its foot
  var top = g.pos.clone(), foot = g.pos.clone(); foot.y -= LANCE_UP;
  var h0 = g.hp; strike(top.clone().add(new THREE.Vector3(0, 0, 6)), top.clone().add(new THREE.Vector3(0, 0, -6)), 1, 6); o.topHit = h0 - g.hp;
  h0 = g.hp; strike(foot.clone().add(new THREE.Vector3(0, 0, 6)), foot.clone().add(new THREE.Vector3(0, 0, -6)), 1, 6); o.footHit = h0 - g.hp;
  h0 = g.hp; up.bomb = 1; bombBlast(g.pos.clone(), BOMB_R[1]); o.bomb = h0 - g.hp;
  var t0 = tally; hitGround(g, 99, g.pos); o.pts = tally - t0; o.gone = !g.alive && !g.group.visible;
  return o;
`));
check(lance.hp === 6 && Math.abs(lance.up - 14.2) < 0.05 && lance.seated && lance.body, 'a lancer stands on the ground in its own body, its gun 14 up at the top of the mast; six hits', JSON.stringify(lance));
check(lance.straight.ev[0][0] === 'charge' && lance.straight.ev[1][0] === 'lance' && Math.abs(lance.straight.ev[1][1] - lance.straight.ev[0][1] - 1.5) < 0.1, 'it charges for a second and a half where you can hear and see it, then fires', JSON.stringify(lance.straight.ev));
check(!lance.straight.none && !lance.straight2.none && !lance.dodge.none, `fixture: clear straight runs past the lancer were found, two of them different  [${lance.runs} of 48 bearings]`, JSON.stringify([lance.straight.none, lance.straight2.none, lance.dodge.none])); check(lance.runs >= 2, 'fixture: more than one clear run', String(lance.runs));
check(lance.straight.shots >= 1 && lance.straight.hits === lance.straight.shots && lance.straight2.shots >= 1 && lance.straight2.hits === lance.straight2.shots && lance.straight.other === 0, `fly on straight and level and the shot lands, 30, from ${lance.d0} off, on two different runs  [${lance.straight.hits} of ${lance.straight.shots}, ${lance.straight2.hits} of ${lance.straight2.shots}]`, JSON.stringify([lance.straight, lance.straight2]));
check(lance.dodge.shots >= 1 && lance.dodge.hits === 0, `turn once it has fired and every shot passes  [${lance.dodge.hits} of ${lance.dodge.shots}]`, JSON.stringify(lance.dodge));
check(lance.farShots === 0, 'beyond 320 it does not charge at all', `events ${lance.farShots}`);
check(lance.topHit === 1 && lance.footHit === 0, 'it is shot at the top of its mast; a bolt through its foot does nothing', JSON.stringify(lance));
check(lance.bomb === 5 && lance.pts === 40 && lance.gone, 'a bomb landing on it hurts it, and destroying it is worth 40', JSON.stringify(lance));

// ------------------------------------------------------------ the crawler
const crawl = await run(J(`
  M.go(0, 6); var C = M.of('crawl'), g = C[0], o = { n: C.length, hp: g.hp, body: g.group !== g.sets.base.group };
  var x0 = g.pos.x, z0 = g.pos.z, far = 0, path = 0, px = x0, pz = z0, wet = 0, off = 0, out = 0, near = 1e9, jump = 0, shipAt = new THREE.Vector3(x0 + 400, 150, z0);
  M.step(30 * 60, function () {
    shipPos.copy(shipAt);                                            // well away: this is about how it drives
    var h = height(g.pos.x, g.pos.z); if (h < 2.5) wet++; if (Math.abs(g.pos.y - (h + 1.9)) > 0.01) off++;
    if (Math.hypot(g.pos.x, g.pos.z) > SPAWN * SCALE + 1) out++;
    var st = Math.hypot(g.pos.x - px, g.pos.z - pz); path += st; jump = Math.max(jump, st); px = g.pos.x; pz = g.pos.z;
    far = Math.max(far, Math.hypot(g.pos.x - x0, g.pos.z - z0));
    ground.forEach(function (q) { if (q !== g && q.alive) near = Math.min(near, Math.hypot(q.pos.x - g.pos.x, q.pos.z - g.pos.z)); });
  });
  o.far = Math.round(far); o.path = Math.round(path); o.wet = wet; o.off = off; o.out = out; o.near = +near.toFixed(1); o.jump = +jump.toFixed(2);
  // it fights as it goes: the ship held 80 off it
  M.only('crawl'); C.slice(1).forEach(function (x) { x.alive = false; }); M.dmg = [];
  var fl = 0, s0 = sfx; sfx = function (n, p) { if (n === 'flak') fl++; return s0(n, p); };
  M.step(30 * 12, function () { shipPos.set(g.pos.x + 60, g.pos.y + 50, g.pos.z); }); o.flak = fl;
  var t0 = tally; hitGround(g, 99, g.pos); o.pts = tally - t0;
  // one put on rock beside water and told to drive into it: it must refuse
  var spot = null; for (var r = 70; r < 200 && !spot; r += 5) for (var a = 0; a < 6.283 && !spot; a += 0.1) { var x = Math.cos(a) * r, z = Math.sin(a) * r; if (height(x, z) < 3 || height(x, z) > 9) continue;
    for (var b = 0; b < 6.283; b += 0.3) { var wx = x + Math.cos(b) * 22, wz = z + Math.sin(b) * 22; if (height(wx, wz) < 0 && height(x + Math.cos(b) * 3, z + Math.sin(b) * 3) >= 2.5) { spot = { x: x, z: z, wx: wx, wz: wz }; break; } } }
  o.spot = !!spot;
  if (spot) { var c = C[1]; setKindAt(c, 'crawl', spot.x, spot.z); c.wp = { x: spot.wx, z: spot.wz }; var w2 = 0, first = true, tried = 0;
    M.step(30 * 8, function () { shipPos.copy(shipAt); if (first) { tried = Math.hypot(c.pos.x - spot.x, c.pos.z - spot.z); } first = false; if (height(c.pos.x, c.pos.z) < 2.5) w2++; });
    o.wet2 = w2; o.went = +Math.hypot(c.pos.x - spot.x, c.pos.z - spot.z).toFixed(1); }
  return o;
`));
check(crawl.spot && crawl.wet2 === 0, 'told to drive into water 22 off, it never leaves the rock', JSON.stringify({ spot: crawl.spot, wet2: crawl.wet2, went: crawl.went }));
check(crawl.n === 2 && crawl.hp === 5 && crawl.body, 'a crawler wears its own body; five hits', JSON.stringify(crawl));
check(crawl.path > 150 && crawl.far > 30 && crawl.jump < 0.4, `it drives: ${crawl.path} of ground covered in a minute, ${crawl.far} from where it began, never more than a step at a time`, JSON.stringify(crawl));
check(crawl.wet === 0 && crawl.off === 0 && crawl.out === 0, 'it keeps to rock, on the ground, inside the map', JSON.stringify(crawl));
check(crawl.near >= 8, `and never drives into another unit  [nearest it came: ${crawl.near}]`, JSON.stringify(crawl));
check(crawl.flak >= 6 && crawl.pts === 30, 'it fires flak as it goes, and destroying it is worth 30', JSON.stringify(crawl));

// ------------------------------------------------------------ the ember
const ember = await run(J(`
  M.go(2, 6); M.only('none'); var o = {}, up0 = function () { return rushers.filter(function (e) { return e.alive; }).length; };
  // a place over the lava, found by looking
  var lx = null, lz = null; for (var r = 60; r < 200 && lx === null; r += 6) for (var a = 0; a < 6.283; a += 0.2) { var x = Math.cos(a) * r, z = Math.sin(a) * r, ok = true; for (var q = 0; q < 8 && ok; q++) if (height(x + Math.cos(q) * 14, z + Math.sin(q) * 14) >= -0.5) ok = false; if (ok) { lx = x; lz = z; break; } }
  o.lava = lx !== null;
  // high over it: nothing rises
  var maxHigh = 0; M.step(30 * 20, function () { shipPos.set(lx, 120, lz); maxHigh = Math.max(maxHigh, up0()); }); o.high = maxHigh;
  // low over it, circling at cruise and never shooting: they rise, from the lava, and come
  var born = [], seen = {}, maxUp = 0, leftMin = 1e9; M.dmg = []; emberT = 0.1; var t = 0;
  M.step(30 * 40, function () { t += 1 / 30; shipPos.set(lx + Math.cos(t * 0.5) * 12, 30, lz + Math.sin(t * 0.5) * 12); yaw = -t * 0.5; pitch = 0; basis();
    rushers.forEach(function (e, i) { if (e.alive && !seen[i]) { seen[i] = 1; born.push({ h: height(e.pos.x, e.pos.z), y: e.pos.y, d: Math.round(Math.hypot(e.pos.x - shipPos.x, e.pos.z - shipPos.z)) }); } if (!e.alive) seen[i] = 0; });
    maxUp = Math.max(maxUp, up0()); });
  o.bornAt = born.filter(function (b) { return !(b.h < -0.5 && b.y < 0); }).slice(0, 4); o.born = born.length; o.fromLava = born.every(function (b) { return b.h < -0.5 && b.y < 0; }); o.dist = born.map(function (b) { return b.d; }); o.maxUp = maxUp;
  o.hits = M.dmg.filter(function (d) { return d === EMBER_DMG; }).length;
  // made to rise every half second and to live long, the cap is what holds them: still two
  var gap0 = EMBER_GAP, life0 = EMBER_LIFE, capMax = 0; EMBER_GAP = 1; EMBER_LIFE = 60; emberT = 0.1;
  M.step(30 * 12, function () { shipPos.set(lx, 30, lz); rushers.forEach(function (e) { if (e.alive && e.t > 1) e.pos.set(lx + 40, 20, lz); }); capMax = Math.max(capMax, up0()); });   // held off the ship, so none bursts
  o.capMax = capMax; o.leftWith = remaining(); o.upThen = up0(); EMBER_GAP = gap0; EMBER_LIFE = life0; emberReset(6);
  // two hits, 20 points
  emberT = 0.1; M.step(60, function () { shipPos.set(lx, 30, lz); }); var e = rushers.filter(function (x) { return x.alive; })[0];
  if (e) { var t0 = tally; hitEmber(e, 1, e.pos); o.after1 = e.alive; hitEmber(e, 1, e.pos); o.after2 = e.alive; o.pts = tally - t0; }
  // the round ends: they go with it
  emberT = 0.1; M.step(60, function () { shipPos.set(lx, 30, lz); }); o.before = up0(); roundLive = false; M.step(2); o.afterRound = up0();
  return o;
`));
check(ember.lava && ember.high === 0, 'fly high over the lava, 120 up, and nothing rises', JSON.stringify(ember));
check(ember.born >= 3 && ember.fromLava, `fly low over it and they rise, out of the lava and nowhere else  [${ember.born} in 40 seconds, ${ember.dist.join(', ')} away]`, JSON.stringify(ember));
check(ember.maxUp === 2 && ember.capMax === 2, 'never more at once than the round allows, two in round 6, even made to rise every half second and live a minute', `most at once ${ember.maxUp}, ${ember.capMax}`);
check(ember.hits >= 1, `left alone they reach a ship circling at cruise and burst on it for 20  [${ember.hits} times in 40 seconds]`, JSON.stringify(ember));
check(ember.upThen === 2 && ember.leftWith === 0, 'they are not in the round\'s "to go" count: two in the air, and nothing to go', `up ${ember.upThen}, to go ${ember.leftWith}`);
check(ember.after1 === true && ember.after2 === false && ember.pts === 20, 'two hits brings one down, for 20', JSON.stringify(ember));
check(ember.before >= 1 && ember.afterRound === 0, 'and when the round ends they go with it', JSON.stringify(ember));

check(errorsSeen.length === 0, 'nothing threw', errorsSeen.slice(0, 5));
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
