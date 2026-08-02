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
// PITCHED FOR A PHONE SPEAKER, which is the whole reason these numbers changed.
// The first version sat at 34-58Hz behind a lowpass sweeping 320 to 120Hz —
// "low and wrong", and correct for headphones. An iPhone speaker rolls off hard
// below about 500Hz, and rendering the old cue offline through a 500Hz highpass
// left 22% of its energy: four fifths of it could not physically reach the
// player, and the remainder was under a full generative score. Two complete
// games were played without either cue being heard once.
//
// So the fundamentals now sit between 98 and 186Hz on a sawtooth, whose
// harmonics a small speaker does reproduce, and the cue's own filter opens far
// enough to let them through. It still reads as low, because it is low relative
// to everything else in the mix — but it is low in a band that exists.
export const STAGE_PLAN = [
  { clacks: 4,  gain: 0.10, hz: 186, dur: 2.2, wash: 0.010, open: 1500 },
  { clacks: 7,  gain: 0.14, hz: 156, dur: 2.7, wash: 0.020, open: 1350 },
  { clacks: 12, gain: 0.19, hz: 124, dur: 3.2, wash: 0.035, open: 1200 },
  { clacks: 18, gain: 0.25, hz:  98, dur: 3.7, wash: 0.055, open: 1050 }
];

// Absorption is its own shape: fuller, longer and lower than any report,
// because it is the one event in a game that cannot be undone.
export const ABSORB_PLAN = { clacks: 22, gain: 0.30, hz: 82, dur: 4.0, wash: 0.050, open: 950 };

// The four reports are moments. On their own they were also too sparse to
// register: four events of three seconds across seventy-two circuits, which is
// why "no difference as we went on" was the correct report even once they could
// be heard. This is the part that is always there once the array has spoken —
// a thin detuned presence and an occasional clack, thickening at every stage.
// SWARM_STAGES says the intent out loud: the tone should change while the table
// is still arguing about colour sets. A sting cannot do that; a bed can.
export const PRESENCE = [
  null,                                                                   // nothing yet
  { gain: 0.016, hz: 150, every: 9.0, clack: 0.045, wash: 0.004 },
  { gain: 0.028, hz: 132, every: 5.5, clack: 0.070, wash: 0.009 },
  { gain: 0.045, hz: 112, every: 3.2, clack: 0.100, wash: 0.016 },
  { gain: 0.066, hz:  96, every: 1.8, clack: 0.135, wash: 0.026 }
];

// `mark` is G.swarmMark — how many reports the deep array has made, 0 to 4.
// Returns the plan for the report just crossed, or null when nothing is due.
export function planFor(mark) {
  if (!Number.isInteger(mark) || mark < 1 || mark > STAGE_PLAN.length) return null;
  return STAGE_PLAN[mark - 1];
}

