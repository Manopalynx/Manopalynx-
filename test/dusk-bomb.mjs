// The bomb upgrade in docs/dusk/: its rules, and a first measure of what it is worth.
//
// Sam's rulings: it is an upgrade card that fires by itself; it hits ground units only; its levels grow the blast
// and how often it drops; it shoots forward, so you see it, with targeting like the wingmen's -- something picked in a
// forward cone and aimed at. The cone's shape (round the heading on the map, 30 degrees either side, 30 to 200 out),
// what it prefers, the lob and every number are a session's fills, his to strike.
//
// Like the other Dusk suites it steps the real game by hand at 30 ticks a second with drawing switched off, on a
// temp copy with one line added. The published file is never touched. Clearing a round brings up the upgrade
// cards, which stops the clock, so every scene keeps one decoy gun alive far from the ship's path.
//
//   node test/dusk-bomb.mjs

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

// A fresh page, round 2 (no interceptors) on the dusk hills at scale 1 in clear weather. M.scene empties it, keeps a
// decoy gun far outside the cone, and puts the ship at (0, 170) heading for the middle (yaw 0, so the heading is -z).
// With flat set, the game's own height is replaced by 5 everywhere, so the ship, the guns and the bomb all read one
// level world: most checks here are about the aim, not the land. (The landscape is still drawn as it was; nothing
// here is drawn.) Without it, alt is above the highest ground on the path. M.lay(i, along, side, raise) puts ground
// unit i 'along' ahead of the ship on its heading and 'side' to the right. Every throw records what it was thrown at.
async function run(code, tick = 30) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await seedPage(page, { seed: 777 });   // seeded from before the page loads, and silent: see dusk-seed.mjs
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  const out = await page.evaluate(([code, tick]) => window.__t(`
    renderer.render = function () {};
    chapterHold = 0; scaleHold = 1; wxHold = 'clear';
    window.M = { now: performance.now() };
    // the test's own reading of the screen, worked out apart from the game's bombOnScreen
    M.inView = function (p) {
      camera.updateMatrixWorld();
      var v = p.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
      if (v.z >= 0) return false;
      var t = Math.tan(camera.fov * Math.PI / 360);
      return Math.abs(v.x / (-v.z * t * camera.aspect)) < 1 && Math.abs(v.y / (-v.z * t)) < 1;
    };
    M.reseed = function () { window.__seed = 777; time = 0; last = M.now; };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / ${tick}; tick(M.now); if (each) each(); } };
    M.step(3);
    M.drops = []; M.blasts = [];
    var sfx0 = sfx; sfx = function (n, p) {
      if (n === 'drop') { for (var i = 0; i < bombs.length; i++) if (bombs[i].live && bombs[i].age === 0) M.drops.push({ t: time, to: bombs[i].to, at: bombs[i].to.pos.clone() }); }
      return sfx0(n, p);
    };
    var blast0 = bombBlast; bombBlast = function (p, r) { M.blasts.push({ t: time, at: p.clone(), r: r }); return blast0(p, r); };
    M.scene = function (alt, flat) {
      chapterHold = 0; startRound(2); damage = function () {};
      var i;
      for (i = 0; i < drones.length; i++) { drones[i].alive = false; drones[i].mesh.visible = false; }
      for (i = 0; i < fleet.length; i++) { fleet[i].gone = Infinity; fleet[i].dying = 0; }
      ensureGround(24);
      for (i = 0; i < ground.length; i++) { ground[i].alive = false; ground[i].group.visible = false; }
      if (flat) height = function () { return 5; };
      setGround(ground[ground.length - 1], -170, 0); // the decoy: alive, so killing the rest never ends the round; outside the cone throughout
      var top = 0; if (flat) top = 5; else for (var z = 170; z > -220; z -= 4) top = Math.max(top, height(0, z));
      shipPos.set(0, top + alt, 170); yaw = 0; pitch = 0; bank = 0; speed = 25; basis();
      // the camera where it settles behind the ship, not where it was: what is on the screen is read from it
      camera.position.copy(shipPos).addScaledVector(fwdV, -9.5).addScaledVector(upV, 2.6); camera.rotation.set(pitch, yaw, 0);
      time = 0; last = M.now; window.__seed = 777; M.drops = []; M.blasts = [];
    };
    M.lay = function (i, along, side, raise) {
      var hx = -Math.sin(yaw), hz = -Math.cos(yaw);
      setGround(ground[i], shipPos.x + hx * along - hz * (side || 0), shipPos.z + hz * along + hx * (side || 0));
      if (raise) { ground[i].group.position.y += raise; ground[i].pos.y += raise; }
      return ground[i];
    };
    // a gun 'deg' off the heading, 'dist' out
    M.layAt = function (i, deg, dist) { var a = deg * Math.PI / 180; return M.lay(i, Math.cos(a) * dist, Math.sin(a) * dist); };
    ${code}
  `), [code, tick]);
  await page.close();
  errorsSeen.push(...errors);
  return out;
}
const J = s => `JSON.stringify((function () { ${s} })())`;

