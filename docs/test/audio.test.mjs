// The decisions behind the sound, asserted where they can be.
//
// What a thing SOUNDS like cannot be tested here and is not pretended to be —
// that needs ears, and it is the one part of this feature the author has to
// judge. What can be tested is everything that decides whether a sound happens
// at all and which one: the stage mapping, its ordering, and that the module is
// silent rather than broken when there is no audio to be had.
//
// The last of those is not hypothetical. ui.probe.mjs deletes window.AudioContext
// before every run, so if this module threw on a machine without Web Audio it
// would take the whole interface down with it.

import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import { STAGE_PLAN, ABSORB_PLAN, PRESENCE, APPROACH, MUSIC_FLOOR, planFor, approachFor,
         supported, isOn, setOn, stage, absorbed, setPresence, setApproach, clearPresence, _reset }
  from '../audio.js';
import { Score, moodFor } from '../score.js';
import { SWARM_STAGES } from '../data.js';

test('there is a plan for each of the deep array\'s reports', () => {
  assert.equal(STAGE_PLAN.length, SWARM_STAGES.length,
    'a stage was added to SWARM_STAGES without a sound, so it would report in silence');
});

test('planFor maps a swarmMark onto the report just crossed', () => {
  assert.equal(planFor(0), null, 'nothing has been reported yet');
  assert.equal(planFor(1), STAGE_PLAN[0]);
  assert.equal(planFor(4), STAGE_PLAN[3]);
});

test('planFor refuses anything that is not a report', () => {
  for (const bad of [null, undefined, -1, 5, 1.5, '1', NaN, {}]) {
    assert.equal(planFor(bad), null, `planFor(${String(bad)}) should be null`);
  }
});

// The text escalates across the four stages — filed, resolved, agreed, and
// finally not worth reporting. If the sound did not escalate with it the game
// would say the situation was worsening while sounding exactly as it did before.
test('every stage is heavier than the one before it', () => {
  for (let i = 1; i < STAGE_PLAN.length; i++) {
    const a = STAGE_PLAN[i - 1], b = STAGE_PLAN[i];
    assert.ok(b.clacks > a.clacks, `stage ${i + 1} has no more clacks than stage ${i}`);
    assert.ok(b.gain > a.gain, `stage ${i + 1} is no louder than stage ${i}`);
    assert.ok(b.dur > a.dur, `stage ${i + 1} is no longer than stage ${i}`);
    assert.ok(b.wash >= a.wash, `stage ${i + 1} has less noise than stage ${i}`);
    assert.ok(b.hz < a.hz, `stage ${i + 1} does not sit lower than stage ${i}`);
  }
});

test('absorption outweighs every stage report', () => {
  const loudest = STAGE_PLAN[STAGE_PLAN.length - 1];
  assert.ok(ABSORB_PLAN.clacks > loudest.clacks, 'absorption must be the fullest sound in the game');
  assert.ok(ABSORB_PLAN.dur > loudest.dur);
  assert.ok(ABSORB_PLAN.hz < loudest.hz, 'and the lowest');
});

// "Low and wrong, not startling." A fast, loud attack is the jump-scare that was
// argued against — absorption is the quietest serious moment in the game.
test('nothing is loud enough to be a jump-scare', () => {
  for (const p of [...STAGE_PLAN, ABSORB_PLAN]) {
    assert.ok(p.gain <= 0.5, `a plan at gain ${p.gain} is too hot for a phone at a table`);
    assert.ok(p.dur >= 1.2, 'a short sharp hit is the startle this was written to avoid');
  }
});

// The bug that cost two entire games. The first plans sat at 34-58Hz, which is
// correct for headphones and inaudible on the phone this is played on: rendered
// offline through a 500Hz highpass, 22% of the cue's energy survived. Anything
// below about 80Hz is being written for a speaker the player does not have.
test('every cue sits where a phone speaker can reproduce it', () => {
  for (const p of [...STAGE_PLAN, ABSORB_PLAN]) {
    assert.ok(p.hz >= 80, `${p.hz}Hz is below what an iPhone speaker reproduces`);
    assert.ok(p.hz <= 220, `${p.hz}Hz has stopped being the low end this should sit in`);
    assert.ok(p.open >= p.hz * 4,
      `a filter at ${p.open}Hz strangles the harmonics of a ${p.hz}Hz saw, which is all a small speaker has to work with`);
  }
  for (const p of PRESENCE.filter(Boolean)) {
    assert.ok(p.hz >= 80 && p.hz <= 220, `the bed at ${p.hz}Hz is outside a phone's range`);
  }
});

