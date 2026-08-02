// Generative score. Lydian and whole-tone harmony, quartal voicings, long
// delay, no drums. Never repeats.
//
// Lifted from the original single-file build with two changes: the stray
// implicit global in init() is declared, and the state machine is driven by the
// UI rather than reaching into game internals.
//
// iOS will not start an AudioContext without a user gesture, so init() must be
// called from a tap. Everything here no-ops safely if that never happens.

export const Score = {
  ctx: null, on: true, ready: false, master: null, lp: null, verb: null,
  dly: null, dfb: null, windG: null,
  // Everything the score itself makes passes through `music`, and nothing else
  // does. audio.js ducks this to bring the swarm over the top in the closing
  // circuits; if it ducked `master` instead it would duck the swarm with it.
  music: null,
  state: 'ledger', bar: 0, timer: null, nextT: 0,
  R: 73.416,                                        // D2
  R0: 73.416,                                       // the tuning to come home to
  // How far the noise bed swells above and below its setting, in gain. Named
  // and hung here so a test can reach it — as a literal inside init() the one
  // number that made the bed distracting was not addressable by anything.
  WIND_SWELL: .015,

  // `neurex` is the score after conversion, not a different piece playing over
  // it. The book is specific about what they do — "It was not destruction;
  // destruction he had a decade of grammar for. This was conversion." — so the
  // progressions, the voicings and the bar structure are untouched and only the
  // scale underneath them is replaced. The same music, playing itself wrong.
  //
  // Two chromatic clusters a tritone apart. Quartal voicing on a six-note scale
  // lands root / tritone / minor sixth / major ninth, which is alien without
  // being random — it still resolves the way the progression says it should,
  // into somewhere nobody would have chosen to go.
  MODE: {
    ledger:   [0, 2, 4, 6, 7, 9, 11],               // lydian — wonder
    auction:  [0, 2, 4, 5, 7, 9, 10],               // mixolydian — drive
    facility: [0, 2, 4, 6, 8, 10],                  // whole tone — weightless, alien
    vassal:   [0, 2, 3, 5, 7, 9, 10],               // dorian — shadowed, not sad
    ascend:   [0, 2, 4, 6, 7, 9, 11],
    neurex:   [0, 1, 2, 6, 7, 8]                    // clusters, a tritone apart
  },
  PROG: {
    ledger:   [[0, 4, 5, 3], [0, 3, 6, 4], [0, 5, 3, 4], [4, 0, 3, 5]],
    auction:  [[0, 6, 4, 5], [0, 4, 6, 3], [5, 3, 6, 0]],
    facility: [[0, 2, 4, 2], [0, 3, 1, 4], [2, 0, 4, 1]],
    vassal:   [[0, 5, 3, 6], [3, 0, 5, 4]],
    ascend:   [[0, 4, 3, 5], [0, 5, 4, 0], [3, 0, 4, 5]],
    // Five, not three. Three progressions is twelve bars, which comes round
    // every 41 seconds — sooner than the 55 of the ledger mood it replaces, so
    // the takeover repeated faster than the music it took over from. Five is
    // twenty bars, 69 seconds, and beats against the 16-bar hush to give a
    // combined period of eighty bars before anything is heard twice.
    neurex:   [[0, 5, 4, 3], [0, 4, 2, 1], [3, 2, 1, 0],
               [5, 1, 4, 0], [2, 5, 0, 3]]                  // every shape descends
  },

  // Arpeggio figures. The default four are four notes long, so at div 4 a bar
  // is one small pattern played four times — fine under a tune, and a loop when
  // it is the only thing moving. The swarm gets eight-note figures that do not
  // repeat inside a bar and do not sit in any key: "They had no formation the
  // eye could parse."
  SHAPES: {
    default: [[0, 3, 5, 8], [0, 5, 3, 8], [0, 2, 5, 7], [8, 5, 3, 0]],
    neurex:  [[0, 5, 1, 8, 3, 10, 2, 7], [8, 1, 5, 2, 10, 0, 7, 3],
              [0, 7, 2, 9, 1, 6, 3, 11], [5, 0, 8, 2, 7, 1, 10, 4]]
  },
  // `wind` is the noise bed, and every one of these was set too high.
  //
  // It was balanced against the drone, which sits at 73Hz and its harmonics —
  // frequencies a phone speaker barely reproduces. So it was mixed against
  // something the player cannot hear. Rendered offline and measured layer by
  // layer through three speaker models, the old settings put the noise LOUDER
  // than every pad, arpeggio and pluck combined: +1 to +2.3dB in the ledger
  // mood, 39-58% of everything audible, and +4.6 to +7.2dB in the takeover,
  // where it reached 82%. Reported from play as "a constant noise that gets
  // distracting", which is precisely what it was.
  //
  // Held now by a test: the bed may never be set above `g`, the musical layer
  // it is supposed to sit under. Every line below would have failed that.
  TONE: {
    ledger:   { lp: 3600, g: .15, arp: .62, shim: .55, sub: .22, div: 2, wind: .06 },
    auction:  { lp: 4600, g: .18, arp: .95, shim: .34, sub: .55, div: 4, wind: .04 },
    facility: { lp: 2400, g: .12, arp: .22, shim: .85, sub: .06, div: 1, wind: .11 },
    vassal:   { lp: 2700, g: .15, arp: .48, shim: .30, sub: .45, div: 2, wind: .07 },
    ascend:   { lp: 5400, g: .19, arp: .88, shim: .80, sub: .35, div: 4, wind: .05 },
    // BUSY AND INCOHERENT, not sparse and still. The first version read "alien"
    // as "motionless" — arp .16, shim .18, div 1 — which made the takeover the
    // least varied mood in the game at 1.54 moving parts a bar against the
    // ledger's 5.73, and it plays over the longest unbroken stretch of a game.
    // The book says the opposite of static: "a single thing wearing billions of
    // bodies", "no formation the eye could parse". Many things moving as one.
    // lp is 1800 rather than 1500 because that motion has to survive a phone
    // speaker, and it is the harmonics that carry it.
    //
    // wind was .40 — the loudest bed in the game, over the longest unbroken
    // stretch of it. That was set here to make the takeover feel like weather,
    // and it made it hiss instead.
    neurex:   { lp: 1800, g: .16, arp: .72, shim: .55, sub: .55, div: 2, wind: .12 }
  },

  init() {
    if (this.ctx) { this.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    try { this.ctx = new C(); } catch { return; }
    const t = this.ctx;

    this.master = t.createGain(); this.master.gain.value = 0;
    this.lp = t.createBiquadFilter(); this.lp.type = 'lowpass';
    this.lp.frequency.value = 3600; this.lp.Q.value = .4;

    // Long delay — what makes it feel like space rather than a room.
    this.dly = t.createDelay(2.0); this.dly.delayTime.value = .52;
    this.dfb = t.createGain(); this.dfb.gain.value = .46;
    const dtone = t.createBiquadFilter(); dtone.type = 'lowpass'; dtone.frequency.value = 2600;
    this.dly.connect(dtone).connect(this.dfb).connect(this.dly);
    const dwet = t.createGain(); dwet.gain.value = .42;
    this.dly.connect(dwet).connect(this.lp);

    const len = Math.floor(t.sampleRate * 3.4);
    const b = t.createBuffer(2, len, t.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
    this.verb = t.createConvolver(); this.verb.buffer = b;
    const wet = t.createGain(); wet.gain.value = .40;
    const dry = t.createGain(); dry.gain.value = .66;   // was an implicit global
    // One node carrying the whole score and nothing else, so it can be pulled
    // down without touching the cues that come in downstream of it.
    this.music = t.createGain(); this.music.gain.value = 1;
    this.lp.connect(this.music);
    this.music.connect(dry).connect(this.master);
    this.music.connect(this.verb).connect(wet).connect(this.master);
    this.master.connect(t.destination);

    this.drone(); this.wind();
    this.watch();
    this.ready = true;
    this.nextT = t.currentTime + .15;
    this.master.gain.linearRampToValueAtTime(this.on ? .9 : 0, t.currentTime + 3.4);
    this.timer = setInterval(() => this.sched(), 150);
  },

  // Any state that is not 'running'. iOS uses 'interrupted' after backgrounding,
  // a call or Siri — and the old check only looked for 'suspended', so coming
  // back from any of those left the score off for good.
  resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'running') return;
    const r = this.ctx.resume();
    if (r && r.then) r.then(() => this.catchUp()).catch(() => {});
    else this.catchUp();
  },

  // The schedule clock keeps its own time, so after five minutes in the
  // background nextT is five minutes behind. Left alone, sched() would schedule
  // every missed bar in one pass with start times in the PAST, and Web Audio
  // fires those immediately — a few hundred bars at once.
  catchUp() {
    if (!this.ctx) return;
    if (this.nextT < this.ctx.currentTime) this.nextT = this.ctx.currentTime + 0.12;
  },

  // Called once from init(). Between them these cover coming back to the app
  // without touching anything, and the case where iOS refuses to resume without
  // a gesture — the next tap anywhere will do it.
  watch() {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.resume(); });
    window.addEventListener('pageshow', () => this.resume());
    window.addEventListener('focus', () => this.resume());
    document.addEventListener('pointerdown', () => this.resume(), { passive: true });
    if (this.ctx.addEventListener) {
      this.ctx.addEventListener('statechange', () => {
        if (this.ctx.state !== 'running' && this.on) this.resume();
      });
    }
  },

  // The floor under the score — and on a phone, the floor was not what reached
  // the player.
  //
  // Reported from play as "a constant techno sounding hum that my attention
  // keeps focusing on rather than the music". It was not the noise bed and it
  // was not a throb: measured, the amplitude fluctuation of every layer in this
  // file is 1-5% of its own level, which is nothing. It was steady TONES.
  //
  // The drone used to carry partials at 4x and 6x the root as pure sines — 294
  // and 440Hz, added so it would be audible on a small speaker. They were. A
  // phone reproduces almost none of the 73Hz fundamental that does the actual
  // work, so what arrived was those two sines plus the sawtooth harmonic ladder
  // above them, measured as steady peaks at 444, 660, 812, 1100 and 1256Hz. A
  // fixed chord of pure tones, unchanged from the first second of a game to the
  // last, sitting 7.5dB under a score whose every chord moves. A pure steady
  // tone is the easiest thing there is for an ear to pick out of a mix, and the
  // ear settles on whatever does not move.
  //
  // So the two sine partials are gone, and what remains is filtered to below
  // the band a phone can throw. Two poles, because one leaves the ladder
  // audible: the drone is meant to be felt rather than heard.
  //
  // 420 was the first attempt and was measured to do almost nothing — the
  // loudest tone in the drone is at 440Hz, which sits ON that cutoff and came
  // through 1dB down. Swept properly, and the reason 240 is affordable is that
  // the drone's full-range level barely moves across the whole range:
  //
  //   cutoff   loudest tone a phone gets   drone vs music, phone   full range
  //     420        440Hz at 8.0                  -15.3dB            -1.2dB
  //     300        220Hz at 3.4                  -23.5dB            -1.0dB
  //     240        220Hz at 3.1                  -29.9dB            -1.0dB
  //     180        220Hz at 1.5                  -38.6dB            -0.9dB
  //
  // The floor is made of 73Hz, and 73Hz is not what is being cut. What is being
  // cut is only ever the part that reached the player as a tone.
  DRONE_LP: 240,
  DRONE_PARTIALS: [[1, .085], [1.5, .05]],

  drone() {
    const cut = () => {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = this.DRONE_LP; f.Q.value = .5;
      return f;
    };
    const a = cut(), b = cut();
    a.connect(b).connect(this.lp);
    this.DRONE_PARTIALS.forEach(([m, g], i) => {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = this.R * m; o.detune.value = det;
        const l = this.ctx.createOscillator(); l.type = 'sine'; l.frequency.value = .03 + i * .017;
        const la = this.ctx.createGain(); la.gain.value = 5 + i * 4;
        l.connect(la).connect(o.detune); l.start();
        const gn = this.ctx.createGain(); gn.gain.value = g / 2;
        o.connect(gn).connect(a); o.start();
      }
    });
  },

  wind() {
    const t = this.ctx, len = t.sampleRate * 4;
    const b = t.createBuffer(1, len, t.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = t.createBufferSource(); src.buffer = b; src.loop = true;
    const bp = t.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 900; bp.Q.value = .8;
    const lf = t.createOscillator(); lf.type = 'sine'; lf.frequency.value = .021;
    const la = t.createGain(); la.gain.value = 520;
    lf.connect(la).connect(bp.frequency); lf.start();
    this.windG = t.createGain(); this.windG.gain.value = .06;
    // The swell, and the reason the bed was distracting rather than merely
    // present. This was .09 against a base of .16, which measured as a 15.4dB
    // rise and fall on a 71-second cycle, running for the whole game — a steady
    // bed disappears, one that keeps swelling does not, because the ear tracks
    // it. The depth is absolute rather than proportional, so it is set from the
    // QUIETEST mood (auction, .04) and not the loudest: at .015 the worst-case
    // swing anywhere is 6.8dB, and a test holds that.
    const sw = t.createOscillator(); sw.type = 'sine'; sw.frequency.value = .014;
    const sa = t.createGain(); sa.gain.value = this.WIND_SWELL;
    sw.connect(sa).connect(this.windG.gain); sw.start();
    src.connect(bp).connect(this.windG).connect(this.lp); src.start();
  },

  pad(f, t, dur, gain) {
    for (const det of [-8, 8]) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f; o.detune.value = det;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain / 2, t + dur * .45);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(this.lp); o.start(t); o.stop(t + dur + .05);
    }
  },
  pluck(f, t, dur, gain, send) {
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(this.lp); if (send) g.connect(this.dly);
    o.start(t); o.stop(t + dur + .03);
  },
  bell(f, t, gain) {
    const c = this.ctx.createOscillator(); c.type = 'sine'; c.frequency.value = f;
    const m = this.ctx.createOscillator(); m.type = 'sine'; m.frequency.value = f * 2.01;
    const ma = this.ctx.createGain();
    ma.gain.setValueAtTime(f * 3.2, t);
    ma.gain.exponentialRampToValueAtTime(1, t + 1.1);
    m.connect(ma).connect(c.frequency); m.start(t); m.stop(t + 3.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + 3.2);
    c.connect(g); g.connect(this.lp); g.connect(this.dly);
    c.start(t); c.stop(t + 3.4);
  },
  sub(t, gain) {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(55, t);
    o.frequency.linearRampToValueAtTime(48, t + .5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .05);
    g.gain.exponentialRampToValueAtTime(.0001, t + 1.1);
    // Through `music`, not straight at the master: the sub is part of the score
    // and must duck with the rest of it when the swarm takes over.
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 1.2);
  },

  sched() {
    if (!this.ready || this.ctx.state !== 'running') return;
    // Belt and braces: whatever put the clock behind, never try to play the past.
    if (this.nextT < this.ctx.currentTime - 0.5) this.catchUp();
    const beat = 60 / 70, barLen = beat * 4;
    while (this.nextT < this.ctx.currentTime + 1.8) {
      this.play(this.nextT, barLen, beat);
      this.nextT += barLen; this.bar++;
    }
  },

  play(t, barLen) {
    const st = this.state, T = this.TONE[st], sc = this.MODE[st], L = sc.length;
    const progs = this.PROG[st], pr = progs[Math.floor(this.bar / 4) % progs.length];
    const deg = pr[this.bar % 4];
    const sd = i => {
      const k = ((i % L) + L) % L, oct = Math.floor(i / L);
      return this.R * Math.pow(2, (sc[k] + 12 * oct) / 12);
    };
    const hush = (this.bar % 16) === 15;
    const amp = (hush ? .3 : 1) * T.g;
    this.lp.frequency.linearRampToValueAtTime(hush ? T.lp * .6 : T.lp, t + barLen * .6);
    if (this.windG) this.windG.gain.linearRampToValueAtTime(T.wind * (hush ? 1.6 : 1), t + barLen * .5);
    this.dly.delayTime.linearRampToValueAtTime(.42 + Math.random() * .22, t + barLen);

    // Quartal voicing — stacked fourths, no minor triad, no funeral.
    const voicing = [deg, deg + 3, deg + 5].concat(Math.random() < .5 ? [deg + 8] : []);
    voicing.forEach((v, i) =>
      this.pad(sd(v + L * 2), t + Math.random() * .05, barLen * (1.9 + Math.random() * .6), amp * (i ? .42 : .62)));
    this.pad(sd(deg) / 2, t, barLen * 1.6, amp * .7);

    if (!hush && Math.random() < T.arp) {
      const n = 4 * T.div, stepT = barLen / n;
      const figures = this.SHAPES[st] || this.SHAPES.default;
      const shape = figures[Math.floor(Math.random() * figures.length)];
      for (let k = 0; k < n; k++) {
        if (Math.random() < .16) continue;
        const f = sd(deg + shape[k % shape.length] + L * (3 + (k % (2 * T.div) >= T.div ? 1 : 0)));
        this.pluck(f, t + k * stepT, stepT * 2.2, amp * .30, true);
      }
    }
    if (Math.random() < T.shim) {
      const off = [0, 3, 5, 7, 8][Math.floor(Math.random() * 5)];
      this.bell(sd(deg + off + L * 4), t + Math.random() * barLen * .6, amp * .26);
    }
    if (!hush && Math.random() < T.sub) this.sub(t, .20);
  },

  set(s) {
    if (!this.MODE[s] || s === this.state) return;
    this.state = s;
    if (this.ready) this.lp.frequency.linearRampToValueAtTime(this.TONE[s].lp, this.ctx.currentTime + 1.6);
  },

  toggle() {
    this.on = !this.on;
    if (this.ctx) {
      this.resume();
      this.catchUp();
      this.master.gain.linearRampToValueAtTime(this.on ? .9 : 0, this.ctx.currentTime + .5);
    }
    return this.on;
  }
};

// Which mood the board is in, given whose turn it is.
//
// `dist` is swarmDistance(G) — circuits remaining — passed in rather than
// recomputed here, because `circuits - circuit + 1` written twice is two things
// that will disagree eventually. Inside ten circuits nothing else matters: whose
// turn it is, who is detained and who holds an oath all stop being the subject.
export function moodFor(G, dist) {
  if (!G) return 'ledger';
  if (typeof dist === 'number' && dist <= 10) return 'neurex';
  if (G.phase === 'auction' || G.phase === 'contest') return 'auction';
  const p = G.players[G.cur];
  if (!p) return 'ledger';
  if (p.inFacility) return 'facility';
  if (p.lord !== null) return 'vassal';
  if (p.vassals.length) return 'ascend';
  return 'ledger';
}
