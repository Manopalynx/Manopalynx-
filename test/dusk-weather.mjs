// The weather in docs/dusk/: drawn afresh each round (Sam: random, clear about half the time, and it changes the game).
//
// Asserts the draw, what each kind does to the look and that nothing stacks from one round to the next, and measures
// what it does to play: how far you can see in fog, how hard a storm pushes you, and that the drones and interceptors
// it pushes too are never pushed into the ground. Steps the real game by hand on a temp copy.
//
//   node test/dusk-weather.mjs

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
async function run(code, draw) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', e => allErrors.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  await page.evaluate(d => window.__t(`
    ${d ? '' : 'renderer.render = function () {};'}
    chapterHold = 0; scaleHold = 1; // ordinary rounds in the dusk hills, at today's size: the ice and the lava are asked for by boss round
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    M.go = function (n, w, boss) { wxHold = w; if (boss) bossForce = boss; startRound(n); damage = function () {}; };
    1`), !!draw);
  const r = await page.evaluate(c => window.__t(c), code);
  await page.close();
  return JSON.parse(r);
}

console.log('\n— the draw —');
{
  const r = await run(`var n = { clear: 0, fog: 0, rain: 0, storm: 0 }; for (var i = 0; i < 20000; i++) n[wxPick()]++;
    // and every round gets one, held only when asked
    var seen = {}; for (var k = 1; k <= 40; k++) { startRound(k); seen[wx] = 1; }
    JSON.stringify({ n: n, seen: Object.keys(seen).length })`);
  const pc = k => 100 * r.n[k] / 20000;
  check(Math.abs(pc('clear') - 50) < 2 && Math.abs(pc('fog') - 20) < 2 && Math.abs(pc('rain') - 15) < 2 && Math.abs(pc('storm') - 15) < 2,
    `clear about half the time  [of 20,000: clear ${pc('clear').toFixed(1)}%, fog ${pc('fog').toFixed(1)}%, rain ${pc('rain').toFixed(1)}%, storm ${pc('storm').toFixed(1)}%]`, JSON.stringify(r.n));
  check(r.seen === 4, 'over forty rounds every kind comes up', JSON.stringify(r));
}

console.log('\n— what each looks like, and that nothing stacks —');
{
  const r = await run(`var o = {};
    function look() { var f = wxFall.map(function (x) { return x.obj.visible ? 1 : 0; }).join('');
      return { fog: +(scene.fog.density / WX_FOG).toFixed(3), veil: wxVeil.visible ? wxVeil.material.opacity : 0, hemi: +hemi.intensity.toFixed(4), sun: +sun.intensity.toFixed(4), falls: f, name: wxName(), note: noteEl.textContent }; }
    ['clear', 'fog', 'rain', 'storm'].forEach(function (w) { M.go(1, w); roundBanner(); o[w] = look(); });
    M.go(5, 'rain', 'wall'); roundBanner(); o.ice = look(); M.go(10, 'rain', 'walker'); roundBanner(); o.lava = look(); M.go(15, 'fog', 'walker'); o.lavaFog = look();
    // round after round of storms and fogs, then clear at the same time of day: the light must be what it was
    M.go(1, 'clear'); var first = look();
    for (var k = 0; k < 12; k++) { M.go(1, k % 2 ? 'storm' : 'fog'); M.step(20); }
    M.go(1, 'clear'); o.again = look(); o.first = first;
    // the same, through the Sam panel's button, which changes the weather in the middle of a round
    for (k = 0; k < 9; k++) document.getElementById('devWx').click();
    wxForce = 'clear'; wxStart(round); o.panel = look();
    JSON.stringify(o)`);
  check(r.clear.fog === 1 && r.clear.veil === 0 && r.clear.falls === '000' && r.clear.name === '', 'clear is the game as it was: haze as ever, no veil, nothing falling', JSON.stringify(r.clear));
  check(r.fog.fog === 1.3 && r.fog.veil > 0.8 && r.fog.falls === '000', 'fog thickens the haze and veils the far skyline', JSON.stringify(r.fog));
  check(r.rain.falls === '100' && r.storm.falls === '100' && r.rain.hemi < r.clear.hemi && r.storm.hemi < r.rain.hemi, 'rain and storm fall as rain in the dusk world, and darken the light, the storm more', JSON.stringify([r.rain, r.storm]));
  check(r.ice.falls === '010' && r.ice.name === 'Snow' && r.lava.falls === '001' && r.lava.name === 'Ash' && r.lavaFog.name === 'Smoke', 'on the ice it snows, on the lava ash falls, and lava fog is smoke', JSON.stringify([r.ice, r.lava, r.lavaFog]));
  check(/Round 1 · Storm/.test(r.storm.note) && /Snow/.test(r.ice.note) && !/Round 1 ·/.test(r.clear.note), `the round's banner names the weather  [${r.storm.note}]`, JSON.stringify([r.storm.note, r.ice.note, r.clear.note]));
  check(r.again.hemi === r.first.hemi && r.again.sun === r.first.sun && r.again.fog === 1 && r.panel.hemi === r.first.hemi, 'twelve rounds of storm and fog, and the Sam panel cycling it nine times, leave the light exactly as it was', JSON.stringify([r.first, r.again, r.panel]));
}