// Four events of three seconds across seventy-two circuits is not a change in
// tone, which is why "no difference as we went on" was an accurate report even
// once the cues were audible. The bed is what actually escalates.
test('the presence thickens at every stage', () => {
  assert.equal(PRESENCE.length, STAGE_PLAN.length + 1, 'one level per report, plus silence at 0');
  assert.equal(PRESENCE[0], null, 'nothing is heard before the array has spoken');
  const live = PRESENCE.filter(Boolean);
  for (let i = 1; i < live.length; i++) {
    assert.ok(live[i].gain > live[i - 1].gain, `bed level ${i + 1} is no louder than ${i}`);
    assert.ok(live[i].every < live[i - 1].every, `bed level ${i + 1} clacks no more often than ${i}`);
    assert.ok(live[i].clack > live[i - 1].clack, `bed level ${i + 1} clacks no harder than ${i}`);
    assert.ok(live[i].hz < live[i - 1].hz, `bed level ${i + 1} does not sit lower than ${i}`);
  }
});

test('the bed is quieter than the reports that punctuate it', () => {
  const quietestStage = Math.min(...STAGE_PLAN.map(p => p.gain));
  for (const p of PRESENCE.filter(Boolean)) {
    assert.ok(p.gain < quietestStage,
      `a bed at ${p.gain} would swamp a report at ${quietestStage} — it is meant to be under the game, not on top of it`);
  }
});

test('with no AudioContext the module is silent rather than broken', () => {
  _reset();
  assert.equal(supported(), false, 'node has no window, so this is the no-audio path');
  assert.doesNotThrow(() => stage(3));
  assert.doesNotThrow(() => absorbed());
  assert.equal(stage(3), false, 'nothing can have played');
  assert.equal(absorbed(), false);
});

test('the setting survives having nowhere to store itself', () => {
  // No localStorage in node either — setOn must not throw on the way past it.
  assert.doesNotThrow(() => setOn(false));
  assert.equal(isOn(), false);
  assert.doesNotThrow(() => setOn(true));
  assert.equal(isOn(), true);
});

test('a silenced game plays nothing even when a cue is due', () => {
  setOn(false);
  assert.equal(stage(4), false);
  assert.equal(absorbed(), false);
  setOn(true);
});

