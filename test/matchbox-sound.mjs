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
  window.__render = async (room, secs, lit) => {
    const rate = 44100, len = Math.floor(rate * (secs || 4));
    const c = new OfflineAudioContext(1, len, rate);
    if (!soundBuild(c)) throw new Error('the page would not build its graph');
    soundOn = true;
    snd.master.gain.value = SOUND.master;
    AMBIENT = room; alightCount = lit || 0;
    const plan = scorePump(secs || 4);
    snd.plk.frequency.value = SOUND.plkLow + Math.max(0, plan.u) * (SOUND.plkHigh - SOUND.plkLow);
    const fire = blaze();
    const draw = drawStep();
    const rush = SOUND.rushGain * Math.min(1.4, fire + draw * SOUND.drawLift);
    snd.bed.gain.value = rush;
    snd.swell.gain.value = rush * SOUND.swellD;
    snd.flut.gain.value = rush * SOUND.flutD;
    snd.throat.gain.value = fire * SOUND.throatD;
    snd.music.gain.value = 1 - fire * SOUND.duck;
    const cracks = firePump(secs || 4, fire);
    const out = await c.startRendering();
    return { rms: __rms(out), buf: out, bpm: plan.bpm, density: plan.density,
             u: plan.u, beats: beatN, notes: plan.notes, cut: snd.plk.frequency.value,
             fire, cracks, bed: snd.bed.gain.value, music: snd.music.gain.value };
  };
  /* The two halves rendered apart, which is the only way to ask whether one drowns the
     other. Same seed of a scene, once with the fire muted and once with the score muted,
     and the comparison is between their RMS. */
  /* The fire alone, and what SHAPE it is — the only way to ask the difference between
     rain and fire, because both are noise and the difference is entirely distribution.

     THE TWO HALVES ARE RENDERED SEPARATELY, and that is not tidiness. A first version
     measured both on the whole fire and the surge figure came out HIGHER with the rush's
     breathing switched off than with it on — 41% against 35% — because what it was
     actually measuring was the gap between one power-law snap and the next. It would have
     passed with the swell deleted. Each number now measures the thing it is named after:

       crest  peak over RMS, on the SNAPS alone. A power-law train stands well clear of
              its own average; snaps of equal size average up and the crest collapses.
       surge  the spread of per-100ms RMS over its mean, on the RUSH alone. Rain is
              steady; a fire breathes, and with no snaps in the buffer the only thing that
              can move the envelope is the swell. */
  window.__fireShape = async (lit, secs, part) => {
    const rate = 44100, len = Math.floor(rate * secs);
    const c = new OfflineAudioContext(1, len, rate);
    soundBuild(c);
    soundOn = true; snd.master.gain.value = SOUND.master;
    AMBIENT = 20; alightCount = lit;
    snd.music.gain.value = 0;                      // the fire on its own
    const fire = blaze();
    /* Isolating one voice by silencing the others through their OWN constants, so what
       runs is the real scheduler and the real graph rather than a reduced copy of them.
       Restored at the end, because these are module state and the next check would
       inherit them. */
    const keepCrk = SOUND.crkGain, keepBig = SOUND.bigGain;
    if (part === 'snaps') SOUND.bigGain = 0;
    if (part === 'big')   SOUND.crkGain = 0;
    const wantRush = part !== 'snaps' && part !== 'big';
    const rush = fire * SOUND.rushGain;
    snd.bed.gain.value    = wantRush ? rush : 0;
    snd.swell.gain.value  = wantRush ? rush * SOUND.swellD : 0;
    snd.flut.gain.value   = wantRush ? rush * SOUND.flutD : 0;
    snd.throat.gain.value = wantRush ? fire * SOUND.throatD : 0;
    if (part !== 'rush') firePump(secs, fire);
    const buf = await c.startRendering();
    SOUND.crkGain = keepCrk; SOUND.bigGain = keepBig;
    const d = buf.getChannelData(0);
    let peak = 0, sq = 0;
    for (let i=0;i<d.length;i++){ const a = Math.abs(d[i]); if (a>peak) peak=a; sq += d[i]*d[i]; }
    const rms = Math.sqrt(sq/d.length);
    const win = Math.floor(rate * .1), envs = [];
    for (let i=0; i+win<=d.length; i+=win){
      let s2=0; for (let k=i;k<i+win;k++) s2 += d[k]*d[k];
      envs.push(Math.sqrt(s2/win));
    }
    const mean = envs.reduce((a,b)=>a+b,0)/envs.length;
    const sd = Math.sqrt(envs.reduce((a,b)=>a+(b-mean)*(b-mean),0)/envs.length);
    /* Two more, both aimed at the difference between a gust and a draw.

       flutter  how much the envelope moves between one 20ms window and the next, over
                its own mean. A sub-Hertz swell barely moves in 20ms; a 4-14Hz draw moves
                a great deal. This is the number that separates weather from fire.
       colour   the spread of the zero-crossing rate across windows. For noise the ZCR
                tracks the spectral centroid, so this says whether the FILTER is moving
                or only the gain — and moving the gain alone is a curtain of wind. */
    const fw = Math.floor(rate * .02), fe = [], zc = [];
    for (let i=0; i+fw<=d.length; i+=fw){
      let s2=0, z=0;
      for (let k=i;k<i+fw;k++){ s2 += d[k]*d[k]; if (k>i && (d[k]>=0) !== (d[k-1]>=0)) z++; }
      fe.push(Math.sqrt(s2/fw)); zc.push(z);
    }
    let flux = 0;
    for (let i=1;i<fe.length;i++) flux += Math.abs(fe[i]-fe[i-1]);
    flux /= (fe.length-1);
    const fem = fe.reduce((a,b)=>a+b,0)/fe.length;
    /* Zero crossings counted only where there IS something, which matters for anything
       sparse. Cracks occupy about 3% of a fourteen-second render, so averaging over every
       window measured the silence between them and reported "0 crossings" — true, and
       about the gaps rather than about the sound. */
    const loud = fe.reduce((a,b)=>Math.max(a,b),0) * .12;
    const zLive = zc.filter((_, i) => fe[i] > loud);
    const zm = zLive.length ? zLive.reduce((a,b)=>a+b,0)/zLive.length
                            : zc.reduce((a,b)=>a+b,0)/zc.length;
    /* Smoothed before its spread is taken, and that is the difference between a metric
       and a noise floor. Zero-crossing rate on noise wanders at random from one 20ms
       window to the next, so the raw spread sat at 24% with the filter nailed still —
       against 33% when it was sweeping. A bar between those two would have been a coin
       toss. A 200ms moving average averages the randomness away and leaves the systematic
       movement, because the throat sweeps at 0.7 and 2.3Hz — periods of 1.4s and 0.43s,
       both far longer than the window. */
    const SM = 10, sm = [];
    for (let i=0; i+SM<=zc.length; i++){
      let a=0; for (let k=i;k<i+SM;k++) a += zc[k];
      sm.push(a/SM);
    }
    const smM = sm.length ? sm.reduce((a,b)=>a+b,0)/sm.length : 0;
    const zsd = sm.length ? Math.sqrt(sm.reduce((a,b)=>a+(b-smM)*(b-smM),0)/sm.length) : 0;
    return { crest: rms > 0 ? peak/rms : 0, surge: mean > 0 ? sd/mean : 0, rms,
             flutter: fem > 0 ? flux/fem : 0, colour: smM > 0 ? zsd/smM : 0, zcr: zm };
  };
  window.__split = async (room, secs, lit) => {
    const one = async (mute) => {
      const rate = 44100, len = Math.floor(rate * (secs || 4));
      const c = new OfflineAudioContext(1, len, rate);
      soundBuild(c);
      soundOn = true; snd.master.gain.value = SOUND.master;
      AMBIENT = room; alightCount = lit || 0;
      const plan = scorePump(secs || 4);
      const fire = blaze();
      const rush = SOUND.rushGain * fire;
      snd.bed.gain.value   = mute === 'fire' ? 0 : rush;
      snd.swell.gain.value = mute === 'fire' ? 0 : rush * SOUND.swellD;
      snd.flut.gain.value  = mute === 'fire' ? 0 : rush * SOUND.flutD;
      snd.throat.gain.value = mute === 'fire' ? 0 : fire * SOUND.throatD;
      snd.music.gain.value = mute === 'music' ? 0 : 1 - fire * SOUND.duck;
      if (mute !== 'fire') firePump(secs || 4, fire);
      return __rms(await c.startRendering());
    };
    return { music: await one('fire'), fire: await one('music') };
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

console.log('\n— the fire —');

await check(browser, 'the fire follows what is alight, and not the room', async p => {
  const r = await p.evaluate(async () => ({
    none:    await __render(20,   1, 0),
    candle:  await __render(20.6, 1, 6),
    volcano: await __render(64.8, 1, 27),
    forge:   await __render(30.7, 1, 135),
    open:    await __render(31.4, 1, 155),
    // A furnace with nothing burning in it. The room is at its ceiling and the fire voice
    // must not stir — this is the separation the two signals exist for.
    oven:    await __render(230,  1, 0)
  }));
  const bad = [];
  if (r.none.fire !== 0)  bad.push(`an unlit box has the fire at ${r.none.fire.toFixed(3)}`);
  if (r.oven.fire !== 0)  bad.push(`an empty furnace has the fire at ${r.oven.fire.toFixed(3)} — it is hearing the room`);
  if (!(r.candle.fire > 0 && r.candle.fire < r.forge.fire))
    bad.push(`a candle reads ${r.candle.fire.toFixed(3)} against a forge's ${r.forge.fire.toFixed(3)}`);
  if (!(r.forge.fire < r.open.fire)) bad.push(`the forge is not below the opening scene`);
  // The Volcano is 27 cells alight against the Forge's 135 — it is a heat event, not a
  // bonfire — so the fire voice must rank it BELOW the forge even though the room says
  // the opposite. That disagreement is the whole reason there are two signals.
  if (!(r.volcano.fire < r.forge.fire))
    bad.push(`the Volcano's fire reads ${r.volcano.fire.toFixed(3)} against the Forge's ${r.forge.fire.toFixed(3)} — the fire is following the room`);
  if (!(r.volcano.bpm > r.forge.bpm))
    bad.push(`...and the tempo should still put the Volcano above the Forge: ${r.volcano.bpm.toFixed(0)} vs ${r.forge.bpm.toFixed(0)}bpm`);
  // A candle should be a few crackles, not silence and not a bonfire.
  if (!(r.candle.cracks > 0)) bad.push('a candle scheduled no crackles at all');
  if (!(r.open.cracks > r.candle.cracks * 2))
    bad.push(`a full fire scheduled ${r.open.cracks} crackles against a candle's ${r.candle.cracks}`);
  console.log(`        (candle ${r.candle.cracks} crackles/s, forge ${r.forge.cracks}, opening ${r.open.cracks}; `
    + `blaze candle ${r.candle.fire.toFixed(2)} forge ${r.forge.fire.toFixed(2)} volcano ${r.volcano.fire.toFixed(2)})`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the fire never drowns the tune', async p => {
  const r = await p.evaluate(async () => ({
    quiet: await __split(20,   6, 0),
    forge: await __split(30.7, 6, 135),
    open:  await __split(31.4, 6, 155)
  }));
  const bad = [];
  /* `docs/README.md` records a bed brought up over ducked music, and the report was
     "it repeats the same sound over and over" — because the variety was all in the part
     that had been turned down. The score may step back for the fire and may not go
     under it. */
  for (const [k, v] of Object.entries(r)){
    if (k === 'quiet'){
      if (v.fire > 1e-4) bad.push(`with nothing alight the fire still rendered at ${v.fire.toFixed(5)}`);
      continue;
    }
    if (!(v.music > v.fire))
      bad.push(`at ${k} the fire is ${v.fire.toFixed(4)} against the music's ${v.music.toFixed(4)} — the bed outweighs the piece`);
  }
  console.log(`        (music vs fire — forge ${r.forge.music.toFixed(3)}/${r.forge.fire.toFixed(3)}, `
    + `opening ${r.open.music.toFixed(3)}/${r.open.fire.toFixed(3)})`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the fire is a fire and not rain', async p => {
  /* Reported from the phone: "it currently sounds more like rain than fire". Rain is
     UNIFORM — many similar transients, evenly spaced, in one narrow band — and the first
     version was exactly that: a bandpassed bed and snaps of near-equal size. Both of the
     things that fix it are distributions rather than settings, so both are measured as
     distributions rather than asserted as parameters. */
  const r = await p.evaluate(async () => ({
    snapsF: await __fireShape(135, 8, 'snaps'),
    snapsO: await __fireShape(155, 8, 'snaps'),
    rushF:  await __fireShape(135, 12, 'rush'),
    rushO:  await __fireShape(155, 12, 'rush')
  }));
  const bad = [];
  /* Snaps: a power-law train stands well clear of its own average. Bars set from the
     mutation rather than from taste, which is the only way to know one separates:

       crkShape 3 (as shipped)   crest 32-42
       crkShape 0 (every snap full size)   crest 14-15

     A bar of 9 passed both, which made it decoration. 22 sits in the gap. */
  for (const [k, v] of [['forge', r.snapsF], ['opening', r.snapsO]])
    if (!(v.crest > 22))
      bad.push(`the ${k}'s snaps have a crest of ${v.crest.toFixed(1)} — they are all the same size, which is a rattle`);
  /* Rush: with no snaps in the buffer the only thing that can move the envelope is the
     swell. Same treatment — the bar comes from what the broken version measures:

       swellD .55 (as shipped)   surge 45-47%
       swellD 0   (no breathing) surge 6.3-6.7%   — the residue of the noise loop itself

     6% passed both. 20% sits in the gap. */
  for (const [k, v] of [['forge', r.rushF], ['opening', r.rushO]])
    if (!(v.surge > .20))
      bad.push(`the ${k}'s rush surges by ${(v.surge*100).toFixed(1)}% of its own level — that is steady hiss, not a fire drawing air`);
  console.log(`        (snap crest — forge ${r.snapsF.crest.toFixed(1)}, opening ${r.snapsO.crest.toFixed(1)}; `
    + `rush surge — forge ${(r.rushF.surge*100).toFixed(1)}%, opening ${(r.rushO.surge*100).toFixed(1)}%)`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the draw is caused by the fire and not by a clock', async p => {
  /* The rush used to swell on two sines at 0.13 and 0.31Hz regardless of what the box was
     doing, and it was reported as "a gust of wind that's blowing through the area rather
     than coming from the fire". That is not a timbre fault: the ear is very good at
     noticing whether two things are correlated, and those two were not.

     So the level answers the CHANGE in `alightCount`. This drives `drawStep` directly —
     it is a state machine over updates, not something a single render can show. */
  const r = await p.evaluate(() => {
    soundBuild(new OfflineAudioContext(1, 4410, 44100));
    const steps = [];
    alightCount = 0;  steps.push(drawStep());                 // nothing
    alightCount = 60; steps.push(drawStep());                 // caught, all at once
    const decay = [];
    for (let i=0;i<10;i++) decay.push(drawStep());            // ...and now merely burning
    return { cold: steps[0], caught: steps[1], after2: decay[1], after10: decay[9] };
  });
  const bad = [];
  if (r.cold !== 0) bad.push(`an unlit box already has a draw of ${r.cold.toFixed(3)}`);
  if (!(r.caught > .6)) bad.push(`sixty cells catching gave a draw of ${r.caught.toFixed(3)} — the fire is not lifting it`);
  if (!(r.after2 < r.caught)) bad.push('the draw does not fall away once the fire is merely burning');
  if (!(r.after10 < .12)) bad.push(`ten updates later the draw is still ${r.after10.toFixed(3)} — that is a gust, not a surge`);
  console.log(`        (draw — cold ${r.cold.toFixed(2)}, caught ${r.caught.toFixed(2)}, `
    + `two updates later ${r.after2.toFixed(2)}, ten later ${r.after10.toFixed(2)})`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'the rush flutters like a draw rather than swelling like weather', async p => {
  const r = await p.evaluate(async () => ({
    forge: await __fireShape(135, 12, 'rush'),
    open:  await __fireShape(155, 12, 'rush')
  }));
  const bad = [];
  for (const [k, v] of [['forge', r.forge], ['opening', r.open]]){
    /* A sub-Hertz swell barely moves between one 20ms window and the next; a 4-14Hz draw
       moves a great deal. This is the number that separates a gust from a fire. */
    if (!(v.flutter > .30))
      bad.push(`the ${k}'s rush changes by ${(v.flutter*100).toFixed(0)}% between 20ms windows — that is a slow swell, which is weather`);
    /* And the throat has to move, not just the level. For noise the zero-crossing rate
       tracks the spectral centroid, so this says whether the FILTER is travelling. */
    /* Bar from the mutation, not from taste: throat sweeping 21.6-21.7%, throat nailed
       still 6.4-6.8%. 14% sits in the gap. The unsmoothed version of this metric read 33%
       against 24% and no bar between them would have been trustworthy. */
    if (!(v.colour > .14))
      bad.push(`the ${k}'s rush shifts colour by ${(v.colour*100).toFixed(1)}% — the filter is standing still and only the gain is moving`);
  }
  console.log(`        (flutter — forge ${(r.forge.flutter*100).toFixed(0)}%, opening ${(r.open.flutter*100).toFixed(0)}%; `
    + `colour — forge ${(r.forge.colour*100).toFixed(1)}%, opening ${(r.open.colour*100).toFixed(1)}%)`);
  return bad.length ? bad.join('; ') : null;
});

await check(browser, 'a crack is a different event from a snap, not a louder one', async p => {
  const r = await p.evaluate(async () => ({
    snaps: await __fireShape(155, 14, 'snaps'),
    big:   await __fireShape(155, 14, 'big')
  }));
  const bad = [];
  // The body has to be there at all...
  if (!(r.big.rms > 1e-4)) bad.push(`the cracks rendered at ${r.big.rms.toFixed(6)} RMS — there is no body under the transient`);
  /* ...and it has to be LOW. That is the whole of what makes a crack a crack rather than
     a big click: a damped tone under the transient. For noise-versus-tone the
     zero-crossing rate is the discriminator, and a 95-210Hz triangle crosses zero far
     less often than a 1.5-6kHz highpassed click. */
  if (!(r.big.zcr < r.snaps.zcr * .5))
    bad.push(`the cracks cross zero at ${r.big.zcr.toFixed(0)} against the snaps' ${r.snaps.zcr.toFixed(0)} — the body is not low, so a crack is only a louder click`);
  console.log(`        (zero crossings — snaps ${r.snaps.zcr.toFixed(0)}, crack bodies ${r.big.zcr.toFixed(0)} per window)`);
  return bad.length ? bad.join('; ') : null;
});

console.log('\n— it survives the speaker it will be played through —');

await check(browser, 'what comes out is still there after a phone speaker has had it', async p => {
  const r = await p.evaluate(async () => {
    const ref = await __reference(500);
    const one = async (room, lit) => {
      const o = await __render(room, 6, lit);
      return { survives: (await __through(o.buf, 500) / o.rms) / ref };
    };
    return { ref, rest: await one(20), fire: await one(31.4), volcano: await one(64.8), ice: await one(-2.8),
             blaze: await one(31.4, 155) };
  });
  const bad = [];
  /* The bar is what `docs/` measured its FIXED cue at, 51%, against the 22% of the
     version that could not be heard at all across two entire games. */
  for (const k of ['rest','fire','volcano','ice','blaze'])
    if (r[k].survives < .35)
      bad.push(`${k} keeps only ${(r[k].survives*100)|0}% of its energy through a 500Hz highpass`);
  console.log(`        (reference ${r.ref.toFixed(3)}; survives — resting ${(r.rest.survives*100)|0}%, `
    + `fire ${(r.fire.survives*100)|0}%, volcano ${(r.volcano.survives*100)|0}%, ice ${(r.ice.survives*100)|0}%, `
    + `alight ${(r.blaze.survives*100)|0}%)`);
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
