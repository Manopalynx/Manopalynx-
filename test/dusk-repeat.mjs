// Does a seeded Dusk suite repeat itself? The guard on test/dusk-seed.mjs.
//
// The same fight is run on three fresh pages that differ only in how long they wait in real time: before the first
// step, and between two pieces of work. With the helper they must end in exactly the same place. Each of the things
// the helper pins (the random, the audio, the clock) made them differ when it was left out; see that file.
//
//   node test/dusk-repeat.mjs

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
const ok = n => { passed++; console.log(` ok   ${n}`); };
const bad = (n, why) => { failed++; console.log(`FAIL  ${n}`); [].concat(why).forEach(w => console.log(`        · ${w}`)); };
const check = (cond, n, why) => cond ? ok(n) : bad(n, why);
const errorsSeen = [];

const browser = await chromium.launch();

const runs = [];
for (const [wait, gap] of [[0, 0], [700, 0], [1500, 900]]) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', e => errorsSeen.push(e.message.split('\n')[0]));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await seedPage(page);
  await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' });
  await page.mouse.click(196, 426);
  await page.waitForTimeout(wait);
  // round 6 with every enemy in it, the hull held, the ship turning slowly with its guns and seekers going
  await page.evaluate(() => window.__t(`
    renderer.render = function () {}; chapterHold = 0; scaleHold = 1; wxHold = 'clear';
    window.M = { now: performance.now(), marks: [], hits: 0 };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each) each(); } };
    M.step(3); startRound(6); damage = function () { M.hits++; }; up.seeker = 2;
    M.go = function () { M.step(900, function () { keys.fire = true; yaw += 0.01; if (Math.round(time * 30) % 300 === 0) M.marks.push((window.__seed >>> 0).toString(36) + ':' + M.hits + ':' + shipPos.x.toFixed(6) + ':' + remaining()); }); };
    M.go(); 0`));
  await page.waitForTimeout(gap);
  runs.push({ wait, gap, marks: await page.evaluate(() => window.__t(`M.go(); M.marks.join(' ')`)) });
  await page.close();
}
for (const r of runs) console.log(`  waited ${String(r.wait).padStart(4)} ms, then ${String(r.gap).padStart(3)} ms between: ${r.marks}`);
check(runs[0].marks.split(' ').length === 6 && /:\d+:-?\d+\.\d{6}:\d+$/.test(runs[0].marks), 'the fight was fought: six marks of the random, the hits taken, where the ship is and what is left', runs[0].marks);
check(runs.every(r => r.marks === runs[0].marks), 'three pages that waited different lengths of real time ended a minute\'s fight in exactly the same place', runs.map(r => r.marks));
check(errorsSeen.length === 0, 'nothing threw', errorsSeen.slice(0, 5));
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