// The point of the rewrite. A second AudioContext beside the score's would mean
// two things to unlock, two to resume after a phone call, and two settings for
// one idea — and on the setup screen they could disagree in writing.
test('the cues own no audio context of their own', () => {
  const src = readFileSync(fileURLToPath(new URL('../audio.js', import.meta.url)), 'utf8');
  assert.equal(/new\s+(window\.)?(webkit)?AudioContext|new\s+C\(/.test(src), false,
    'audio.js constructs a context — it must borrow the score\'s');
  assert.match(src, /import \{ Score \} from '\.\/score\.js'/,
    'the cues are voices in the score and must reach it directly');
});

test('the setting is the score\'s own switch, not a second one beside it', () => {
  setOn(false);
  assert.equal(Score.on, false, 'the menu would still read "score on" while the setup said off');
  setOn(true);
  assert.equal(Score.on, true);
  assert.equal(isOn(), Score.on);
});

test('a cue routes into the score rather than straight at the speakers', () => {
  const src = readFileSync(fileURLToPath(new URL('../audio.js', import.meta.url)), 'utf8');
  assert.match(src, /const dryDest = \(\) => Score\.master/,
    'the dry cue must land past the mood lowpass or it comes back attenuated and level with the pads');
  assert.match(src, /const wetDest = \(\) => Score\.verb/,
    'and needs a reverb send, or it sits outside the room the music is in');
  assert.equal(/\.connect\(\s*t\.destination\s*\)/.test(src), false,
    'connecting to destination would bypass Score.master and ignore the off switch');
});

/* ---------------------------------------------------------- the approach */
// The last fifteen circuits. Absolute rather than fractional on purpose: the
// swarm is a fixed distance away and does not care how long the game was set to
// run, so at 48 circuits this is the last third and at 120 the last eighth.

test('the approach does nothing until the swarm is inside fifteen circuits', () => {
  assert.equal(approachFor(72), null);
  assert.equal(approachFor(16), null);
  assert.ok(approachFor(15), 'fifteen circuits out is where it begins');
});

test('the approach refuses a distance that is not one', () => {
  for (const bad of [null, undefined, NaN, Infinity, '5', {}]) {
    assert.equal(approachFor(bad), null, `approachFor(${String(bad)}) should be null`);
  }
});

test('every circuit closer is heavier than the one before', () => {
  let prev = null;
  for (let d = 15; d >= 0; d--) {
    const a = approachFor(d);
    assert.ok(a, `nothing at ${d} circuits out`);
    if (prev) {
      assert.ok(a.music <= prev.music, `the score got louder between ${d + 1} and ${d}`);
      assert.ok(a.bed >= prev.bed, `the swarm got quieter between ${d + 1} and ${d}`);
      assert.ok(a.rain <= prev.rain, `the rain slowed between ${d + 1} and ${d}`);
      assert.ok(a.breath >= prev.breath, `the breathing eased between ${d + 1} and ${d}`);
      assert.ok(a.drift <= prev.drift, `the score came back into tune between ${d + 1} and ${d}`);
    }
    prev = a;
  }
});

test('it is a slope, not three steps a player could count', () => {
  // Between the named rows the values must actually move, or the swarm arrives
  // in three jumps and the writing above it is a lie.
  const a = approachFor(13), b = approachFor(12);
  assert.notEqual(a.music, b.music, 'nothing changes between 13 and 12 circuits');
  assert.ok(a.music > b.music);
});

// This bound was once "below 0.12", which was the destruction reading. Ducking
// that far made the converted score inaudible, so the last circuits were carried
// by a drone and some clacks — and every bit of variety added to the neurex mood
// was spent under a duck that hid it. The takeover is the music having become
// theirs, not the music having gone.
test('at the end the converted score is still what you are listening to', () => {
  const end = approachFor(0);
  assert.equal(end.music, MUSIC_FLOOR);
  assert.ok(end.music >= 0.25,
    `at ${end.music} the digested score cannot be heard, so the swarm is a drone rather than a piece of music`);
  assert.ok(end.music <= 0.45, 'and it must still be clearly taken over');
  assert.ok(end.music < approachFor(15).music, 'the score has to give way as the swarm closes');
});

// The bed sits on top of the music, not in place of it.
test('the swarm bed never outweighs the score it has converted', () => {
  for (const row of APPROACH) {
    assert.ok(row.bed < row.music,
      `at ${row.at} circuits the bed is ${row.bed} against music at ${row.music} — ` +
      'the drone would be the piece and the music the texture, which is backwards');
  }
});

test('arriving early cannot push it past the last row', () => {
  // swarmDistance clamps at 0, but a game extended past its limit must not
  // produce a negative distance that walks off the end of the table.
  assert.deepEqual(approachFor(-4), approachFor(0));
});

/* ------------------------------------------------- conversion, not replacement */
// The book is specific: "It was not destruction; destruction he had a decade of
// grammar for. This was conversion." The endgame must be the score playing
// itself wrong, not a different piece playing instead of it.

test('the neurex mood reuses the score\'s own structure', () => {
  assert.ok(Score.MODE.neurex, 'no converted scale');
  assert.ok(Score.PROG.neurex, 'no converted progression');
  assert.ok(Score.TONE.neurex, 'no converted tone');
  assert.equal(Score.PROG.neurex[0].length, Score.PROG.ledger[0].length,
    'a different bar length would make it a different piece, not the same one digested');
});

test('the converted scale is not one anybody would have chosen', () => {
  const m = Score.MODE.neurex;
  assert.ok(m.includes(1), 'a semitone against the root is the whole point');
  assert.ok(m.includes(6), 'and a tritone');
  assert.equal(m.some(d => d === 4 || d === 3), false,
    'a major or minor third would let it resolve into something consoling');
});

test('inside ten circuits nothing else is the subject', () => {
  const G = { phase: 'auction', cur: 0, players: [{ inFacility: true, lord: null, vassals: [] }] };
  assert.equal(moodFor(G, 40), 'auction', 'far out, an auction is still an auction');
  assert.equal(moodFor(G, 10), 'neurex', 'inside ten, it is not');
  assert.equal(moodFor(G, 1), 'neurex');
});

test('the mood needs no distance to keep working', () => {
  // galaxy.js and any older call site pass one argument. That must not silently
  // become the swarm mood, nor throw.
  const G = { phase: 'roll', cur: 0, players: [{ inFacility: false, lord: null, vassals: [] }] };
  assert.equal(moodFor(G), 'ledger');
});

/* ------------------------------------------------- the takeover must move */
// The first neurex mood was built on reading "alien" as "motionless": arp .16,
// shim .18, div 1, three progressions. That made the takeover the least varied
// thing in the score — 1.54 moving parts a bar against the ledger's 5.73 — and
// it plays over the longest unbroken stretch of a game, so it read as one sound
// repeating. The book says the opposite of static: "a single thing wearing
// billions of bodies", "no formation the eye could parse".

const moving = st => {
  const T = Score.TONE[st];
  return T.arp * (4 * T.div) + T.shim + T.sub;
};

test('the swarm moves at least as much as the music it takes over from', () => {
  assert.ok(moving('neurex') >= moving('ledger'),
    `neurex has ${moving('neurex').toFixed(2)} moving parts a bar against ledger's ` +
    `${moving('ledger').toFixed(2)} — it is the thing you listen to longest`);
});

test('it is not the most static mood in the game', () => {
  const others = Object.keys(Score.TONE).filter(s => s !== 'neurex');
  const quietest = Math.min(...others.map(moving));
  assert.ok(moving('neurex') > quietest,
    'the takeover cannot be less alive than every mood it replaces');
});

test('the swarm takes longer to come round than the ledger does', () => {
  const bars = st => Score.PROG[st].length * 4;
  assert.ok(bars('neurex') > bars('ledger'),
    `neurex repeats after ${bars('neurex')} bars and ledger after ${bars('ledger')} — ` +
    'a takeover that loops sooner than what it replaced sounds like less, not more');
});

test('its arpeggio figures do not repeat inside a bar', () => {
  const T = Score.TONE.neurex, notes = 4 * T.div;
  for (const shape of Score.SHAPES.neurex) {
    assert.ok(shape.length >= notes,
      `a ${shape.length}-note figure across ${notes} steps is one pattern played ` +
      `${(notes / shape.length).toFixed(1)} times`);
  }
});

test('every mood still has figures to draw on', () => {
  for (const st of Object.keys(Score.MODE)) {
    const figures = Score.SHAPES[st] || Score.SHAPES.default;
    assert.ok(Array.isArray(figures) && figures.length, `${st} has no arpeggio figures`);
    for (const f of figures) assert.ok(f.length > 0, `${st} has an empty figure`);
  }
});

test('the swarm has more than one size of mandible', () => {
  const src = readFileSync(fileURLToPath(new URL('../audio.js', import.meta.url)), 'utf8');
  const kinds = src.match(/const CLACK_KINDS = \[([\s\S]*?)\];/);
  assert.ok(kinds, 'CLACK_KINDS not found');
  const rows = kinds[1].match(/\{ w:/g) || [];
  assert.ok(rows.length >= 3, 'one clack recipe is a tick track however much it is jittered');
  const weights = [...kinds[1].matchAll(/w:\s*([\d.]+)/g)].map(m => +m[1]);
  assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 0.001,
    `the sizes must be a distribution — they sum to ${weights.reduce((a, b) => a + b, 0)}`);
});

// The noise bed.
//
// `wind` is a band of filtered noise running continuously under everything, and
// every mood had it set too high. It was balanced against the drone, which sits
// at 73Hz and its harmonics — frequencies a phone speaker barely reproduces —
// so it was mixed against something the player cannot hear. Rendered offline
// and measured layer by layer, it came out LOUDER than every pad, arpeggio and
// pluck combined: +1 to +2.3dB in the ledger mood and up to +7.2dB in the
// takeover, where it was 82% of everything audible.
//
// Nothing failed. The score played exactly as written, for the whole game, and
// the report from play was "a constant noise that gets distracting".
test('the noise bed never sits louder than the music it sits under', () => {
  for (const [st, T] of Object.entries(Score.TONE)) {
    assert.ok(T.wind < T.g,
      `${st} has wind ${T.wind} against a musical layer of ${T.g} — the bed is the loudest thing in it`);
  }
});

// A steady bed disappears into the background. One that keeps swelling does
// not, because the ear follows it. The LFO was .09 against a base of .16, and
// the rendered bed rose and fell 15.4dB on a 71-second cycle for the whole game.
//
// This covers the LFO only, which is one of three things moving the bed — the
// hush bar multiplies it by 1.6 every sixteenth bar and the bandpass sweep
// changes how much of it survives the lowpass. Rendered, those together still
// come to 10.8dB, so this test does NOT say the bed is steady. It says the one
// term that was set from the loudest mood is now set from the quietest, because
// the depth is an absolute gain and its worst relative effect is where the bed
// is thinnest — the same trap the original number fell into from the other end.
test('the swell is set from the quietest mood, not the loudest', () => {
  const quietest = Math.min(...Object.values(Score.TONE).map(T => T.wind));
  const d = Score.WIND_SWELL;
  assert.ok(d < quietest, `a swell of ${d} silences or inverts a bed set at ${quietest}`);
  const swing = 20 * Math.log10((quietest + d) / (quietest - d));
  assert.ok(swing < 7,
    `the LFO alone swings the bed ${swing.toFixed(1)}dB in the quietest mood`);
});

// The drone, which is the score's floor.
//
// Reported from play as "a constant techno sounding hum that my attention keeps
// focusing on rather than the music" — and it was not the noise bed, and it was
// not a throb. Measured, the amplitude fluctuation of every layer in this file
// is 1-5% of its own level, which is nothing. It was steady TONES: partials at
// 4x and 6x the root, added as pure sines so the drone would carry on a small
// speaker, which it did by putting 294Hz and 440Hz under the whole game and
// never moving them. A phone reproduces almost none of the 73Hz fundamental
// that does the actual work, so those two sines and the sawtooth ladder above
// them were the entire drone as far as the player was concerned.
//
// Both halves of the fix are asserted here, because either alone comes undone:
// a partial put back would sail past the filter if it sat below the cutoff, and
// a cutoff raised into the phone's band would let the ladder back through.
test('the drone has no partial standing up in the band a phone throws', () => {
  for (const [m, g] of Score.DRONE_PARTIALS) {
    const hz = Score.R0 * m;
    assert.ok(hz < Score.DRONE_LP,
      `a partial at ${hz.toFixed(0)}Hz is above the ${Score.DRONE_LP}Hz cut, so it is a tone, not a floor`);
    assert.ok(g > 0, 'a silent partial is not a partial');
  }
});

test('and it is cut below where a phone speaker starts to carry', () => {
  // Small speakers roll off hard under roughly 500Hz; everything the drone was
  // heard AS sat between there and 1300Hz.
  assert.ok(Score.DRONE_LP < 500,
    `a ${Score.DRONE_LP}Hz cut leaves the drone audible as pitch rather than weight`);
  // And not so low that the fundamental itself is being filtered away.
  assert.ok(Score.DRONE_LP > Score.R0 * 2,
    `${Score.DRONE_LP}Hz cuts into the root at ${Score.R0.toFixed(0)}Hz`);
});

// Reported as "a constant and almost faint alarm in the background going up and
// down", starting "around 5-10ish rounds in the smallest circuit option".
//
// The smallest game is 48 circuits and the first report fires at a quarter
// elapsed. Nothing else in this codebase switches on partway through a game and
// then never stops, which is what identified it — the bed is two detuned
// sawtooths under a filter sweeping on a 77-second cycle, and it used to arrive
// at the first report and hold for the remaining three quarters.
//
// The reports are still too sparse to carry the swarm alone, so the bed stays.
// What it may not do is start the moment the array first speaks.
test('the first report does not switch on a tone that never stops', () => {
  assert.equal(PRESENCE[1].gain, 0,
    'a quarter of the way into a game is too early for a drone that never rests again');
  assert.equal(PRESENCE[1].wash, 0, 'and the same goes for its noise');
  assert.ok(PRESENCE[1].clack > 0,
    'the report is not silent though — it still carries the occasional distant clack');
  assert.ok(PRESENCE[2].gain > 0, 'the bed does open, at the halfway report');
});

// The ending is driven by APPROACH, not by the stage bed — resolveBed takes the
// heavier of the two. So the stage levels can come down without touching the
// climax, and this is what says so.
test('the approach still outweighs the stage bed by the end', () => {
  const lastStage = PRESENCE[PRESENCE.length - 1].gain;
  const closest = APPROACH[APPROACH.length - 1].bed;
  assert.ok(closest > lastStage,
    `an approach topping out at ${closest} under a stage bed of ${lastStage} means the last ` +
    `circuits are carried by the wrong table, and quietening a stage would flatten the ending`);
});
