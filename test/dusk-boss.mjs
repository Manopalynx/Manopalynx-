// The dreadnought in docs/dusk/: every fifth round is one fortress, alone, harder each time.
//
// Asserts Sam's rulings and measures how long the fight takes. Like dusk-intercept.mjs it steps the real game
// by hand at 30 ticks a second with drawing off, on a temp copy with one line added. The fight figures come
// from a stand-in that flies at the generator and then the hull holding Fire: they bound the fight, they do not describe his.
//
//   node test/dusk-boss.mjs

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
const check = (cond, n, why) => { if (cond) { passed++; console.log(` ok   ${n}`); } else { failed++; console.log(`FAIL  ${n}`); [].concat(why).forEach(w => console.log(`        · ${w}`)); } };

const browser = await chromium.launch();
const allErrors = [];
async function fresh() {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', e => allErrors.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await seedPage(page);   // seeded from before the page loads, and silent: see dusk-seed.mjs
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  await page.evaluate(() => window.__t(`
    renderer.render = function () {};
    chapterHold = 0; scaleHold = 1; wxHold = 'clear'; wxStart(round); // the chapters and the weather vary; these checks are about other things, so hold them: dusk hills, clear
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    M.census = function () {
      var live = fleet.filter(function (f) { return f.gone <= 0 && f.dying === 0; });
      return { ships: live.filter(function (f) { return !f.boss; }).length, boss: live.filter(function (f) { return f.boss; }).length,
        drones: drones.filter(function (d) { return d.alive; }).length, ground: ground.filter(function (g) { return g.alive; }).length,
        left: remaining(), readout: readoutEl.textContent, sent: icWant };
    };
    // this suite is about the dreadnought: chapterHold = 0 below keeps every chapter in the dusk hills, whose boss it is
    M.step(3); inControl`));
  return page;
}
const run = async code => { const page = await fresh(); const r = await page.evaluate(c => window.__t(c), code); await page.close(); return JSON.parse(r); };

console.log('\n— which rounds —');
{
  const c = await run(`var o = {}; [4, 5, 6, 10, 11, 15].forEach(function (n) { startRound(n); o[n] = M.census(); }); o.first = fleet[0].boss === true; JSON.stringify(o)`);
  // It was "the boss alone" until Sam found it too easy: "add units". Its escort is the set amount in set places he
  // asked for of bosses; still no ordinary ships and nothing on the ground.
  for (const n of [5, 10, 15]) check(c[n].boss === 1 && c[n].ships === 0 && c[n].drones === 4 + 2 * (n / 5) && c[n].ground === 0 && c[n].left === 1 + c[n].drones,
    `round ${n} is the dreadnought and its escort of ${4 + 2 * (n / 5)}, nothing else  [${c[n].readout.replace(/Round \d+/, '').trim()}]`, JSON.stringify(c[n]));
  for (const n of [4, 6, 11]) check(c[n].boss === 0 && c[n].ships === n && c[n].drones === 5 * n && c[n].ground === 5 * n,
    `round ${n} is an ordinary round: ${n} ships, ${5 * n} drones, ${5 * n} ground  [${c[n].readout.replace(/Round \d+/, '').trim()}]`, JSON.stringify(c[n]));
  check(/Shield generator 100%/.test(c[5].readout), 'the readout names what stands in the way, not a count', c[5].readout);
  check(c[5].sent === 0 && c[10].sent === 0, 'none fly in from the far fight in a boss round: they come from its bays', `${c[5].sent}, ${c[10].sent}`);
  check(c.first === false, 'the first ship in the fleet is still an ordinary one (the shuttles fly to it)', 'fleet[0] is the dreadnought');
}

