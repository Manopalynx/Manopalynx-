// The ice wall in docs/dusk/: the second boss. Four sections, each with a crack; guns on the ledges that rebuild;
// a section collapses when its crack is destroyed; the round is won when the whole wall is down.
//
// Asserts Sam's rulings, that the ground really moves and nothing is left standing on air, and measures the fight.
// Steps the real game by hand on a temp copy, like the other dusk suites.
//
//   node test/dusk-wall.mjs

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
    renderer.render = function () {};
    wxHold = 'clear'; wxStart(round); // the weather is random; these checks are about other things, so hold it clear
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    M.wall = function (n) { bossForce = 'wall'; startRound(n); damage = function () {}; };
    M.guns = function () { return ground.filter(function (g) { return g.alive && g.spot; }); };       // the wall's own
    M.towers = function () { return ground.filter(function (g) { return g.alive && g.tower; }); };
    M.meshOff = function () { var pos = terrainGeo.attributes.position, n = 0; for (var i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - height(pos.getX(i), pos.getZ(i))) > 1e-4) n++; return n; };
    M.step(3); M.snap = Array.prototype.slice.call(terrainGeo.attributes.position.array); 1`));
  const r = await page.evaluate(c => window.__t(c), code);
  await page.close();
  return JSON.parse(r);
}

console.log('\n— the round —');
{
  const r = await run(`M.wall(5); var g = M.guns(), o = {};
    o.arena = arena; o.left = remaining(); o.readout = readoutEl.textContent; o.guns = g.length; o.props = duskProps.visible;
    o.kinds = { flak: g.filter(function (x) { return x.type === 'flak'; }).length, sam: g.filter(function (x) { return x.type === 'sam'; }).length };
    o.faces = { front: g.filter(function (x) { return x.pos.z > 0; }).length, back: g.filter(function (x) { return x.pos.z < 0; }).length };
    o.perSec = [0, 1, 2, 3].map(function (k) { return g.filter(function (x) { return x.spot.sec.k === k; }).length; });
    o.onLedge = g.filter(function (x) { var h = x.pos.y - 1.9; return Math.abs(h - 62) < 0.6 || Math.abs(h - 32) < 0.6; }).length;
    o.level = g.filter(function (x) { var h = height(x.pos.x, x.pos.z); return Math.abs(height(x.pos.x + 3, x.pos.z) - h) < 2.2 && Math.abs(height(x.pos.x, x.pos.z + 3) - h) < 2.2 && Math.abs(height(x.pos.x - 3, x.pos.z) - h) < 2.2; }).length;
    o.others = fleet.filter(function (f) { return f.gone <= 0; }).length; o.ic = icWant;
    o.rings = wallSecs.filter(function (s) { M.step(1); return s.ring.visible; }).length; o.meshOff = M.meshOff();
    o.ship = shipPos.y - height(shipPos.x, shipPos.z); o.note = (roundBanner(), noteEl.textContent);
    JSON.stringify(o)`);
  check(r.arena === 1 && !r.props && r.meshOff === 0, 'it is fought on the ice, and the ground you see is the ground the game uses', JSON.stringify(r));
  check(r.left === 4 && /Ice wall: 4 of 4 standing/.test(r.readout), `what is left to do is sections, not guns  [${r.readout.replace(/Round \d+/, '').trim()}]`, JSON.stringify(r));
  check(r.guns === 16 && r.perSec.join() === '4,4,4,4', `sixteen guns the first time, four to a section  [${r.perSec.join(', ')}]`, JSON.stringify(r));
  check(r.kinds.flak > 0 && r.kinds.sam > 0, `both kinds of ground unit  [${r.kinds.flak} flak, ${r.kinds.sam} missile sites]`, JSON.stringify(r.kinds));
  check(r.faces.front === 8 && r.faces.back === 8, 'on both faces of the wall  [8 and 8]', JSON.stringify(r.faces));
  check(r.onLedge === r.guns && r.level === r.guns, 'every one stands on a ledge, on level ice', `${r.onLedge} on a ledge, ${r.level} level, of ${r.guns}`);
  check(r.others === 0 && r.ic === 0, 'no capital ships and no interceptors', JSON.stringify(r));
  check(r.rings === 4, 'every crack wears its health ring from the start', `${r.rings} of 4`);
  check(r.ship > 30 && /Ice Wall/.test(r.note) && /cracks/.test(r.note), 'you start clear of the ice, and the banner says what to break', JSON.stringify(r));
}

console.log('\n— guard towers and drones —');
{
  const g = await run(`M.wall(5); var tw = M.towers(), o = {};
    o.n = tw.length; o.at = tw.map(function (x) { return Math.round(x.pos.x) + ',' + Math.round(x.pos.z); }).sort().join(' ');
    M.wall(5); o.again = M.towers().map(function (x) { return Math.round(x.pos.x) + ',' + Math.round(x.pos.z); }).sort().join(' ');
    tw = M.towers();
    o.onTop = tw.filter(function (x) { return Math.abs(x.pos.y - 1.9 - TOWER_H - height(x.pos.x, x.pos.z)) < 0.01; }).length;
    o.clearOfWall = tw.filter(function (x) { return Math.abs(x.pos.z) > 60 && Math.sqrt(x.pos.x * x.pos.x + x.pos.z * x.pos.z) < 200; }).length;
    o.kinds = tw.map(function (x) { return x.type; }).sort().join(' '); o.shafts = wallProps.visible && wallProps.children.length === 12;
    var d = drones.filter(function (x) { return x.alive; }); o.drones = d.length;
    o.dronesUnder = d.filter(function (x) { for (var a = 0; a < 6.3; a += 0.2) if (x.c.y - 4 < Math.max(height(x.c.x + Math.cos(a) * x.r, x.c.z + Math.sin(a) * x.r), 0) + 2) return true; return false; }).length;
    o.left = remaining();
    var t0 = tw[0], cr = wallSecs.map(function (s) { return s.hp; }).join(), wallGun = M.guns()[0].maxHp, hits = 0;
    while (t0.alive && hits < 40) { hitGround(t0, 1, t0.pos); hits++; } o.hits = hits; o.wallGun = wallGun; o.cracksSame = cr === wallSecs.map(function (s) { return s.hp; }).join();
    M.step(30 * 14); o.rebuilt = t0.alive; o.leftAfter = remaining();
    d.forEach(function (x) { killDrone(x); }); o.liveAfterAll = roundLive;
    startRound(6); o.propsGone = !wallProps.visible; o.towersLeft = M.towers().length + ground.filter(function (x) { return x.tower; }).length;
    JSON.stringify(o)`);
  check(g.n === 6 && g.at === g.again, `six guard towers, in the same places every time  [${g.at}]`, JSON.stringify(g));
  check(g.onTop === 6 && g.shafts, 'each gun stands on top of its tower, and the towers are drawn', JSON.stringify(g));
  check(g.clearOfWall === 6, 'they ring the plain, clear of the wall and inside the map', JSON.stringify(g));
  check(g.kinds === 'flak flak flak sam sam sam', 'flak and missile sites by turns', g.kinds);
  check(g.hits > g.wallGun && !g.rebuilt && g.cracksSame, `a tower's gun is tougher than the wall's (${g.hits} hits against ${g.wallGun}), stays destroyed, and does not shake the cracks`, JSON.stringify(g));
  check(g.drones === 8 && g.dronesUnder === 0, `eight drones over the ice, none of them circling through it`, JSON.stringify(g));
  check(g.left === 4 && g.leftAfter === 4 && g.liveAfterAll, 'neither towers nor drones are what is left to do: the count is still sections', JSON.stringify(g));
  check(g.propsGone && g.towersLeft === 0, 'and the towers are gone when the round after begins', JSON.stringify(g));
}

console.log('\n— the cracks —');
{
  // Laid on the faces: not buried in the wall, not floating off it.
  const c = await run(`M.wall(5); var bad = [], n = 0;
    wallSecs.forEach(function (s) { s.pts.forEach(function (p) { n++; var side = Math.sign(p.z), inside = heightIce(p.x, p.z - side * 3), outside = heightIce(p.x, p.z + side * 3);
      if (!(inside >= p.y - 1 && outside < p.y + 1)) bad.push([s.k, Math.round(p.y), Math.round(p.z), Math.round(inside), Math.round(outside)]); }); });
    JSON.stringify({ n: n, bad: bad })`);
  check(c.n === 64 && c.bad.length === 0, `all ${c.n} pieces of the four cracks lie on the face of the wall: ice behind each, air in front`, c.bad.map(b => JSON.stringify(b)));

  // CAN A CRACK BE HIT. The dreadnought shipped with a generator nothing could reach and 33 green checks, because
  // nothing fired at it and counted. So: bolts aimed at each crack with a person's scatter, from 150 out on either face.
  const los = await run(`M.wall(5); var out = [];
    wallSecs.forEach(function (s) { [0, 1].forEach(function (fi) { [-10, 0, 15].forEach(function (elev) {
      var hits = 0, n = 0, hc = hitCrack; hitCrack = function (sec) { if (sec === s) hits++; };
      var tgt = s.face[fi].clone(); tgt.z -= (fi === 0 ? 1 : -1) * 22;   // the middle of the face itself
      for (var q = 0; q < 40; q++) {
        var e = elev * Math.PI / 180, side = fi === 0 ? 1 : -1;
        var from = new THREE.Vector3(tgt.x + (Math.random() - 0.5) * 60, tgt.y + Math.sin(e) * 150, tgt.z + side * Math.cos(e) * 150);
        var dir = tgt.clone().sub(from).normalize(); dir.x += (Math.random() - 0.5) * 0.04; dir.y += (Math.random() - 0.5) * 0.04; dir.normalize();
        trk.k = 0; launchBolt(from, dir); n++; }
      for (var w = 0; w < 40; w++) updateBolts(1 / 30);
      hitCrack = hc; out.push({ k: s.k, face: fi, elev: elev, pct: Math.round(100 * hits / n) });
    }); }); });
    JSON.stringify(out)`);
  const worst = los.reduce((a, b) => (a.pct < b.pct ? a : b));
  console.log('  bolts aimed at the middle of a crack that land on it:  ' + [-10, 0, 15].map(e => `${e > 0 ? '+' : ''}${e}°: ${Math.round(los.filter(x => x.elev === e).reduce((a, b) => a + b.pct, 0) / 8)}%`).join('   ') + `   (worst single case ${worst.pct}%)`);
  check(los.length === 24 && worst.pct >= 80, 'every crack can be hit from either face, from below, level and above  [24 cases]', los.filter(x => x.pct < 80).map(x => JSON.stringify(x)));

  const d = await run(`M.wall(5); var s = wallSecs[1], o = {};
    o.hp0 = s.hp; hitCrack(s, 40); o.after = s.hp; o.lit = s.segs.filter(function (a) { return a.material.color.getHex() === 0x9dff6a; }).length;
    var g = M.guns().filter(function (x) { return x.spot.sec.k === 1; })[0], far = wallSecs[3].hp, n0 = wallSecs[0].hp, n2 = wallSecs[2].hp, own = s.hp, hits = 0;
    while (g.alive && hits < 20) { hitGround(g, 1, g.pos); hits++; }
    o.hits = hits; o.own = own - s.hp; o.near = [n0 - wallSecs[0].hp, n2 - wallSecs[2].hp]; o.far = far - wallSecs[3].hp;
    M.step(30 * 9); o.at9 = g.alive; M.step(45); o.at10 = g.alive; o.whole = g.hp === g.maxHp; o.same = Math.abs(g.pos.x - g.spot.x) < 0.01;
    JSON.stringify(o)`);
  check(d.hp0 === 200 && d.after === 160 && d.lit === 4, 'a crack can be shot directly, and its ring shows it  [200, then 160 and four segments lit]', JSON.stringify(d));
  check(d.own === 25 && d.near.join() === '10,10' && d.far === 0, `destroying a gun damages the crack on its section, and the ones either side less  [${d.own}, ${d.near.join(' and ')}, none further off]`, JSON.stringify(d));
  check(!d.at9 && d.at10 && d.whole && d.same, 'that gun is back on its mount, whole, ten seconds later: not at nine', JSON.stringify(d));
  check(d.own / d.hits > 3, `through the guns is the faster way: ${d.hits} hits on a gun took ${d.own} off the crack, ${(d.own / d.hits).toFixed(1)} for each against 1 for a direct hit`, JSON.stringify(d));
}

console.log('\n— a section falls —');
{
  const f = await run(`M.wall(5); var s = wallSecs[2], o = {};
    o.crestBefore = [0, 1, 2, 3].map(function (k) { return Math.round(height(wallSecs[k].cx, 0)); });
    var mine = M.guns().filter(function (x) { return x.spot.sec === s; });
    hitCrack(s, s.hp); o.leftAtOnce = remaining(); o.gunsGone = mine.filter(function (x) { return x.alive; }).length;
    M.step(20); o.midway = Math.round(height(s.cx, 0)); o.meshMid = M.meshOff();
    M.step(60); o.crestAfter = [0, 1, 2, 3].map(function (k) { return Math.round(height(wallSecs[k].cx, 0)); }); o.meshOff = M.meshOff();
    o.ledge = Math.round(height(s.cx, 18)); o.down = s.down; o.left = remaining(); o.readout = readoutEl.textContent; o.live = roundLive;
    M.step(30 * 12); o.rebuilt = mine.filter(function (x) { return x.alive; }).length; o.ringOff = !s.ring.visible && !s.grp.visible;
    o.othersRebuild = M.guns().length;
    // nothing left in the air: every gun still alive is on the ground under it
    o.floating = M.guns().filter(function (x) { return Math.abs(x.pos.y - 1.9 - height(x.pos.x, x.pos.z)) > 0.01; }).length;
    JSON.stringify(o)`);
  check(f.crestBefore.every(h => h >= 95) && f.crestAfter[2] < 20 && [0, 1, 3].every(k => f.crestAfter[k] >= 95),
    `the ground itself comes down, there and nowhere else  [crests ${f.crestBefore.join(' ')} before, ${f.crestAfter.join(' ')} after]`, JSON.stringify(f));
  check(f.midway < f.crestBefore[2] - 10 && f.midway > f.crestAfter[2] + 10, `it sinks, it does not vanish  [${f.crestBefore[2]}, then ${f.midway} part way, then ${f.crestAfter[2]}]`, JSON.stringify(f));
  check(f.meshMid === 0 && f.meshOff === 0, 'part way down and once fallen, every point of the ground you see is where the game says the ground is', `${f.meshMid} off midway, ${f.meshOff} after`);
  check(f.gunsGone === 0 && f.rebuilt === 0 && f.floating === 0, 'its guns go with it, do not rebuild, and none is left standing on air', JSON.stringify(f));
  check(f.down && f.left === 3 && f.leftAtOnce === 3 && /3 of 4 standing/.test(f.readout) && f.live && f.ringOff, 'three are left standing, the readout says so, and its crack and ring are gone', JSON.stringify(f));
  check(f.othersRebuild === 12, 'the guns on the three standing sections carry on rebuilding  [12]', `${f.othersRebuild}`);
}

console.log('\n— winning, and what comes after —');
{
  const w = await run(`M.wall(5); var o = {};
    wallSecs.forEach(function (s, i) { hitCrack(s, s.hp); M.step(60); if (i === 2) o.liveAt3 = roundLive; });
    o.live = roundLive; o.note = noteEl.textContent; o.guns = M.guns().length;
    startRound(6); o.arena = arena; o.props = duskProps.visible; o.wallOn = wallOn; o.ships = fleet.filter(function (f) { return f.gone <= 0; }).length; o.ground = ground.filter(function (g) { return g.alive; }).length;
    var pos = terrainGeo.attributes.position.array, diff = 0; for (var i = 0; i < pos.length; i++) if (Math.abs(pos[i] - M.snap[i]) > 1e-6) diff++;
    o.diff = diff; o.meshOff = M.meshOff(); o.left = remaining(); o.hp = ground.filter(function (g) { return g.maxHp !== g.baseHp; }).length;
    JSON.stringify(o)`);
  check(w.liveAt3 && !w.live && /cleared/.test(w.note) && w.guns === 0, 'the round is won when the fourth section falls, and not before', JSON.stringify(w));
  check(w.arena === 0 && w.props && !w.wallOn && w.diff === 0 && w.meshOff === 0, 'the next round is back at dusk, with the landscape exactly as it was', JSON.stringify(w));
  check(w.ships === 6 && w.ground === 30 && w.left === 66 && w.hp === 0, 'and is an ordinary round again: 6 ships, 30 ground units at their ordinary toughness, 66 to go', JSON.stringify(w));

  const t = await run(`var o = [];
    [5, 10, 15].forEach(function (n) { M.wall(n); var g = M.guns(); o.push({ round: n, crack: wallSecs[0].hp, guns: g.length, flakHp: g.filter(function (x) { return x.type === 'flak'; })[0].hp, samHp: g.filter(function (x) { return x.type === 'sam'; })[0].hp, level: g.filter(function (x) { var h = height(x.pos.x, x.pos.z); return Math.abs(height(x.pos.x + 3, x.pos.z) - h) < 2.2 && Math.abs(height(x.pos.x, x.pos.z + 3) - h) < 2.2; }).length }); });
    JSON.stringify(o)`);
  console.log('  round   each crack   guns   a flak gun takes   a missile site takes');
  for (const r of t) console.log(`  ${String(r.round).padStart(5)}   ${String(r.crack).padStart(10)}   ${String(r.guns).padStart(4)}   ${String(r.flakHp).padStart(15)}   ${String(r.samHp).padStart(20)}`);
  check(t[1].crack > t[0].crack && t[2].crack > t[1].crack && t[1].guns > t[0].guns && t[2].guns > t[1].guns && t[1].flakHp > t[0].flakHp, 'harder each time it comes: tougher cracks, more guns, tougher guns', JSON.stringify(t));
  check(t.every(r => r.level === r.guns) && t[2].guns === 32, 'and at its fullest, all 32 mounts, every gun is still on level ice', JSON.stringify(t));

  // (Which boss a round draws is asserted in dusk-walker.mjs, where there are three to draw from.)
  const b = await run(`M.wall(5); var a = arena, w = wallOn; bossForce = 'dread'; startRound(10); JSON.stringify({ a: a, w: w, c: arena, cw: wallOn })`);
  check(b.a === 1 && b.w && b.c === 0 && !b.cw, 'the ice is there for the wall and only for the wall', JSON.stringify(b));
}

// ------------------------------------------------------------ the fight
// A stand-in that plays the way the wall is meant to be played: on its side of the wall it goes for the nearest gun,
// and for a crack when no gun is up; over the top and round again. It never dodges a missile, cannot die, and repair
// is not modelled, so the cost is a ceiling. A second stand-in that ignores the guns shows what that route is worth.
// It only ever goes for the WALL's guns: the towers and drones are left alone to shoot, which is the worst case for cost.
async function fight(round, ups, label, gunsFirst) {
  const r = await run(`${ups} bossForce = 'wall'; startRound(${round}); hull = maxHull();
    var R = { lost: 0, by: { flak: 0, missiles: 0 }, secs: null, falls: [], guns: 0 }, t0 = time, away = false, last = 4;
    R.by.drones = 0;
    damage = function (n) { R.lost += n; R.by[n === 20 ? 'missiles' : n === 10 ? 'drones' : 'flak'] += n; };
    var hg = hitGround; hitGround = function (g, d, at) { var was = g.alive; hg(g, d, at); if (was && !g.alive) R.guns++; };
    M.step(30 * 420, function () {
      if (!roundLive) { R.secs = +(time - t0).toFixed(1); return false; }
      var st = wallStanding(); if (st !== last) { R.falls.push(+(time - t0).toFixed(0)); last = st; }
      var tgt = null, bd = 1e9;
      if (${gunsFirst}) ground.forEach(function (g) { if (!g.alive || !g.spot || (g.pos.z >= 0) !== (shipPos.z >= 0)) return; var d = g.pos.distanceTo(shipPos); if (d < bd) { bd = d; tgt = g.pos.clone(); } });
      if (!tgt) wallSecs.forEach(function (s) { if (s.down || s.falling > 0) return; var p = s.face[shipPos.z >= 0 ? 0 : 1].clone(); p.z -= (shipPos.z >= 0 ? 1 : -1) * 22; var d = p.distanceTo(shipPos); if (d < bd) { bd = d; tgt = p; } });
      if (!tgt) return;
      if (bd < 55) away = true; else if (bd > 190) away = false;
      if (!away) { var dx = tgt.x - shipPos.x, dy = tgt.y - shipPos.y, dz = tgt.z - shipPos.z, flat = Math.sqrt(dx * dx + dz * dz), wy = Math.atan2(-dx, -dz);
        yaw += Math.max(-1.4 / 30, Math.min(1.4 / 30, Math.atan2(Math.sin(wy - yaw), Math.cos(wy - yaw)))); pitch += Math.max(-1 / 30, Math.min(1 / 30, Math.atan2(dy, flat) - pitch)); }
      else pitch += Math.max(-1 / 30, Math.min(1 / 30, 0.5 - pitch));   // pull up and over the crest
      keys.fire = true;
    });
    R.standing = wallStanding(); R.maxHull = maxHull(); JSON.stringify(R)`);
  console.log(`  ${label.padEnd(40)} ${(r.secs === null ? 'not down in 420s, ' + r.standing + ' standing' : 'down in ' + r.secs + 's').padEnd(30)} sections fell at ${(r.falls.join(', ') || '–').padEnd(18)}s   guns destroyed ${String(r.guns).padStart(3)}   ${r.lost} hull lost of ${r.maxHull}: flak ${r.by.flak}, missiles ${r.by.missiles}, drones ${r.by.drones}`);
  return r;
}
console.log('\n— how long the fight is, and what it costs —');
const K4 = 'up.rapid = 1; up.cannons = 1; up.heavy = 1; up.plating = 1;';
const f0 = await fight(5, '', 'round 5, no upgrades, guns first', true);
const f4 = await fight(5, K4, 'round 5, four upgrades, guns first', true);
const f4c = await fight(5, K4, 'round 5, four upgrades, cracks only', false);
const f9 = await fight(10, 'up.rapid = 2; up.cannons = 2; up.heavy = 2; up.plating = 2; up.shield = 1;', 'round 10, nine upgrades, guns first', true);
check(f0.secs !== null, 'it can be brought down with no upgrades at all', JSON.stringify(f0));
check(f4.secs !== null && f4.secs > 20, 'and with four it is neither a wall nor a walkover', JSON.stringify(f4));
check(f4.lost > 0, 'it hits back', JSON.stringify(f4));

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
