// The walker's fight in docs/dusk/: the third boss. Knees to shoot out, a fall, a core that opens, a getting-up.
// (How it walks is dusk-lava.mjs's business.)
//
// Asserts the rules, that everything meant to be shot can be hit from where a person would shoot it, the bombs and
// the lava, the draw between three bosses, and measures the fight. Steps the real game by hand on a temp copy.
//
//   node test/dusk-walker.mjs

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
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    M.go = function (n) { bossForce = 'walker'; startRound(n); damage = function () {}; eruptT = 1e9; };   // no eruptions unless a check asks for one
    M.fell = function () { walker.legs.slice(0, 3).forEach(function (l) { hitKnee(l, 1e6, l.kneeAt); }); M.step(40); };
    M.park = function () { shipPos.set(0, 150, 0); };   // out of everything's way
    M.step(3); M.snap = Array.prototype.slice.call(terrainGeo.attributes.position.array); 1`));
  const r = await page.evaluate(c => window.__t(c), code);
  await page.close();
  return JSON.parse(r);
}

const walkerSpec1 = await run(`JSON.stringify(walkerSpec(1))`);

console.log('\n— the round —');
{
  const r = await run(`M.go(5); var f = walkF, o = {};
    o.arena = arena; o.left = remaining(); o.readout = readoutEl.textContent; o.note = (roundBanner(), noteEl.textContent);
    o.others = drones.filter(function (d) { return d.alive; }).length + ground.filter(function (g) { return g.alive && !wkTowerGun(g); }).length + fleet.filter(function (x) { return x.gone <= 0 && x !== f; }).length + icWant;
    o.towerGuns = ground.filter(function (g) { return g.alive && wkTowerGun(g); }).length;
    o.turrets = f.turrets.filter(function (t) { return t.hp > 0; }).length; o.knees = walker.legs.map(function (l) { return l.hp; }).join();
    var hp = f.hp; hitCapital(f, 500); o.armoured = f.hp === hp; o.ship = shipPos.y - Math.max(height(shipPos.x, shipPos.z), 0); o.first = fleet[0].boss === true;
    o.vol = Math.round(Math.sqrt(Math.pow(VOLC.x + volcGroup.position.x, 2) + Math.pow(VOLC.z + volcGroup.position.z, 2)));
    JSON.stringify(o)`);
  check(r.arena === 2 && r.vol < 480, 'it is fought on the lava field, under the volcano', JSON.stringify(r));
  check(r.left === 1 && r.others === 0 && r.towerGuns === 6 && /Walker 100%/.test(r.readout), `the walker and the six guns on its towers, and only the walker is counted  [${r.readout.replace(/Round \d+/, '').trim()}]`, JSON.stringify(r));
  check(/Walker/.test(r.note) && /knees/.test(r.note), 'the banner says what to shoot', r.note);
  check(r.armoured, 'its plate cannot be shot through: 500 at the hull does nothing', JSON.stringify(r));
  check(r.turrets === walkerSpec1.turrets && r.knees === Array(6).fill(walkerSpec1.kneeHp).join(), `${walkerSpec1.turrets} turrets and six knees of ${walkerSpec1.kneeHp} the first time`, JSON.stringify(r));
  check(r.ship > 20 && !r.first, 'you start clear of the ground, and the fleet still begins with an ordinary ship', JSON.stringify(r));
}

console.log('\n— can it be hit where you aim —');
{
  // The dreadnought shipped with a generator nothing could reach. So: bolts with a person's scatter, from every side.
  // the tower guns stand in some of these lines, and a bolt that hits one is not a miss on the knee: take them away
  const los = await run(`M.go(5); ground.forEach(function (g) { if (wkTowerGun(g)) { g.alive = false; g.group.visible = false; g.back = 0; } }); M.step(90); var out = { knee: {}, core: {} }, hk = hitKnee;
    out.blocked = {};
    [0, 20, 40].forEach(function (elev) { var hits = 0, n = 0, blocked = 0; hitKnee = function () { hits++; };
      walker.legs.forEach(function (lg) { for (var q = 0; q < 16; q++) { var az = q / 16 * 6.283, e = elev * Math.PI / 180, c = lg.kneeAt;
        var from = new THREE.Vector3(c.x + Math.cos(az) * Math.cos(e) * 150, c.y + Math.sin(e) * 150, c.z + Math.sin(az) * Math.cos(e) * 150);
        // a shot with rock between gun and knee is not one a person takes: count it as blocked, not as a miss
        var rock = false; for (var u = 0.02; u < 0.97; u += 0.01) { if (Math.max(height(from.x + (c.x - from.x) * u, from.z + (c.z - from.z) * u), 0) > from.y + (c.y - from.y) * u) { rock = true; break; } }
        if (rock) { blocked++; continue; }
        var dir = c.clone().sub(from).normalize(); dir.x += (Math.random() - 0.5) * 0.03; dir.y += (Math.random() - 0.5) * 0.03; dir.z += (Math.random() - 0.5) * 0.03; dir.normalize();
        trk.k = 0; launchBolt(from, dir); n++; } for (var w = 0; w < 30; w++) updateBolts(1 / 30); });
      out.knee[elev] = Math.round(100 * hits / n); out.blocked[elev] = blocked; });
    hitKnee = hk; M.fell(); var f = walkF, hc = hitCapital; out.state = walker.state;
    [5, 20, 40, 70].forEach(function (elev) { var hits = 0, n = 0; hitCapital = function (x, d) { if (x === f && !x.armour) hits++; };
      f.ship.updateMatrixWorld(); var c = f.ship.localToWorld(WK_CORE.clone());
      for (var q = 0; q < 48; q++) { var az = q / 48 * 6.283, e = elev * Math.PI / 180;
        var from = new THREE.Vector3(c.x + Math.cos(az) * Math.cos(e) * 120, c.y + Math.sin(e) * 120, c.z + Math.sin(az) * Math.cos(e) * 120);
        var dir = c.clone().sub(from).normalize(); dir.x += (Math.random() - 0.5) * 0.03; dir.y += (Math.random() - 0.5) * 0.03; dir.z += (Math.random() - 0.5) * 0.03; dir.normalize();
        trk.k = 0; launchBolt(from, dir); n++; }
      for (var w = 0; w < 30; w++) updateBolts(1 / 30);
      out.core[elev] = Math.round(100 * hits / n); });
    hitCapital = hc; JSON.stringify(out)`);
  console.log('  bolts aimed at a knee with a clear line that reach it:   ' + Object.keys(los.knee).map(e => `+${e}°: ${los.knee[e]}% (${los.blocked[e]} of 96 behind rock)`).join('   '));
  console.log('  bolts aimed at the open core that reach it:   ' + Object.keys(los.core).map(e => `+${e}°: ${los.core[e]}%`).join('   '));
  check(Object.values(los.knee).every(p => p >= 80), 'a knee can be hit from any side, level and from above', JSON.stringify(los.knee));
  check(los.state === 'down' && los.core[20] >= 80 && los.core[40] >= 80 && los.core[70] >= 80, 'the open core can be hit from any side, from a shallow dive to a steep one', JSON.stringify(los.core));
}

console.log('\n— knees, the fall, and getting up —');
{
  const k = await run(`M.go(5); M.park(); M.step(60); var w = walker, f = walkF, o = {}, lg = w.legs[0];
    hitKnee(lg, 10, lg.kneeAt); M.step(1); o.hp = lg.hp; o.max = lg.maxHp; o.ring = lg.ring.visible; o.otherRing = w.legs[1].ring.visible;
    var n = 10; while (!lg.dead && n < 999) { hitKnee(lg, 1, lg.kneeAt); n++; } o.hits = n; o.stump = !lg.lower.visible && !lg.pad.visible && lg.upper.visible; o.state1 = w.state;
    var a0 = w.ang; M.step(300); o.rate5 = (w.ang - a0) / 10; hitKnee(w.legs[3], 1e6, w.legs[3].kneeAt); o.state2 = w.state;
    // walking on four: no live foot floating, no leg over-stretched
    var bad = 0; M.step(450, function () { w.legs.forEach(function (l) { if (l.dead) return; var gy = wkGround(l.foot.x, l.foot.z); if (l.t < 0 && Math.abs(l.foot.y - gy) > 0.01) bad++; if (l.foot.distanceTo(l.hip) > WK_L1 + WK_L2 - 0.5) bad++; }); });
    o.badOnFour = bad; o.steps4 = w.legs.filter(function (l) { return !l.dead; }).map(function (l) { return l.steps; }).join(' ');
    // the core while it stands
    var hp = f.hp, before = w.state; f.ship.updateMatrixWorld(); var c = f.ship.localToWorld(WK_CORE.clone());
    for (var q = 0; q < 30; q++) { trk.k = 0; launchBolt(new THREE.Vector3(c.x, c.y + 100, c.z), new THREE.Vector3(0, -1, 0)); } for (q = 0; q < 30; q++) updateBolts(1 / 30);
    o.shutCore = f.hp === hp && !w.core.visible && w.hatch.visible;
    var hpFall = f.hp; hitKnee(w.legs[5], 1e6, w.legs[5].kneeAt); o.state3 = w.state; M.step(35); o.fallCost = Math.round(100 * (hpFall - f.hp) / f.maxHp); o.state4 = w.state; o.open = w.core.visible && !w.hatch.visible; o.readout = readoutEl.textContent;
    o.belly = Math.round(w.g.position.y - wkGround(w.pos.x, w.pos.z)); var a1 = w.ang; M.step(30); o.still = w.ang === a1;
    f.ship.updateMatrixWorld(); c = f.ship.localToWorld(WK_CORE.clone()); hp = f.hp; trk.k = 0; launchBolt(new THREE.Vector3(c.x, c.y + 40, c.z), new THREE.Vector3(0, -1, 0)); for (q = 0; q < 12; q++) updateBolts(1 / 30); o.perBolt = hp - f.hp;
    var t = 0; while (w.state === 'down' && t < 900) { M.step(1); t++; } o.after = w.state; o.shut = !w.core.visible && w.hatch.visible;
    o.mended = w.legs.every(function (l) { return !l.dead && l.hp === l.maxHp && l.lower.visible; });
    M.step(60); o.walking = w.state; M.step(120);
    o.feet = w.legs.filter(function (l) { return l.t < 0 && Math.abs(l.foot.y - wkGround(l.foot.x, l.foot.z)) > 0.01; }).length; o.falls = w.falls; o.hpKept = f.hp < f.maxHp;
    JSON.stringify(o)`);
  check(k.hp === k.max - 10 && k.ring && !k.otherRing, 'a knee takes damage and shows a ring once it has; an untouched one shows none', JSON.stringify(k));
  check(k.hits === k.max && k.stump && k.state1 === 'walk', `${k.max} hits takes a leg off at the knee, and it walks on, on five`, JSON.stringify(k));
  check(k.rate5 < 9 / 105 * 0.9 && k.rate5 > 0 && k.state2 === 'walk', `slower for each leg lost  [${(k.rate5 * 105).toFixed(1)} a second on five, 9 on six]`, JSON.stringify(k));
  check(k.badOnFour === 0, `on four legs it still plants every foot on the ground and over-stretches none  [steps ${k.steps4}]`, `${k.badOnFour} faults`);
  check(k.shutCore, 'while it stands the core is shut: thirty bolts straight down onto its back do nothing', JSON.stringify(k));
  check(k.state3 === 'falling' && k.state4 === 'down' && k.open && /core open/.test(k.readout) && k.belly < 14 && k.still, 'the third knee brings it down: on its belly, stopped, core open, and the readout says so', JSON.stringify(k));
  check(k.perBolt === 18, 'the core is a weak spot: a bolt into it does 18, three times what it would do to a hull', `${k.perBolt}`);
  check(k.after === 'rising' && k.shut && k.mended, `it lies open, then shuts and gets up with every leg mended`, JSON.stringify(k));
  check(k.fallCost === 15, `the fall alone costs it 15% of its whole`, `${k.fallCost}%`);
  check(k.walking === 'walk' && k.feet === 0 && k.falls === 1 && k.hpKept, 'and walks on, feet on the ground, keeping the damage it took', JSON.stringify(k));
}

{
  // how long the core stays open, timed tick by tick from the tick it opens, at each tier, against the spec
  const d = await run(`var o = [1, 2, 3].map(function (tier) { M.go(tier * 5); M.park(); M.step(30);
    walker.legs.slice(0, 3).forEach(function (l) { hitKnee(l, 1e6, l.kneeAt); });   // not M.fell: that steps on past the opening, and the first version of this check started its watch late
    var n = 0; while (walker.state !== 'down' && n < 90) { M.step(1); n++; } var open = 0; while (walker.state === 'down' && open < 900) { M.step(1); open++; }
    return { tier: tier, open: +(open / 30).toFixed(2), spec: walker.spec.down, then: walker.state }; }); JSON.stringify(o)`);
  check(d.every(x => Math.abs(x.open - x.spec) < 0.05 && x.then === 'rising'), `the core stays open for exactly the time it should at each tier  [${d.map(x => x.open + 's').join(', ')}]`, JSON.stringify(d));
}

console.log('\n— turrets, bombs and lava —');
{
  const t = await run(`M.go(5); M.park(); M.step(30); var f = walkF, w = walker, o = {}, tr = f.turrets[0], n = 0, hp = f.hp;
    while (tr.hp > 0 && n < 99) { hitTurret(f, tr, 1, tr.local); n++; } o.hits = n; o.hull = f.hp === hp;
    M.step(30 * 9); o.at9 = tr.hp; M.step(45); o.at10 = tr.hp;
    // an eruption
    var dealt = []; damage = function (d) { dealt.push(d); };
    shipPos.set(40, 30, 40); speed = 0; eruptT = 0.01; M.step(3); o.flying = lavaBombs.filter(function (b) { return b.t >= 0; }).length;
    var b0 = lavaBombs.filter(function (b) { return b.t >= 0; })[0]; o.markOnGround = lavaBombs.filter(function (b) { return b.t >= 0; }).every(function (b) { return Math.abs(b.to.y - wkGround(b.to.x, b.to.z)) < 0.01 && b.mark.visible; });
    o.inMap = lavaBombs.filter(function (b) { return b.t >= 0; }).every(function (b) { return Math.sqrt(b.to.x * b.to.x + b.to.z * b.to.z) <= 211; });
    M.step(30 * 3, function () { shipPos.set(b0.to.x, b0.to.y + 30, b0.to.z); }); o.before = dealt.filter(function (d) { return d === 25; }).length;
    M.step(40, function () { shipPos.set(b0.to.x, b0.to.y + 30, b0.to.z); }); o.under = dealt.filter(function (d) { return d === 25; }).length; o.landed = lavaBombs.every(function (b) { return b.t < 0 && !b.mark.visible; });
    dealt = []; eruptT = 0.01; eruptOn = 0; M.step(3); b0 = lavaBombs.filter(function (b) { return b.t >= 0; })[0];
    M.step(130, function () { shipPos.set(b0.to.x, b0.to.y + 90, b0.to.z); }); o.above = dealt.filter(function (d) { return d === 25; }).length;
    // the lava itself
    var lx = null, rx = null; for (var a = 0; a < 6.283 && (lx === null || rx === null); a += 0.05) for (var r = 20; r < 180; r += 10) { var x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z); if (h < -2 && lx === null) lx = [x, z]; if (h > 6 && rx === null) rx = [x, z]; }
    eruptT = 1e9; dealt = []; M.step(60, function () { shipPos.set(lx[0], 2, lx[1]); pitch = 0; }); o.lava = dealt.filter(function (d) { return d === 12; }).length;
    dealt = []; M.step(60, function () { shipPos.set(lx[0], 30, lx[1]); }); o.lavaHigh = dealt.filter(function (d) { return d === 12; }).length;
    dealt = []; M.step(60, function () { shipPos.set(rx[0], height(rx[0], rx[1]) + 2, rx[1]); }); o.rock = dealt.filter(function (d) { return d === 12; }).length;
    JSON.stringify(o)`);
  check(t.hits === 8 && t.hull && t.at9 === 0 && t.at10 === 8, 'a turret takes 8, costs the walker nothing, and is back ten seconds later: not at nine', JSON.stringify(t));
  check(t.flying === 4 && t.markOnGround && t.inMap, 'an eruption throws four bombs, each with a mark on the ground where it will land, all inside the map', JSON.stringify(t));
  check(t.before === 0 && t.under === 1 && t.landed, 'under a mark you are hit when it lands and not before; then the marks are gone', JSON.stringify(t));
  check(t.above === 0, 'well above a mark you are clear of it', JSON.stringify(t));
  check(t.lava >= 2 && t.lavaHigh === 0 && t.rock === 0, `skimming the lava burns, about twice a second; flying over it or skimming rock does not  [${t.lava} burns in two seconds]`, JSON.stringify(t));
}

console.log('\n— the towers and the interceptors —');
{
  // Sam, of walker-1: "rather easy". Guns on watch towers that rebuild, and two interceptors back 20 seconds after each is lost.
  const tw = await run(`M.go(5); var o = { towers: [] };
    ground.filter(wkTowerGun).forEach(function (g) {
      var x = g.tower.x, z = g.tower.z, lo = 1e9;
      for (var q = 0; q < 12; q++) { var b = q / 12 * 6.283; for (var rad = 0; rad <= 6; rad += 3) lo = Math.min(lo, heightLava(x + Math.cos(b) * rad, z + Math.sin(b) * rad)); }
      o.towers.push({ type: g.type, hp: g.maxHp, alive: g.alive && g.group.visible, lift: +(g.pos.y - heightLava(x, z)).toFixed(2), r: Math.round(Math.hypot(x, z)), rock: +lo.toFixed(1) });
    });
    o.props = wkProps.visible;
    // its feet and knees, over 150 seconds of walking: how near any comes to a tower
    var near = 1e9; M.park(); M.step(30 * 150, function () { walker.legs.forEach(function (l) { wkTowerSpots.forEach(function (t) { near = Math.min(near, Math.hypot(l.foot.x - t.x, l.foot.z - t.z), Math.hypot(l.kneeAt.x - t.x, l.kneeAt.z - t.z)); }); }); });
    o.near = +near.toFixed(1); o.laps = +(walker.ang / 6.283).toFixed(2);
    JSON.stringify(o)`);
  const T = tw.towers;
  check(tw.props && T.length === 6 && T.every(t => t.alive) && T.filter(t => t.type === 'flak').length === 3 && T.every(t => t.hp === (t.type === 'flak' ? 7 : 8)),
    'six towers, a gun on each, flak and missile sites by turns, taking 7 and 8 the first time', JSON.stringify(T));
  check(T.every(t => Math.abs(t.lift - 29.9) < 0.01), 'every gun is up on top of its tower, not on the ground beside it', JSON.stringify(T.map(t => t.lift)));
  check(T.every(t => t.rock > 1), `every tower stands on rock: no lava within 6 of its foot  [lowest rock ${Math.min(...T.map(t => t.rock))}]`, JSON.stringify(T.map(t => t.rock)));
  check(T.every(t => t.r >= 158) && tw.near > 9.5, `the walker never walks through one: its nearest foot or knee in ${tw.laps} laps comes ${tw.near} from a tower's middle`, JSON.stringify(tw));

  const rb = await run(`M.go(5); M.park(); M.step(30); var g = ground.filter(function (x) { return wkTowerGun(x) && x.type === 'flak'; })[0], o = {}, hp = walkF.hp, n = 0;
    while (g.alive && n < 99) { hitGround(g, 1, g.pos); n++; } o.hits = n; o.left = remaining(); o.hull = walkF.hp === hp;
    M.step(30 * 9); o.at9 = g.alive; M.step(45); o.at10 = g.alive && g.hp === g.maxHp && g.group.visible;
    o.lift = +(g.pos.y - heightLava(g.tower.x, g.tower.z)).toFixed(2); o.same = g.pos.x === g.tower.x && g.pos.z === g.tower.z;
    JSON.stringify(o)`);
  check(rb.hits === 7 && rb.left === 1 && rb.hull && !rb.at9 && rb.at10 && Math.abs(rb.lift - 29.9) < 0.01 && rb.same,
    "a tower's flak gun takes 7, is not counted, costs the walker nothing, and is back on its tower ten seconds later: not at nine", JSON.stringify(rb));

  // can a tower's gun be hit where you aim: bolts with a person's scatter from every side, level and from above
  const los = await run(`M.go(5); M.park(); M.step(30); var out = {}, hg = hitGround, hits = 0;
    hitGround = function () { hits++; };
    [0, 20, 40].forEach(function (elev) { var n = 0, blocked = 0; hits = 0;
      ground.filter(wkTowerGun).forEach(function (g) { for (var q = 0; q < 16; q++) { var az = q / 16 * 6.283, e = elev * Math.PI / 180, c = g.pos;
        var from = new THREE.Vector3(c.x + Math.cos(az) * Math.cos(e) * 120, c.y + Math.sin(e) * 120, c.z + Math.sin(az) * Math.cos(e) * 120);
        var rock = false; for (var u = 0.02; u < 0.97; u += 0.01) { if (Math.max(height(from.x + (c.x - from.x) * u, from.z + (c.z - from.z) * u), 0) > from.y + (c.y - from.y) * u) { rock = true; break; } }
        if (rock) { blocked++; continue; }
        var dir = c.clone().sub(from).normalize(); dir.x += (Math.random() - 0.5) * 0.03; dir.y += (Math.random() - 0.5) * 0.03; dir.z += (Math.random() - 0.5) * 0.03; dir.normalize();
        trk.k = 0; launchBolt(from, dir); n++; for (var w = 0; w < 30; w++) updateBolts(1 / 30); } });
      out[elev] = [Math.round(100 * hits / n), blocked]; });
    hitGround = hg; JSON.stringify(out)`);
  console.log('  bolts aimed at a tower gun with a clear line that reach it:   ' + Object.keys(los).map(e => `+${e}°: ${los[e][0]}% (${los[e][1]} of 96 behind rock)`).join('   '));
  check(Object.values(los).every(v => v[0] >= 80), 'a tower gun can be hit from any side, level and from above', JSON.stringify(los));

  const ic = await run(`M.go(5); M.park(); var o = {}, up = function () { return ics.filter(function (x) { return x.alive && x.mode !== 3; }).length; };
    M.step(30 * 5); o.at5 = up(); M.step(36); o.at6 = up(); o.note = noteEl.textContent; var most = 0;
    M.step(30 * 30, function () { most = Math.max(most, up()); }); o.most = most; o.left = remaining();
    var a = ics.filter(function (x) { return x.alive; })[0]; hitInterceptor(a, 99, a.pos); o.after = up();
    M.step(30 * 19); o.at19 = up(); M.step(36); o.at20 = up();
    ics.forEach(function (x) { if (x.alive) hitInterceptor(x, 99, x.pos); }); o.none = up(); M.step(30 * 19); o.both19 = up(); M.step(36); o.both20 = up();
    // the round ends: they turn for home, none come after them, and the towers stand down. Held 80 off a flak tower,
    // inside its reach, for five seconds before and three after (the cards come up soon after): it must fire in the
    // first and not in the second. A burst comes every 2.4 to 3.8 seconds, so five always holds one.
    var fired = 0, fs = flakShoot, lm = launchMissile, ft = ground.filter(function (g) { return wkTowerGun(g) && g.type === 'flak'; })[0];
    flakShoot = function (g, d) { if (wkTowerGun(g)) fired++; return fs(g, d); }; launchMissile = function (g) { if (wkTowerGun(g)) fired++; return lm(g); };
    var hold = function () { shipPos.set(ft.tower.x - 80 * Math.sign(ft.tower.x || 1), ft.pos.y + 20, ft.tower.z); };
    M.step(150, hold); o.firedLive = fired;
    walker.legs.slice(0, 3).forEach(function (l) { hitKnee(l, 1e6, l.kneeAt); }); M.step(40); walkF.armour = false; hitCapital(walkF, walkF.hp + 1); walkF.armour = true;
    o.live = roundLive; fired = 0; var after = 0; M.step(90, function () { hold(); after = Math.max(after, up()); }); o.afterEnd = after; o.fired = fired; o.inControl = inControl;
    // and the next round has no towers
    startRound(6); o.next = { props: wkProps.visible, marked: ground.filter(wkTowerGun).length };
    JSON.stringify(o)`);
  check(ic.at5 === 0 && ic.at6 === 2 && /Interceptor/.test(ic.note), 'two interceptors come in six seconds after the start, and the banner says so', JSON.stringify(ic));
  check(ic.most === 2 && ic.left === 1, 'never more than two, and they are not counted', JSON.stringify(ic));
  check(ic.after === 1 && ic.at19 === 1 && ic.at20 === 2, 'one shot down is back 20 seconds later: not at 19', JSON.stringify(ic));
  check(ic.none === 0 && ic.both19 === 0 && ic.both20 === 2, 'both shot down, both are back 20 seconds later', JSON.stringify(ic));
  check(!ic.live && ic.inControl && ic.afterEnd === 0 && ic.firedLive > 0 && ic.fired === 0, `once the walker is destroyed no interceptor comes for you and the towers stop firing  [a flak tower 80 off: ${ic.firedLive} shots in five seconds before, ${ic.fired} in three after]`, JSON.stringify(ic));
  check(!ic.next.props && ic.next.marked === 0, 'the next round has no towers, and their guns are ordinary units again', JSON.stringify(ic.next));
}

