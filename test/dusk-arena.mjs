// The arena swap in docs/dusk/: the same map with a different landscape under it.
//
// The risk in swapping the ground is anything left standing where the old ground was. So this asks, for both
// landscapes and for the trip there and back: does the mesh you SEE agree with the height the game USES, does
// everything that stands on the ground stand on it, and is what belongs to the other landscape put away.
//
//   node test/dusk-arena.mjs

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
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
await page.mouse.click(196, 426);
const r = JSON.parse(await page.evaluate(() => window.__t(`
  chapterHold = 0; wxHold = 'clear'; wxStart(round); // the chapters and the weather vary; these checks are about other things, so hold them: dusk hills, clear
  renderer.render = function () {};
  var now = performance.now(); function st(n) { for (var i = 0; i < n; i++) { now += 1000 / 30; tick(now); } }
  st(3); damage = function () {}; arenaHold = true;   // these rounds are ordinary ones played on the ice, which the game itself never does
  var pos = terrainGeo.attributes.position, col = terrainGeo.attributes.color.array;
  function survey() {
    var o = { verts: pos.count, meshOff: 0, worst: 0, r: 0, b: 0, top: -1e9 };
    for (var i = 0; i < pos.count; i++) { var d = Math.abs(pos.getY(i) - height(pos.getX(i), pos.getZ(i))); if (d > 1e-4) o.meshOff++; if (d > o.worst) o.worst = d; o.r += col[i * 3]; o.b += col[i * 3 + 2]; if (pos.getY(i) > o.top) o.top = pos.getY(i); }
    o.r /= pos.count; o.b /= pos.count;
    var g = ground.filter(function (x) { return x.alive; });
    o.ground = g.length; o.groundOff = g.filter(function (x) { return Math.abs(x.pos.y - (height(x.pos.x, x.pos.z) + 1.9)) > 0.01; }).length;
    o.groundTilted = g.filter(function (x) { var h = height(x.pos.x, x.pos.z); return Math.abs(height(x.pos.x + 3, x.pos.z) - h) > 2.2 || Math.abs(height(x.pos.x, x.pos.z + 3) - h) > 2.2; }).length;
    o.groundOnWall = g.filter(function (x) { return x.pos.y > 25; }).length;
    var d = drones.filter(function (x) { return x.alive; });
    o.drones = d.length; o.dronesUnder = d.filter(function (x) { for (var a = 0; a < 6.3; a += 0.2) { if (x.c.y - 4 < Math.max(height(x.c.x + Math.cos(a) * x.r, x.c.z + Math.sin(a) * x.r), 0) + 2) return true; } return false; }).length;   // anywhere round its circle, at the bottom of its bob
    o.props = duskProps.visible; o.fog = scene.fog.color.getHex(); o.shipClear = shipPos.y - Math.max(height(shipPos.x, shipPos.z), 0);
    return o;
  }
  var out = {}, snap0 = Array.prototype.slice.call(pos.array);
  startRound(4); st(60); out.dusk = survey();
  setArena(1); startRound(4); st(60); out.ice = survey();
  // the wall itself, read off the function the game uses
  out.wall = { crest: [], ledge1: [], ledge2: [], plain: [] };
  for (var x = -80; x <= 80; x += 20) { out.wall.crest.push(Math.round(height(x, 0))); out.wall.ledge1.push(Math.round(height(x, 18))); out.wall.ledge2.push(Math.round(height(x, -36))); out.wall.plain.push(Math.round(height(x, 90))); }
  out.wall.ledgeFlat = [18, -18, 36, -36].every(function (z) { for (var x = -80; x <= 80; x += 4) { var h = height(x, z); if (Math.abs(height(x + 3, z) - h) > 2.2 || Math.abs(height(x, z + 3) - h) > 2.2) return false; } return true; });
  out.wall.ends = [Math.round(height(140, 0)), Math.round(height(-140, 0))];
  setArena(0); startRound(4); st(60); out.back = survey();
  var same = 0; for (var i = 0; i < snap0.length; i++) if (Math.abs(snap0[i] - pos.array[i]) > 1e-6) same++;
  out.backDiff = same;
  JSON.stringify(out)`)));
await browser.close();

const land = (name, o, want) => {
  check(o.meshOff === 0, `${name}: every one of the ${o.verts} mesh vertices is at the height the game uses there`, `${o.meshOff} off, worst by ${o.worst.toFixed(3)}`);
  check(o.ground === 20 && o.groundOff === 0, `${name}: all ${o.ground} ground units sit on the ground`, `${o.groundOff} of ${o.ground} are not at ground level`);
  check(o.drones === 20 && o.dronesUnder === 0, `${name}: no drone's circle passes through the landscape anywhere  [${o.drones} checked]`, `${o.dronesUnder} are below the surface`);
  check(o.shipClear > 5, `${name}: your ship is above the ground  [by ${o.shipClear.toFixed(0)}]`, `${o.shipClear}`);
  check(o.props === want.props, `${name}: the landing pad, spire and pylons are ${want.props ? 'out' : 'put away'}`, `visible: ${o.props}`);
};
console.log('\n— dusk, as it always was —');
land('dusk', r.dusk, { props: true });
console.log('\n— the ice field —');
land('ice', r.ice, { props: false });
check(r.ice.b > r.ice.r * 1.25 && r.dusk.r > r.dusk.b * 0.8, `ice is blue and dusk is not  [red/blue: ice ${r.ice.r.toFixed(2)}/${r.ice.b.toFixed(2)}, dusk ${r.dusk.r.toFixed(2)}/${r.dusk.b.toFixed(2)}]`, JSON.stringify([r.ice.r, r.ice.b, r.dusk.r, r.dusk.b]));
check(r.ice.fog !== r.dusk.fog, 'and the haze changes colour with it', `${r.ice.fog} / ${r.dusk.fog}`);
console.log(`  ground units that landed on the wall's ledges of their own accord: ${r.ice.groundOnWall} of ${r.ice.ground}; on a slope: ${r.ice.groundTilted}`);

console.log('\n— the wall —');
const all = (a, lo, hi) => a.every(v => v >= lo && v <= hi);
check(all(r.wall.crest, 95, 105), `the crest stands at 95 and a little over, jagged, for 160 along the wall  [${r.wall.crest.join(' ')}]`, r.wall.crest.join(' '));
check(all(r.wall.ledge1, 61, 63) && all(r.wall.ledge2, 31, 33), `a ledge at 62 and a ledge at 32, each side  [${r.wall.ledge1[0]}, ${r.wall.ledge2[0]}]`, JSON.stringify(r.wall));
check(r.wall.ledgeFlat, 'both ledges on both faces are level enough for a ground unit to stand anywhere along them', 'a ledge has a slope steeper than a ground unit accepts');
check(all(r.wall.plain, 0, 14) && all(r.wall.ends, 0, 14), `the ice beyond it is a plain, and the wall has ends you can fly round  [plain ${Math.min(...r.wall.plain)} to ${Math.max(...r.wall.plain)}]`, JSON.stringify(r.wall));

console.log('\n— and back again —');
land('dusk again', r.back, { props: true });
check(r.backDiff === 0, 'the dusk landscape comes back exactly as it was: not one coordinate different', `${r.backDiff} coordinates differ`);
check(r.back.fog === r.dusk.fog, 'and so does its haze', `${r.back.fog} / ${r.dusk.fog}`);

check(errors.length === 0, 'nothing threw', errors);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