/* ------------------------------------------------------------ the approach */
// The last fifteen circuits, keyed to swarmDistance(G) — circuits remaining, an
// absolute count rather than a fraction, because the swarm is a fixed distance
// away and does not care how long the game was set to run. At 48 circuits this
// is the last third; at 120 it is the last eighth. That is correct: the swarm
// really is closer, relative to everything else, in a short game.
//
// Read from the book rather than invented:
//   the doubled voice   "the translator's flat doubled voice" — the detuned
//                       unison was already there by accident and is now canon.
//   the rain            "resolving out of the intergalactic night like rain
//                       beginning on a window" — sparse, then everywhere, and
//                       never on a beat you could count.
//   the breathing       "vast hexagonal masses, less built than grown, their
//                       surfaces pocked with irregular openings that breathed".
//                       The score has no drums by design, so a pulse is a
//                       violation of its own language. That is the point.
//   the drift           conversion, not destruction. The score is pulled flat
//                       as it is digested — it does not stop, it goes wrong.
//
// `at` is circuits remaining, and values are interpolated between rows, so the
// swarm arrives continuously instead of in three steps a player could count.
// THE MUSIC DOES NOT GO AWAY. The first version took it to 0.07 and brought a
// drone up over the top, which is the destruction reading, not the conversion
// one — and it had a second cost that only showed up on measurement: the neurex
// mood was made busier and more varied at exactly the point it was being ducked
// to seven percent, so none of that variety could be heard and the last
// circuits were carried by a drone and some clacks. That is what "it repeats the
// same sound over and over" was.
//
// The brief was "the Neurex music is all you can hear", and the Neurex music is
// this score after conversion. So it plays on, down about nine decibels and
// wholly digested — cluster harmony, thirty-eight cents flat, dark and slow —
// with the bed and the rain as the thing on top of it rather than instead of it.
// What makes it a takeover is that everything you can hear has become theirs,
// not that the volume went down.
export const APPROACH = [
  { at: 15, music: 1.00, bed: 0.030, rain: 5.00, breath: 0.00, drift:   0 },
  { at: 10, music: 0.84, bed: 0.058, rain: 2.40, breath: 0.35, drift: -12 },
  { at:  5, music: 0.55, bed: 0.092, rain: 1.10, breath: 0.70, drift: -24 },
  // ONE, not zero. swarmDistance is `circuits - circuit + 1` and the game ends
  // at `circuit > circuits`, which is the exact moment it reaches zero — so a
  // bottom row at 0 was a state no player was ever in. Measured over 20 full
  // games: 235 readings at a distance of one, and none at all at zero. The
  // endgame had been topping out at the interpolated value for one — music at
  // 0.382 against the 0.34 written here, about a decibel short of its own
  // design. Spotted by Sam, who asked whether the last row was reachable.
  { at:  1, music: 0.34, bed: 0.128, rain: 0.45, breath: 1.00, drift: -38 }
];

// The floor the score settles to, not silence: the converted music is the point.
export const MUSIC_FLOOR = APPROACH[APPROACH.length - 1].music;

