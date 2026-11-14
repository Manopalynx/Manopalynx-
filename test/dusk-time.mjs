// The time of day in docs/dusk/: a cycle, one step a round (Sam: "time of day is a cycle"; keep night).
//
// Asserts the cycle, that dusk is the game as it always was, that the sky follows the look in every landscape, and
// measures what matters most: whether the enemies still stand out from the world at each time. That is measured as a
// differential: every view is drawn twice, enemies shown and hidden, and the difference in brightness where they are
// is how far they stand out. Dusk is the control, because it is what Sam has played.
//
//   node test/dusk-time.mjs

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
const errors = [];
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
await page.mouse.click(196, 426);
const T = c => page.evaluate(code => window.__t(code), c).then(JSON.parse);
await T(`chapterHold = 0; scaleHold = 1; wxHold = 'clear'; wxStart(round); // the chapters and the weather vary; these checks are about other things, so hold them: dusk hills, clear
  window.M = { now: performance.now() };
  M.step = function (n) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); } };
  damage = function () {}; '1'`);

console.log('\n— the cycle —');
{
  const r = await T(`var o = []; for (var n = 1; n <= 9; n++) { bossForce = 'dread'; startRound(n); o.push(arena + ':' + TIMES[tod].name + ':' + scene.fog.color.getHexString()); } JSON.stringify(o)`);
  const names = r.map(x => x.split(':')[1]);
  check(names.join(' ') === 'dusk night dawn morning dusk night dawn morning dusk', `one step a round, round 1 at dusk  [${names.join(', ')}]`, r);
  check(new Set(r.slice(0, 4).map(x => x.split(':')[2])).size === 4 && r[0] === r[4] && r[1] === r[5], 'each time has its own haze, and the same time comes back the same', r);
  check(r[4].startsWith('0:') && r[8].startsWith('0:'), 'the dreadnought, fought in the dusk world, takes whatever time the cycle gives it', r);
}

console.log('\n— dusk is the game as it always was —');
{
  // what walker-2 had, written out: the one place these are restated, on purpose, as the control
  const was = { haze: '3a2040', zenith: '060716', sun: 'ffc49a', sunK: 1.15, sunPos: [-0.55, 0.32, -0.62], sky: '7a78ff', ground: '24121c', hemiK: 0.6, water: '0e5566', glow: '0a3540', stars: 0.85, ridges: ['2a1733', '321c3b', '241329'] };
  const r = await T(`startRound(1); var o = { haze: scene.fog.color.getHexString(), zenith: scene.background.getHexString(), sun: sun.color.getHexString(), sunK: sun.intensity, sunPos: [sun.position.x, sun.position.y, sun.position.z],
      sky: hemi.color.getHexString(), ground: hemi.groundColor.getHexString(), hemiK: hemi.intensity, water: water.material.color.getHexString(), glow: water.material.emissive.getHexString(), stars: skyStars.material.opacity,
      ridges: ridgeMats.map(function (m) { return m.color.getHexString(); }) };
    // the sky as walker-2 painted it once at load, from the same formula, against what is painted now
    var pos = skyDome.geometry.attributes.position, col = skyDome.geometry.attributes.color, lo = new THREE.Color(0x3a2040), hi = new THREE.Color(0x060716), warm = new THREE.Color(0x7a3550), c = new THREE.Color(), worst = 0;
    for (var i = 0; i < pos.count; i++) { var t = pos.getY(i) / 1500;
      if (t <= 0) c.copy(lo); else { c.copy(lo).lerp(hi, Math.pow(Math.min(1, t * 1.25), 0.55)); var side = Math.max(0, -(pos.getX(i) * 0.66 + pos.getZ(i) * 0.75) / 1500); c.lerp(warm, side * Math.max(0, 1 - t * 4) * 0.8); }
      worst = Math.max(worst, Math.abs(c.r - col.getX(i)), Math.abs(c.g - col.getY(i)), Math.abs(c.b - col.getZ(i))); }
    o.skyWorst = worst; JSON.stringify(o)`);
  const same = ['haze', 'zenith', 'sun', 'sunK', 'sky', 'ground', 'hemiK', 'water', 'glow', 'stars'].filter(k => r[k] !== was[k]);
  check(same.length === 0 && r.sunPos.every((v, i) => Math.abs(v - was.sunPos[i]) < 1e-9), 'haze, sky, sun, light, water and stars at dusk are exactly what they were', JSON.stringify({ differs: same, r }));
  check(r.ridges.every((h, i) => {
    const a = parseInt(h, 16), b = parseInt(was.ridges[i], 16);
    return [16, 8, 0].every(s => Math.abs(((a >> s) & 255) - ((b >> s) & 255)) <= 1);
  }), `the far ridges and the volcano at dusk are the colours they were  [${r.ridges.join(', ')}]`, JSON.stringify(r.ridges));
  // the warm band's direction comes from the sun now, (-0.55, -0.62), where it was written as (-0.66, -0.75): the same line to within a degree
  check(r.skyWorst < 0.01, `the dusk sky is painted as it was, to within ${(r.skyWorst * 255).toFixed(1)} of 255 anywhere`, `${r.skyWorst}`);
}