// ------------------------------------------------------------ the card
const card = JSON.parse(await run(J(`
  var c = UPGRADES.filter(function (u) { return u.id === 'bomb'; })[0];
  return { has: !!c, max: c && c.max, R: BOMB_R, cool: BOMB_COOL, inPool: (function () { resetUpgrades(); var pool = []; for (var i = 0; i < UPGRADES.length; i++) if (up[UPGRADES[i].id] < UPGRADES[i].max) pool.push(UPGRADES[i].id); return pool.indexOf('bomb') >= 0; })() };
`)));
check(card.has && card.max === 3, 'Bombs is an upgrade card, three levels', JSON.stringify(card));
check(card.inPool, 'it is in the pool the cards are drawn from');
check(card.R[1] < card.R[2] && card.R[2] < card.R[3] && card.cool[1] > card.cool[2] && card.cool[2] > card.cool[3],
  'each level blasts wider and throws more often', `radius ${card.R.slice(1)}  every ${card.cool.slice(1)}s`);

// ------------------------------------------------------------ what it throws at
// Every scene also reports whether each blast landed on what it was thrown at -- within 3, the gun's own footprint, on
// which a bomb stops: a throw that misses is a bomb wasted, and the miss is the thing to see first. The first look for a
// target is a second in, when the cool-down a round starts with runs out; flying on widens a gun's angle off the
// heading, so the scenes about the cone's edge lay their guns just before that look ('M.step(28);').
const scene = (alt, lvl, lay, steps, opt = {}) => J(`
  M.scene(${alt}, ${opt.flat !== false}); up.bomb = ${lvl}; ${lay}
  var seen0 = ground.slice(0, 8).map(function (g) { return g.alive && M.inView(g.pos); });
  M.step(${steps}${opt.each ? `, function () { ${opt.each} }` : ''});
  var miss = 0, worst = 0;
  for (var i = 0; i < M.drops.length && i < M.blasts.length; i++) { var e = M.drops[i].at.distanceTo(M.blasts[i].at); worst = Math.max(worst, e); if (e > 3) miss++; }
  return { drops: M.drops.length, blasts: M.blasts.length, miss: miss, worst: +worst.toFixed(2), seen0: seen0,
    first: M.drops.length ? ground.indexOf(M.drops[0].to) : -1, firstT: M.drops.length ? +M.drops[0].t.toFixed(2) : null,
    alive: ground.slice(0, 8).map(function (g) { return g.alive; }) };
`);
const allLanded = [];
const R = async (...a) => { const r = JSON.parse(await run(scene(...a), a[4] && a[4].tick || 30)); allLanded.push(r); return r; };

const noCard = await R(40, 0, 'for (var i = 0; i < 6; i++) M.lay(i, 60 + 25 * i, 0);', 300);
check(noCard.drops === 0 && noCard.alive.slice(0, 6).every(Boolean), 'without the card nothing is thrown, with six guns ahead', `drops ${noCard.drops}`);

const bare = await R(40, 3, '', 300);
check(bare.drops === 0, 'level 3 with nothing on the ground ahead for ten seconds: nothing is thrown', `drops ${bare.drops}`);

const ahead = await R(40, 1, 'M.lay(0, 120, 0);', 120);
check(ahead.drops === 1 && !ahead.alive[0], 'one gun 120 ahead, level 1: one bomb, and the gun is gone', JSON.stringify(ahead));

