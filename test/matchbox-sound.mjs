// What the box sounds like, measured rather than described.
//
// This cannot tell you whether the result is pleasant. Nothing here can — that judgement
// is Sam's, and the numbers it would need are all at the top of `SOUND` in the page so
// acting on it is a one-line change. What it CAN tell you is the set of things that
// would make the sound silently pointless, every one of which has actually happened to
// this repository's other project:
//
//   * that it plays at all, and only when it has been switched on;
//   * that the two voices answer the two numbers they are supposed to answer, rather
//     than sitting at a constant that happens to sound plausible;
//   * that the drone never drops below the floor a phone speaker can reproduce;
//   * and that what comes out SURVIVES A PHONE SPEAKER, which is the one that sank the
//     first version of the Neurex cues in `docs/`: written at 34–58Hz, 22% of the energy
//     made it through a 500Hz highpass, and two entire games were played without either
//     cue being heard once.
//
// The graph under test is the page's own. `soundBuild` takes a context so this file can
// hand it an OfflineAudioContext and render the real thing — a test that rebuilds the
// graph in order to measure it is measuring its own copy, which is the mistake the sim
// harness carries a comment about and the one this file would be likeliest to repeat.
//
// Run:  node test/matchbox-sound.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const PAGE = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '..', 'matchbox.html');
const VIEWPORT = { width: 430, height: 900 };

let passed = 0, failed = 0;

/* Rendering helpers, injected once. `render` drives the page's own graph in an offline
   context at a given fire and heat, and hands back the RMS of the result and the RMS of
   the same result through a 500Hz highpass standing in for a small speaker.

   THE REFERENCE DIVISION IS NOT OPTIONAL. A biquad highpass is not unity in its
   passband, so the raw ratio of filtered to unfiltered understates what survives — the
   same measurement in `docs/` once reported "127% survives", which is not a fraction of
   anything, because the filter has gain of its own. So the filter is characterised first
   on a 2kHz tone that is entirely in its passband, and every ratio is divided by that. */
const HARNESS = `
  window.__rms = (buf) => {
    const d = buf.getChannelData(0);
    let s = 0; for (let i=0;i<d.length;i++) s += d[i]*d[i];
    return Math.sqrt(s / d.length);
  };
  window.__through = async (rendered, hz) => {
    const c = new OfflineAudioContext(1, rendered.length, rendered.sampleRate);
    const src = c.createBufferSource(); src.buffer = rendered;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hz; f.Q.value = .707;
    src.connect(f); f.connect(c.destination); src.start();
    return __rms(await c.startRendering());
  };
  // What the filter does to something it is supposed to pass unchanged.
  window.__reference = async (hz) => {
    const rate = 44100, len = rate;
    const a = new OfflineAudioContext(1, len, rate);
    const o = a.createOscillator(); o.type='sine'; o.frequency.value = 2000;
    const g = a.createGain(); g.gain.value = .5;
    o.connect(g); g.connect(a.destination); o.start();
    const plain = await a.startRendering();
    return (await __through(plain, hz)) / __rms(plain);
  };
  /* One render of the page's own graph. The scene is not simulated — the two numbers the
     sound is driven by are set directly, which is the whole point of the sound being
     driven by two numbers. */
  window.__render = async (lit, above, secs) => {
    const rate = 44100, len = Math.floor(rate * (secs || 2));
    const c = new OfflineAudioContext(1, len, rate);
    if (!soundBuild(c)) throw new Error('the page would not build its graph');
    soundOn = true;
    snd.master.gain.value = SOUND.master;
    AMBIENT = 20; boxMix = 20 + above; alightCount = lit;
    soundUpdate();
    const out = await c.startRendering();
    return { rms: __rms(out), buf: out,
             hz: snd.saws[0].frequency.value,
             fire: snd.fireGain.gain.value,
             band: snd.fireFilt.frequency.value,
             open: snd.heatFilt.frequency.value,
             drone: snd.heatGain.gain.value };
  };
`;