console.log('\n— fog: how far you can see —');
{
  // A drone, alone, set at increasing distances straight ahead, drawn with and without it over a silhouette of it, as
  // test/dusk-time.mjs measures stand-out. How far you can see is the furthest it still stands out a quarter as much as
  // it does at 30 in clear weather. Dusk, round 1, level flight 120 up, over the hills: the first version flew at 40 and
  // the hills hid the drone beyond 100 in clear and fog alike.
  const r = await run(`
    var gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, A = new Uint8Array(W * H * 4), B = new Uint8Array(W * H * 4), MK = new Uint8Array(W * H * 4);
    var white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), black = new THREE.Color(0);
    function shot(buf) { renderer.render(scene, camera); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); }
    function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    function lum(b, i) { var Y = (0.2126 * lin(b[i]) + 0.7152 * lin(b[i + 1]) + 0.0722 * lin(b[i + 2]) + 0.04) / 1.04; return (116 * Math.cbrt(Y) - 16) / 100; }
    var out = {};
    ['clear', 'fog'].forEach(function (w) {
      M.go(1, w); M.step(3); inControl = false;
      fleet.forEach(function (f) { f.ship.visible = false; }); ground.forEach(function (g) { g.group.visible = false; }); drones.forEach(function (d) { d.mesh.visible = false; });
      var d0 = drones[0];
      shipPos.set(0, 120, 160); yaw = 0; pitch = 0; bank = 0; basis(); // high enough that no hill stands between it and the drone
      camera.position.copy(shipPos).addScaledVector(fwdV, -9.5).addScaledVector(upV, 2.6); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld();
      sky.position.copy(camera.position); wxVeil.position.copy(camera.position);
      var row = [];
      [30, 50, 75, 100, 130, 160, 200, 250, 300, 375, 450].forEach(function (dist) {
        d0.mesh.position.copy(camera.position).addScaledVector(fwdV, dist); d0.mesh.position.y = camera.position.y - 2; d0.mesh.updateMatrixWorld();
        // its silhouette
        var was = scene.children.map(function (o) { return o.visible; }), bg = scene.background;
        scene.children.forEach(function (o) { o.visible = o === d0.mesh; }); d0.mesh.visible = true; scene.background = black; scene.overrideMaterial = white;
        shot(MK); scene.overrideMaterial = null; scene.background = bg; scene.children.forEach(function (o, i) { o.visible = was[i]; });
        d0.mesh.visible = true; shot(A); d0.mesh.visible = false; shot(B);
        var s = 0, c = 0; for (var i = 0; i < A.length; i += 4) { if (MK[i] < 128) continue; s += Math.abs(lum(A, i) - lum(B, i)); c++; }
        row.push([dist, c ? s / c : 0, c]);
      });
      out[w] = row;
    });
    JSON.stringify(out)`, true);
  const ref = r.clear[0][1];
  const sight = row => { let far = 0; for (const [d, v] of row) if (v >= 0.25 * ref) far = d; return far; };
  console.log('  a drone straight ahead, how far it stands out, as a share of how it stands out at 30 in clear:');
  console.log('    distance  ' + r.clear.map(x => String(x[0]).padStart(5)).join(''));
  for (const w of ['clear', 'fog']) console.log(`    ${w.padEnd(8)}  ` + r[w].map(x => String(Math.round(100 * x[1] / ref) + '%').padStart(5)).join(''));
  const sc = sight(r.clear), sf = sight(r.fog);
  console.log(`  you can see it to about ${sc} in clear and ${sf} in fog`);
  check(ref > 0.05 && r.clear.every(x => x[2] > 0), 'the measure sees the drone at every distance', JSON.stringify(r.clear));
  // In clear air its lights carry across the whole map, so there is no clear-weather distance to halve: the first
  // version of this check asked for a half and was measuring against the end of its own list. So: clear carries the
  // whole way, and in fog it is lost somewhere between 100 and 200, under half the map's width.
  check(sc === 450 && sf >= 100 && sf <= 200, `in clear air you see it across the whole map; in fog you lose it at about ${sf}`, JSON.stringify(r));
}

