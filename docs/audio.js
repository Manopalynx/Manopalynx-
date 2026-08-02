// The Neurex, heard — two cues added to the score that is already playing.
//
// THIS DELIBERATELY OWNS NO AudioContext. score.js has run a generative score
// since the original single-file build: five moods, a convolution reverb, a
// half-second delay, and a `vassal` mood the board already switches to when a
// player is absorbed. The first draft of this file built a second context and a
// second on/off switch beside it, which would have meant two independent sound
// systems, two settings for one idea, and — on iOS, where contexts are a scarce
// and badly-behaved resource — two things to unlock and two to resume after a
// phone call. The cues are voices in the existing score instead.
//
// They route into Score.lp, the same node the pads and plucks use, so they
// arrive in the same room: the delay and reverb apply, the mood's filter applies,
// and a cue sounds like part of the piece rather than a notification over it.
// Routing there also means Score.master gates them, so the existing menu toggle
// silences these too and cannot get out of step with them.
//
// SYNTHESISED, NOT SAMPLED, like everything else here: the game is text plus one
// 180px icon, sw.js caches every asset for offline use, and audio files would
// dwarf the repository. It also means the character of a cue is a number in this
// file, so "less clack, more drone" is a one-line change — which matters,
// because the author cannot run any of this and tuning happens by description.
//
// WHAT PLAYS
//   absorbed()   one player is taken. Low and wrong rather than startling —
//                absorption is the book's thesis and the game's win condition,
//                and a jump-scare would cheapen the quietest serious moment
//                there is. Mandibles come up underneath a detuned sub.
//   stage(n)     the deep array's four reports, at 25/50/75/95% of the game.
//                Tied to the existing SWARM_STAGES beats rather than a second
//                clock, so the sound escalates exactly when the text does.

import { Score } from './score.js';

/* ---------------------------------------------------------------- the plan */
// Pure and exported so the decisions can be asserted in node, where there is no
// Web Audio to run. Escalation is monotonic on purpose: the text goes filed →
// resolved → agreed → past patience, and if the sound did not rise with it the
// game would say the situation was worsening while sounding unchanged.
export const STAGE_PLAN = [
  { clacks: 2,  gain: 0.16, hz: 58, dur: 1.5, wash: 0.00 },
  { clacks: 4,  gain: 0.22, hz: 52, dur: 2.0, wash: 0.04 },
  { clacks: 7,  gain: 0.30, hz: 46, dur: 2.6, wash: 0.09 },
  { clacks: 12, gain: 0.40, hz: 39, dur: 3.2, wash: 0.16 }
];

// Absorption is its own shape: fuller, longer and lower than any report,
// because it is the one event in a game that cannot be undone.
export const ABSORB_PLAN = { clacks: 14, gain: 0.44, hz: 34, dur: 3.4, wash: 0.13 };

// `mark` is G.swarmMark — how many reports the deep array has made, 0 to 4.
// Returns the plan for the report just crossed, or null when nothing is due.
export function planFor(mark) {
  if (!Number.isInteger(mark) || mark < 1 || mark > STAGE_PLAN.length) return null;
  return STAGE_PLAN[mark - 1];
}

/* ------------------------------------------------------------- the setting */
// Score.on is the single source of truth for whether this game makes any sound.
// It was not persisted, so every launch came up with the score on regardless of
// what was chosen last time. The setup screen now shows the switch — before a
// game starts, which is when it matters, because on a Home Screen PWA the iPhone
// ringer switch does not reliably silence a web page.
const KEY = 'grandiose-sound';

export const isOn = () => Score.on;

export function setOn(v) {
  Score.on = !!v;
  try { localStorage.setItem(KEY, Score.on ? '1' : '0'); } catch { /* private mode */ }
  if (Score.ctx && Score.master) {
    try {
      Score.resume();
      Score.catchUp();
      Score.master.gain.linearRampToValueAtTime(Score.on ? 0.9 : 0, Score.ctx.currentTime + 0.5);
    } catch { /* never let a setting throw */ }
  }
  return Score.on;
}

export function restore() {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) Score.on = v === '1';      // default on when never set
  } catch { /* private mode — keep the default */ }
  return Score.on;
}

export const supported = () =>
  typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);

/* --------------------------------------------------------------- the sound */
// One mandible: a short noise burst through a tight bandpass. Irregular in pitch
// and spacing, because evenly spaced identical clicks read as a machine rather
// than as something alive.
function clack(t, at, level, dest, buf) {
  const src = t.createBufferSource();
  src.buffer = buf;
  const bp = t.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400 + Math.random() * 2100;
  bp.Q.value = 6 + Math.random() * 8;
  const g = t.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.012 + Math.random() * 0.02);
  src.connect(bp); bp.connect(g); g.connect(dest);
  src.start(at); src.stop(at + 0.09);
}

let noiseBuf = null;

function play(plan) {
  // Score.ready is false until init() has run from a real gesture. Nothing here
  // may throw: a cue is never worth taking the interface down with it.
  if (!plan || !Score.on || !Score.ready || !Score.ctx || !Score.lp) return false;
  try {
    const t = Score.ctx;
    const dest = Score.lp;                    // into the score's own room
    const at = t.currentTime + 0.02;

    if (!noiseBuf) {
      const n = Math.floor(t.sampleRate * 0.4);
      noiseBuf = t.createBuffer(1, n, t.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }

    // A detuned pair a few cents apart beats slowly against itself, which is
    // what makes it sit wrong rather than sound like a test tone.
    const lp = t.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(320, at);
    lp.frequency.exponentialRampToValueAtTime(120, at + plan.dur);
    const sg = t.createGain();
    sg.gain.setValueAtTime(0.0001, at);
    sg.gain.exponentialRampToValueAtTime(plan.gain, at + plan.dur * 0.35);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + plan.dur);
    lp.connect(sg); sg.connect(dest);
    for (const cents of [-7, 7]) {
      const o = t.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = plan.hz * Math.pow(2, cents / 1200);
      o.connect(lp);
      o.start(at); o.stop(at + plan.dur + 0.05);
    }

    if (plan.wash > 0) {
      const src = t.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const hp = t.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 900;
      const wg = t.createGain();
      wg.gain.setValueAtTime(0.0001, at);
      wg.gain.exponentialRampToValueAtTime(plan.wash, at + plan.dur * 0.6);
      wg.gain.exponentialRampToValueAtTime(0.0001, at + plan.dur);
      src.connect(hp); hp.connect(wg); wg.connect(dest);
      src.start(at); src.stop(at + plan.dur + 0.05);
    }

    // Clacks start after the sub has established, so they arrive as something
    // moving inside a sound that was already there.
    for (let i = 0; i < plan.clacks; i++) {
      const frac = 0.25 + (i / Math.max(1, plan.clacks - 1)) * 0.7;
      const jitter = (Math.random() - 0.5) * 0.12;
      clack(t, at + Math.max(0, plan.dur * frac + jitter), 0.10 + Math.random() * 0.14, dest, noiseBuf);
    }
    return true;
  } catch {
    return false;
  }
}

export const stage = mark => play(planFor(mark));
export const absorbed = () => play(ABSORB_PLAN);

// Testing seam — the probe swaps the context underneath and needs the cached
// noise buffer, which belongs to the old one, forgotten with it.
export function _reset() { noiseBuf = null; }