console.log('\n— the end of it, and what comes after —');
{
  const e = await run(`M.go(5); M.park(); M.step(30); M.fell(); var f = walkF, w = walker, o = {};
    f.armour = false; hitCapital(f, f.hp + 1); f.armour = true; o.live = roundLive; o.note = noteEl.textContent; M.step(30); o.burning = w.on && f.dying > 0;
    M.step(90); o.gone = !w.on && f.gone > 0 && !w.g.visible && w.legs.every(function (l) { return !l.upper.visible; }) && f.turrets.every(function (t) { return !t.ring.visible; });
    startRound(6); o.arena = arena; var pos = terrainGeo.attributes.position.array, d = 0; for (var i = 0; i < pos.length; i++) if (Math.abs(pos[i] - M.snap[i]) > 1e-6) d++; o.diff = d;
    o.vol = volcGroup.position.length(); o.ships = fleet.filter(function (x) { return x.gone <= 0; }).length; o.left = remaining(); o.bombs = lavaBombs.filter(function (b) { return b.mesh.visible || b.mark.visible; }).length;
    JSON.stringify(o)`);
  check(!e.live && /cleared/.test(e.note) && e.burning && e.gone, 'destroying it clears the round; it burns where it lies and then is gone, legs, rings and all', JSON.stringify(e));
  check(e.arena === 0 && e.diff === 0 && e.vol === 0 && e.ships === 6 && e.left === 66 && e.bombs === 0, 'the next round is an ordinary one at dusk, the landscape exactly as it was and the volcano back on the horizon', JSON.stringify(e));

  const s = await run(`var o = [1, 2, 3].map(function (t) { var s = walkerSpec(t); M.go(t * 5); return { round: t * 5, hull: walkF.maxHp, knee: walker.legs[0].hp, turrets: walkF.turrets.filter(function (x) { return x.hp > 0; }).length, down: s.down, bombs: s.bombs }; }); JSON.stringify(o)`);
  console.log('  round   core   each knee   turrets   seconds open   bombs an eruption');
  for (const r of s) console.log(`  ${String(r.round).padStart(5)}   ${String(r.hull).padStart(4)}   ${String(r.knee).padStart(9)}   ${String(r.turrets).padStart(7)}   ${String(r.down).padStart(12)}   ${String(r.bombs).padStart(17)}`);
  check(s[1].hull > s[0].hull && s[2].hull > s[1].hull && s[1].knee > s[0].knee && s[1].turrets > s[0].turrets && s[1].down < s[0].down && s[1].bombs > s[0].bombs, 'harder each time: more core, tougher knees, more turrets, open for less long, more bombs', JSON.stringify(s));

  // Which boss. Sixty runs of five boss rounds.
  const b = await run(`var first = { dread: 0, wall: 0, walker: 0 }, repeats = 0, seen = {};
    for (var runN = 0; runN < 60; runN++) { lastBoss = null; var prev = null; for (var q = 0; q < 5; q++) { var k = pickBoss(); if (q === 0) first[k]++; if (k === prev) repeats++; if (q === 1) seen[prev + '>' + k] = 1; prev = k; } }
    JSON.stringify({ first: first, repeats: repeats, pairs: Object.keys(seen).length })`);
  check(b.first.dread >= 8 && b.first.wall >= 8 && b.first.walker >= 8, `the first boss of a run can be any of the three  [of 60 runs: dreadnought ${b.first.dread}, ice wall ${b.first.wall}, walker ${b.first.walker}]`, JSON.stringify(b));
  check(b.repeats === 0 && b.pairs === 6, 'the same boss never comes twice running, and after any one either of the others can follow  [all 6 pairings seen]', JSON.stringify(b));
}