// the cone: 30 degrees either side of the heading, 30 to 200 out
const in25 = await R(40, 1, 'M.step(28); M.layAt(0, 25, 120);', 150);
const out36 = await R(40, 1, 'M.step(28); M.layAt(0, -36, 120);', 150);
check(in25.drops >= 1 && !in25.alive[0], 'a gun 25 degrees off the heading is in the cone: bombed', JSON.stringify(in25));
check(out36.drops === 0 && out36.alive[0], 'a gun 36 degrees off is outside it, and only falls further out as you fly on: left alone', JSON.stringify(out36));
const behind = await R(40, 3, 'M.lay(0, -80, 0);', 150);
check(behind.drops === 0 && behind.alive[0], 'a gun behind you is never thrown at', JSON.stringify(behind));
const under = await R(40, 3, 'M.step(28); M.lay(0, 22, 0);', 150);
check(under.drops === 0 && under.alive[0], 'a gun 22 ahead, nearer than 30, is flown over: no bomb straight down', JSON.stringify(under));
const far = await R(40, 1, 'M.lay(0, 280, 0);', 210);
check(far.drops >= 1 && far.firstT >= 2.8 && far.firstT <= 4, 'a gun 280 ahead waits until it is within 200 (about 3.2 seconds at cruise)', `first throw at ${far.firstT}s`);

// the point of it: fighting in the air with the nose up, the ground ahead is still bombed
const noseUp = await R(40, 1, 'M.lay(0, 140, 0);', 150, { each: 'pitch = 0.5; basis();' });
check(noseUp.drops >= 1 && !noseUp.alive[0], 'nose held 0.5 up, as at a drone above: the gun on the ground ahead is still bombed', JSON.stringify(noseUp));

// what it prefers: on the screen first
const pref = await R(45, 1, 'M.step(28); M.lay(0, 170, 0); M.layAt(1, 26, 90);', 40);
check(pref.seen0[0] && !pref.seen0[1], 'fixture: the gun straight ahead is on the screen and the nearer one 26 degrees aside is not', JSON.stringify(pref.seen0));
check(pref.first === 0, 'with one gun on the screen and a nearer one off it, the one on the screen is thrown at first', `first ${pref.first}`);
const offOnly = await R(45, 1, 'M.step(28); M.layAt(1, 26, 90);', 120);
check(offOnly.drops >= 1 && !offOnly.alive[1], 'with only the one off the screen, it is thrown at all the same', JSON.stringify(offOnly));
// then the most the blast catches: a camp beats a nearer lone gun
const campLay = `var st = 12 * 0.55; [[-0.6, -0.4], [0.6, -0.4], [0, 0.55]].forEach(function (o, i) { M.lay(i, 175 + o[1] * st, o[0] * st); }); M.lay(3, 110, 4);`;
const camp = await R(45, 1, 'M.step(28); ' + campLay, 150);
check(camp.first >= 0 && camp.first <= 2, 'a three-gun camp is thrown at before a nearer lone gun', `first ${camp.first}`);
check(camp.blasts >= 1 && camp.alive.slice(0, 3).every(a => !a), 'and that one level-1 bomb takes the whole camp', `standing ${camp.alive.slice(0, 3)}`);

// it is not thrown at what it cannot reach: a ridge 65 high across the path, the gun beyond it
const ridge = JSON.parse(await run(J(`
  M.scene(45, true); up.bomb = 1;
  height = function (x, z) { return z > -15 && z < -5 ? 70 : 5; };
  setGround(ground[0], 0, -60);
  M.step(120);
  return { drops: M.drops.length, blasts: M.blasts.length, alive: ground[0].alive, z: shipPos.z };
`)));
check(ridge.drops === 0 && ridge.alive, 'a gun behind a ridge the throw cannot clear is not thrown at: no bomb spent on the ridge', JSON.stringify(ridge));

// a gun on a tower stands above the ground: the bomb lands on it, not at the tower's foot
const tower = await R(45, 1, 'M.lay(0, 120, 0, 22);', 120);
check(tower.drops >= 1 && !tower.alive[0], 'a gun raised 22 on a tower is hit where it stands', JSON.stringify(tower));

// on real ground, from low and high, near and far: each lands on what it was thrown at
for (const [alt, tk] of [[15, 30], [60, 30], [150, 30], [60, 20]]) {
  const r = await R(alt, 1, 'M.lay(0, 60, 0); M.lay(1, 130, 6); M.lay(2, 195, -10);', 240, { flat: false, tick: tk });
  check(r.blasts >= 1, `real ground, ${alt} up, ${tk} ticks a second: guns at 60, 130 and 195 ahead are thrown at (${r.drops} throws)`, JSON.stringify(r));
}
const misses = allLanded.reduce((a, r) => a + r.miss, 0), throws = allLanded.reduce((a, r) => a + Math.min(r.drops, r.blasts), 0);
check(misses === 0 && throws >= 10, `every bomb thrown in this suite so far landed within 3 of what it was thrown at (${throws} throws)`,
  `misses ${misses}, worst ${Math.max(...allLanded.map(r => r.worst))}`);