console.log('\n— harder each time —');
{
  // Everything is read off the live ship after the round starts, not off the table that set it.
  const t = await run(`var o = [];
    function blow(f) { var t = f.turrets.filter(function (x) { return x.hp > 0; })[0], n = 0; if (f.boss) { f.shield = 0; f.gen.hp = 0; } var hp0 = f.hp; while (t.hp > 0 && n < 99) { hitTurret(f, t, 1 * dmgMul(), t.local); n++; } return { hits: n, hullLost: hp0 - f.hp }; }
    startRound(4); var ord = blow(fleet[0]);
    [5, 10, 15, 20, 40].forEach(function (n) { startRound(n); var f = bossF, live = f.turrets.filter(function (x) { return x.hp > 0 && !x.sam; }).length, sams = f.turrets.filter(function (x) { return x.hp > 0 && x.sam; }).length, esc = drones.filter(function (d) { return d.alive; }).length, hull = f.hp, sh = f.shield, gh = f.gen.hp, b = blow(f);
      o.push({ round: n, hull: hull, turrets: live, sams: sams, esc: esc, hits: b.hits, lost: b.hullLost, gap: f.fireK, shield: sh, gen: gh }); });
    var sz = fleet.filter(function (f) { return !f.boss; }).map(function (f) { return f.scale; }).sort();
    JSON.stringify({ ord: ord, tiers: o, sizes: sz[0] + ' to ' + sz[sz.length - 1], typical: sz[Math.floor(sz.length / 2)] })`);
  console.log('  round   hull   shield   generator hits   turrets   hits to blow one   hull lost when one goes   gap between its shots');
  for (const r of t.tiers) console.log(`  ${String(r.round).padStart(5)}  ${String(r.hull).padStart(5)}   ${String(r.shield).padStart(6)}   ${String(r.gen).padStart(14)}   ${String(r.turrets).padStart(7)}   ${String(r.hits).padStart(16)}   ${String(r.lost).padStart(23)}   ${('×' + r.gap.toFixed(2)).padStart(21)}`);
  console.log(`  (an ordinary ship's turret: ${t.ord.hits} hits)`);
  const up = k => t.tiers.every((r, i) => i === 0 || r[k] >= t.tiers[i - 1][k]), strictly = k => t.tiers[1][k] > t.tiers[0][k] && t.tiers[2][k] > t.tiers[1][k];
  check(up('hull') && strictly('hull'), 'more hull each time', t.tiers.map(r => r.hull).join(', '));
  check(up('hits') && strictly('hits') && t.tiers[0].hits > t.ord.hits, `its turrets take more hits each time, and more than an ordinary turret from the first  [${t.tiers.map(r => r.hits).join(', ')} against ${t.ord.hits}]`, JSON.stringify(t));
  check(t.tiers.every((r, i) => i === 0 || r.gap <= t.tiers[i - 1].gap) && t.tiers[1].gap < t.tiers[0].gap && t.tiers[0].gap <= 1, 'its guns fire faster each time it comes back, starting from an ordinary turret\'s rate', t.tiers.map(r => r.gap).join(', '));
  check(t.tiers.every(r => r.turrets <= 12 && r.turrets >= 4) && t.tiers[1].turrets > t.tiers[0].turrets, 'more gun turrets each time, up to the twelve it has mounts for', t.tiers.map(r => r.turrets).join(', '));
  check(t.tiers.every(r => r.sams === 4), 'four missile launchers, every time it comes', t.tiers.map(r => r.sams).join(', '));
  check(t.tiers[0].esc === 6 && t.tiers[1].esc === 8 && up('esc') && t.tiers.every(r => r.esc <= 14), `an escort of drones, more each time  [${t.tiers.map(r => r.esc).join(', ')}]`, t.tiers.map(r => r.esc).join(', '));
  check(up('shield') && strictly('shield') && up('gen') && strictly('gen'), 'a bigger shield and a tougher generator each time', JSON.stringify(t.tiers));
  check(t.tiers.every(r => Math.abs(r.lost / r.hull - 0.04) < 0.005), 'a turret lost costs it 4% of its hull, at every tier', t.tiers.map(r => (100 * r.lost / r.hull).toFixed(1) + '%').join(', '));
}