console.log('\n— the storm: wind —');
{
  // With nothing held on the controls, what moves the ship that its own flying does not is the wind: measured tick by
  // tick as the residual against where it would have gone, while it is well inside the map and clear of the ground.
  const r = await run(`M.go(1, 'storm'); inControl = true; var o = { peak: 0, sum: 0, n: 0, gusting: 0, cut: 0, edge: 0 };
    shipPos.set(0, 120, 0); speed = 25;
    // one tick at a time, comparing where it went with where its own flying took it
    for (var k = 0; k < 30 * 90; k++) {
      if (shipPos.length() > 150) { shipPos.set(0, 120, 0); }
      // the whole residual, in every direction: a first version kept only the sideways part, so a headwind or a
      // tailwind did not show, and a wind of 10.9 read as a push of 6.8
      var p0 = shipPos.clone(); M.step(1); var f = new THREE.Vector3(); f.copy(shipPos).sub(p0).addScaledVector(fwdV, -speed / 30); f.y = 0;
      var v = f.length() * 30; o.peak = Math.max(o.peak, v); o.sum += v; o.n++; if (v > 6) o.gusting++;
      o.windNow = Math.max(o.windNow || 0, wind.length());
    }
    // at the edge, it never pushes you further out
    // measured as the push alone, outward: a first version allowed for the ship's own flying, which was bigger than the
    // whole push, and passed with the edge rule deleted
    for (k = 0; k < 30 * 30; k++) { var a = Math.atan2(wind.z, wind.x); shipPos.set(Math.cos(a) * 226, 120, Math.sin(a) * 226); var p1 = shipPos.clone(), w1 = wind.length(); M.step(1);
      var res = shipPos.clone().sub(p1).addScaledVector(fwdV, -speed / 30); res.y = 0; if (w1 > 3 && res.dot(p1.setY(0).normalize()) > 0.01) o.edge++; }
    // and in clear weather there is none
    wxHold = 'clear'; wxStart(round); var any = 0; for (k = 0; k < 300; k++) { M.step(1); if (wind.length() > 0) any++; } o.clearWind = any;
    o.mean = o.sum / o.n; o.gustShare = o.gusting / o.n; JSON.stringify(o)`);
  console.log(`  push on a ship holding nothing, beyond its own flying: peak ${r.peak.toFixed(1)} a second, average ${r.mean.toFixed(1)}; over 6 a second ${Math.round(100 * r.gustShare)}% of the time. Full strafe is 15 a second.`);
  check(r.peak > 8 && r.peak < 13 && r.windNow <= 11.01, `a full gust pushes you about as hard as two thirds of full strafe, so you can always fly out of it  [peak ${r.peak.toFixed(1)}]`, JSON.stringify(r));
  check(r.gustShare > 0.1 && r.gustShare < 0.6, `gusts come and go: pushing hard ${Math.round(100 * r.gustShare)}% of the time`, JSON.stringify(r));
  check(r.edge === 0, 'at the edge of the map it never pushes you further out', JSON.stringify(r));
  check(r.clearWind === 0, 'there is no wind out of a storm', JSON.stringify(r));
}

