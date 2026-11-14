// Measures how the interceptors in docs/dusk/ FLY, and asserts the rules Sam set.
//
// It steps the real game by hand at a fixed 30 ticks a second with drawing
// switched off, so the figures are about the rules of the flying and are the
// same on any machine. They say nothing about how it feels: that is Sam's, on
// his phone.
//
// The published file is never touched. A copy is written to a temp folder with
// one line added, giving the test a way into the game's closure.
//
//   node test/dusk-intercept.mjs

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

const browser = await chromium.launch();

// One fresh page per scenario, so nothing carries over.
async function fresh() {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });   // the test drives the clock
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);                                              // first touch: take the controls
  await page.evaluate(() => window.__t(`
    renderer.render = function () {};
    chapterHold = 0; wxHold = 'clear'; wxStart(round); // the chapters and the weather vary; these checks are about other things, so hold them: dusk hills, clear
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each) each(); } };
    M.quiet = function () {
      var i;
      for (i = 0; i < drones.length; i++) { drones[i].alive = false; drones[i].mesh.visible = false; }
      for (i = 0; i < ground.length; i++) { ground[i].alive = false; }
      for (i = 0; i < fleet.length; i++) { fleet[i].gone = Infinity; fleet[i].dying = 0; }
    };
    // where the camera sees a point: inside the screen or not
    M.inView = function (p) {
      var v = p.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
      if (v.z >= 0) return false;
      var t = Math.tan(camera.fov * Math.PI / 360);
      return Math.abs(v.x / (-v.z * t * camera.aspect)) < 1 && Math.abs(v.y / (-v.z * t)) < 1;
    };
    M.step(3);
    inControl
  `));
  return { page, errors };
}

// ------------------------------------------------------------ the flying
// The round is emptied of everything else and the hull cannot be lost, so the
// only thing being measured is the interceptors. 180 game-seconds each.
// Left alone the ship reaches the edge of the map in seconds and is turned for home by the game, which makes
// "flying straight" a slow circle round the rim. So the stand-in player flies LEGS: straight across, a firm
// turn back in when it nears the edge, straight again. That is the nearest thing here to how the map is flown.
const LEGS = `(function () { var r = Math.sqrt(shipPos.x * shipPos.x + shipPos.z * shipPos.z); if (r > 175 || M.turning) {
  var home = Math.atan2(shipPos.x, shipPos.z), d = Math.atan2(Math.sin(home - yaw), Math.cos(home - yaw));
  M.turning = Math.abs(d) > 0.15; if (M.turning) yaw += Math.sign(d) * 1.2 / 30; } })();`;
