// The weather's sound in docs/dusk/: background beds under the music, and thunder after lightning.
//
// Nothing here can hear it. What it can do is measure the signal: how loud each bed is, coming out of the weather's
// own bus, against the music coming out of the music's, in each weather and each landscape; that thunder comes after
// its flash and not with it; and that the sound modes do what they say. The browser runs with its tap-to-start rule
// ON, as a phone does: an earlier audio suite here ran with it off and so proved nothing about a phone.
//
//   node test/dusk-wxsound.mjs

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

const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
const T = c => page.evaluate(code => window.__t(code), c).then(JSON.parse);
const wait = ms => page.waitForTimeout(ms);

// before anyone has touched the screen: a storm is on and nothing is made
const before = await T(`renderer.render = function () {}; chapterHold = 0; window.M = { now: performance.now() };
  M.step = function (n) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); } };
  wxHold = 'storm'; startRound(1); M.step(30); wxBolt(); JSON.stringify({ actx: actx === null, wxs: wxs === null })`);
check(before.actx && before.wxs, 'before the first tap, in a storm with lightning, no sound is made at all: nothing is even built', JSON.stringify(before));

await page.mouse.click(196, 426);
await wait(400);
// the weather bus and the music, each into an analyser of its own
const started = await T(`(function () {
  M.step(3); musicFrame(true);
  window.AN = { wx: actx.createAnalyser(), mus: actx.createAnalyser() }; AN.wx.fftSize = 2048; AN.mus.fftSize = 2048;
  wxs.bus.connect(AN.wx); mus.out.connect(AN.mus);
  AN.rms = function (a) { var d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d); var s = 0; for (var i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length); };
  return JSON.stringify({ state: actx.state, wxs: !!wxs, mus: !!mus });
})()`);
check(started.state === 'running' && started.wxs, 'one tap and the sound is running, the weather beds with it', JSON.stringify(started));

// hold a weather, keep the game ticking in real time, and read both buses over the last second
async function listen(w, boss, n) {
  await T(`wxHold = '${w}'; ${boss ? `bossForce = '${boss}';` : ''} startRound(${n || 1}); devHeat = 0; '1'`);
  const reads = { wx: [], mus: [] };
  for (let i = 0; i < 40; i++) {
    const r = await T(`M.step(2); JSON.stringify({ wx: AN.rms(AN.wx), mus: AN.rms(AN.mus) })`);
    if (i >= 20) { reads.wx.push(r.wx); reads.mus.push(r.mus); }
    await wait(50);
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  return { wx: avg(reads.wx), mus: avg(reads.mus) };
}
const db = v => v > 1e-6 ? (20 * Math.log10(v)).toFixed(1) + ' dB' : 'silent';
const L = {};
for (const [k, w, boss, n] of [['clear', 'clear'], ['fog', 'fog'], ['rain', 'rain'], ['storm', 'storm'], ['snow', 'rain', 'wall', 5], ['blizzard', 'storm', 'wall', 5], ['ash', 'rain', 'walker', 10]]) {
  L[k] = await listen(w, boss, n);
}
console.log('  loudness out of the weather\'s bus, against the music\'s, both in calm (heat 0):');
for (const k of Object.keys(L)) console.log(`    ${k.padEnd(9)} weather ${db(L[k].wx).padStart(9)}   music ${db(L[k].mus).padStart(9)}`);

check(L.clear.wx < 1e-4 && L.fog.wx < 1e-4, 'clear and fog are silent', JSON.stringify([L.clear, L.fog]));
check(L.rain.wx > 1e-3 && L.storm.wx > L.rain.wx && L.snow.wx > 1e-4 && L.snow.wx < L.rain.wx && L.ash.wx > 1e-4, 'rain hisses, a storm is louder, snow is softer than rain, and ash crackles', JSON.stringify(L));
const music = Math.min(...Object.values(L).map(x => x.mus));
check(music > 1e-3, `the music is playing to be measured against  [quietest ${db(music)}]`, JSON.stringify(L));
// against the music's typical level: its level at any one moment wanders by 4 dB with the bar it is in
const musSorted = Object.values(L).map(x => x.mus).sort((a, b) => a - b), musMid = musSorted[Math.floor(musSorted.length / 2)];
check(Object.values(L).every(x => x.wx < 0.5 * musMid), `every weather sits under the music: 6 dB or more below its typical level in calm  [music ${db(musMid)}, loudest weather ${db(Math.max(...Object.values(L).map(x => x.wx)))}]`, JSON.stringify(L));

// thunder: in fog, so no bed is playing, a bolt and then listen
// (a first version threw the bolt straight after a storm and heard that storm's rain still fading, at 0 seconds)
await T(`wxHold = 'fog'; startRound(1); '1'`);
for (let i = 0; i < 40; i++) { await T(`M.step(2); '1'`); await wait(75); }
const quiet = await T(`JSON.stringify({ v: AN.rms(AN.wx) })`);
await T(`window.TH0 = actx.currentTime; wxBolt(); '1'`);
const samples = [];
for (let i = 0; i < 70; i++) { const r = await T(`JSON.stringify({ t: actx.currentTime - TH0, v: AN.rms(AN.wx) })`); samples.push(r); await wait(100); }
// heard while within a tenth of its own peak: each clap is 60 to 100% as loud, and a first version used a fixed floor,
// so a quiet clap sank under it sooner and the check failed one run in a few
const peak0 = Math.max(...samples.map(s => s.v)), loud = samples.filter(s => s.v > peak0 / 10);
const first = loud.length ? loud[0].t : null, last = loud.length ? loud[loud.length - 1].t : null, peak = Math.max(...samples.map(s => s.v));
console.log(`  thunder: first heard ${first === null ? 'never' : first.toFixed(2) + 's'} after the flash, last at ${last === null ? '–' : last.toFixed(2) + 's'}, peak ${db(peak)}`);
check(quiet.v < 1e-4 && first !== null && first >= 0.7 && first <= 2.5 && last - first > 1.5, 'thunder comes a second or two after its flash, not with it, and rolls on for a while', JSON.stringify(samples.filter((s, i) => i % 5 === 0)));
check(peak < 1.2 * Math.max(...Object.values(L).map(x => x.mus)), 'and is no louder than the music', JSON.stringify({ peak }));

// the sound modes: effects only keeps the weather; silent stops everything and makes no thunder
const modes = await T(`(function () {
  var o = {}; wxHold = 'rain'; startRound(1);
  while (muted || !musicOn) sndEl.click();   // to "everything"
  sndEl.click(); o.fxOnly = { muted: muted, music: musicOn };
  return JSON.stringify(o);
})()`);
// with the game ticking while it waits: a first version read the bus before a single frame had faded the rain in
for (let i = 0; i < 30; i++) { await T(`M.step(2); '1'`); await wait(60); }
const fx = await T(`JSON.stringify({ wx: AN.rms(AN.wx) })`);
await T(`sndEl.click(); '1'`);
await wait(600);
const silent = await T(`var v = voices; wxBolt(); JSON.stringify({ muted: muted, master: aMaster.gain.value, added: voices - v })`);
check(!modes.fxOnly.muted && !modes.fxOnly.music && fx.wx > 1e-3, `"effects only" keeps the weather  [rain at ${db(fx.wx)}]`, JSON.stringify([modes, fx]));
check(silent.muted && silent.master < 0.01 && silent.added === 0, '"silent" silences it, and a flash makes no thunder', JSON.stringify(silent));
await T(`sndEl.click(); '1'`); // back to everything, as stored

check(errors.length === 0, 'nothing threw', errors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
