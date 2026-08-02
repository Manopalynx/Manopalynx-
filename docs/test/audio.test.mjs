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

import { STAGE_PLAN, ABSORB_PLAN, PRESENCE, planFor, supported, isOn, setOn, stage, absorbed,
         setPresence, clearPresence, _reset }
  from '../audio.js';
import { Score } from '../score.js';
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