// An ordinary round that sends two. Not 5: every fifth round is the dreadnought, whose interceptors come from its
// bays -- this suite went red on a correct game the day that arrived, on a fixture that named round 5.
const ROUND = 6;
const FLY = {
  'legs, cruising':       LEGS,
  'legs, full speed':     LEGS + 'keys.f = true;',
  'legs, gentle weave':   LEGS + 'yaw += Math.sin(time * 0.8) * 0.45 / 30;',
  'legs, hard weave':     LEGS + 'yaw += Math.sin(time * 0.8) * 0.9 / 30;',
  'circling, never stops': 'yaw += 0.5 / 30;',
  // What a person does with an arrow on the screen: turns to face the nearest one. Sam's report -- "they just
  // fly in circles around me" -- came from the real seat, and none of the rows above sat in it.
  'turns to face them':   `(function () { var b = null, bd = 1e9; for (var i = 0; i < ics.length; i++) if (ics[i].alive) { var d = ics[i].pos.distanceTo(shipPos); if (d < bd) { bd = d; b = ics[i]; } }
    if (b) { var want = Math.atan2(-(b.pos.x - shipPos.x), -(b.pos.z - shipPos.z)), d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)); yaw += Math.max(-1.4 / 30, Math.min(1.4 / 30, d)); } })();`,
};
async function fly(name, steer, round, firing) {
  const { page, errors } = await fresh();
  const r = await page.evaluate(([steer, round, firing]) => window.__t(`
    startRound(${round}); M.quiet();
    var R = { alive: 0, near: 0, nearSeen: 0, shots: 0, shotsUnseen: 0, shotsAstern: 0, hits: 0, dmg: 0, passes: [], passSeen: [], laps: 0, lurk: 0, kills: 0, firstKill: null, sent: 0, heatPeak: 0, sfx: {} };
    var seenAcc = [0, 0, 0], t0 = time, hp0 = [0, 0, 0], brg = [null, null, null];
    damage = function (n) { R.hits++; R.dmg += n; };
    var sfx0 = sfx;
    sfx = function (n, p) {
      R.sfx[n] = (R.sfx[n] || 0) + 1;
      if (n === 'ishot') { R.shots++; if (!M.inView(p)) R.shotsUnseen++; if (p.clone().sub(shipPos).dot(fwdV) < 0) R.shotsAstern++; }
      if (n === 'pass') { R.passes.push(+(time - t0).toFixed(2)); for (var q = 0; q < ics.length; q++) if (ics[q].pos === p) { R.passSeen.push(+seenAcc[q].toFixed(2)); seenAcc[q] = 0; } }
      return sfx0(n, p);
    };
    M.step(5400, function () {
      ${steer}
      ${firing ? 'keys.fire = true;' : ''}
      if (heat > R.heatPeak) R.heatPeak = heat;
      for (var i = 0; i < ics.length; i++) {
        var ic = ics[i];
        if (hp0[i] > 0 && !ic.alive) { R.kills++; if (R.firstKill === null) R.firstKill = +(time - t0).toFixed(1); }
        hp0[i] = ic.alive ? ic.hp : 0;
        if (!ic.alive) continue;
        R.alive++;
        var d = ic.pos.distanceTo(shipPos), v = M.inView(ic.pos);
        if (v) seenAcc[i] += 1 / 30;
        if (d < 250) { R.near++; if (v) R.nearSeen++; }
        // LAPS: how far round you it has swung, in whole turns. A straight pass through is half a lap; circling is many laps and no passes.
        var bb = Math.atan2(ic.pos.x - shipPos.x, ic.pos.z - shipPos.z);
        if (brg[i] !== null && d > 12) R.laps += Math.abs(Math.atan2(Math.sin(bb - brg[i]), Math.cos(bb - brg[i]))) / 6.283;
        brg[i] = bb;
        if (d < 110 && !v) R.lurk++;   // close by and not on the screen
      }
    });
    R.sent = icWant; R.left = remaining(); R.roundLive = roundLive;
    JSON.stringify(R)
  `), [steer, round, firing]).then(JSON.parse);
  await page.close();
  r.name = name; r.errors = errors;
  return r;
}

const gap = p => p.length < 2 ? null : (p[p.length - 1] - p[0]) / (p.length - 1);
const fmt = (x, d = 1) => x === null || x === undefined || Number.isNaN(x) ? '  –' : x.toFixed(d);