// ------------------------------------------------------------ you see it go off
// a gun on the screen, 190 ahead, level flight. Above some height the ground in reach is under the view whatever is
// done: that height is printed, not asserted.
for (const alt of [15, 40, 80, 130]) {
  const r = JSON.parse(await run(J(`
    M.scene(${alt}, true); up.bomb = 1; M.lay(0, 190, 0);
    var seen = null; var b0 = bombBlast; bombBlast = function (p, r) { if (seen === null) seen = M.inView(p); return b0(p, r); };
    M.step(200, function () { pitch = 0; basis(); });
    return { seen: seen, drops: M.drops.length };
  `)));
  if (alt <= 80) check(r.seen === true, `level flight ${alt} up: the blast is on the screen`, JSON.stringify(r));
  else console.log(`  ·    level flight ${alt} up: the blast is ${r.seen ? 'on' : 'off'} the screen (printed, not asserted)`);
}

// ------------------------------------------------------------ what it hurts
const hurt = JSON.parse(await run(J(`
  M.scene(40, true); up.bomb = 1;
  var p = new THREE.Vector3(0, 5, 60), R = BOMB_R[1];
  setGround(ground[0], 0, 60);
  setGround(ground[1], R * 0.9, 60);
  setGround(ground[2], 0, 60 + R * 1.15);
  var d = drones[0]; d.alive = true; d.mesh.visible = true; d.mesh.position.copy(p).y += 4;
  var ic = ics[0]; ic.alive = true; ic.hp = IC_HP; ic.pos.copy(p).y += 5;
  var o = { in2: ground[2].hp };
  bombBlast(p, R);
  o.dead0 = !ground[0].alive; o.dead1 = !ground[1].alive; o.left2 = ground[2].alive && ground[2].hp === o.in2;
  o.drone = d.alive; o.ic = ic.alive && ic.hp === IC_HP;
  setGround(ground[3], 0, 20); ground[3].hp = ground[3].maxHp = 99; up.heavy = 0; bombBlast(ground[3].pos.clone(), R); o.h0 = 99 - ground[3].hp;
  ground[3].hp = 99; up.heavy = 2; bombBlast(ground[3].pos.clone(), R); o.h2 = 99 - ground[3].hp;
  return o;
`)));
check(hurt.dead0 && hurt.dead1, 'the gun under it and one 0.9 of the blast away are both destroyed', JSON.stringify(hurt));
check(hurt.left2, 'one 1.15 of the blast away is untouched', JSON.stringify(hurt));
check(hurt.drone && hurt.ic, 'ground units only: a drone and an interceptor inside the blast are untouched', JSON.stringify(hurt));
check(hurt.h0 === 5 && hurt.h2 === 10, 'a blast does 5, and heavy bolts scale it as they scale every weapon (5, then 10 at level 2)', `${hurt.h0}, ${hurt.h2}`);

// ------------------------------------------------------------ how often: always something to throw at
// Guns are kept in the cone (any destroyed, or slid more than 20 degrees off the heading or nearer than 40, is laid
// again ahead), so a throw is always wanted; the count is the cool-down's. The ship flies a lap to stay inside the map.
for (const lvl of [1, 2, 3]) {
  const r = JSON.parse(await run(J(`
    M.scene(40, true); up.bomb = ${lvl};
    for (var i = 0; i < 4; i++) M.lay(i, 100 + 20 * i, 0);
    var hx, hz, g, dx, dz, d;
    M.step(600, function () { yaw += 0.35 / 30; basis(); hx = -Math.sin(yaw); hz = -Math.cos(yaw);
      for (var i = 0; i < 4; i++) { g = ground[i]; dx = g.pos.x - shipPos.x; dz = g.pos.z - shipPos.z; d = Math.hypot(dx, dz);
        if (!g.alive || d < 40 || (dx * hx + dz * hz) / d < 0.94) M.lay(i, 120 + 15 * i, 0); } });
    return { drops: M.drops.length };
  `)));
  const want = 1 + Math.floor((20 - 1) / card.cool[lvl]);
  check(Math.abs(r.drops - want) <= 1, `level ${lvl} with guns always ahead for 20 seconds: ${r.drops} bombs, the cool-down allows ${want}`, `got ${r.drops}`);
}