console.log('\n— an ordinary ship with no turrets left —');
{
  // Sam: "when all turrets are destroyed the capital ship takes double damage". Ordinary ships only (a boss's turrets rebuild).
  const d = await run(`startRound(4); damage = function () {}; var f = fleet[0], o = { blows: [] }, h;
    h = f.hp; hitCapital(f, 10); o.whole = h - f.hp;
    f.turrets.forEach(function (t, i) { if (i === f.turrets.length - 1) { h = f.hp; hitCapital(f, 10); o.oneLeft = h - f.hp; }
      h = f.hp; while (t.hp > 0) hitTurret(f, t, 1, t.local); o.blows.push(h - f.hp); });
    o.note = noteEl.textContent; h = f.hp; hitCapital(f, 10); o.bare = h - f.hp; o.n = f.turrets.length;
    var f2 = fleet[1]; noteEl.textContent = ''; f2.turrets.forEach(function (t) { while (t.hp > 0) hitTurret(f2, t, 1, t.local); }); o.note2 = noteEl.textContent;
    h = f2.hp; hitCapital(f2, 10); o.bare2 = h - f2.hp;
    startRound(1); startRound(4); var f3 = fleet[0]; noteEl.textContent = ''; f3.turrets.forEach(function (t) { while (t.hp > 0) hitTurret(f3, t, 1, t.local); }); o.note3 = noteEl.textContent;
    startRound(5); var b = bossF; b.shield = 0; b.gen.hp = 0; b.turrets.forEach(function (t) { t.hp = 0; }); h = b.hp; hitCapital(b, 10); o.boss = h - b.hp;
    JSON.stringify(o)`);
  check(d.whole === 10 && d.oneLeft === 10, 'with turrets standing, even one, a hit does what it does', JSON.stringify(d));
  check(d.bare === 20, `with all ${d.n} destroyed it does double  [10 becomes ${d.bare}]`, JSON.stringify(d));
  check(d.blows.every(x => x === 60), 'the last turret\'s own blow is not doubled: 60 off the hull, like the others', d.blows.join(', '));
  check(/double damage/.test(d.note), 'and the screen says so the first time the last one goes', d.note);
  // Sam: only "for the first capital ship the player destroys all turrets ... but no more the rest of the game"
  check(d.bare2 === 20 && !/double damage/.test(d.note2) && !/double damage/.test(d.note3), 'the second ship disarmed takes double too, and the screen says nothing; nor after starting again from round 1', JSON.stringify({ note2: d.note2, note3: d.note3, bare2: d.bare2 }));
  check(d.boss === 10, 'the dreadnought with every turret down takes no more than before', `10 did ${d.boss}`);
}

