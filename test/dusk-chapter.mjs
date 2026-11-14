// The chapters in docs/dusk/: every five rounds a new arena, each its boss's landscape (Sam: "every 5 rounds it moves
// to a new and larger arena"). This is the first step, the move: every arena is still the dusk hills' size.
//
// Asserts the order (the dusk hills first, then the ice and the lava in random order, round again, never the same twice
// running), that a chapter's rounds and its boss share one arena, what an ordinary round on the ice and on the lava is
// like, and that capital ships, which used to patrol only the dusk hills, clear the ground everywhere.
//
//   node test/dusk-chapter.mjs

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
    renderer.render = function () {}; wxHold = 'clear'; scaleHold = 1; // the size is dusk-size.mjs's business
    window.M = { now: performance.now() };
    M.step = function (n, each) { for (var i = 0; i < n; i++) { M.now += 1000 / 30; tick(M.now); if (each && each() === false) break; } };
    damage = function () {}; 1`));
  const r = await page.evaluate(c => window.__t(c), code);
  await page.close();
  return JSON.parse(r);
}

console.log('\n— the order —');
{
  // 300 runs of nine chapters, drawn as a run draws them: from round 1
  const r = await run(`var o = { first: {}, second: { 1: 0, 2: 0 }, repeats: 0, cyclesWhole: 0, cycles: 0 };
    for (var k = 0; k < 300; k++) { startRound(1); var seq = []; for (var c = 0; c < 9; c++) seq.push(chapterArena(c));
      o.first[seq[0]] = (o.first[seq[0]] || 0) + 1; o.second[seq[1]]++;
      for (c = 1; c < 9; c++) if (seq[c] === seq[c - 1]) o.repeats++;
      for (c = 0; c < 9; c += 3) { o.cycles++; if (seq[c] === 0 && seq.slice(c, c + 3).sort().join() === '0,1,2') o.cyclesWhole++; } }
    JSON.stringify(o)`);
  check(r.first[0] === 300, 'every run opens in the dusk hills', JSON.stringify(r));
  check(r.second[1] > 120 && r.second[2] > 120, `the second chapter is the ice or the lava, about half each  [of 300: ice ${r.second[1]}, lava ${r.second[2]}]`, JSON.stringify(r));
  check(r.cyclesWhole === r.cycles && r.repeats === 0, `every three chapters visit all three arenas, the dusk hills first, and none comes twice running  [${r.cycles} cycles]`, JSON.stringify(r));
}

console.log('\n— a chapter is one arena, ending in its boss —');
{
  const r = await run(`var o = []; startRound(1);
    for (var n = 1; n <= 15; n++) { startRound(n); roundBanner();
      var boss = isBossRound(n) ? (wallOn ? 'wall' : walker && walker.on ? 'walker' : fleet.some(function (f) { return f.boss && f.gone <= 0 && !f.selfMoved; }) ? 'dread' : '?') : '';
      o.push({ n: n, arena: arena, boss: boss, note: noteEl.textContent }); }
    JSON.stringify(o)`);
  const byCh = [0, 1, 2].map(c => r.slice(c * 5, c * 5 + 5));
  check(byCh.every(ch => ch.every(x => x.arena === ch[0].arena)), `all five rounds of a chapter are in one arena  [${byCh.map(ch => ch[0].arena).join(' → ')}]`, JSON.stringify(r.map(x => x.arena)));
  check(byCh.every(ch => ch[4].boss === ['dread', 'wall', 'walker'][ch[0].arena]), `and each ends in that arena's boss  [${byCh.map(ch => ch[4].boss).join(', ')}]`, JSON.stringify(r.map(x => x.boss)));
  check(/^Chapter 1 · The Dusk Hills/.test(r[0].note) && /^Chapter 2 · The (Ice|Lava) Field/.test(r[5].note) && !/Chapter/.test(r[1].note), `a chapter's first round names the place  [${r[5].note}]`, JSON.stringify([r[0].note, r[1].note, r[5].note]));
}

