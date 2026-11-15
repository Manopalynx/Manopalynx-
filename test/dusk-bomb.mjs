// The bomb upgrade in docs/dusk/: its rules, and a first measure of what it is worth.
//
// Sam's rulings: it is an upgrade card that fires by itself; it hits ground units only; its levels grow the blast
// and how often it drops. The way it reaches the ground (a falling bomb, let go only when it would land on a ground
// unit) and every number are a session's fills, his to strike.
//
// Like the other Dusk suites it steps the real game by hand at 30 ticks a second with drawing switched off, on a
// temp copy with one line added. The published file is never touched. Clearing a round brings up the upgrade
// cards, which stops the clock, so every scene keeps one decoy gun alive far from the ship's path.
//
//   node test/dusk-bomb.mjs

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
const ok = n => { passed++; console.log(` ok   ${n}`); };
const bad = (n, why) => { failed++; console.log(`FAIL  ${n}`); [].concat(why).forEach(w => console.log(`        · ${w}`)); };
const check = (cond, n, why) => cond ? ok(n) : bad(n, why);
const errorsSeen = [];

const browser = await chromium.launch();

// A fresh page, round 2 (no interceptors) on the dusk hills at scale 1 in clear weather. M.scene empties it, keeps
// a decoy gun far off the path, puts the ship at (0, 170) heading for the middle, alt above the highest ground on
// its straight path (a gun just behind a ridge the ship skims cannot be bombed: that is geometry, not a fault), and counts drops
// and blasts. M.lay(i, along, side, raise) puts ground unit i on the path, 'along' beyond where a bomb let go now
// would land (a bomb is thrown well ahead of the ship, so the ship is the wrong place to measure from).
async function run(code, tick = 30) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    // seeded from before the page's own script runs: the world it builds at load (the far dogfight, whose ships
    // become round 6's interceptors) is otherwise different every run, whatever is seeded afterwards
    window.__seed = 777;
    Math.random = function () { var s = window.__seed | 0; s = s + 0x6D2B79F5 | 0; window.__seed = s; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  const out = await page.evaluate(([code, tick]) => window.__t(`
    renderer.render = function () {};
    chapterHold = 0; scaleHold = 1; wxHold = 'clear';
    window.M = { now: performance.now() };
    M.inView = function (p) {
      var v = p.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
      if (v.z >= 0) return false;
      var t = Math.tan(camera.fov * Math.PI / 360);
      return Math.abs(v.x / (-v.z * t * camera.aspect)) < 1 && Math.abs(v.y / (-v.z * t)) < 1;
    };
    M.reseed = function () { window.__seed = 777; time = 0; last = M.now; };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / ${tick}; tick(M.now); if (each) each(); } };
    M.step(3);
    M.drops = []; M.blasts = [];
    var sfx0 = sfx; sfx = function (n, p) { if (n === 'drop') M.drops.push({ t: time, at: bmQ.clone() }); return sfx0(n, p); };
    var blast0 = bombBlast; bombBlast = function (p, r) { M.blasts.push({ t: time, at: p.clone(), r: r }); return blast0(p, r); };
    M.scene = function (alt, round, arena) {
      chapterHold = arena || 0; startRound(round || 2); damage = function () {};
      var i;
      for (i = 0; i < drones.length; i++) { drones[i].alive = false; drones[i].mesh.visible = false; }
      for (i = 0; i < fleet.length; i++) { fleet[i].gone = Infinity; fleet[i].dying = 0; }
      ensureGround(24);
      for (i = 0; i < ground.length; i++) { ground[i].alive = false; ground[i].group.visible = false; }
      setGround(ground[ground.length - 1], -170, 0); // the decoy: alive, so killing the rest never ends the round
      var top = 0; for (var z = 170; z > -220; z -= 4) top = Math.max(top, height(0, z));
      shipPos.set(0, top + alt, 170); yaw = 0; pitch = 0; bank = 0; speed = 25; basis();
      time = 0; last = M.now; window.__seed = 777; M.drops = []; M.blasts = [];
    };
    M.lay = function (i, along, side, raise) {
      var q = new THREE.Vector3(); if (!bombLanding(q)) q.copy(shipPos);
      var x = q.x + fwdV.x * along + rightV.x * side, z = q.z + fwdV.z * along + rightV.z * side;
      setGround(ground[i], x, z);
      if (raise) { ground[i].group.position.y += raise; ground[i].pos.y += raise; }
      return ground[i];
    };
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
  'each level blasts wider and drops more often', `radius ${card.R.slice(1)}  every ${card.cool.slice(1)}s`);

// ------------------------------------------------------------ when it drops
const scene = (alt, lvl, lay, steps, extra = '') => J(`
  M.scene(${alt}); up.bomb = ${lvl}; ${lay}
  ${extra}
  M.step(${steps});
  return { drops: M.drops.length, blasts: M.blasts.map(function (b) { return { t: +b.t.toFixed(2), x: b.at.x, y: b.at.y, z: b.at.z, r: b.r }; }),
    pred: M.drops.map(function (d) { return { x: d.at.x, y: d.at.y, z: d.at.z }; }),
    alive: ground.slice(0, 8).map(function (g) { return g.alive; }), hp: ground.slice(0, 8).map(function (g) { return g.hp; }) };
`);

const noCard = JSON.parse(await run(scene(40, 0, 'for (var i = 0; i < 6; i++) M.lay(i, 30 + 25 * i, 0);', 300)));
check(noCard.drops === 0 && noCard.alive.slice(0, 6).every(Boolean), 'without the card nothing drops, over six guns on the path',
  `drops ${noCard.drops}`);

const bare = JSON.parse(await run(scene(40, 3, '', 300)));
check(bare.drops === 0, 'at level 3 over empty ground for ten seconds, nothing drops: it waits for something to land on',
  `drops ${bare.drops}`);

const onPath = JSON.parse(await run(scene(40, 1, 'M.lay(0, 60, 0);', 240)));
check(onPath.drops === 1 && !onPath.alive[0], 'one gun on the path, level 1: one bomb, and the gun is gone',
  `drops ${onPath.drops}, gun alive ${onPath.alive[0]}`);

// it lets go when the fall would end within reach of a unit -- three quarters of the blast -- and not otherwise.
// On ground made flat for the scene (the game's own height, replaced by 5 everywhere, so the ship, the guns and the
// bomb all read the same world): the hills put a gun 5 aside on a rise 9 above the path, rightly out of reach, and
// these checks are about the aim, not the land. A gun beside a gully is the land's business; see above.
const near = JSON.parse(await run(scene(40, 1, 'height = function () { return 5; }; shipPos.y = 45; M.lay(0, 60, 5);', 240)));
const edge = JSON.parse(await run(scene(40, 1, 'height = function () { return 5; }; shipPos.y = 45; M.lay(0, 60, 9);', 240)));
const wide = JSON.parse(await run(scene(40, 1, 'height = function () { return 5; }; shipPos.y = 45; M.lay(0, 60, 12);', 240)));
check(near.drops >= 1 && !near.alive[0], 'a gun 5 to the side of the path (blast 10) is still bombed', `drops ${near.drops}, alive ${near.alive[0]}`);
check(edge.drops === 0, 'a gun 9 to the side, inside the blast but outside the reach (7.5), is not aimed at: a bomb is let go only where the miss still kills', `drops ${edge.drops}`);
check(wide.drops === 0 && wide.alive[0], 'a gun 12 to the side, outside the blast, is flown past: no bomb is wasted on it', `drops ${wide.drops}, alive ${wide.alive[0]}`);

// a gun on a tower stands above the ground: the bomb must stop on it, not fall past it to the foot
const tower = JSON.parse(await run(scene(60, 1, 'M.lay(0, 60, 0, 22);', 300)));
check(tower.drops >= 1 && !tower.alive[0], 'a gun raised 22 on a tower is hit where it stands, not at the tower\'s foot',
  `drops ${tower.drops}, alive ${tower.alive[0]}, blasts at y ${tower.blasts.map(b => b.y.toFixed(1))}`);

// where it lands is where it was meant to land: the release is decided on a prediction
for (const [tk, alt] of [[30, 40], [30, 120], [20, 120]]) {
  const r = JSON.parse(await run(scene(alt, 1, 'M.lay(0, 60, 0);', 300), tk));
  const errs = r.pred.map((p, i) => r.blasts[i] ? Math.hypot(p.x - r.blasts[i].x, p.y - r.blasts[i].y, p.z - r.blasts[i].z) : Infinity);
  const worst = errs.length ? Math.max(...errs) : Infinity;
  check(errs.length >= 1 && worst < 3, `from ${alt} up at ${tk} ticks a second, it lands within 3 of where it was predicted to`,
    `${errs.length} bombs, worst ${worst.toFixed(2)}`);
}

// a camp: three guns as the game lays them in a small base (half 12), about 8 apart. One bomb should take the camp:
// let go at the first chance, it landed at the camp's near edge and took one gun of three.
for (const lvl of [1, 2]) {
  const r = JSON.parse(await run(scene(40, lvl, `height = function () { return 5; }; shipPos.y = 45;
    var q = new THREE.Vector3(); bombLanding(q); var cx = q.x + fwdV.x * 70, cz = q.z + fwdV.z * 70, st = 12 * 0.55;
    [[-0.6, -0.4], [0.6, -0.4], [0, 0.55]].forEach(function (o, i) { setGround(ground[i], cx + o[0] * st, cz + o[1] * st); });`, 240)));
  check(r.drops === 1 && r.alive.slice(0, 3).every(a => !a), `level ${lvl}: one bomb takes a whole three-gun camp`, `drops ${r.drops}, standing ${r.alive.slice(0, 3)}`);
}

// you see it go off: in level flight, from low to high, the blast lands on the screen, not under the ship
for (const alt of [15, 40, 80, 130]) {
  const r = JSON.parse(await run(J(`
    M.scene(${alt}); height = function () { return 5; }; shipPos.y = 5 + ${alt}; up.bomb = 1; M.lay(0, 40, 0);
    var seen = null; var b0 = bombBlast; bombBlast = function (p, r) { if (seen === null) seen = M.inView(p); return b0(p, r); };
    M.step(360, function () { pitch = 0; });
    return { seen: seen, drops: M.drops.length };
  `)));
  check(r.seen === true, `level flight ${alt} up: the blast is on the screen`, JSON.stringify(r));
}

// ------------------------------------------------------------ what it hurts
const hurt = JSON.parse(await run(J(`
  M.scene(40); up.bomb = 1;
  var p = new THREE.Vector3(0, Math.max(height(0, 60), 0), 60), R = BOMB_R[1];
  setGround(ground[0], 0, 60);                     // under it
  setGround(ground[1], R * 0.9, 60);               // just inside
  setGround(ground[2], 0, 60 + R * 1.15);          // just outside
  var d = drones[0]; d.alive = true; d.mesh.visible = true; d.mesh.position.copy(p).y += 4;
  var ic = ics[0]; ic.alive = true; ic.hp = IC_HP; ic.pos.copy(p).y += 5;
  var o = { in0: ground[0].hp, in1: ground[1].hp, in2: ground[2].hp };
  bombBlast(p, R);
  o.dead0 = !ground[0].alive; o.dead1 = !ground[1].alive; o.left2 = ground[2].alive && ground[2].hp === o.in2;
  o.drone = d.alive; o.ic = ic.alive && ic.hp === IC_HP;
  // damage follows heavy bolts, like every other weapon
  setGround(ground[3], 0, 20); ground[3].hp = ground[3].maxHp = 99; up.heavy = 0; bombBlast(ground[3].pos.clone(), R); o.h0 = 99 - ground[3].hp;
  ground[3].hp = 99; up.heavy = 2; bombBlast(ground[3].pos.clone(), R); o.h2 = 99 - ground[3].hp;
  return o;
`)));
check(hurt.dead0 && hurt.dead1, 'the gun under it and one 0.9 of the blast away are both destroyed', JSON.stringify(hurt));
check(hurt.left2, 'one 1.15 of the blast away is untouched', JSON.stringify(hurt));
check(hurt.drone && hurt.ic, 'ground units only: a drone and an interceptor inside the blast are untouched', JSON.stringify(hurt));
check(hurt.h0 === 5 && hurt.h2 === 10, 'a blast does 5, and heavy bolts scale it as they scale every weapon (5, then 10 at level 2)', `${hurt.h0}, ${hurt.h2}`);

// ------------------------------------------------------------ how often: a carpet of guns saturates the cool-down
// Wherever a bomb let go now would land, a gun is put if none is there, so a bomb is always wanted; the count is
// then the cool-down's. The ship flies a lap of the plain to stay inside the map.
const rates = [];
for (const lvl of [1, 2, 3]) {
  const r = JSON.parse(await run(J(`
    M.scene(50); up.bomb = ${lvl};
    var q = new THREE.Vector3(), next = 0;
    M.step(600, function () {
      yaw += 0.35 / 30;
      if (!bombLanding(q)) return;
      for (var i = 0; i < 8; i++) if (ground[i].alive && ground[i].pos.distanceTo(q) < 4) return;
      for (i = 0; i < 8 && ground[next].alive; i++) next = (next + 1) % 8;
      setGround(ground[next], q.x, q.z); next = (next + 1) % 8;
    });
    return { drops: M.drops.length };
  `)));
  const want = 1 + Math.floor((20 - 1) / card.cool[lvl]);
  rates.push(r.drops);
  check(Math.abs(r.drops - want) <= 1, `level ${lvl} over a carpet of guns for 20 seconds: ${r.drops} bombs, the cool-down allows ${want}`, `got ${r.drops}`);
}

// ------------------------------------------------------------ housekeeping
const clear = JSON.parse(await run(J(`
  M.scene(80); up.bomb = 1; M.lay(0, 40, 0);
  // counted the moment the new round starts: a bomb left falling would have landed by the end of the run anyway
  var live = 0, still = -1; M.step(200, function () {
    var i; for (i = 0; i < bombs.length; i++) if (bombs[i].live) live = 1;
    if (live && !M.cut) { M.cut = true; startRound(3); still = 0;
      for (i = 0; i < bombs.length; i++) if (bombs[i].live || bombs[i].mesh.visible) still++; }
  });
  return { saw: live, still: still };
`)));
check(clear.saw && clear.still === 0, 'a new round clears bombs still falling', JSON.stringify(clear));

// ------------------------------------------------------------ a first measure of what it is worth (printed, not asserted)
// A real round 6 on the dusk hills at scale 1, every enemy in it, the hull held, the stand-in flying legs across
// the map without firing. Only the automatic weapons work, so the count is what each card does on its own. Seekers
// are the comparison: the other card that fires by itself. Ground units destroyed, of the round's, in 90 seconds.
const LEGS = `(function () { var r = Math.sqrt(shipPos.x * shipPos.x + shipPos.z * shipPos.z); if (r > 175 || M.turning) {
  var home = Math.atan2(shipPos.x, shipPos.z), d = Math.atan2(Math.sin(home - yaw), Math.cos(home - yaw));
  M.turning = Math.abs(d) > 0.15; if (M.turning) yaw += Math.sign(d) * 1.2 / 30; } })();`;
if (!process.env.DUSK_QUICK) {
console.log('\n— worth: round 6, the stand-in flying legs at 50 up, not firing; ground units destroyed in 90 s —');
console.log('  card          lvl   ground killed   of   drones killed');
for (const [id, lvl] of [['none', 0], ['bomb', 1], ['bomb', 2], ['bomb', 3], ['seeker', 1], ['seeker', 2], ['seeker', 3]]) {
  const r = JSON.parse(await run(J(`
    // muted: the sound effects draw from the same random as the game, and whether one plays depends on the real audio
    // clock, so with sound on the seeded game drifts with wall time (seekers moved by a kill between identical runs)
    muted = true; M.reseed(); startRound(6); damage = function () {}; time = 0; last = M.now;
    ${id !== 'none' ? `up.${id} = ${lvl};` : ''}
    var g0 = 0, d0 = 0, i; for (i = 0; i < ground.length; i++) if (ground[i].alive) g0++; for (i = 0; i < drones.length; i++) if (drones[i].alive) d0++;
    M.step(2700, function () { ${LEGS} if (shipPos.y < Math.max(height(shipPos.x, shipPos.z), 0) + 50) pitch = 0.08; else pitch = 0; basis(); });
    var g1 = 0, d1 = 0; for (i = 0; i < ground.length; i++) if (ground[i].alive) g1++; for (i = 0; i < drones.length; i++) if (drones[i].alive) d1++;
    return { g: g0 - g1, of: g0, d: d0 - d1 };
  `)));
  console.log(`  ${id.padEnd(12)} ${String(lvl).padStart(3)}   ${String(r.g).padStart(13)}  ${String(r.of).padStart(3)}   ${String(r.d).padStart(13)}`);
}
console.log('');
}

check(errorsSeen.length === 0, 'nothing threw', errorsSeen.slice(0, 5));
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