console.log('\n— what makes it a dreadnought —');
{
  // The mounts: each sits outside the hull and against it, and between them they face every way.
  const m = await run(`startRound(20); var f = bossF, out = [], c = new THREE.Vector3();
    f.turrets.forEach(function (t, i) { var inw = t.local.clone().addScaledVector(t.nrm, -6);   // six back along the way the mount faces: that should be inside the hull
      out.push({ i: i, outside: !f.inHull(t.local), seated: f.inHull(inw), x: Math.round(t.local.x), y: Math.round(t.local.y - BOSS_RING_Y), z: Math.round(t.local.z) }); });
    JSON.stringify(out)`);
  check(m.length === 16 && m.every(t => t.outside && t.seated), 'all sixteen mounts, twelve guns and four launchers, sit on the hull: none buried in it, none floating off it', m.filter(t => !(t.outside && t.seated)).map(t => JSON.stringify(t)));
  const sides = { above: m.some(t => t.y > 2), below: m.some(t => t.y < -2), xp: m.some(t => t.x > 30), xn: m.some(t => t.x < -30), zp: m.some(t => t.z > 30), zn: m.some(t => t.z < -30) };
  check(Object.values(sides).every(Boolean), 'and between them they cover above, below and all four sides', JSON.stringify(sides));

  // CAN THE CORE BE HIT. dreadnought-2 passed every check here while the ring stood between the guns and the
  // generator: nothing fired a bolt at it and counted what arrived. From 150 out, 160 bolts a row, aimed at the core
  // with a person's scatter, from every side.
  const los = await run(`var out = {};
    [-40, -22, -8, 0, 8, 15, 30].forEach(function (elev) {
      startRound(5); damage = function () {}; bossF.launchT = 1e9;
      var f = bossF, gen = 0, n = 0, hg = hitGenerator, hc = hitCapital, ht = hitTurret;
      hitGenerator = function () { gen++; }; hitCapital = function () {}; hitTurret = function () {};
      for (var k = 0; k < 16; k++) { M.step(1);
        for (var q = 0; q < 10; q++) {
          var az = (k * 10 + q) / 160 * 6.283, e = elev * Math.PI / 180, c = f.ship.position;
          var from = new THREE.Vector3(c.x + Math.cos(az) * Math.cos(e) * 150, c.y + Math.sin(e) * 150, c.z + Math.sin(az) * Math.cos(e) * 150);
          var dir = c.clone().sub(from).normalize(); dir.x += (Math.random() - 0.5) * 0.05; dir.y += (Math.random() - 0.5) * 0.05; dir.z += (Math.random() - 0.5) * 0.05; dir.normalize();
          trk.k = 0; launchBolt(from, dir); n++; }
        for (var w = 0; w < 30; w++) updateBolts(1 / 30); }
      hitGenerator = hg; hitCapital = hc; hitTurret = ht; out[elev] = Math.round(100 * gen / n);
    });
    out.ring = bossF.gen.ring.visible; JSON.stringify(out)`);
  console.log('  bolts aimed at the core that reach it, by how far above or below level you come in:');
  console.log('  ' + [-40, -22, -8, 0, 8, 15, 30].map(e => `${e > 0 ? '+' : ''}${e}°: ${los[e]}%`).join('   '));
  check(los[0] >= 90 && los[8] >= 90 && los[15] >= 90 && los[30] >= 90, `from level and from above, at least nine bolts in ten aimed at the core reach the generator  [level ${los[0]}%]`, JSON.stringify(los));
  check(los.ring, 'the generator wears its health ring from the start, before it has been hit', JSON.stringify(los));

  // The shield, and the generator that feeds it.
  const sh = await run(`startRound(5); damage = function () {}; var f = bossF, o = {};
    hitCapital(f, 300); o.hullAfterHit = f.hp === f.maxHp; o.shieldDown = Math.round(f.shieldMax - f.shield);
    M.step(120); o.refilled = f.shield === f.shieldMax;
    var n = 0; o.genWas = f.gen.hp; while (f.gen.hp > 0 && n < 9999) { hitGenerator(f, 1 * dmgMul(), f.ship.position); n++; } o.genHits = n; o.readout = readoutEl.textContent; M.step(2); o.ringGone = !f.gen.ring.visible;
    o.shieldGone = f.shield === 0; M.step(2); o.shellHidden = !f.shell.visible && !f.net.visible;
    hitCapital(f, 50); o.through = f.maxHp - f.hp;
    M.step(300); o.stayedDown = f.shield === 0 && f.gen.hp === 0 && !f.shell.visible;
    // with the core gone, is the upper half still joined to the lower? walk the centre line and look for a gap in the hull
    o.gap = 0; for (var y = -47; y <= 47; y += 0.5) if (!f.inHull(new THREE.Vector3(0, y, 0))) o.gap++;
    JSON.stringify(o)`);
  check(sh.hullAfterHit && sh.shieldDown === 300, 'the shield takes the hit and the hull is untouched', JSON.stringify(sh));
  check(sh.refilled, 'while the generator lives the shield refills', JSON.stringify(sh));
  check(sh.ringGone && sh.genHits === sh.genWas && sh.genHits >= 100 && /Dreadnought 100%/.test(sh.readout), `the generator can be destroyed  [${sh.genHits} hits at base damage], and the readout turns to the hull`, JSON.stringify(sh));
  check(sh.shieldGone && sh.shellHidden, 'the shield falls the moment the generator does, and is gone from the screen', JSON.stringify(sh));
  check(sh.through === 50 && sh.stayedDown, 'the next hit lands on the hull in full, and the shield never comes back', JSON.stringify(sh));
  check(sh.gap === 0, 'with the core gone the two halves of the spindle are still joined: no gap anywhere down its centre line', `${sh.gap} half-unit steps of open air`);

  const rg = await run(`startRound(5); damage = function () {}; var f = bossF, o = [];
    function lit() { return f.gen.segs.filter(function (s) { return s.material.color.getHex() === 0x9dff6a; }).length; }
    o.push(lit()); [0.25, 0.5, 0.75, 0.95].forEach(function (k) { hitGenerator(f, f.gen.maxHp * k - (f.gen.maxHp - f.gen.hp), f.ship.position); o.push(lit()); });
    JSON.stringify(o)`);
  check(rg.join(',') === '5,4,3,2,1', `its ring loses a segment for each fifth shot away  [lit: ${rg.join(', ')} at 0, 25, 50, 75, 95% damage]`, rg.join(','));

  // Turrets can be shot through the shield, and come back after ten seconds.
  const tr = await run(`startRound(5); damage = function () {}; var f = bossF, t = f.turrets[0], n = 0, o = {};
    o.shieldUp = f.shield === f.shieldMax;
    while (t.hp > 0 && n < 99) { hitTurret(f, t, 1, t.local); n++; } o.hits = n; o.gone = !t.pivot.visible;
    M.step(30 * 9); o.at9 = t.hp; M.step(45); o.at10 = t.hp; o.back = t.pivot.visible; o.bare = f.turrets.filter(function (x) { return !x.fitted; }).length;
    M.step(30 * 30); o.bareStill = f.turrets.filter(function (x) { return !x.fitted && x.hp > 0; }).length;
    JSON.stringify(o)`);
  check(tr.shieldUp && tr.hits === 8 && tr.gone, 'a turret can be destroyed while the shield is up  [8 hits]', JSON.stringify(tr));
  check(tr.at9 === 0 && tr.at10 === 8 && tr.back, 'and is back, whole, ten seconds later: not at nine', JSON.stringify(tr));
  check(tr.bare === 8 && tr.bareStill === 0, 'a gun mount this tier does not carry stays bare', JSON.stringify(tr));

  // The bays.
  const by = await run(`startRound(5); damage = function () {}; var o = { n: [] }, last = 0, t0 = time, f = bossF;
    M.step(30 * 100, function () { var n = ics.filter(function (c) { return c.alive; }).length; if (n !== last) { o.n.push([+(time - t0).toFixed(0), n]); last = n; } });
    o.maxUp = Math.max.apply(null, o.n.map(function (x) { return x[1]; }));
    var c = f.ship.position; o.clear = ics.filter(function (x) { return x.alive; }).every(function (x) { return !f.inHull(f.ship.worldToLocal(x.pos.clone())); });
    JSON.stringify(o)`);
  const at = by.n.map(x => x[0]), up = by.n.map(x => x[1]);
  // Sam: "have 6 interceptors come out at a time". Three pairs, 0.7 seconds apart: all six up within two seconds of the first.
  check(up[0] === 2 && at[0] === 6 && by.n.some(x => x[1] === 6 && x[0] - at[0] <= 2),
    `six interceptors leave its bays together, the first launch six seconds in  [flying: ${by.n.map(x => x[1] + ' at ' + x[0] + 's').join(', ')}]`, JSON.stringify(by));
  check(by.maxUp === 6, 'and never more than six are flying, however long they are left alone', JSON.stringify(by));

  // The escort: posted evenly on a ring round it, alternately above and below, clear of its hull; gone the moment it sinks.
  const es = await run(`startRound(5); damage = function () {}; M.step(30); var f = bossF, o = {};
    var live = drones.filter(function (d) { return d.alive; });
    o.n = live.length; o.r = live.map(function (d) { return Math.round(Math.hypot(d.c.x - f.ship.position.x, d.c.z - f.ship.position.z)); });
    o.dy = live.map(function (d) { return Math.round(d.c.y - f.ship.position.y); });
    o.ang = live.map(function (d) { return Math.round(Math.atan2(d.c.z, d.c.x) * 180 / Math.PI); });
    o.clear = live.every(function (d) { return !f.inHull(f.ship.worldToLocal(d.mesh.position.clone())); });
    o.aboveGround = live.every(function (d) { return d.mesh.position.y > Math.max(height(d.mesh.position.x, d.mesh.position.z), 0) + 10; });
    f.shield = 0; f.gen.hp = 0; hitCapital(f, f.hp + 1); o.after = drones.filter(function (d) { return d.alive; }).length;
    JSON.stringify(o)`);
  const gaps = es.ang.slice().sort((a, b) => a - b).map((a, i, arr) => i ? a - arr[i - 1] : null).slice(1);
  check(es.n === 6 && es.r.every(r => Math.abs(r - 95) <= 2) && gaps.every(g => Math.abs(g - 60) <= 2), `its escort is posted evenly on a ring 95 out  [${es.r.join(', ')}; ${gaps.join(', ')} degrees apart]`, JSON.stringify(es));
  check(es.dy.filter(y => y > 0).length === 3 && es.dy.filter(y => y < 0).length === 3 && es.clear && es.aboveGround, `three above its ring and three below, clear of its hull and of the ground  [${es.dy.join(', ')}]`, JSON.stringify(es));
  check(es.after === 0, 'and goes down with it: none left to hunt', `left ${es.after}`);

  // The launchers: they fire missiles, not shots; one shot away fires nothing until it is rebuilt.
  const ms = await run(`startRound(5); damage = function () {}; var f = bossF, o = { n: 0, from: [] }, lm = launchMissileFrom;
    var sams = f.turrets.filter(function (t) { return t.sam && t.fitted; }), w = new THREE.Vector3();
    launchMissileFrom = function (at) { o.n++; var best = -1, bd = 1e9; sams.forEach(function (t, i) { t.pivot.getWorldPosition(w); var d = w.distanceTo(at); if (d < bd) { bd = d; best = i; } }); o.from.push(best); o.far = Math.max(o.far || 0, bd); lm(at); };
    shipPos.set(0, f.ship.position.y, 150); bossF.launchT = 1e9;
    M.step(30 * 30, function () { shipPos.set(0, f.ship.position.y, 150); });
    o.in30 = o.n; o.each = [0, 1, 2, 3].map(function (i) { return o.from.filter(function (x) { return x === i; }).length; });
    var t = sams[0]; while (t.hp > 0) hitTurret(f, t, 1, t.local);
    o.from = []; M.step(30 * 9, function () { shipPos.set(0, f.ship.position.y, 150); }); o.deadFired = o.from.filter(function (x) { return x === 0; }).length;
    M.step(30 * 12, function () { shipPos.set(0, f.ship.position.y, 150); }); o.backFired = o.from.filter(function (x) { return x === 0; }).length; o.back = t.hp > 0;
    o.lamp = t.lamp.material.color.getHex() === 0xff4a3a;
    JSON.stringify(o)`);
  check(ms.in30 >= 12 && ms.in30 <= 24 && ms.each.every(n => n >= 2) && ms.far < 1, `its four launchers each fire missiles: ${ms.in30} in 30 seconds  [${ms.each.join(', ')}]`, JSON.stringify(ms));
  check(ms.deadFired === 0 && ms.back && ms.backFired >= 1, 'a launcher shot away fires nothing for nine seconds, and is back and firing after ten', JSON.stringify(ms));
  check(ms.lamp, 'a launcher wears a red lamp, as a missile site does, and keeps it after it has flashed', JSON.stringify(ms));

  const k = await run(`startRound(5); damage = function () {}; M.step(300); var f = bossF, ic0 = ics.filter(function (c) { return c.alive; }).length;
    f.shield = 0; f.gen.hp = 0; hitCapital(f, f.hp + 1);
    var r = { ic0: ic0, live: roundLive, dying: f.dying > 0, icModes: ics.filter(function (c) { return c.alive; }).map(function (c) { return c.mode; }).join(''), note: noteEl.textContent };
    var t = f.turrets[0]; t.hp = 0; t.back = 0.1; M.step(30); r.noRebuild = t.hp === 0;
    startRound(6); r.next = M.census(); r.icNext = icWant; JSON.stringify(r)`);
  check(!k.live && k.dying && /cleared/.test(k.note), 'sinking it clears the round', JSON.stringify(k));
  check(k.ic0 === 6 && k.icModes === '333333' && k.noRebuild, 'its interceptors turn for home, and nothing rebuilds on a sinking ship', JSON.stringify(k));
  check(k.next.boss === 0 && k.next.ships === 6 && k.icNext === 2, 'the round after is ordinary again: 6 ships, and interceptors from the far fight as before', JSON.stringify(k.next));
}