console.log('\n— an ordinary round on the ice and on the lava —');
{
  const ice = await run(`var o = {}; chapterHold = 1;
    // a wall round with sections down first, so the next visit has to put it back
    bossForce = 'wall'; startRound(5); hitCrack(wallSecs[0], 1e6); hitCrack(wallSecs[2], 1e6); M.step(60); o.downAfterFight = wallDown.join();
    startRound(6); o.arena = arena; o.wallOn = wallOn; o.wallDown = wallDown.join(); o.crest = Math.round(height(0, 0));
    o.cracks = wallSecs.some(function (s) { return s.grp.visible; }); o.towers = wallProps.visible;
    o.enemies = { ships: fleet.filter(function (f) { return f.gone <= 0; }).length, drones: drones.filter(function (d) { return d.alive; }).length, ground: ground.filter(function (g) { return g.alive; }).length };
    o.left = remaining();
    JSON.stringify(o)`);
  check(ice.arena === 1 && !ice.wallOn && !ice.cracks && !ice.towers, 'on the ice, an ordinary round: the wall stands, but no cracks, no guns on it, no towers', JSON.stringify(ice));
  check(ice.downAfterFight !== '0,0,0,0' && ice.wallDown === '0,0,0,0' && ice.crest >= 90, `and it stands whole again after a fight that brought sections down  [${ice.downAfterFight} → ${ice.wallDown}]`, JSON.stringify(ice));
  check(ice.enemies.ships === 6 && ice.enemies.drones === 30 && ice.enemies.ground === 30 && ice.left === 66, 'with an ordinary round\'s enemies, all of them counted', JSON.stringify(ice));

  const lava = await run(`var o = {}; chapterHold = 2; startRound(6); o.arena = arena; o.walker = walker ? walker.on : null;
    o.groundOnLava = ground.filter(function (g) { return g.alive && height(g.pos.x, g.pos.z) < 2.5; }).length; o.ground = ground.filter(function (g) { return g.alive; }).length;
    // an eruption in an ordinary round throws half its boss round's bombs
    shipPos.set(40, 60, 40); eruptT = 0.01; M.step(3); o.bombs = lavaBombs.filter(function (b) { return b.t >= 0; }).length; o.bossBombs = walkerSpec(chapterOf(6) + 1).bombs;
    o.left = remaining();
    JSON.stringify(o)`);
  check(lava.arena === 2 && lava.walker === false, 'on the lava, an ordinary round: no walker', JSON.stringify(lava));
  check(lava.bombs === Math.round(lava.bossBombs / 2), `the volcano erupts all the same, with half the bombs of the walker's round  [${lava.bombs} of ${lava.bossBombs}]`, JSON.stringify(lava));
  check(lava.ground === 30 && lava.groundOnLava === 0, 'no ground unit stands on the lava', JSON.stringify(lava));
}