console.log('\n— how they fly: round ' + ROUND + ' (two interceptors), nothing else alive, 180s —');
console.log('  player                 passes  laps round you  close+unseen  seen before pass  in view <250m  shots  from unseen  from astern  hits on you');
const runs = [];
for (const [name, steer] of Object.entries(FLY)) {
  const r = await fly(name, steer, ROUND, false); runs.push(r);
  const seenAvg = r.passSeen.length ? r.passSeen.reduce((a, b) => a + b, 0) / r.passSeen.length : null;
  console.log(`  ${name.padEnd(22)} ${String(r.passes.length).padStart(5)}   ${fmt(r.laps).padStart(10)}     ${fmt(100 * r.lurk / Math.max(1, r.alive), 0).padStart(8)}%      ${fmt(seenAvg).padStart(8)}s      ${fmt(100 * r.nearSeen / Math.max(1, r.near), 0).padStart(8)}%   ${String(r.shots).padStart(5)}   ${String(r.shotsUnseen).padStart(8)}     ${String(r.shotsAstern).padStart(6)}     ${r.hits} (${r.dmg} hull)`);
}
const all = k => runs.reduce((a, r) => a + r[k], 0);
check(runs.every(r => r.errors.length === 0), 'nothing threw in any run', runs.flatMap(r => r.errors));
check(runs.every(r => r.sent === 2), 'round ' + ROUND + ' sends two', runs.map(r => `${r.name}: ${r.sent}`));
const legs = runs.filter(r => r.name.startsWith('legs') && !r.name.includes('hard'));
check(legs.length === 3 && legs.every(r => r.passes.length >= 12), 'flown across the map, with or without a gentle weave, a pass comes at least every 15s  [' + legs.map(r => r.passes.length).join(', ') + ' in 180s]', runs.map(r => `${r.name}: ${r.passes.length}`));
check(all('shots') > 0 && all('shotsAstern') === 0, `no shot is ever fired from behind you  [${all('shots')} shots]`, `${all('shotsAstern')} of ${all('shots')} from astern`);
check(all('shots') > 0 && all('shotsUnseen') === 0, `no shot is ever fired from off the screen  [${all('shots')} shots]`, `${all('shotsUnseen')} of ${all('shots')} from out of view`);
const few = r => r.passSeen.filter(s => s < 0.5).length;
// THE CIRCLING CHECK. Build interceptors-1 passed everything above and Sam's first words on it were "they just seem
// to fly in circles around me". Measured afterwards against a player who turns to face them: 3.2 laps round him for
// every pass, 81% of the time close by and off the screen. A straight run through is half a lap. The line is 1.0.
const facer = runs.find(r => r.name === 'turns to face them');
const lapsPer = facer.laps / Math.max(1, facer.passes.length), lurk = 100 * facer.lurk / Math.max(1, facer.alive);
check(lapsPer < 1.0, `they go through a player who turns to face them, not round him  [${lapsPer.toFixed(2)} laps a pass; circling was 3.2]`, `${facer.laps.toFixed(1)} laps for ${facer.passes.length} passes`);
check(lurk < 45, `and are not close-but-unseen most of the time  [${lurk.toFixed(0)}%; circling was 81%]`, `${lurk.toFixed(0)}% of the time within 110 and off the screen`);
check(few(facer) <= facer.passSeen.length * 0.2, `four passes in five at that player are on screen for half a second first  [unseen: ${few(facer)} of ${facer.passSeen.length}]`, `${few(facer)} of ${facer.passSeen.length} unseen`);
console.log('  (not asserted, because not true: at a player flying straight legs ' + legs.map(r => few(r) + ' of ' + r.passSeen.length).join(', ') + ' passes are unseen, and all of them at one who circles without stopping. Unseen passes fire nothing.)');
check(legs.every(r => r.heatPeak > 0.3), 'they raise the heat the music follows', runs.map(r => `${r.name}: peak ${r.heatPeak.toFixed(2)}`));
check(runs.every(r => r.left === 0 && r.roundLive), 'they are not in the "to go" count  [0 to go with two still flying]', runs.map(r => `${r.name}: ${r.left} to go`));

console.log('\n— can you shoot one? holding Fire, base guns, no upgrades —');
for (const name of ['legs, cruising', 'legs, gentle weave']) {
  const r = await fly(name, FLY[name], ROUND, true);
  console.log(`  ${name.padEnd(22)} kills ${r.kills} of 2 in 180s   first at ${r.firstKill === null ? 'never' : r.firstKill + 's'}   passes made ${r.passes.length}   hits on you ${r.hits}`);
  runs.push(r);
}
console.log('  (this player never aims: it holds Fire and flies its line. A floor, not a forecast.)');