// Returns null while the swarm is further off than the first row.
export function approachFor(dist) {
  if (typeof dist !== 'number' || !Number.isFinite(dist)) return null;
  const d = Math.max(0, dist);
  if (d > APPROACH[0].at) return null;
  // The last row is returned whole rather than interpolated to. Landing on it
  // through the mix gave rain 0.44999999999999996 against the 0.45 written in
  // the table — the same float artefact the README records for `180 * 0.7`, and
  // at the one distance every game actually ends on.
  const last = APPROACH[APPROACH.length - 1];
  if (d <= last.at) return { ...last, grip: 1 };
  for (let i = 0; i < APPROACH.length - 1; i++) {
    const a = APPROACH[i], b = APPROACH[i + 1];
    if (d <= a.at && d >= b.at) {
      const span = a.at - b.at;
      const k = span === 0 ? 0 : (a.at - d) / span;      // 0 at a, 1 at b
      const mix = (x, y) => x + (y - x) * k;
      return {
        music:  mix(a.music,  b.music),
        bed:    mix(a.bed,    b.bed),
        rain:   mix(a.rain,   b.rain),
        breath: mix(a.breath, b.breath),
        drift:  mix(a.drift,  b.drift),
        // How far into the approach this is, 0 at the first row and 1 at the
        // last. Derived from the position in the table rather than stored on
        // each row, so the sky and the score cannot disagree about how close
        // the swarm is — galaxy.js reads this and nothing else.
        grip:   (i + k) / (APPROACH.length - 1)
      };
    }
  }
  return { ...APPROACH[APPROACH.length - 1], grip: 1 };
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
// Mandibles come in sizes. One recipe repeated is a tick track however much its
// centre frequency is jittered, so there are three: a small tap, a heavier
// shell-knock well below it, and a tiny dry tick above. Weighted so the taps
// carry the rhythm and the knocks land rarely enough to still register.
const CLACK_KINDS = [
  { w: 0.60, lo: 1400, hi: 3500, q: [6, 14], decay: [0.012, 0.032], gain: 1.00 },  // tap
  { w: 0.22, lo:  520, hi: 1050, q: [3,  7], decay: [0.040, 0.110], gain: 1.35 },  // shell
  { w: 0.18, lo: 3600, hi: 6200, q: [9, 20], decay: [0.006, 0.014], gain: 0.70 }   // tick
];

function pickKind() {
  let r = Math.random();
  for (const k of CLACK_KINDS) { if ((r -= k.w) <= 0) return k; }
  return CLACK_KINDS[0];
}

// Width. The score is mono throughout, so a swarm spread across the stereo
// field is the one thing here that cannot be mistaken for part of it — "no
// formation the eye could parse". Mostly a headphone gain: the iPhone's two
// speakers are close enough that this reads as texture rather than position.
// Feature-detected, because a browser without it must still get the sound.
function panned(t, dest) {
  if (!t.createStereoPanner) return dest;
  try {
    const p = t.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    p.connect(dest);
    return p;
  } catch { return dest; }
}

// One mandible. Irregular in pitch, size and spacing, because evenly spaced
// identical clicks read as a machine rather than as something alive.
function clack(t, at, level, dest, buf) {
  const k = pickKind();
  const src = t.createBufferSource();
  src.buffer = buf;
  const bp = t.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = k.lo + Math.random() * (k.hi - k.lo);
  bp.Q.value = k.q[0] + Math.random() * (k.q[1] - k.q[0]);
  const decay = k.decay[0] + Math.random() * (k.decay[1] - k.decay[0]);
  const g = t.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level * k.gain, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(bp); bp.connect(g); g.connect(panned(t, dest));
  src.start(at); src.stop(at + decay + 0.08);
}

let noiseBuf = null;

// Where a cue lands in the score. Dry into Score.master, past the mood's
// lowpass, because routing into Score.lp put the cue *inside* the music: at the
// facility mood that filter is at 2400Hz, so the clacks came back attenuated and
// mixed level with the pads. A send into Score.verb keeps it in the same room.
// Both sit behind Score.master, so the one off switch still silences everything.
const dryDest = () => Score.master;
const wetDest = () => Score.verb;

function ensureNoise(t) {
  if (!noiseBuf) {
    const n = Math.floor(t.sampleRate * 0.4);
    noiseBuf = t.createBuffer(1, n, t.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const live = () => !!(Score.on && Score.ready && Score.ctx && Score.master && Score.verb);

function play(plan) {
  // Score.ready is false until init() has run from a real gesture. Nothing here
  // may throw: a cue is never worth taking the interface down with it.
  if (!plan || !live()) return false;
  try {
    const t = Score.ctx;
    const dest = dryDest();
    const at = t.currentTime + 0.02;
    ensureNoise(t);

    // A detuned pair a few cents apart beats slowly against itself, which is
    // what makes it sit wrong rather than sound like a test tone.
    const lp = t.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(plan.open, at);
    lp.frequency.exponentialRampToValueAtTime(plan.open * 0.42, at + plan.dur);
    const sg = t.createGain();
    sg.gain.setValueAtTime(0.0001, at);
    sg.gain.exponentialRampToValueAtTime(plan.gain, at + plan.dur * 0.35);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + plan.dur);
    lp.connect(sg); sg.connect(dest); sg.connect(wetDest());
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

/* ------------------------------------------------------------- the presence */
// Built once and then left running for the rest of the game, its level moved by
// setPresence(). Oscillators are not restarted per stage: an AudioContext will
// happily accumulate them, and a 72-circuit game restarting a drone four times
// leaks four. One set, four gain ramps.
let bed = null;      // { gain, wash, osc:[], filt, timer, mark }

function buildBed(t) {
  const g = t.createGain();       g.gain.value = 0;
  const w = t.createGain();       w.gain.value = 0;
  const f = t.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.7;
  f.connect(g); g.connect(dryDest()); g.connect(wetDest());

  // The breathing. An LFO summed onto the bed's own gain, so the automation
  // below still sets the level and this rides on top of it. Depth is 0 until
  // the approach opens it, which is why it can be started once and left alone.
  const lfo = t.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.35;
  const depth = t.createGain(); depth.gain.value = 0;
  lfo.connect(depth); depth.connect(g.gain); lfo.start();

  // Two saws at a fixed pitch is a constant, and by the last five circuits the
  // bed is the loudest thing in the game — so the climax was carried by
  // something that never changed. Each voice now wanders in its own time:
  // independent slow LFOs on detune, at rates that share no common multiple, so
  // the beating between them never lands in the same place twice.
  const osc = [];
  const drift = [];
  const rates = [0.021, 0.034];
  for (let i = 0; i < 2; i++) {
    const cents = i === 0 ? -9 : 9;
    const o = t.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = PRESENCE[1].hz * Math.pow(2, cents / 1200);
    const dl = t.createOscillator(); dl.type = 'sine'; dl.frequency.value = rates[i];
    const da = t.createGain(); da.gain.value = 0;          // opened by applyBed
    dl.connect(da); da.connect(o.detune); dl.start();
    o.connect(f); o.start();
    osc.push(o); drift.push(da);
  }
  // And the filter itself breathes on a third incommensurable period, so the
  // timbre moves even while the level is holding still.
  const swp = t.createOscillator(); swp.type = 'sine'; swp.frequency.value = 0.013;
  const swa = t.createGain(); swa.gain.value = 0;
  swp.connect(swa); swa.connect(f.frequency); swp.start();
  const src = t.createBufferSource();
  src.buffer = ensureNoise(t); src.loop = true;
  const hp = t.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
  src.connect(hp); hp.connect(w); w.connect(dryDest());
  src.start();

  return { gain: g, wash: w, osc, filt: f, lfo, depth, drift, sweep: swa,
           timer: null, mark: 0, appr: null, rate: null, level: 0 };
}

// What the bed should currently be, given both the stage it has reached and how
// close the swarm is. The two are independent — the stage bed is the early
// game, the approach is the last fifteen circuits — and they overlap, so the
// heavier of the two wins rather than one replacing the other.
function resolveBed() {
  const p = bed && bed.mark ? PRESENCE[bed.mark] : null;
  const a = bed ? bed.appr : null;
  if (!p && !a) return { level: 0, wash: 0, hz: PRESENCE[1].hz, rate: null, clack: 0, breath: 0 };
  return {
    level:  Math.max(p ? p.gain  : 0, a ? a.bed : 0),
    wash:   Math.max(p ? p.wash  : 0, a ? a.bed * 0.35 : 0),
    hz:     Math.min(p ? p.hz    : 999, a ? 96 - a.bed * 40 : 999),
    rate:   Math.min(p ? p.every : Infinity, a ? a.rain : Infinity),
    clack:  Math.max(p ? p.clack : 0, a ? 0.09 + a.bed * 0.9 : 0),
    breath: a ? a.breath : 0
  };
}

// One clack. Rate and weight come from resolveBed, so the same routine is both
// the occasional distant report of mid-game and the rain of the last circuits.
function bedClack() {
  if (!bed || !live()) return;
  const r = resolveBed();
  if (!r.clack) return;
  try {
    const t = Score.ctx;
    clack(t, t.currentTime + 0.03, r.clack * (0.6 + Math.random() * 0.7), dryDest(), ensureNoise(t));
    if (Math.random() < 0.35) {
      clack(t, t.currentTime + 0.09 + Math.random() * 0.1, r.clack * 0.7, wetDest(), ensureNoise(t));
    }
    // Close in, it stops being single taps. "Like rain beginning on a window."
    if (r.breath > 0.5 && Math.random() < r.breath) {
      const extra = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < extra; i++) {
        clack(t, t.currentTime + 0.05 + Math.random() * 0.45, r.clack * (0.4 + Math.random() * 0.6),
              dryDest(), ensureNoise(t));
      }
    }
  } catch { /* a clack is never worth an exception */ }
}

function armBed() {
  if (!bed) return;
  if (bed.timer) { clearTimeout(bed.timer); bed.timer = null; }
  const r = resolveBed();
  if (!r.rate || !Number.isFinite(r.rate)) return;
  // Jittered rather than metronomic — an even pulse reads as a machine, and the
  // one thing the Neurex are not is a machine keeping time.
  const wait = Math.max(120, r.rate * (0.55 + Math.random() * 0.9) * 1000);
  bed.timer = setTimeout(() => { bedClack(); armBed(); }, wait);
}

// Ramps the bed to whatever resolveBed now says, over `secs`.
function applyBed(secs) {
  if (!bed || !live()) return false;
  const t = Score.ctx, now = t.currentTime, r = resolveBed();
  bed.level = r.level;
  bed.gain.gain.linearRampToValueAtTime(r.level, now + secs);
  bed.wash.gain.linearRampToValueAtTime(r.wash, now + secs);
  bed.filt.frequency.linearRampToValueAtTime(620 + r.level * 4200, now + secs);
  for (let i = 0; i < bed.osc.length; i++) {
    const cents = i === 0 ? -9 : 9;
    bed.osc[i].frequency.linearRampToValueAtTime(r.hz * Math.pow(2, cents / 1200), now + secs);
  }
  // Breathing rides on the level, so its depth is a fraction of it — otherwise
  // it would pump hardest when the bed is quietest.
  bed.depth.gain.linearRampToValueAtTime(r.level * r.breath * 0.75, now + secs);
  bed.lfo.frequency.linearRampToValueAtTime(0.35 + r.breath * 0.5, now + secs);
  // Detune wander in cents, and filter sweep in Hz. Both scale with how present
  // the bed is, so a barely-there drone stays still and a dominant one crawls.
  const wander = 4 + r.level * 90;
  for (const d of bed.drift) d.gain.linearRampToValueAtTime(wander, now + secs);
  bed.sweep.gain.linearRampToValueAtTime(120 + r.level * 900, now + secs);
  armBed();
  return true;
}

// mark is G.swarmMark, 0 to 4. Idempotent: called on every render, acts only
// when the stage has actually moved.
export function setPresence(mark) {
  const m = Number.isInteger(mark) ? Math.max(0, Math.min(PRESENCE.length - 1, mark)) : 0;
  if (!live()) return false;
  try {
    if (!bed) bed = buildBed(Score.ctx);
    if (bed.mark === m) return true;
    bed.mark = m;
    return applyBed(6);            // thickens rather than switches on
  } catch {
    return false;
  }
}

// The last fifteen circuits. Called every render with swarmDistance(G); does
// nothing until the swarm is inside range, and nothing again once it has
// settled at a level.
export function setApproach(dist) {
  if (!live()) return false;
  try {
    if (!bed) bed = buildBed(Score.ctx);
    const a = approachFor(dist);
    const was = bed.appr;
    // Quantised to a hundredth before comparing, or floating point makes every
    // render a change and the ramps restart continuously.
    const same = (!a && !was) ||
      (a && was && Math.abs(a.music - was.music) < 0.005 && Math.abs(a.bed - was.bed) < 0.002);
    if (same) return true;
    bed.appr = a;

    const t = Score.ctx, now = t.currentTime;
    // The duck. Long ramps: the swarm closes over the score rather than cutting
    // it — "the swarm closed over the walls like water over a stone".
    if (Score.music) {
      Score.music.gain.cancelScheduledValues(now);
      Score.music.gain.setValueAtTime(Score.music.gain.value, now);
      Score.music.gain.linearRampToValueAtTime(a ? a.music : 1, now + 8);
    }
    // Conversion, not destruction: the score is pulled flat as it is digested.
    // R is read when a bar is scheduled, so this reaches the music within a bar
    // or two without touching anything already sounding.
    Score.R = (Score.R0 || Score.R) * Math.pow(2, (a ? a.drift : 0) / 1200);
    return applyBed(8);
  } catch {
    return false;
  }
}

// A new game starts from silence again, and in tune.
export function clearPresence() {
  if (!bed) {
    if (Score.R0) Score.R = Score.R0;
    return;
  }
  if (bed.timer) { clearTimeout(bed.timer); bed.timer = null; }
  bed.mark = 0;
  bed.appr = null;
  try {
    const now = Score.ctx.currentTime;
    bed.gain.gain.cancelScheduledValues(now);
    bed.gain.gain.linearRampToValueAtTime(0, now + 1.2);
    bed.wash.gain.linearRampToValueAtTime(0, now + 1.2);
    bed.depth.gain.linearRampToValueAtTime(0, now + 1.2);
    for (const d of bed.drift) d.gain.linearRampToValueAtTime(0, now + 1.2);
    bed.sweep.gain.linearRampToValueAtTime(0, now + 1.2);
    if (Score.music) {
      Score.music.gain.cancelScheduledValues(now);
      Score.music.gain.linearRampToValueAtTime(1, now + 1.2);
    }
    Score.R = Score.R0 || Score.R;
  } catch { /* ignore */ }
}

// Testing seam — the probe swaps the context underneath and needs the cached
// noise buffer and the bed, which belong to the old one, forgotten with it.
export function _reset() {
  if (bed && bed.timer) clearTimeout(bed.timer);
  noiseBuf = null;
  bed = null;
}
