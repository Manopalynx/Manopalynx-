// What the box sounds like, measured rather than described.
//
// This cannot tell you whether the result is pleasant. Nothing here can — that judgement
// is Sam's, and the numbers it would need are all in the `SOUND` block at the top of the
// sound section so acting on it is a one-line change. What it CAN tell you is the set of
// things that would make the score silently pointless.
//
// Rewritten when the two synthesised voices became a score. The old suite asserted that a
// fire voice tracked the alight count and a drone tracked the temperature; both voices
// were reported back as "like an electric motor sound for fire" and deleted, and every
// check about them went with them. A suite that kept passing about a deleted design would
// have been the most convincing kind of green.
//
// The scheduler is driven directly. `scorePump(horizon)` fills up to an audio-context
// time, so the page's five-a-second half-second lookahead and a single call covering a
// whole offline render are the same code path — the tests drive the real scheduler rather
// than a stand-in for it.
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
  /* Notes only, without rendering — the scheduler is the thing under test and audio is
     expensive to render. Lets a check ask about a minute of music instead of six seconds,
     which is the difference between a bar on a dice roll and a bar on a distribution. */
  window.__notes = (room, secs) => {
    const c = new OfflineAudioContext(1, 44100, 44100);
    soundBuild(c); soundOn = true; AMBIENT = room;
    let n = 0, t = 0;
    while (t < secs){ const plan = scorePump(t + 1); n += plan.notes; t += 1; }
    return n;
  };
  /* One render of the page's own graph, driven by the page's own scheduler.

     The room is set directly rather than simulated, because the room reading IS the
     signal — that is the whole point of the score being driven by one number. */
  window.__render = async (room, secs) => {
    const rate = 44100, len = Math.floor(rate * (secs || 4));
    const c = new OfflineAudioContext(1, len, rate);
    if (!soundBuild(c)) throw new Error('the page would not build its graph');
    soundOn = true;
    snd.master.gain.value = SOUND.master;
    AMBIENT = room;
    const plan = scorePump(secs || 4);
    snd.plk.frequency.value = SOUND.plkLow + Math.max(0, plan.u) * (SOUND.plkHigh - SOUND.plkLow);
    const out = await c.startRendering();
    return { rms: __rms(out), buf: out, bpm: plan.bpm, density: plan.density,
             u: plan.u, beats: beatN, notes: plan.notes, cut: snd.plk.frequency.value };
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
  /* The SETTING is on at boot and the GRAPH is not built, and those are different
     things. A context created outside a user gesture is one iOS hands over and then
     refuses to let make a sound, which reads exactly like a broken graph — so "on by
     default" has to mean "armed", with the first touch doing the building. */
  const r = await p.evaluate(() => ({ ctx: actx === null, graph: snd === null, on: soundOn }));
  const bad = [];
  if (!r.ctx || !r.graph) bad.push('the page built an audio context at boot, which iOS hands over and then will not let make a sound');
  if (!r.on) bad.push('the sound was not armed at boot, so the default is not on');
  return bad.length ? bad.join('; ') : null;
});

/* The guard, not the gate. The master starts at zero and only `soundSet` opens it, so a
   render with the sound off is silent whatever else happens — which means asserting
   silence alone passes with `soundUpdate`'s own `!soundOn` guard deleted. Mutation-tested
   on the previous design, and it duly stayed green. So the gate is forced open and the
   claim becomes: with the sound off, nothing is SCHEDULED. */