console.log('\n— the storm: lightning —');
{
  const r = await run(`var o = {};
    // counted where the bolt is thrown: a flash starts at 1 and has faded a step by the end of the same tick, so a first
    // version that waited to see it above 0.9 counted none
    var wb = wxBolt, bolts = 0; wxBolt = function () { bolts++; wb(); };
    function count(n, w, boss) { M.go(n, w, boss); bolts = 0; var hemiBase = wxBase.hemiK; M.step(30 * 120); var b = bolts;
      var after = 0; while (flash > 0 && after < 300) { M.step(1); after++; } return { bolts: b, hemiBack: hemi.intensity === hemiBase, fogBack: scene.fog.color.equals(wxBase.haze), sky: skyDome.material.color.r }; }
    o.storm = count(1, 'storm'); o.rain = count(1, 'rain'); o.blizzard = count(5, 'storm', 'wall'); o.ashStorm = count(10, 'storm', 'walker');
    JSON.stringify(o)`);
  check(r.storm.bolts >= 8 && r.storm.bolts <= 30, `a storm flashes every few seconds  [${r.storm.bolts} flashes in two minutes]`, JSON.stringify(r.storm));
  check(r.storm.hemiBack && r.storm.fogBack && r.storm.sky === 1, 'after each flash the light, the haze and the sky are exactly as they were', JSON.stringify(r.storm));
  check(r.rain.bolts === 0 && r.blizzard.bolts === 0 && r.ashStorm.bolts > 0, 'no lightning in rain or in a blizzard on the ice; an ash storm has it', JSON.stringify(r));
}

console.log('\n— the storm: what else it pushes —');
{
  // Sam: push only the player unless the lighter enemies are not "messed up too bad". So, over three minutes of storm
  // in each landscape: how near the ground any drone or interceptor comes, against the same in clear weather.
  // interceptors only where the game sends them: the ice wall has none, the walker has its own two
  const one = (n, w, boss) => run(`M.go(${n}, '${w}'${boss ? `, '${boss}'` : ''}); ${boss ? '' : 'icWant = 2; icPeelT = 0.05;'} shipPos.set(0, 90, 0);
    var o = { droneMin: 1e9, icMin: 1e9, drift: 0, icTicks: 0 };
    M.step(30 * 180, function () {
      if (shipPos.length() > 160) shipPos.set(0, 90, 0);
      drones.forEach(function (d) { if (!d.alive) return; var p = d.mesh.position; o.droneMin = Math.min(o.droneMin, p.y - Math.max(height(p.x, p.z), 0)); o.drift = Math.max(o.drift, d.off.length()); });
      // inside the map only: on the way in from the far fight they cross the rim, which is not what the wind is about
      ics.forEach(function (ic) { if (!ic.alive || ic.mode === 3 || Math.hypot(ic.pos.x, ic.pos.z) > 200) return; o.icTicks++; o.icMin = Math.min(o.icMin, ic.pos.y - Math.max(height(ic.pos.x, ic.pos.z), 0)); });
    });
    // the storm passes: they drift home
    wxHold = 'clear'; wxStart(round); M.step(30 * 20); o.home = Math.max.apply(null, drones.filter(function (d) { return d.alive; }).map(function (d) { return d.off.length(); }).concat([0]));
    JSON.stringify(o)`);
  const rows = [['dusk world, round 8', 8, null], ['ice wall', 5, 'wall'], ['lava field', 10, 'walker']];
  console.log('  nearest the ground over three minutes (drones at the bottom of their bob; interceptors), clear against storm:');
  const res = [];
  for (const [label, n, boss] of rows) {
    const c = await one(n, 'clear', boss), s = await one(n, 'storm', boss);
    res.push({ label, c, s });
    console.log(`    ${label.padEnd(20)} drones ${c.droneMin.toFixed(1)} → ${s.droneMin.toFixed(1)}   interceptors ${c.icTicks ? c.icMin.toFixed(1) : '–'} → ${s.icTicks ? s.icMin.toFixed(1) : '–'}   drones drifted up to ${s.drift.toFixed(1)}, ${s.home.toFixed(1)} from home 20s after`);
  }
  check(res.every(x => x.s.droneMin > 5), 'in a storm no drone comes within 5 of the ground anywhere', JSON.stringify(res.map(x => [x.label, x.c.droneMin, x.s.droneMin])));
  // The wind does not push them: pushed, they went into the ground in every one of four storms and never in still air.
  // This is the check that found it; it guards that whatever moves them, it is not the storm.
  check(res.every(x => !x.s.icTicks || x.s.icMin > 2), 'in a storm no interceptor touches the ground', JSON.stringify(res.map(x => [x.label, x.c.icMin, x.s.icMin])));
  // The hard case, set up on purpose: a drone low beside the ice wall with a full gust held towards the wall face for 20
  // seconds. Out on open ground a drift barely changes what is under it, and a first version of this suite passed with
  // drifting drones never changing height at all.
  const wallDrone = await run(`M.go(5, 'storm', 'wall'); var d = drones[0]; d.alive = true; d.mesh.visible = true; d.r = 6;
    var top = 0; for (var q = 0; q < 24; q++) top = Math.max(top, height(Math.cos(q * 0.2618) * 6, 64 + Math.sin(q * 0.2618) * 6));
    d.c.set(0, top + 16, 64); d.clear = 16; d.off.set(0, 0, 0); var o = { min: 1e9, z: 0 };
    M.step(30 * 20, function () { windAng = -Math.PI / 2; gustDur = 3; gustK = 1.5; gustPeak = 1; var p = d.mesh.position;
      o.min = Math.min(o.min, p.y - Math.max(height(p.x, p.z), 0)); o.z = Math.min(o.z || 1e9, d.c.z + d.off.z); });
    JSON.stringify(o)`);
  check(wallDrone.min > 5 && wallDrone.z < 50, `a drone blown at the ice wall's face for 20 seconds rises over it rather than into it  [its circle went from 64 out to ${wallDrone.z.toFixed(0)}; nearest the ice ${wallDrone.min.toFixed(1)}]`, JSON.stringify(wallDrone));
  const withDrones = res.filter(x => x.c.droneMin < 1e8); // the walker fights without drones
  check(withDrones.length === 2 && withDrones.every(x => x.s.drift <= 30.01 && x.s.drift > 3 && x.s.home < 3), 'drones drift with the storm, never more than 30, and go home once it passes', JSON.stringify(res.map(x => [x.label, x.s.drift, x.s.home])));
}