async function check(browser, name, body){
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.setDefaultTimeout(30000);
  const problems = [];
  page.on('pageerror', e => problems.push('uncaught: ' + e.message));
  page.on('console', c => { if (c.type()==='error' && !/Failed to load resource/.test(c.text())) problems.push('console: ' + c.text()); });
  await page.route(u => /^https?:/.test(u.href), r => r.abort());
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  const fails = [];
  try {
    await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof W !== 'undefined' && W > 40);
    await page.evaluate(HARNESS);
    const out = await body(page);
    if (out) fails.push(out);
    if (problems.length) fails.unshift(problems[0]);
  } catch (err) {
    fails.push('harness error: ' + String(err.message).split('\n')[0]);
  }
  if (fails.length){ failed++; console.log(`FAIL  ${name}`); fails.forEach(f => console.log(`        · ${f}`)); }
  else { passed++; console.log(` ok   ${name}`); }
  await page.close();
}

const browser = await chromium.launch();

console.log('\n— it plays, and only when asked —');

await check(browser, 'the page makes no context until it is switched on', async p => {
  const before = await p.evaluate(() => actx === null && snd === null && soundOn === false);
  if (!before) return 'the page had already built an audio context at boot, which iOS hands over and then will not let make a sound';
  return null;
});

/* Both guards, separately, because they are not the same guard and one of them hides
   the other.

   The master gate starts at zero and only `soundSet` opens it, so a render with the
   sound off is silent whatever `soundUpdate` does. That makes the render check alone
   pass with `soundUpdate`'s own `!soundOn` guard deleted — mutation-tested, and it duly
   stayed green. Belt and braces measures exactly like decoration from the outside, so
   the second half is asserted directly: with the gate forced open, an off box must not
   move a single voice. */