await check(browser, 'switched off, nothing is scheduled and nothing is heard', async p => {
  const r = await p.evaluate(async () => {
    const one = async (openTheGate) => {
      const c = new OfflineAudioContext(1, 44100 * 2, 44100);
      soundBuild(c);
      soundOn = false;
      AMBIENT = 320;                        // a furnace, and it must not matter
      if (openTheGate) snd.master.gain.value = SOUND.master;
      soundUpdate();
      return { rms: __rms(await c.startRendering()), beats: beatN };
    };
    return { shut: await one(false), open: await one(true) };
  });
  const bad = [];
  if (r.shut.rms > 1e-4) bad.push(`a furnace with the sound off rendered at ${r.shut.rms.toFixed(5)} RMS — the master gate is not holding`);
  if (r.open.beats !== 0) bad.push(`with the sound off, ${r.open.beats} beats were scheduled — soundUpdate is driving the score when nobody asked it to`);
  if (r.open.rms > 1e-3) bad.push(`with the gate forced open, an off box rendered at ${r.open.rms.toFixed(5)} RMS`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'on by default, and an off that survives a reload', async p => {
  const bad = [];
  // Default on. `soundStored` has to answer three things, not two: on, off, and never
  // asked — or a stored "off" is indistinguishable from a fresh box and comes back on.
  const fresh = await p.evaluate(() => ({ stored: soundStored(), on: soundOn }));
  if (fresh.stored !== null) bad.push(`a fresh box reports a stored setting of ${fresh.stored}`);
  if (fresh.on !== true) bad.push('a fresh box did not come up with the sound on, which is the default that was asked for');

  await p.evaluate(() => soundSet(false));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof W !== 'undefined' && W > 40);
  const after = await p.evaluate(() => ({ stored: soundStored(), on: soundOn }));
  if (after.stored !== false) bad.push(`after being switched off, the stored setting is ${after.stored}`);
  if (after.on !== false) bad.push('the sound came back on after being switched off and reloaded');
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— the pulse follows the room —');

await check(browser, 'the tempo rises with the room and falls with it', async p => {
  const r = await p.evaluate(async () => ({
    ice:      (await __render(-2.8, 1)).bpm,
    nitrogen: (await __render(12.1, 1)).bpm,
    rest:     (await __render(20,   1)).bpm,
    candle:   (await __render(20.6, 1)).bpm,
    fire:     (await __render(31.4, 1)).bpm,
    volcano:  (await __render(64.8, 1)).bpm,
    oven:     (await __render(230,  1)).bpm,
    furnace:  (await __render(480,  1)).bpm
  }));
  const bad = [];
  const order = ['ice','nitrogen','rest','candle','fire','volcano'];
  for (let i = 1; i < order.length; i++)
    if (!(r[order[i]] > r[order[i-1]]))
      bad.push(`${order[i]} at ${r[order[i]].toFixed(1)}bpm is not quicker than ${order[i-1]} at ${r[order[i-1]].toFixed(1)}`);
  if (Math.abs(r.rest - 60) > .5) bad.push(`a still box runs at ${r.rest.toFixed(1)}bpm rather than the 60 it rests at`);
  // A fixed room setting is a deliberate act and is allowed to drive this — but clamped,
  // or a Furnace at 480°C would be four times an eruption.
  if (Math.abs(r.oven - r.furnace) > .01) bad.push(`Oven ${r.oven.toFixed(1)}bpm and Furnace ${r.furnace.toFixed(1)}bpm differ — the top is not clamped`);
  if (!(r.oven >= r.volcano)) bad.push(`an Oven runs slower than an eruption`);
  /* The quiet end is where the choice of compression lives, exactly as it did for the
     voices this replaced. On a straight line an ordinary fire moves the room 11 degrees
     against the Volcano's 45 and is barely quicker than silence. */
  const span = r.volcano - r.rest;
  const at = (r.fire - r.rest) / span;
  if (!(at > .45)) bad.push(`an ordinary fire sits ${(at*100)|0}% of the way from resting to an eruption — the quiet end is crowded`);
  console.log(`        (ice ${r.ice.toFixed(0)} · nitrogen ${r.nitrogen.toFixed(0)} · rest ${r.rest.toFixed(0)} · candle ${r.candle.toFixed(0)}`
    + ` · fire ${r.fire.toFixed(0)} · volcano ${r.volcano.toFixed(0)} · oven ${r.oven.toFixed(0)} bpm)`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the tempo is a pulse and not just a number', async p => {
  // The bpm could be perfect and drive nothing. This counts what actually got scheduled
  // into a fixed window, which is the only claim that matters.
  const r = await p.evaluate(async () => ({
    ice:     (await __render(-2.8, 8)).beats,
    rest:    (await __render(20,   8)).beats,
    volcano: (await __render(64.8, 8)).beats
  }));
  const bad = [];
  if (!(r.volcano > r.rest && r.rest > r.ice))
    bad.push(`eight seconds carried ${r.ice} beats cold, ${r.rest} resting and ${r.volcano} hot — the tempo is not reaching the scheduler`);
  if (r.ice < 4) bad.push(`only ${r.ice} beats in eight seconds at the cold end — the piece has stopped rather than slowed`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the piece plays when nothing at all is happening', async p => {
  /* The whole brief is a soundtrack you leave on. A score that only arrives with a fire
     is a sound effect wearing a score's clothes.

     It counts NOTES and not loudness, and that distinction was found by mutation. Asking
     only whether a still box makes a sound is satisfied by the pads on their own, so
     deleting every pluck at rest — `density = hot * denHot`, which is nought at 20°C —
     left the check green with the tune gone and the drone left. */
  const r = await p.evaluate(async () => ({ heard: await __render(20, 6), min: __notes(20, 60) }));
  const bad = [];
  if (r.heard.rms < 1e-3) bad.push(`a still box on Neutral rendered at ${r.heard.rms.toFixed(5)} RMS — there is nothing there at all`);
  /* A MINUTE, and a bar well under the expectation, because the first version of this
     asked for three notes in six seconds — six beats at 45% density, so an expectation of
     2.7 against a bar of 3. It measured fine on the run that set it and failed on the
     next. `MATCHBOX.md` warns about exactly this and says three of them have shipped in
     this file; this was the fourth. Sixty seconds at 60bpm expects about 27. */
  if (r.min < 12) bad.push(`a still box played ${r.min} notes in a minute — there is no tune until something burns, only a bed`);
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— it survives the speaker it will be played through —');

await check(browser, 'what comes out is still there after a phone speaker has had it', async p => {
  const r = await p.evaluate(async () => {
    const ref = await __reference(500);
    const one = async (room) => {
      const o = await __render(room, 6);
      return { survives: (await __through(o.buf, 500) / o.rms) / ref };
    };
    return { ref, rest: await one(20), fire: await one(31.4), volcano: await one(64.8), ice: await one(-2.8) };
  });
  const bad = [];
  /* The bar is what `docs/` measured its FIXED cue at, 51%, against the 22% of the
     version that could not be heard at all across two entire games. */
  for (const k of ['rest','fire','volcano','ice'])
    if (r[k].survives < .35)
      bad.push(`${k} keeps only ${(r[k].survives*100)|0}% of its energy through a 500Hz highpass`);
  console.log(`        (reference ${r.ref.toFixed(3)}; survives — resting ${(r.rest.survives*100)|0}%, `
    + `fire ${(r.fire.survives*100)|0}%, volcano ${(r.volcano.survives*100)|0}%, ice ${(r.ice.survives*100)|0}%)`);
  /* A figure at or slightly over 100% is not the broken metric `docs/` once reported as
     "127% survives". That one had no reference division at all. This one does, and a
     ratio a little over unity simply means the score sits further above the 500Hz corner
     than the 2kHz tone the filter was characterised on — which is the answer "essentially
     all of it", and is what putting the plucks at 440-1760Hz was for. */
  return bad.length ? bad.join('; ') : null;
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