{
  // the hard floor, found while measuring the weather: an interceptor flown straight down at the ground stops 3 above it
  const r = await run(`M.go(8, 'clear'); var ic = ics[0]; icPeel(ic); var o = { min: 1e9 };
    for (var k = 0; k < 90; k++) { ic.pos.set(40, Math.max(height(40, 40), 0) + 30, 40); ic.dir.set(0.2, -1, 0).normalize(); ic.mode = 2; ic.t = -5;
      M.step(1); o.min = Math.min(o.min, ic.pos.y - Math.max(height(ic.pos.x, ic.pos.z), 0)); }
    M.step(30, function () { o.min = Math.min(o.min, ic.pos.y - Math.max(height(ic.pos.x, ic.pos.z), 0)); }); JSON.stringify(o)`);
  check(r.min >= 2.99, `an interceptor flown straight down at a hill stops 3 above it, in any weather  [nearest ${r.min.toFixed(2)}]`, JSON.stringify(r));
}

console.log('\n— what falls follows you —');
{
  const r = await run(`M.go(1, 'rain'); var o = { out: 0, n: 0 }; shipPos.set(-150, 80, 150); yaw = -2.4;
    M.step(30 * 20); var f = wxFaller(), a = f.obj.geometry.attributes.position.array, c = camera.position;
    for (var i = 0; i < f.n; i++) { var k = i * f.per * 3; o.n++; if (Math.abs(a[k] - c.x) > WX_BOX / 2 + 2 || Math.abs(a[k + 2] - c.z) > WX_BOX / 2 + 2 || a[k + 1] < c.y - 32 || a[k + 1] > c.y + WX_TALL - 28) o.out++; }
    o.moved = Math.round(Math.hypot(c.x + 150, c.z - 150)); JSON.stringify(o)`);
  check(r.out === 0 && r.moved > 100, `after flying ${r.moved} every drop is still in the box round the camera`, JSON.stringify(r));
}

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
