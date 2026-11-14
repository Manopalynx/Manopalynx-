// The dreadnought in docs/dusk/: every fifth round is one large ship, alone, harder each time.
//
// Asserts Sam's rulings and measures how long the fight takes. Like dusk-intercept.mjs it steps the real game
// by hand at 30 ticks a second with drawing off, on a temp copy with one line added. The fight figures come
// from a stand-in that flies at the nearest turret holding Fire: they bound the fight, they do not describe his.
//
//   node test/dusk-boss.mjs

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
async function fresh() {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', e => allErrors.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  await page.evaluate(() => window.__t(`
    renderer.render = function () {};
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    M.census = function () {
      var live = fleet.filter(function (f) { return f.gone <= 0 && f.dying === 0; });
      return { ships: live.filter(function (f) { return !f.boss; }).length, boss: live.filter(function (f) { return f.boss; }).length,
        drones: drones.filter(function (d) { return d.alive; }).length, ground: ground.filter(function (g) { return g.alive; }).length,
        left: remaining(), readout: readoutEl.textContent, sent: icWant };
    };
    M.step(3); inControl`));
  return page;
}
const run = async code => { const page = await fresh(); const r = await page.evaluate(c => window.__t(c), code); await page.close(); return JSON.parse(r); };

console.log('\n— which rounds —');
{
  const c = await run(`var o = {}; [4, 5, 6, 10, 11, 15].forEach(function (n) { startRound(n); o[n] = M.census(); }); o.first = fleet[0].boss === true; JSON.stringify(o)`);
  for (const n of [5, 10, 15]) check(c[n].boss === 1 && c[n].ships === 0 && c[n].drones === 0 && c[n].ground === 0 && c[n].left === 1,
    `round ${n} is the dreadnought alone  [${c[n].readout.replace(/Round \d+/, '').trim()}]`, JSON.stringify(c[n]));
  for (const n of [4, 6, 11]) check(c[n].boss === 0 && c[n].ships === n && c[n].drones === 5 * n && c[n].ground === 5 * n,
    `round ${n} is an ordinary round: ${n} ships, ${5 * n} drones, ${5 * n} ground  [${c[n].readout.replace(/Round \d+/, '').trim()}]`, JSON.stringify(c[n]));
  check(/Dreadnought 100%/.test(c[5].readout), 'the readout shows its hull, not a count', c[5].readout);
  check(c[5].sent === 2 && c[10].sent === 3 && c[15].sent === 3, 'it brings interceptors on the usual count  [2 at round 5, 3 at 10 and 15]', `${c[5].sent}, ${c[10].sent}, ${c[15].sent}`);
  check(c.first === false, 'the first ship in the fleet is still an ordinary one (the shuttles fly to it)', 'fleet[0] is the dreadnought');
}

console.log('\n— harder each time —');
{
  // Everything is read off the live ship after the round starts, not off the table that set it.
  const t = await run(`var o = [];
    function blow(f) { var t = f.turrets.filter(function (x) { return x.hp > 0; })[0], n = 0, hp0 = f.hp; while (t.hp > 0 && n < 99) { hitTurret(f, t, 1 * dmgMul(), t.local); n++; } return { hits: n, hullLost: hp0 - f.hp }; }
    startRound(4); var ord = blow(fleet[0]);
    [5, 10, 15, 20, 40].forEach(function (n) { startRound(n); var f = bossF, live = f.turrets.filter(function (x) { return x.hp > 0; }).length, hull = f.hp, b = blow(f);
      o.push({ round: n, hull: hull, turrets: live, hits: b.hits, lost: b.hullLost, gap: f.fireK, scale: f.scale }); });
    var sz = fleet.filter(function (f) { return !f.boss; }).map(function (f) { return f.scale; }).sort();
    JSON.stringify({ ord: ord, tiers: o, sizes: sz[0] + ' to ' + sz[sz.length - 1], typical: sz[Math.floor(sz.length / 2)] })`);
  console.log('  round   hull   turrets   hits to blow one   hull lost when one goes   gap between its shots');
  for (const r of t.tiers) console.log(`  ${String(r.round).padStart(5)}  ${String(r.hull).padStart(5)}   ${String(r.turrets).padStart(7)}   ${String(r.hits).padStart(16)}   ${String(r.lost).padStart(23)}   ${('×' + r.gap.toFixed(2)).padStart(21)}`);
  console.log(`  (an ordinary ship's turret: ${t.ord.hits} hits)`);
  const up = k => t.tiers.every((r, i) => i === 0 || r[k] >= t.tiers[i - 1][k]), strictly = k => t.tiers[1][k] > t.tiers[0][k] && t.tiers[2][k] > t.tiers[1][k];
  check(up('hull') && strictly('hull'), 'more hull each time', t.tiers.map(r => r.hull).join(', '));
  check(up('hits') && strictly('hits') && t.tiers[0].hits > t.ord.hits, `its turrets take more hits each time, and more than an ordinary turret from the first  [${t.tiers.map(r => r.hits).join(', ')} against ${t.ord.hits}]`, JSON.stringify(t));
  check(t.tiers.every((r, i) => i === 0 || r.gap <= t.tiers[i - 1].gap) && t.tiers[1].gap < t.tiers[0].gap && t.tiers[0].gap <= 1, 'its guns fire faster each time it comes back, starting from an ordinary turret\'s rate', t.tiers.map(r => r.gap).join(', '));
  check(t.tiers.every(r => r.turrets <= 7 && r.turrets >= 5) && t.tiers[1].turrets > t.tiers[0].turrets, 'more turrets each time, up to the seven it has mounts for', t.tiers.map(r => r.turrets).join(', '));
  check(t.tiers.every(r => r.scale >= 2 * t.typical), `at least double the size of a typical ship  [${t.tiers[0].scale} against ${t.sizes}]`, t.tiers.map(r => r.scale).join(', '));
}

console.log('\n— same rules as any capital ship —');
{
  const m = await run(`startRound(15); var f = bossF, out = [];
    f.turrets.forEach(function (t, i) { var up = t.local.y > 0 ? 1 : -1, on = t.local.clone(); on.y -= up * 1.6; out.push({ i: i, outside: !inHull(t.local), seated: inHull(on) }); });
    JSON.stringify(out)`);
  check(m.length === 7 && m.every(t => t.outside && t.seated), 'all seven turret mounts sit on the hull: none buried in it, none floating off it', m.filter(t => !(t.outside && t.seated)).map(t => JSON.stringify(t)));

  const k = await run(`startRound(5); M.step(160); var f = bossF, ic0 = ics.filter(function (c) { return c.alive; }).length;
    hitCapital(f, f.hp + 1);
    var r = { ic0: ic0, live: roundLive, dying: f.dying > 0, icModes: ics.filter(function (c) { return c.alive; }).map(function (c) { return c.mode; }).join(''), note: noteEl.textContent };
    startRound(6); r.next = M.census(); JSON.stringify(r)`);
  check(!k.live && k.dying && /cleared/.test(k.note), 'sinking it clears the round', JSON.stringify(k));
  check(k.ic0 === 2 && k.icModes === '33', 'and its interceptors turn for home', JSON.stringify(k));
  check(k.next.boss === 0 && k.next.ships === 6, 'the round after is ordinary again, with the ship count carrying on  [6 ships]', JSON.stringify(k.next));
}

// ------------------------------------------------------------ the fight
// A stand-in that turns and pitches at the nearest live turret (the hull once they are gone) and holds Fire.
// It cannot be killed, so "hull lost" is what the fight costs, counted and not ended by it.
async function fight(round, ups, label) {
  const r = await run(`
    ${ups}
    startRound(${round}); hull = maxHull();
    var R = { lost: 0, hits: 0, secs: null, turretsLeft: 0 }, t0 = time, f = bossF, tp = new THREE.Vector3(), away = false;
    damage = function (n) { R.lost += n; R.hits++; };
    M.step(30 * 300, function () {
      if (!roundLive) { R.secs = +(time - t0).toFixed(1); return false; }
      var tgt = null, bd = 1e9;
      f.turrets.forEach(function (t) { if (t.hp > 0) { t.pivot.getWorldPosition(tp); var d = tp.distanceTo(shipPos); if (d < bd) { bd = d; tgt = tp.clone(); } } });
      if (!tgt) { tgt = f.ship.position.clone(); bd = tgt.distanceTo(shipPos); }
      if (bd < 45) away = true; else if (bd > 170) away = false;      // fly through, out the far side, round again
      if (!away) {
        var dx = tgt.x - shipPos.x, dy = tgt.y - shipPos.y, dz = tgt.z - shipPos.z, flat = Math.sqrt(dx * dx + dz * dz);
        var wy = Math.atan2(-dx, -dz), wp = Math.atan2(dy, flat);
        yaw += Math.max(-1.4 / 30, Math.min(1.4 / 30, Math.atan2(Math.sin(wy - yaw), Math.cos(wy - yaw))));
        pitch += Math.max(-1.0 / 30, Math.min(1.0 / 30, wp - pitch));
      }
      keys.fire = true;
    });
    R.turretsLeft = f.turrets.filter(function (t) { return t.hp > 0; }).length; R.hullLeft = Math.round(f.hp / f.maxHp * 100); R.maxHull = maxHull();
    JSON.stringify(R)`);
  console.log(`  ${label.padEnd(44)} ${r.secs === null ? ('not sunk in 300s, ' + r.hullLeft + '% left').padEnd(22) : (r.secs + 's').padEnd(22)} hit ${String(r.hits).padStart(3)} times, ${String(r.lost).padStart(4)} hull lost (you have ${r.maxHull})`);
  return r;
}
console.log('\n— how long the fight is, and what it costs —');
const KIT4 = 'up.rapid = 1; up.cannons = 1; up.heavy = 1; up.plating = 1;';
const KIT9 = 'up.rapid = 2; up.cannons = 2; up.heavy = 2; up.plating = 2; up.shield = 1;';
const f5a = await fight(5, '', 'round 5, no upgrades at all');
const f5b = await fight(5, KIT4, 'round 5, four upgrades (what you would have)');
const f10 = await fight(10, KIT9, 'round 10, nine upgrades');
check(f5b.secs !== null, 'a player with four upgrades can sink the first one inside five minutes', JSON.stringify(f5b));
check(f5b.secs === null || f5b.secs > 20, 'and it is not over in seconds', JSON.stringify(f5b));
check(f5b.hits > 0, 'it hits back', JSON.stringify(f5b));

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