// ------------------------------------------------------------ the rules
console.log('\n— the rules —');
{
  let { page, errors } = await fresh();
  const again = async () => { await page.close(); const f = await fresh(); page = f.page; f.errors.forEach(e => errors.push(e)); errors = f.errors.concat(errors); };
  const counts = await page.evaluate(() => window.__t('[1,2,3,4,5,7,8,12].map(icCount).join(",")'));
  check(counts === '0,0,1,1,2,2,3,3', 'none before round 3, one in 3-4, two from 5, three from 8, never more', `rounds 1,2,3,4,5,7,8,12 give ${counts}`);

  await again();
  const hp = await page.evaluate(() => window.__t(`
    startRound(6); M.quiet(); damage = function () {}; M.step(200);
    var ic = ics[0], n = 0; while (ic.alive && n < 9) { hitInterceptor(ic, 1 * dmgMul(), ic.pos); n++; } n`));
  check(hp === 3, 'three hits at base damage brings one down', `took ${hp}`);

  await again();
  const pick = await page.evaluate(() => window.__t(`
    startRound(6); damage = function () {}; M.step(140);
    var d = drones[0]; d.alive = true; d.mesh.position.copy(shipPos).addScaledVector(fwdV, 60);
    ics[1].pos.copy(shipPos).addScaledVector(fwdV, 150).addScaledVector(rightV, 12);
    pickTarget(shipPos, fwdV, 0.914, 260, 0.04)`));
  check(pick === 4, 'tracking takes an interceptor over a nearer, better-centred drone', `picked kind ${pick} (4 is an interceptor, 1 a drone)`);

  await again();
  const leave = await page.evaluate(() => window.__t(`
    startRound(6); M.quiet(); damage = function () {}; M.step(200);
    var before = ics.filter(function (c) { return c.alive; }).length;
    var d0 = ics[0].pos.distanceTo(shipPos) + ics[1].pos.distanceTo(shipPos);
    checkRound();
    var modes = ics.filter(function (c) { return c.alive; }).map(function (c) { return c.mode; }).join('');
    M.step(60);   // two seconds: the upgrade cards come up at 2.4 and stop the clock
    var d1 = ics[0].pos.distanceTo(shipPos) + ics[1].pos.distanceTo(shipPos);
    startRound(2);
    JSON.stringify({ before: before, live: roundLive, modes: modes, further: Math.round(d1 - d0), after: ics.filter(function (c) { return c.alive; }).length })`)).then(JSON.parse);
  check(leave.before === 2 && leave.modes === '33' && leave.further > 60 && leave.after === 0,
    'the round clears with them still flying; they turn for home, and none carries into the next round', JSON.stringify(leave));

  await again();
  // Markers: put one at a known place relative to the camera and read where its marker went.
  const marks = await page.evaluate(() => window.__t(`
    startRound(6); M.quiet(); damage = function () {}; M.step(140);
    var out = {}, w = innerWidth, h = innerHeight;
    function at(name, x, y, z) {
      ics[0].pos.copy(new THREE.Vector3(x, y, z).applyQuaternion(camera.quaternion).add(camera.position));
      updateIcMarkers();
      var m = /translate\\(([-\\d.]+)px, ?([-\\d.]+)px\\) rotate\\(([-\\d.]+)rad\\)/.exec(ics[0].mark.style.transform);
      out[name] = { x: +m[1], y: +m[2], rot: +m[3], lock: /lock/.test(ics[0].mark.className), shown: ics[0].mark.style.display };
    }
    at('ahead', 0, 0, -100); at('right', 100, 0, -10); at('left', -100, 0, -10); at('above', 0, 100, -10); at('astern', 3, -1, 100);
    out.w = w; out.h = h; JSON.stringify(out)`)).then(JSON.parse);
  const m = marks, why = JSON.stringify(marks);
  check(m.ahead.lock && Math.abs(m.ahead.x - m.w / 2) < 2 && Math.abs(m.ahead.y - m.h / 2) < 2, 'dead ahead: a diamond on the middle of the screen', why);
  check(!m.right.lock && m.right.x > m.w - 30 && m.right.x <= m.w && Math.abs(m.right.rot - Math.PI / 2) < 0.2, 'off to the right: an arrow at the right edge, pointing right', why);
  check(!m.left.lock && m.left.x < 30 && m.left.x >= 0 && Math.abs(m.left.rot + Math.PI / 2) < 0.2, 'off to the left: an arrow at the left edge, pointing left', why);
  check(!m.above.lock && m.above.y < m.h / 2 && m.above.y >= 100 && Math.abs(m.above.rot) < 0.2, 'overhead: an arrow at the top, below the bars, pointing up', why);
  check(!m.astern.lock && m.astern.x >= 0 && m.astern.x <= m.w && m.astern.y >= 0 && m.astern.y <= m.h, 'behind you: still an arrow, and still on the screen', why);
  check(errors.length === 0, 'nothing threw while checking the rules', errors);
  await page.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