console.log('\n— the sky follows the look —');
{
  const r = await T(`var o = {}; function horizon() { var pos = skyDome.geometry.attributes.position, col = skyDome.geometry.attributes.color; for (var i = 0; i < pos.count; i++) if (pos.getY(i) < -10) return new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString(); }
    [1, 2, 3, 4].forEach(function (n) { startRound(n); o[TIMES[tod].name] = { horizon: horizon(), haze: scene.fog.color.getHexString(), ridge: ridgeMats[0].color.getHexString(), stars: skyStars.material.opacity }; });
    bossForce = 'wall'; startRound(5); o.ice = { horizon: horizon(), haze: scene.fog.color.getHexString(), ridge: ridgeMats[0].color.getHexString(), arena: arena };
    bossForce = 'walker'; startRound(10); o.lava = { horizon: horizon(), haze: scene.fog.color.getHexString(), ridge: ridgeMats[0].color.getHexString(), arena: arena };
    // a morning sky shows no shooting stars
    startRound(4); var seen = 0; for (var k = 0; k < 30 * 60; k++) { M.step(1); if (meteors.some(function (m) { return m.mesh.visible; })) seen++; }
    o.meteorsMorning = seen; startRound(2); seen = 0; for (k = 0; k < 30 * 60; k++) { M.step(1); if (meteors.some(function (m) { return m.mesh.visible; })) seen++; } o.meteorsNight = seen;
    JSON.stringify(o)`);
  const looks = ['dusk', 'night', 'dawn', 'morning', 'ice', 'lava'];
  check(looks.every(k => r[k].horizon === r[k].haze), 'at every time, and on the ice and the lava, the sky at the horizon is that look\'s own haze', JSON.stringify(r));
  check(r.ice.arena === 1 && r.lava.arena === 2 && r.ice.horizon !== r.dusk.horizon && r.lava.horizon !== r.dusk.horizon, 'the ice and the lava are no longer fought under the dusk sky', JSON.stringify(r));
  check(new Set(looks.map(k => r[k].ridge)).size === 6, 'the far ridges take each look\'s haze rather than staying dusk purple', JSON.stringify(looks.map(k => r[k].ridge)));
  check(r.meteorsMorning === 0 && r.meteorsNight > 0, `no shooting stars in a morning sky; at night they still come  [${(r.meteorsNight / 30).toFixed(1)}s of them in a minute]`, JSON.stringify(r));
}