// ------------------------------------------------------------ the fight
// A stand-in that turns and pitches at the nearest live turret (the hull once they are gone) and holds Fire.
// It cannot be killed, so "hull lost" is what the fight costs, counted and not ended by it.
async function fight(round, ups, label) {
  const r = await run(`
    ${ups}
    startRound(${round}); hull = maxHull();
    var R = { lost: 0, hits: 0, secs: null, turretsLeft: 0 }, t0 = time, f = bossF, tp = new THREE.Vector3(), away = false;
    R.by = { ram: 0, interceptors: 0, turrets: 0 };
    damage = function (n) { R.lost += n; R.hits++; R.by[n === 15 ? 'ram' : n === 10 ? 'interceptors' : 'turrets'] += n; };   // told apart by what each one does: 15, 10, 8
    M.step(30 * 300, function () {
      if (!roundLive) { R.secs = +(time - t0).toFixed(1); return false; }
      // the generator first, then the spindle: it never shoots a turret or an interceptor on purpose
      var tgt = f.gen.hp > 0 ? f.ship.position.clone() : f.ship.localToWorld(new THREE.Vector3(0, 30, 0)), bd = tgt.distanceTo(shipPos);
      if (f.gen.hp <= 0 && R.genAt === undefined) R.genAt = +(time - t0).toFixed(1);
      R.icPeak = Math.max(R.icPeak || 0, ics.filter(function (c) { return c.alive; }).length);
      if (bd < 75) away = true; else if (bd > 200) away = false;      // fly through, out the far side, round again
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
  console.log(`  ${label.padEnd(44)} ${r.secs === null ? ('not sunk in 300s, ' + r.hullLeft + '% left').padEnd(26) : ('sunk in ' + r.secs + 's').padEnd(26)} generator down at ${String(r.genAt === undefined ? 'never' : r.genAt + 's').padEnd(7)} most interceptors up ${r.icPeak}   ${String(r.lost).padStart(4)} hull lost of ${r.maxHull}: turrets ${r.by.turrets}, interceptors ${r.by.interceptors}, ramming it ${r.by.ram}`);
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
