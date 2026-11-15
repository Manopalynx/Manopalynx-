// The score in docs/dusk/.
//
// Sam's rulings: every unit destroyed gives points; kills in a row count up in a tally which, "after a few seconds
// with no points", is added to the total; dying ends the run, so the score starts again; the best is kept on the phone.
// The points, the multiplier (a step every three kills of a chain, to five times), three seconds to bank and a tally
// lost with the ship are a session's fills, his to strike.
//
// Steps the real game by hand at 30 ticks a second with drawing off, on a temp copy with one line added.
//
//   node test/dusk-score.mjs

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

async function open(vp = { width: 393, height: 852 }) {
  const page = await browser.newPage({ viewport: vp });
  page.on('pageerror', e => errorsSeen.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  return page;
}
const PRE = `
  renderer.render = function () {}; chapterHold = 0; scaleHold = 1; wxHold = 'clear'; muted = true;
  window.M = { now: performance.now() };
  M.step = function (n) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); } };
  // a round with a decoy gun far off so nothing here ends it, and the hull held
  M.scene = function (round) { startRound(round || 6); damage = function () {}; };
  M.drone = function () { for (var i = 0; i < drones.length; i++) if (drones[i].alive) { killDrone(drones[i]); return; } };
  M.gun = function () { for (var i = 0; i < ground.length; i++) if (ground[i].alive) { hitGround(ground[i], 99, ground[i].pos); return; } };
  M.s = function () { return { score: score, tally: tally, k: scoreK(), n: scoreN.textContent, t: scoreT.textContent, pop: popN.textContent, on: popEl.classList.contains('on'), each: [].map.call(popEach, function (e) { return e.textContent; }).join(' ') }; };
  M.step(3);`;
const J = s => `JSON.stringify((function () { ${s} })())`;
async function run(code, keep) {
  const page = await open();
  await page.mouse.click(196, 426);
  const out = JSON.parse(await page.evaluate(c => window.__t(c), PRE + J(code)));
  if (!keep) await page.close();
  return keep ? { out, page } : out;
}

// ------------------------------------------------------------ what each thing is worth
const worth = await run(`
  M.scene(6); var o = {}, t0;
  function one(name, f) { t0 = tally; f(); o[name] = tally - t0; bankScore(); }
  one('drone', M.drone); one('ground', M.gun);
  one('interceptor', function () { M.step(200); var ic = ics.filter(function (c) { return c.alive; })[0]; hitInterceptor(ic, 99, ic.pos); });
  var f = fleet[0];
  one('turret', function () { var t = f.turrets[0]; hitTurret(f, t, 99, t.local); });
  one('capital', function () { f.turrets.forEach(function (t) { t.hp = 1; }); hitCapital(f, f.hp + 1); });
  M.scene(5); var b = bossF, d0 = drones.filter(function (d) { return d.alive; }).length;
  one('generator', function () { hitGenerator(b, b.gen.hp + 1, b.ship.position); });
  one('boss', function () { b.shield = 0; hitCapital(b, b.hp + 1); });
  o.escort = d0; o.escortLeft = drones.filter(function (d) { return d.alive; }).length;
  bossForce = 'wall'; M.scene(10); one('section', function () { var sec = wallSecs.filter(function (x) { return !x.down; })[0]; hitCrack(sec, sec.hp + 1); });
  bossForce = 'walker'; M.scene(15); one('knee', function () { var lg = walker.legs[0]; hitKnee(lg, lg.hp + 1, lg.kneeAt); });
  return o;
`).catch(e => ({ error: e.message.split('\n')[0] }));
check(!worth.error, 'every kind of kill could be made', worth.error);
check(worth.drone === 10 && worth.ground === 15 && worth.turret === 20 && worth.interceptor === 25, 'a drone 10, a gun or launcher on the ground 15, a turret 20, an interceptor 25', JSON.stringify(worth));
check(worth.capital === 100 && worth.generator === 200 && worth.boss === 1000, 'a capital ship 100, the shield generator 200, the dreadnought 1000', JSON.stringify(worth));
check(worth.section === 250 && worth.knee === 50, 'a section of the ice wall 250, a knee of the walker 50', JSON.stringify(worth));
check(worth.escort === 6 && worth.escortLeft === 0, 'the dreadnought\'s escort, going down with it, is worth nothing: 1000 is the whole of that blow', JSON.stringify(worth));

// ------------------------------------------------------------ the chain and the bank
const chain = await run(`
  M.scene(9); var o = { seq: [] };
  for (var i = 0; i < 16; i++) { var t0 = tally; M.drone(); o.seq.push(tally - t0); }
  o.tally = tally; o.shown = M.s();
  M.step(87); o.at29 = M.s();          // 2.9 seconds on
  M.step(6); o.at31 = M.s();           // 3.1
  M.drone(); o.after = tally;
  return o;
`);
check(chain.seq.join(',') === '10,10,10,20,20,20,30,30,30,40,40,40,50,50,50,50', 'a chain is worth more every three kills, to five times and no further', chain.seq.join(','));
check(chain.at29.score === 0 && chain.at29.tally === chain.tally, 'the tally is still counting 2.9 seconds after the last kill', JSON.stringify(chain.at29));
check(chain.at31.score === chain.tally && chain.at31.tally === 0, `and is added to the score by 3.1  [${chain.tally}]`, JSON.stringify(chain.at31));
check(chain.after === 10, 'the next kill starts a new chain at once times', `worth ${chain.after}`);
check(chain.tally === chain.seq.reduce((a, b) => a + b, 0) && chain.shown.n === '0' && chain.shown.pop === `+${chain.tally} ×5` && chain.shown.on, 'the tally shows in the middle of the screen with its multiplier while it counts', JSON.stringify(chain.shown));
// Sam: "when you defeat an enemy the points flashes on the screen like in call of duty ... where you can see it add up"
check(chain.shown.each === '+50 +50 +50 +50', 'each kill\'s own points flash by it: the last four here were 50 apiece', chain.shown.each);
check(chain.at31.n === String(chain.tally) && !chain.at31.on && chain.at31.pop === `+${chain.tally} ×5`, 'banked, the score takes it and the tally is let fade, still reading what it reached', JSON.stringify(chain.at31));

const keepUp = await run(`
  M.scene(9); var o = {};
  M.drone(); M.step(60); M.drone(); M.step(60); o.at4 = M.s();   // kills at 0 and 2 seconds; now 4
  M.step(36); o.at52 = M.s();
  return o;
`);
check(keepUp.at4.score === 0 && keepUp.at4.tally === 20 && keepUp.at52.score === 20, 'a kill inside the three seconds keeps the tally open: banked three seconds after the last, not the first', JSON.stringify(keepUp));

const frozen = await run(`
  M.scene(9); M.drone(); M.step(30); picking = true; M.step(300); var o = { during: M.s() }; picking = false; M.step(55); o.at28 = M.s(); M.step(10); o.after = M.s();
  return o;
`);
check(frozen.during.tally === 10 && frozen.at28.tally === 10 && frozen.after.score === 10, 'the upgrade screen stops the clock on the tally too', JSON.stringify(frozen));

// ------------------------------------------------------------ dying, and the best
{
  const { out: d, page } = await run(`
    M.scene(9); var o = {};
    M.drone(); M.drone(); bankScore(); o.banked = score;
    M.drone(); o.pending = tally;
    damage = function () {}; die(); o.dead = M.s(); o.note = noteEl.textContent; o.best = bestScore; o.stored = localStorage.getItem('small-world-best-score');
    respawn(); o.again = M.s(); o.bestAgain = bestScore;
    startRound(9); M.drone(); bankScore(); die(); o.best2 = bestScore; o.stored2 = localStorage.getItem('small-world-best-score');
    return o;
  `, true);
  check(d.banked === 20 && d.pending === 10 && d.dead.score === 20 && d.dead.tally === 0 && !d.dead.on, 'the tally not yet banked is lost with the ship; what was banked stands', JSON.stringify(d));
  check(d.best === 20 && d.stored === '20' && /Score 20\./.test(d.note) && d.dead.t === 'Best 20', 'the best is kept, and the screen says the score and the best', JSON.stringify(d));
  check(d.again.score === 0 && d.again.tally === 0 && d.again.n === '0' && d.bestAgain === 20, 'flying again starts from nothing, the best still held', JSON.stringify(d));
  check(d.best2 === 20 && d.stored2 === '20', 'a worse run does not lower the best', JSON.stringify(d));
  await page.reload({ waitUntil: 'load' });
  const first = await page.evaluate(() => window.__t(`JSON.stringify({ best: bestScore, n: scoreN.textContent, t: scoreT.textContent })`)).then(JSON.parse);
  check(first.best === 20 && first.n === 'Best 20', 'opened again, the first screen shows the best', JSON.stringify(first));
  await page.close();
}
const none = await run(`inControl = false; var t0 = tally; addScore('drone'); return { d: tally - t0, n: (paintScore(), scoreN.textContent) };`);
check(none.d === 0 && none.n === '', 'nothing is scored before the ship is taken, and with no best yet the first screen shows nothing', JSON.stringify(none));

// ------------------------------------------------------------ where it sits, both ways up
for (const [name, vp] of [['portrait', { width: 393, height: 852 }], ['landscape', { width: 852, height: 393 }], ['SE on its side', { width: 667, height: 375 }]]) {
  const page = await open(vp);
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.evaluate(c => window.__t(c), PRE + `startRound(9); score = 1234567; chain = 14; tally = 98760; paintScore(); warnEl.style.display = 'block'; shieldBar.style.display = 'block'; 0`);
  const r = await page.evaluate(() => {
    const box = id => { const b = document.getElementById(id).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const s = box('score'), p = box('popN'), others = ['warn', 'hull', 'shieldBar', 'readout', 'sam', 'snd', 'fire', 'cross'].filter(id => document.getElementById(id)).map(id => [id, box(id)]);
    const inside = b => b.l >= 0 && b.t >= 0 && b.r <= innerWidth && b.b <= innerHeight;
    return { s, p, on: inside(s) && inside(p) && p.r > p.l, over: others.filter(([id, b]) => hit(s, b) || hit(p, b)).concat(hit(s, p) ? [['each other']] : []).map(([id]) => id), text: document.getElementById('score').textContent + ' / ' + document.getElementById('popN').textContent };
  });
  check(r.on && r.over.length === 0, `${name}: a seven-figure score, and a five-figure tally under the crosshair, fit over nothing else on the screen  [${r.text}]`, JSON.stringify(r));
  await page.close();
}

check(errorsSeen.length === 0, 'nothing threw', errorsSeen.slice(0, 5));
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
