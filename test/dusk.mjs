// Smoke test for docs/dusk/ -- "A small world at dusk".
//
// It proves the page OPENS AND RUNS as published, and nothing about how it
// plays. Headless Chromium draws this game at a few frames a second, so feel
// is Sam's to judge on his phone and no figure from here describes it.
//
// Four things, each of which fails silently on a phone:
//   · nothing threw, and nothing was logged as an error
//   · the page asked for nothing outside its own folder -- three.js used to
//     come from a CDN, and one stray absolute URL would put that dependency
//     back without any visible sign until the first time there is no signal
//   · the picture changes between two moments, so the loop is ticking and
//     WebGL is drawing rather than leaving a styled blank
//   · the Sam panel shows the BUILD the source declares. The tag is READ from
//     the file, not restated here: a second copy would be the one to go stale.
//
//   node test/dusk.mjs

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'docs', 'dusk', 'index.html');
const source = readFileSync(file, 'utf8');

let passed = 0, failed = 0;
const ok = name => { passed++; console.log(` ok   ${name}`); };
const bad = (name, why) => { failed++; console.log(`FAIL  ${name}`); [].concat(why).forEach(w => console.log(`        · ${w}`)); };

const m = source.match(/var BUILD = '([^']+)'/);
if (!m) { console.log('FAIL  the source declares a BUILD tag\n        · no "var BUILD = \'...\'" in docs/dusk/index.html'); process.exit(1); }
const BUILD = m[1];

const browser = await chromium.launch();
// iPhone 16 in portrait, which is the only screen this game is played on.
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });

const errors = [], outside = [];
page.on('pageerror', e => errors.push('threw: ' + e.message.split('\n')[0]));
page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text().split('\n')[0]); });
await page.route(/^https?:/, route => { outside.push(route.request().url()); route.abort(); });

await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });

const three = await page.evaluate(() => (window.THREE ? window.THREE.REVISION : null));
if (three === '128') ok('three.js loads from beside the page  [r128]');
else bad('three.js loads from beside the page', `window.THREE.REVISION is ${three}, wanted 128`);

await page.waitForTimeout(600);
const a = await page.screenshot();
await page.waitForTimeout(1500);
const b = await page.screenshot();
if (!a.equals(b)) ok('the picture changes over 1.5s, so the loop is ticking and drawing');
else bad('the picture changes over 1.5s', 'two screenshots 1.5s apart are byte-identical: the loop is stopped or nothing is being drawn');

// The Sam button does not exist for the eye until the first touch hands over the
// controls -- before that the page is an orbiting title shot. So touch first.
await page.mouse.click(196, 426);
await page.waitForTimeout(300);
await page.click('#sam');
await page.waitForTimeout(700);   // the diagnostic line repaints every 400ms while the panel is open
const diag = await page.textContent('#devDiag');
if ((diag || '').startsWith('build ' + BUILD + ' ')) ok(`the Sam panel shows the build the source declares  [${BUILD}]`);
else bad('the Sam panel shows the build the source declares', `source says ${BUILD}; the panel reads "${(diag || '').slice(0, 60)}"`);

if (outside.length === 0) ok('nothing was requested from outside the folder');
else bad('nothing was requested from outside the folder', outside);

if (errors.length === 0) ok('nothing threw and nothing was logged as an error');
else bad('nothing threw and nothing was logged as an error', errors);

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
