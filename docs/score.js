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
  state: 'ledger', bar: 0, timer: null, nextT: 0,
  R: 73.416,                                        // D2

  MODE: {
    ledger:   [0, 2, 4, 6, 7, 9, 11],               // lydian — wonder
    auction:  [0, 2, 4, 5, 7, 9, 10],               // mixolydian — drive
    facility: [0, 2, 4, 6, 8, 10],                  // whole tone — weightless, alien
    vassal:   [0, 2, 3, 5, 7, 9, 10],               // dorian — shadowed, not sad
    ascend:   [0, 2, 4, 6, 7, 9, 11]
  },
  PROG: {
    ledger:   [[0, 4, 5, 3], [0, 3, 6, 4], [0, 5, 3, 4], [4, 0, 3, 5]],
    auction:  [[0, 6, 4, 5], [0, 4, 6, 3], [5, 3, 6, 0]],
    facility: [[0, 2, 4, 2], [0, 3, 1, 4], [2, 0, 4, 1]],
    vassal:   [[0, 5, 3, 6], [3, 0, 5, 4]],
    ascend:   [[0, 4, 3, 5], [0, 5, 4, 0], [3, 0, 4, 5]]
  },
  TONE: {
    ledger:   { lp: 3600, g: .15, arp: .62, shim: .55, sub: .22, div: 2, wind: .16 },
    auction:  { lp: 4600, g: .18, arp: .95, shim: .34, sub: .55, div: 4, wind: .10 },
    facility: { lp: 2400, g: .12, arp: .22, shim: .85, sub: .06, div: 1, wind: .30 },
    vassal:   { lp: 2700, g: .15, arp: .48, shim: .30, sub: .45, div: 2, wind: .18 },
    ascend:   { lp: 5400, g: .19, arp: .88, shim: .80, sub: .35, div: 4, wind: .12 }
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
    this.lp.connect(dry).connect(this.master);
    this.lp.connect(this.verb).connect(wet).connect(this.master);
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

  drone() {
    [[1, .085], [1.5, .05], [4, .022], [6, .014]].forEach(([m, g], i) => {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        o.type = i > 1 ? 'sine' : 'sawtooth';
        o.frequency.value = this.R * m; o.detune.value = det;
        const l = this.ctx.createOscillator(); l.type = 'sine'; l.frequency.value = .03 + i * .017;
        const la = this.ctx.createGain(); la.gain.value = 5 + i * 4;
        l.connect(la).connect(o.detune); l.start();
        const gn = this.ctx.createGain(); gn.gain.value = g / 2;
        o.connect(gn).connect(this.lp); o.start();
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
    this.windG = t.createGain(); this.windG.gain.value = .16;
    const sw = t.createOscillator(); sw.type = 'sine'; sw.frequency.value = .014;
    const sa = t.createGain(); sa.gain.value = .09;
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
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 1.2);
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
      const shape = [[0, 3, 5, 8], [0, 5, 3, 8], [0, 2, 5, 7], [8, 5, 3, 0]][Math.floor(Math.random() * 4)];
      for (let k = 0; k < n; k++) {
        if (Math.random() < .16) continue;
        const f = sd(deg + shape[k % 4] + L * (3 + (k % (2 * T.div) >= T.div ? 1 : 0)));
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
export function moodFor(G) {
  if (!G) return 'ledger';
  if (G.phase === 'auction' || G.phase === 'contest') return 'auction';
  const p = G.players[G.cur];
  if (!p) return 'ledger';
  if (p.inFacility) return 'facility';
  if (p.lord !== null) return 'vassal';
  if (p.vassals.length) return 'ascend';
  return 'ledger';
}