console.log('\n— do the enemies still stand out —');
{
  // Each view drawn three times: the enemies alone as white silhouettes on black, which says where they are; then the
  // world with them shown and hidden. How much those two differ in brightness, averaged over every pixel of the
  // silhouettes, is how far the enemies stand out. A part of one that melts into the dark counts as a zero there.
  // (A first version averaged only over pixels that differed by more than a threshold, so whatever melted away simply
  // left the average: the mock-up's dark night, where the ships were hard to see, scored 119% of dusk.)
  // Fifteen views of an ordinary round, five of each kind: behind a capital ship, down onto a ground unit, and at a drone.
  let r = await T(`
    var gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, A = new Uint8Array(W * H * 4), B = new Uint8Array(W * H * 4);
    function enemies(on) {
      fleet.forEach(function (f) { if (f.gone <= 0) f.ship.visible = on; });
      drones.forEach(function (d) { if (d.alive) d.mesh.visible = on; });
      ground.forEach(function (g) { if (g.alive) g.group.visible = on; });
    }
    function shot(buf) { renderer.render(scene, camera); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); }
    var MASK = new Uint8Array(W * H * 4), white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), black = new THREE.Color(0);
    var GMASK = new Uint8Array(W * H * 4), terrainMesh = scene.children.filter(function (o) { return o.geometry === terrainGeo; })[0];
    function silhouettes(only, buf) {
      var keep = new Set(), was = [], bg = scene.background;
      if (only) keep.add(only); else { fleet.forEach(function (f) { if (f.gone <= 0) keep.add(f.ship); }); drones.forEach(function (d) { if (d.alive) keep.add(d.mesh); }); ground.forEach(function (g) { if (g.alive) keep.add(g.group); }); }
      scene.children.forEach(function (o) { was.push(o.visible); o.visible = keep.has(o); });
      scene.background = black; scene.overrideMaterial = white;
      shot(buf || MASK);
      scene.overrideMaterial = null; scene.background = bg; scene.children.forEach(function (o, i) { o.visible = was[i]; });
    }
    // brightness as a person at a sales desk sees it: the pixel as light, plus what the glass reflects of the room
    // (GLARE, a share of white: an assumption, not a measurement), then put on a scale of perceived lightness (CIE L*).
    // Without the glare a dark difference counts as much as a bright one, and on a phone under office light it does not.
    var GLARE = 0.04;
    function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    function lum(b, i) { var Y = (0.2126 * lin(b[i]) + 0.7152 * lin(b[i + 1]) + 0.0722 * lin(b[i + 2]) + GLARE) / (1 + GLARE); return (116 * Math.cbrt(Y) - 16) / 100; }
    function view(k, j) {
      var p, back, up;
      var pick = function (list) { return list[j % list.length]; }; // round 4 has only four capital ships
      if (k === 0) { p = pick(fleet.filter(function (x) { return x.gone <= 0 && !x.boss; })).ship.position; back = 140; up = 18; }
      else if (k === 1) { p = pick(ground.filter(function (x) { return x.alive; })).pos; back = 70; up = 45; }
      else { p = pick(drones.filter(function (x) { return x.alive; })).mesh.position; back = 45; up = 6; }
      shipPos.set(p.x + back * 0.5, p.y + up, p.z + back * 0.87); yaw = Math.atan2(shipPos.x - p.x, shipPos.z - p.z);
      pitch = Math.atan2(p.y - shipPos.y, Math.hypot(p.x - shipPos.x, p.z - shipPos.z)); bank = 0; basis(); speed = 0;
      camera.position.copy(shipPos).addScaledVector(fwdV, -9.5).addScaledVector(upV, 2.6); camera.lookAt(p);
      sky.position.copy(camera.position); camera.updateMatrixWorld();
    }
    // each landscape: one ordinary round, its enemies held where they are, under each time in turn; and on the ice and the
    // lava, under their boss rounds' look too, which is the control there
    // A fixed seed: the comparison is between looks over the same enemies, but which enemies, where, varied from run to
    // run, and on the lava the night swung from 87% to 69% of the boss look between two runs with nothing changed.
    var seed = 12345; Math.random = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    function measureArena(a) {
    var out = {};
    seed = 12345 + a; time = 0; last = M.now; // and the clock: drones circle by it, and its first step was however long the test took to get here
    chapterHold = a; startRound(a ? 9 : 4); M.step(30 * 3); inControl = false;
    var looks = [1, 2, 3, 4].map(function (n) { return todOf(n); }); if (a) looks.push('boss');
    looks.forEach(function (lk) {
      if (lk === 'boss') round = 10; else { tod = lk; round = a ? 9 : 4; } applyLook();
      var name = lk === 'boss' ? 'boss' : TIMES[lk].name;
      var sum = 0, px = 0, views = [], gs = 0, gs2 = 0, gn = 0;
      // five of each kind: one of each made the figure swing from 80% to 89% of dusk between runs
      for (var k = 0; k < 3; k++) {
        var s = 0, c = 0;
        for (var j = 0; j < 5; j++) {
          view(k, j); silhouettes(); enemies(true); shot(A); enemies(false); shot(B); enemies(true);
          for (var i = 0; i < A.length; i += 4) { if (MASK[i] < 128) continue; s += Math.abs(lum(A, i) - lum(B, i)); c++; }
          // the ground's light and shade, where the ground is and no enemy is in front of it
          silhouettes(terrainMesh, GMASK);
          for (i = 0; i < B.length; i += 4) { if (GMASK[i] < 128) continue; var v = lum(B, i); gs += v; gs2 += v * v; gn++; }
        }
        views.push(c ? s / c : 0); sum += s; px += c;
      }
      var gm = gs / Math.max(1, gn);
      out[name] = { mean: sum / Math.max(1, px), views: views, px: px, relief: Math.sqrt(Math.max(0, gs2 / Math.max(1, gn) - gm * gm)), groundL: gm };
    });
    return out;
    }
    var all = { 0: measureArena(0), 1: measureArena(1), 2: measureArena(2) }; chapterHold = 0;
    JSON.stringify(all)`);
  const R = r, rIce = R[1], rLava = R[2];
  r = R[0];
  const base = r.dusk.mean;
  console.log('  how far the enemies stand out, as a difference in perceived lightness where they are, under office light (0 to 1):');
  for (const k of ['dusk', 'night', 'dawn', 'morning']) console.log(`    ${k.padEnd(8)} ${r[k].mean.toFixed(3)}  (${Math.round(100 * r[k].mean / base)}% of dusk)   ship ${r[k].views[0].toFixed(3)}, ground unit ${r[k].views[1].toFixed(3)}, drone ${r[k].views[2].toFixed(3)}   over ${r[k].px} pixels`);
  check(base > 0.05 && r.dusk.px > 500, 'the measure sees the enemies at all: at dusk they cover pixels and differ from what is behind them', JSON.stringify(r.dusk));
  check(['night', 'dawn', 'morning'].every(k => r[k].mean >= 0.75 * base), 'at every time the enemies stand out at least three quarters as far as at dusk', JSON.stringify(r));
  check(['night', 'dawn', 'morning'].every(k => r[k].views.every((v, i) => v >= 0.6 * r.dusk.views[i])), 'and no one kind of enemy falls below 60% of how it stands out at dusk', JSON.stringify(r));
  // The enemies carry their own lights and outline, so they stand out against any dark world: a near-black night scored
  // 76% above. What a night that is too dark takes away is the ground: its shape, to fly low by. So, separately, the
  // spread of light and shade across the ground, under the same office light, against dusk.
  console.log('  the ground\'s light and shade (spread of perceived lightness across it), and how light it is:');
  for (const k of ['dusk', 'night', 'dawn', 'morning']) console.log(`    ${k.padEnd(8)} spread ${r[k].relief.toFixed(3)} (${Math.round(100 * r[k].relief / r.dusk.relief)}% of dusk), lightness ${r[k].groundL.toFixed(2)}`);
  check(['night', 'dawn', 'morning'].every(k => r[k].relief >= 0.6 * r.dusk.relief), 'at every time the ground keeps at least 60% of the light and shade it shows at dusk', JSON.stringify(['dusk', 'night', 'dawn', 'morning'].map(k => r[k].relief)));

  // The ice and the lava, which take every time of day in their ordinary rounds (Sam), against their own boss look.
  const T4 = ['dusk', 'night', 'dawn', 'morning'];
  for (const [nm, x] of [['ice', rIce], ['lava', rLava]]) {
    console.log(`  ${nm}, against its boss look: enemies stand out ` + T4.map(k => `${k} ${Math.round(100 * x[k].mean / x.boss.mean)}%`).join(', ') + `; the ground's light and shade ` + T4.map(k => `${k} ${Math.round(100 * x[k].relief / x.boss.relief)}%`).join(', '));
  }
  check([rIce, rLava].every(x => T4.every(k => x[k].mean >= 0.75 * x.boss.mean && x[k].relief >= 0.6 * x.boss.relief)), 'on the ice and the lava, at every time, enemies stand out at least three quarters as far and the ground keeps 60% of its light and shade, against each one\'s boss look', JSON.stringify({ ice: rIce, lava: rLava }));
}

console.log('\n— the ice and the lava take every time of day, and their bosses keep their look —');
{
  const r = await T(`var o = {};
    [1, 2].forEach(function (a) { chapterHold = a; var hz = [];
      for (var n = 6; n <= 9; n++) { startRound(n); hz.push(scene.fog.color.getHexString()); }
      startRound(10); o[a] = { times: hz, boss: scene.fog.color.getHexString(), own: new THREE.Color(ARENAS[a].haze).getHexString() }; });
    chapterHold = 0; JSON.stringify(o)`);
  check([1, 2].every(a => new Set(r[a].times).size === 4), 'each of the four ordinary rounds on the ice and on the lava has a look of its own', JSON.stringify(r));
  check([1, 2].every(a => r[a].boss === r[a].own && !r[a].times.includes(r[a].own)), 'and the boss round has its own look, exactly as before', JSON.stringify(r));
}

check(errors.length === 0, 'nothing threw', errors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