await check(browser, 'switched off, the graph is silent and stays where it was put', async p => {
  const r = await p.evaluate(async () => {
    const one = async (openTheGate) => {
      const rate = 44100, len = rate;
      const c = new OfflineAudioContext(1, len, rate);
      soundBuild(c);
      soundOn = false;
      AMBIENT = 20; boxMix = 320; alightCount = 150;   // a large fire, and it must not matter
      if (openTheGate){
        /* The gate held open and both voices wound to nothing, so the only thing that
           can make a sound is `soundUpdate` deciding to. With its guard in place it
           declines and this renders silent; with the guard gone it drives a large fire
           into an open gate and this does not.

           Reading the AudioParams back instead does not work, and that is worth writing
           down: `setTargetAtTime` SCHEDULES a change, it does not move `.value`. A first
           version of this check compared the parameters before and after and passed with
           the guard deleted, because there was nothing to see yet. */
        snd.master.gain.value = SOUND.master;
        snd.heatGain.gain.value = 0;
        snd.fireGain.gain.value = 0;
      }
      soundUpdate();
      return __rms(await c.startRendering());
    };
    return { shut: await one(false), open: await one(true) };
  });
  const bad = [];
  // A bar rather than an equality, because a biquad has a transient of its own at t=0.
  if (r.shut > 1e-4) bad.push(`a fire with the sound off rendered at ${r.shut.toFixed(5)} RMS — the master gate is not holding`);
  if (r.open > 1e-3) bad.push(`with the gate forced open and both voices at zero, an off box still rendered at ${r.open.toFixed(5)} RMS `
    + `— soundUpdate is driving the graph when the sound is switched off`);
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— the two voices answer the two numbers —');

await check(browser, 'the fire voice follows what is alight, and not the room', async p => {
  const r = await p.evaluate(async () => ({
    none:   (await __render(0, 0)).fire,
    candle: (await __render(6, 2)).fire,
    forge:  (await __render(135, 36)).fire,
    open:   (await __render(155, 40)).fire,
    // An empty box in an oven. `alightCount` is 0 and the room is at 230, so the fire
    // voice must not stir at all — this is the case that killed using the box's own
    // temperature as the signal.
    oven:   (await __render(0, 0, 2)).fire
  }));
  const bad = [];
  if (!(r.none === 0)) bad.push(`an unlit box has the fire voice at ${r.none.toFixed(3)}`);
  if (!(r.candle > 0 && r.candle < r.forge)) bad.push(`a candle reads ${r.candle.toFixed(3)} against a forge's ${r.forge.toFixed(3)}`);
  if (!(r.forge < r.open)) bad.push(`the forge reads ${r.forge.toFixed(3)} against the opening scene's ${r.open.toFixed(3)}`);
  if (r.oven !== 0) bad.push(`an empty box reads ${r.oven.toFixed(3)} — the fire voice is hearing the room`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the heat voice reaches both ends and saturates at neither', async p => {
  const r = await p.evaluate(async () => ({
    still:   (await __render(0, 0)).hz,
    candle:  (await __render(6, 2)).hz,
    forge:   (await __render(135, 36)).hz,
    volcano: (await __render(27, 522)).hz,
    nitro:   (await __render(0, -31)).hz,
    ice:     (await __render(0, -33)).hz
  }));
  const bad = [];
  if (Math.abs(r.still - 110) > .5) bad.push(`a still box sits at ${r.still.toFixed(1)}Hz rather than the 110 it rests at`);
  if (!(r.candle < r.forge && r.forge < r.volcano))
    bad.push(`candle ${r.candle.toFixed(1)}, forge ${r.forge.toFixed(1)}, volcano ${r.volcano.toFixed(1)} — not in order`);
  /* The candle, and not the forge, because the candle is the only place the choice of
     compression makes any difference at all.

     This check used to assert the FORGE's position, on the stated grounds that a `tanh`
     would crowd every ordinary fire into the bottom of the scale. Mutation-tested by
     swapping the log for `tanh(x/60)`, and it stayed green — because the claim was
     wrong. The two agree within a tenth everywhere except one scene:

           tanh(x/60)   log1p/log1p
       candle    0.033         0.175    5.3x
       Forge     0.532         0.575    1.1x
       opening   0.587         0.594    1.0x
       Volcano   1.000         0.999    1.0x

     A candle is the scene most likely to be the only thing in the box, and under a tanh
     it is 3% of the way up a scale it has entirely to itself. So the bar goes on the
     quiet end, which is where the decision actually lives. */
  const span = r.volcano - r.still;
  const at = (r.candle - r.still) / span;
  if (!(at > .10))
    bad.push(`a candle sits ${(at*100).toFixed(1)}% of the way from a still box to the volcano `
           + `— the quiet end of the scale is crowded, which is what a tanh does here`);
  const forge = (r.forge - r.still) / span;
  if (!(forge > .35 && forge < .75))
    bad.push(`the forge sits ${(forge*100)|0}% of the way from still to the volcano`);
  if (!(r.nitro < r.still && r.ice < r.nitro))
    bad.push(`cold does not take the drone down: still ${r.still.toFixed(1)}, nitrogen ${r.nitro.toFixed(1)}, ice ${r.ice.toFixed(1)}`);
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— it survives the speaker it will be played through —');

await check(browser, 'the drone never drops below what a phone can reproduce', async p => {
  const worst = await p.evaluate(async () => {
    let lo = 1e9, at = 0;
    // Swept past the measured extremes in both directions, because `heatRef` is the
    // largest excursion anyone has built rather than a bound the box enforces.
    for (let above = -900; above <= 900; above += 30){
      const hz = (await __render(0, above, .2)).hz;
      if (hz < lo){ lo = hz; at = above; }
    }
    return { lo, at };
  });
  if (worst.lo < 82) return `the drone reaches ${worst.lo.toFixed(1)}Hz at ${worst.at}°C above the room — under 82Hz a phone speaker does not reproduce the fundamental`;
  return null;
});

await check(browser, 'what comes out is still there after a phone speaker has had it', async p => {
  const r = await p.evaluate(async () => {
    const ref = await __reference(500);
    const one = async (lit, above) => {
      const o = await __render(lit, above, 2);
      const cut = await __through(o.buf, 500);
      return { raw: o.rms, survives: (cut / o.rms) / ref };
    };
    return { ref,
      drone:  await one(0, 0),
      candle: await one(6, 2),
      forge:  await one(135, 36),
      volcano:await one(27, 522) };
  });
  const bad = [];
  // The bar is what `docs/` measured its *fixed* cue at, 51% at stage one, and the
  // failure it replaced was 22%. Anything at or under a quarter is a sound written for
  // headphones and inaudible on the thing it is played on.
  for (const k of ['drone','candle','forge','volcano'])
    if (r[k].survives < .35)
      bad.push(`${k} keeps only ${(r[k].survives*100)|0}% of its energy through a 500Hz highpass`);
  console.log(`        (reference ${r.ref.toFixed(3)}; survives — drone ${(r.drone.survives*100)|0}%, `
    + `candle ${(r.candle.survives*100)|0}%, forge ${(r.forge.survives*100)|0}%, volcano ${(r.volcano.survives*100)|0}%)`);
  return bad.length ? bad.join('; ') : null;
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