// ------------------------------------------------------------ housekeeping
const clear = JSON.parse(await run(J(`
  M.scene(80, true); up.bomb = 1; M.lay(0, 150, 0);
  var live = 0, still = -1; M.step(200, function () {
    var i; for (i = 0; i < bombs.length; i++) if (bombs[i].live) live = 1;
    if (live && !M.cut) { M.cut = true; startRound(3); still = 0;
      for (i = 0; i < bombs.length; i++) if (bombs[i].live || bombs[i].mesh.visible) still++; }
  });
  return { saw: live, still: still };
`)));
check(clear.saw && clear.still === 0, 'a new round clears bombs still in the air', JSON.stringify(clear));

// ------------------------------------------------------------ what it is worth (printed, not asserted)
// A real round 6 on the dusk hills at scale 1, every enemy in it, the hull held. Two stand-ins: one flies legs across
// the map at 50 up without firing; one fights drones as a person does, turning and pitching at the nearest, guns
// firing. Ground units destroyed by the card's own weapon, of the round's, in 90 seconds. Seekers are the comparison:
// the other card that fires by itself.
const LEGS = `(function () { var r = Math.sqrt(shipPos.x * shipPos.x + shipPos.z * shipPos.z); if (r > 175 || M.turning) {
  var home = Math.atan2(shipPos.x, shipPos.z), d = Math.atan2(Math.sin(home - yaw), Math.cos(home - yaw));
  M.turning = Math.abs(d) > 0.15; if (M.turning) yaw += Math.sign(d) * 1.2 / 30; }
  if (shipPos.y < Math.max(height(shipPos.x, shipPos.z), 0) + 50) pitch = 0.08; else pitch = 0; basis(); })();`;
const CHASE = `(function () { var b = null, bd = 1e9; for (var i = 0; i < drones.length; i++) if (drones[i].alive) { var d = drones[i].mesh.position.distanceTo(shipPos); if (d < bd) { bd = d; b = drones[i]; } }
  if (!b) return; var dx = b.mesh.position.x - shipPos.x, dz = b.mesh.position.z - shipPos.z, dy = b.mesh.position.y - shipPos.y;
  var want = Math.atan2(-dx, -dz), dd = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)); yaw += Math.max(-1.4 / 30, Math.min(1.4 / 30, dd));
  var wp = Math.atan2(dy, Math.hypot(dx, dz)); pitch += Math.max(-0.8 / 30, Math.min(0.8 / 30, Math.max(-0.6, Math.min(0.6, wp)) - pitch)); basis(); })(); keys.fire = true;`;
if (!process.env.DUSK_QUICK) {
  for (const [who, steer] of [['flying legs, not firing', LEGS], ['fighting drones, firing', CHASE]]) {
    console.log(`\n— worth: round 6, ${who}; ground units the card destroyed, of the round's, in 90 s —`);
    console.log('  card          lvl   thrown   ground by it   of');
    for (const [id, lvl] of [['none', 0], ['bomb', 1], ['bomb', 2], ['bomb', 3], ['seeker', 1], ['seeker', 2], ['seeker', 3]]) {
      const r = JSON.parse(await run(J(`
        // muted: the sound effects draw from the same random as the game, and whether one plays depends on the real
        // audio clock, so with sound on the seeded game drifts with wall time
        muted = true; M.reseed(); startRound(6); damage = function () {}; time = 0; last = M.now;
        ${id !== 'none' ? `up.${id} = ${lvl};` : ''}
        var by = 0, src = null, g0 = 0, i;
        for (i = 0; i < ground.length; i++) if (ground[i].alive) g0++;
        var hg = hitGround; hitGround = function (g, d, a) { var was = g.alive; hg(g, d, a); if (was && !g.alive && src) by++; };
        var bb = bombBlast; bombBlast = function (p, r) { src = 'bomb'; bb(p, r); src = null; };
        var us = updateSeekers; updateSeekers = function (dt) { src = 'seeker'; us(dt); src = null; };
        var n = 0, ls = launchSeeker; launchSeeker = function () { n++; ls(); };
        M.step(2700, function () { ${steer} });
        return { by: by, of: g0, thrown: ${id === 'bomb' ? 'M.drops.length' : 'n'} };
      `)));
      console.log(`  ${id.padEnd(12)} ${String(lvl).padStart(3)}   ${String(r.thrown).padStart(6)}   ${String(r.by).padStart(12)}   ${String(r.of).padStart(3)}`);
    }
  }
  console.log('');
}

check(errorsSeen.length === 0, 'nothing threw', errorsSeen.slice(0, 5));
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