console.log('\n— capital ships clear the ground in every arena —');
{
  // Over each ship's WHOLE circle, five points along its hull, against the ground: a first version flew a minute of
  // round 9 and saw a fifth of each circle, and missed that in the dusk hills, as the game always was, the fifth ship
  // flies 18 into a hill once every five minutes. The lift that keeps them over the ice wall fixed that too.
  const r = await run(`var o = {};
    function worst(f, alt) { var w = 1e9; for (var q = 0; q < 2000; q++) { var a = q / 2000 * 6.283, cx = Math.cos(a) * f.radius, cz = Math.sin(a) * f.radius, tx = -Math.sin(a), tz = Math.cos(a);
      for (var k = -2; k <= 2; k++) w = Math.min(w, alt - Math.max(height(cx + tx * k * 14 * f.scale, cz + tz * k * 14 * f.scale), 0)); } return w; }
    [0, 1, 2].forEach(function (a) { chapterHold = a; startRound(9); var ships = [];
      fleet.forEach(function (f, i) { if (f.boss || f.gone > 0) return; ships.push({ i: i, before: +worst(f, f.alt).toFixed(1), now: +worst(f, f.flyAlt).toFixed(1), lift: +(f.flyAlt - f.alt).toFixed(1) }); });
      o[a] = ships; });
    // and in flight: a minute of round 9 on the ice, the hull's height over the ground as it really moves
    chapterHold = 1; startRound(9); var min = 1e9;
    M.step(30 * 60, function () { fleet.forEach(function (f) { if (f.boss || f.gone > 0 || f.dying > 0) return; var p = f.ship.position;
      for (var q = -2; q <= 2; q++) { var x = p.x + Math.cos(f.angle + Math.PI / 2) * q * 14 * f.scale, z = p.z + Math.sin(f.angle + Math.PI / 2) * q * 14 * f.scale; min = Math.min(min, p.y - Math.max(height(x, z), 0)); } }); });
    o.flown = min; JSON.stringify(o)`);
  const names = ['dusk hills', 'ice field', 'lava field'];
  for (const a of [0, 1, 2]) console.log(`  ${names[a].padEnd(11)} nearest the ground on its whole circle, before → now: ` + r[a].map(x => `${x.before}→${x.now}`).join('  '));
  check([0, 1, 2].every(a => r[a].every(x => x.now >= 8)), 'no capital ship\'s hull comes within 8 of the ground anywhere on its whole circle, in any arena', JSON.stringify(r));
  check(r[0].filter(x => x.before < 0).length === 1 && r[0].every(x => x.before >= 10 ? x.lift === 0 : true), `in the dusk hills, ships that were clear fly as they did; the one that went ${-Math.min(...r[0].map(x => x.before))} into a hill is now over it`, JSON.stringify(r[0]));
  check(r[1].some(x => x.lift > 20), `on the ice, ships are lifted over the wall  [${r[1].filter(x => x.lift > 0).length} of 9, by up to ${Math.max(...r[1].map(x => x.lift))}]`, JSON.stringify(r[1]));
  check(r.flown >= 8, `and flying a minute over the ice, the nearest any hull comes is ${r.flown.toFixed(1)}`, JSON.stringify(r.flown));
}

console.log('\n— a new run, and the Sam panel —');
{
  const r = await run(`var o = {}; var orders = {}; for (var k = 0; k < 40; k++) { startRound(1); orders[[0, 1, 2, 3, 4, 5].map(chapterArena).join('')] = 1; }
    o.orders = Object.keys(orders).length;
    // dying starts a new run, which draws its own order
    // (through the game's own restart: a first version set the death flags by hand, and nothing restarted)
    startRound(1); startRound(7); var drew = 0, ca = chapterArena; chapterArena = function (c) { if (c === 0 && chOrder.length === 0) drew++; return ca(c); };
    respawn(); chapterArena = ca; o.restarted = round === 1; o.newDraw = drew > 0 && chOrder[0] === 0;
    // the boss buttons: the wall at round 5 makes chapter 1 the ice, and chapter 2 is then not the ice again
    // with the order set so that the ice comes second: a first version left it to chance, and passed with the rule deleted
    startRound(1); chOrder = [0, 1, 2]; bossForce = 'wall'; startRound(5); o.forced = { arena: arena, wall: wallOn, next: chapterArena(1) };
    JSON.stringify(o)`);
  check(r.orders === 4, `different runs draw different orders: of 40 runs, ${r.orders} different first six chapters (there are 4)`, JSON.stringify(r));
  check(r.restarted && r.newDraw, 'dying starts a new run at round 1 with an order drawn afresh, from the dusk hills', JSON.stringify(r));
  check(r.forced.arena === 1 && r.forced.wall && r.forced.next !== 1, 'the Sam panel\'s boss buttons still work: the wall at round 5 is fought on the ice, and the next chapter is somewhere else', JSON.stringify(r.forced));
}

check(allErrors.length === 0, 'nothing threw anywhere in this suite', allErrors);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