// ------------------------------------------------------------ the fight
// A stand-in that flies at the nearest live knee, and at the core when it is open, holding Fire. It never dodges a
// bomb or a turret, cannot die, and repair is not modelled: a ceiling on the cost. With towersFirst it goes for the
// nearest tower gun standing before anything on the walker. It never aims at an interceptor; it hits one only when
// one crosses its fire. Each hit is put down to what dealt it by its size, which is different for every source here.
async function fight(round, ups, label, towersFirst, limit) {
  const r = await run(`${ups} bossForce = 'walker'; startRound(${round}); hull = maxHull();
    var R = { lost: 0, by: { turrets: 0, towers: 0, interceptors: 0, bombs: 0, lava: 0, ram: 0, other: 0 }, secs: null, falls: [] }, t0 = time, away = false, w = walker, f = walkF, last = 'walk';
    var SRC = { 8: 'turrets', 6: 'towers', 20: 'towers', 10: 'interceptors', 25: 'bombs', 12: 'lava', 15: 'ram' };
    damage = function (n) { R.lost += n; R.by[SRC[n] || 'other'] += n; };
    R.icShots = 0; R.icKills = 0; R.icUp = 0; var sf = sfx, hi = hitInterceptor, cleared = {};
    sfx = function (name, at) { if (name === 'ishot') R.icShots++; return sf(name, at); };
    hitInterceptor = function (ic, d, at) { hi(ic, d, at); if (!ic.alive) R.icKills++; };
    M.step(30 * ${limit || 420}, function () {
      if (!roundLive) { R.secs = +(time - t0).toFixed(1); return false; }
      if (w.state === 'down' && last !== 'down') R.falls.push(+(time - t0).toFixed(0)); last = w.state;
      var tgt = null, bd = 1e9;
      ground.forEach(function (g) { if (wkTowerGun(g) && !g.alive) cleared[g.tower.x] = 1; });
      if (ics[0].alive || ics[1].alive) R.icUp += 1 / 30;
      // towers first: each tower's gun once, then the walker. They rebuild, so 'until none is standing' never ends.
      if (${!!towersFirst}) ground.forEach(function (g) { if (!g.alive || !wkTowerGun(g) || cleared[g.tower.x]) return; var d = g.pos.distanceTo(shipPos); if (d < bd) { bd = d; tgt = g.pos.clone(); } });
      if (tgt) {} else if (w.state === 'down') { f.ship.updateMatrixWorld(); tgt = f.ship.localToWorld(WK_CORE.clone()); bd = tgt.distanceTo(shipPos); }
      else w.legs.forEach(function (l) { if (l.dead) return; var d = l.kneeAt.distanceTo(shipPos); if (d < bd) { bd = d; tgt = l.kneeAt.clone(); } });
      if (!tgt) return;
      if (bd < 45) away = true; else if (bd > 150) away = false;
      if (!away) { var dx = tgt.x - shipPos.x, dy = tgt.y - shipPos.y, dz = tgt.z - shipPos.z, flat = Math.sqrt(dx * dx + dz * dz), wy = Math.atan2(-dx, -dz);
        yaw += Math.max(-1.4 / 30, Math.min(1.4 / 30, Math.atan2(Math.sin(wy - yaw), Math.cos(wy - yaw)))); pitch += Math.max(-1 / 30, Math.min(1 / 30, Math.atan2(dy, flat) - pitch)); }
      else pitch += Math.max(-1 / 30, Math.min(1 / 30, 0.35 - pitch));
      keys.fire = true;
    });
    R.left = Math.round(100 * f.hp / f.maxHp); R.maxHull = maxHull(); JSON.stringify(R)`);
  console.log(`  ${label.padEnd(34)} ${(r.secs === null ? `not destroyed in ${limit || 420}s, ` + r.left + '% left' : 'destroyed in ' + r.secs + 's').padEnd(34)} it fell at ${(r.falls.join(', ') || '–').padEnd(22)}s   ${r.lost} hull lost of ${r.maxHull}: turrets ${r.by.turrets}, towers ${r.by.towers}, interceptors ${r.by.interceptors}, bombs ${r.by.bombs}, lava ${r.by.lava}, ramming ${r.by.ram}${r.by.other ? ', other ' + r.by.other : ''}; interceptors fired ${r.icShots}, ${r.icKills} shot down, one or more up ${Math.round(r.icUp)}s`);
  return r;
}
if (process.env.DUSK_QUICK) { // the rules only, for mutation runs: the fights take minutes
  check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
  await browser.close(); console.log(`\n${passed} passed, ${failed} failed  (DUSK_QUICK: the fights were not run)`); process.exit(failed ? 1 : 0);
}
console.log('\n— how long the fight is, and what it costs —');
// Runs differ: the guns' timing is random, and over a long fight that decides how many falls it takes. walker-1's
// document quoted one no-upgrade run as 257s; five runs gave 257, 300, 300, 393, 393. So the short fights run three times.
const UP4 = 'up.rapid = 1; up.cannons = 1; up.heavy = 1; up.plating = 1;';
const f0 = await fight(5, '', 'round 5, no upgrades', false, 900);
const f4s = [];
for (let i = 1; i <= 3; i++) f4s.push(await fight(5, UP4, `round 5, four upgrades (${i})`));
const f4t = [];
for (let i = 1; i <= 3; i++) f4t.push(await fight(5, UP4, `round 5, four, towers first (${i})`, true));
const f9 = await fight(10, 'up.rapid = 2; up.cannons = 2; up.heavy = 2; up.plating = 2; up.shield = 1;', 'round 10, nine upgrades');
const f4 = f4s[0];
check(f0.secs !== null, 'it can be destroyed with no upgrades at all', JSON.stringify(f0));
check(f4.secs !== null && f4.secs > 20 && f4.falls.length >= 1, 'with four it has to be brought down at least once, and is not over in seconds', JSON.stringify(f4));
check(f4.lost > 0, 'it hits back', JSON.stringify(f4));
check(f4s.every(r => r.by.towers > 0) && f4t.every(r => r.secs !== null), 'the towers draw blood, and the walker can still be destroyed with the towers taken first', JSON.stringify(f4s.map(r => r.by)));
// What the game controls is that two are up. Whether they get to fire depends on the flying: they fire only while on
// your screen, and this stand-in circles under the walker, which is the case interceptors-2 noted is barely shot at.
check([...f4s, ...f4t, f9].every(r => r.icUp >= 0.5 * (r.secs - 6)), `interceptors are up for most of every fight  [${[...f4s, ...f4t, f9].map(r => Math.round(100 * r.icUp / (r.secs - 6)) + '%').join(', ')}]`, JSON.stringify([...f4s, ...f4t, f9].map(r => [r.icUp, r.secs])));
check([f0, ...f4s, ...f4t, f9].every(r => r.by.other === 0), 'every hit taken is put down to a known source', JSON.stringify([f0, ...f4s, ...f4t, f9].map(r => r.by.other)));

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
