// The middle of the board. A spiral galaxy seen at an angle, with ships running
// between the arms and asteroids tumbling past.
//
// This is the largest single area on the screen and it was dead space, so it is
// worth some care — but it is also running on a phone, on battery, for an hour
// at a time. Everything below is bounded: a fixed star count, at most a couple
// of ships, no allocation in the animation loop, the whole thing stopped when
// the page is hidden, and a single static frame when the reader has asked for
// reduced motion.

const ARMS = 2;
const STARS = 320;

// ---- the universe the galaxy is in --------------------------------------
// Outside the disc the panel was a black rectangle, and it is the largest
// single area on the screen. These are NOT part of the galaxy: they never
// rotate, never drift, and are drawn once into an offscreen canvas that is
// blitted each frame, because the file's budget is "a phone, on battery, for
// an hour at a time" and an hour is roughly 216,000 frames.
//
// Measured at the real panel size with a forced GPU flush: 250 of these drawn
// live every frame costs 0.45ms against 0.30ms today, which is 2.7% of a 60fps
// frame and affordable either way. Pre-rendering is not about the frame — it is
// about not paying for it 216,000 times.
const BG_STARS = 230;
const TWINKLERS = 16;           // drawn live on top; the rest are baked
const BG_GALAXIES = 5;

// Real starfields are not one grey. Weighted toward white, because a field of
// obviously coloured dots reads as confetti.
const BG_TINTS = [
  [198, 214, 255], [198, 214, 255],           // blue-white
  [226, 231, 242], [226, 231, 242], [226, 231, 242], [226, 231, 242],
  [255, 232, 202],                            // warm white
  [232, 202, 166]                             // faint amber
];
const TWIST = 2.9;              // radians of sweep per unit radius
const TILT = 0.52;              // vertical squash — the disc seen at an angle
const SPIN = 0.000045;          // radians per millisecond, i.e. very slow

// Mood tints, keyed to the same states the score uses.
const TINTS = {
  ledger:   { core: [255, 226, 170], arm: [150, 178, 224], hot: [217, 164, 65] },
  auction:  { core: [255, 214, 150], arm: [224, 160, 120], hot: [224, 119, 106] },
  facility: { core: [190, 220, 235], arm: [120, 150, 190], hot: [ 94, 207, 200] },
  vassal:   { core: [222, 200, 240], arm: [150, 130, 200], hot: [139, 125, 216] },
  ascend:   { core: [255, 240, 205], arm: [180, 205, 240], hot: [255, 205, 110] },
  // The red tide, and the green their shields answer with — "Green light
  // answered. Shields - layered, organic, shimmering like membranes." Reached
  // inside ten circuits, when the score is being converted too; the sky staying
  // gold through that would read as a fault rather than as restraint.
  neurex:   { core: [235, 110,  90], arm: [128, 175, 130], hot: [150, 230, 130] }
};

const rand = (a, b) => a + Math.random() * (b - a);
const mixRGB = (x, y, k) => [
  Math.round(x[0] + (y[0] - x[0]) * k),
  Math.round(x[1] + (y[1] - x[1]) * k),
  Math.round(x[2] + (y[2] - x[2]) * k)
];

// ---- the swarm arriving ------------------------------------------------
// Driven by approachFor()'s `grip`, 0 at fifteen circuits out and 1 at one,
// which is the same number the score's duck and drift are read from. One clock
// for the sky and the music, so they cannot disagree about how close it is.
//
// The red is the point. Inside ten circuits the disc already takes the Neurex
// mood, but 89.7% of its stars are the arm and hot tints, which are green —
// and in the book green is their SHIELDS, the thing that answers your fire once
// they are here. The approach is red: "the red tide", "a deep red stain spread
// across a full quadrant of the display", "watched the red blips arrive".
const BLIP_MAX = 46;              // "One. Then ten. Then a hundred"
const HEX_MAX = 3;
const BLIP_RED = [232, 74, 62];
const HEX_RIM = [214, 88, 74];

export function startGalaxy(canvas, getMood, getApproach) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return { stop() {}, resize() {} };

  const reduced = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, cx = 0, cy = 0, radius = 0, dpr = 1;
  let raf = 0, last = 0, spin = 0, running = false;

  // ---- the disc -----------------------------------------------------------
  // Stars are placed once in polar form and only rotated afterwards, so the
  // arms hold their shape and the loop never allocates.
  const stars = [];
  for (let i = 0; i < STARS; i++) {
    // sqrt keeps the density even across the disc rather than piling up at the core
    const t = Math.sqrt(Math.random());
    const arm = i % ARMS;
    const scatter = (Math.random() + Math.random() + Math.random() - 1.5) * (0.30 + t * 0.42);
    stars.push({
      t,
      angle: (arm * 2 * Math.PI) / ARMS + t * TWIST + scatter,
      size: rand(0.5, 1.7) * (1 - t * 0.3),
      alpha: rand(0.40, 1) * (1 - t * 0.32),
      twinkle: rand(0.0006, 0.0022),
      phase: rand(0, Math.PI * 2)
    });
  }

  // ---- the background -----------------------------------------------------
  // Held in normalised coordinates and rendered at resize, so rotating the
  // phone moves the field with the panel instead of dealing a new sky.
  const bg = [];
  for (let i = 0; i < BG_STARS; i++) {
    bg.push({
      nx: Math.random(), ny: Math.random(),
      r: rand(0.35, 1.15),
      // Most are barely there. The brightest few are what makes it read as
      // depth rather than as noise.
      a: Math.pow(Math.random(), 2.1) * 0.34 + 0.045,
      c: BG_TINTS[Math.floor(Math.random() * BG_TINTS.length)],
      period: rand(2600, 9000),
      phase: rand(0, Math.PI * 2)
    });
  }
  // The twinklers are bg[0..TWINKLERS-1], and they have to be stars that are
  // actually visible. Taken uniformly, several land inside the disc where
  // clearOfDisc fades them to nothing, so a sixteen-star budget was delivering
  // ten — and on the smallest phone almost none reached the corners, which is
  // where the whole point of this is. Anything past a third of the way out is a
  // candidate; the rest of the order is left alone so they stay scattered
  // rather than ringing the edge.
  //
  // 0.40, not 0.30. clearOfDisc starts fading in at 0.62 of the disc's own
  // ellipse, and on a square panel that lands at a normalised distance of about
  // 0.29 across and 0.23 down — so a 0.30 threshold was putting twinklers right
  // on the edge of the fade, where they render at a few percent alpha and are
  // effectively invisible. Beyond 0.40 they are in genuinely dark sky. Roughly
  // half the panel qualifies, so there is no shortage of candidates.
  {
    const far = [], near = [];
    for (const s of bg) {
      (Math.hypot(s.nx - 0.5, s.ny - 0.5) > 0.40 ? far : near).push(s);
    }
    for (let i = far.length - 1; i > 0; i--) {      // shuffle, so they scatter
      const j = Math.floor(Math.random() * (i + 1));
      [far[i], far[j]] = [far[j], far[i]];
    }
    bg.length = 0;
    bg.push(...far, ...near);
  }

  const bgGalaxies = [];
  for (let i = 0; i < BG_GALAXIES; i++) {
    bgGalaxies.push({
      nx: Math.random(), ny: Math.random(),
      size: rand(0.05, 0.115),          // of the panel's short side
      squash: rand(0.22, 0.55),
      rot: rand(0, Math.PI),
      a: rand(0.05, 0.115),
      c: BG_TINTS[Math.floor(Math.random() * BG_TINTS.length)]
    });
  }

  // How much of the background survives at this point on the panel. The disc's
  // glow washes out anything near the middle anyway — and the centre carries
  // the turn name, the dice, the square name and the circuit line, so stars
  // behind text would cost legibility for nothing. Fades on the same ellipse
  // the glow uses, so the field thins around the disc rather than in a circle.
  function clearOfDisc(px, py) {
    if (!radius) return 1;
    const ry = radius * TILT + radius * 0.28;
    const d = Math.hypot((px - cx) / radius, (py - cy) / ry);
    return Math.max(0, Math.min(1, (d - 0.62) / 0.55));
  }

  const field = document.createElement('canvas');
  const fctx = field.getContext('2d');

  function buildField() {
    if (!fctx || !w || !h) return;
    field.width = Math.round(w * dpr);
    field.height = Math.round(h * dpr);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.clearRect(0, 0, w, h);

    // Distant galaxies first, so stars sit in front of them.
    for (const g of bgGalaxies) {
      const px = g.nx * w, py = g.ny * h;
      const fade = clearOfDisc(px, py);
      if (fade <= 0.02) continue;
      const rr = g.size * Math.min(w, h);
      fctx.save();
      fctx.translate(px, py);
      fctx.rotate(g.rot);
      fctx.scale(1, g.squash);
      const grd = fctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      grd.addColorStop(0, `rgba(${g.c.join(',')},${(g.a * fade).toFixed(3)})`);
      grd.addColorStop(0.45, `rgba(${g.c.join(',')},${(g.a * fade * 0.35).toFixed(3)})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = grd;
      fctx.beginPath();
      fctx.arc(0, 0, rr, 0, Math.PI * 2);
      fctx.fill();
      fctx.restore();
    }

    // The twinklers are drawn live in draw() instead, so their brightness is
    // theirs alone rather than a live dot added on top of a baked one.
    for (let i = TWINKLERS; i < bg.length; i++) {
      const s = bg[i];
      const px = s.nx * w, py = s.ny * h;
      const fade = clearOfDisc(px, py);
      if (fade <= 0.02) continue;
      fctx.globalAlpha = s.a * fade;
      fctx.fillStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`;
      fctx.beginPath();
      fctx.arc(px, py, s.r, 0, Math.PI * 2);
      fctx.fill();
    }
    fctx.globalAlpha = 1;
  }

  // ---- drifting rock ------------------------------------------------------
  const asteroids = [];
  for (let i = 0; i < 7; i++) asteroids.push(newAsteroid(true));
  function newAsteroid(anywhere) {
    const shape = [];
    const points = 5 + Math.floor(Math.random() * 3);
    for (let k = 0; k < points; k++) {
      shape.push({ a: (k / points) * Math.PI * 2, r: rand(0.55, 1) });
    }
    return {
      x: anywhere ? Math.random() : -0.1,
      y: Math.random(),
      vx: rand(0.000012, 0.000055),
      vy: rand(-0.000018, 0.000018),
      size: rand(1.4, 4.2),
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.0006, 0.0006),
      alpha: rand(0.18, 0.5),
      shape
    };
  }

  // ---- ships --------------------------------------------------------------
  // At most two at once, and they only appear now and then, so the eye catches
  // one occasionally rather than watching traffic.
  const ships = [];
  let nextShip = rand(1200, 4200);
  function launchShip() {
    const fromLeft = Math.random() < 0.5;
    const y = rand(0.12, 0.88);
    const drift = rand(-0.10, 0.10);
    ships.push({
      x: fromLeft ? -0.08 : 1.08,
      y,
      vx: (fromLeft ? 1 : -1) * rand(0.00016, 0.00042),
      vy: drift * 0.0004,
      len: rand(4, 7),
      trail: rand(16, 34),
      alpha: rand(0.5, 0.95)
    });
  }

  // ---- the swarm ----------------------------------------------------------
  // Pools allocated once and reused; the loop never allocates. A blip enters at
  // the rim and creeps inward, and is returned to the rim when it reaches the
  // disc — so the field migrates continuously rather than piling up over the
  // middle, where the panel carries the turn name and the square name.
  const blips = [];
  for (let i = 0; i < BLIP_MAX; i++) blips.push(newBlip(true));
  function newBlip(anywhere) {
    const a = Math.random() * Math.PI * 2;
    const start = anywhere ? rand(0.55, 1.35) : rand(1.05, 1.35);
    return {
      a, d: start,                        // polar, in units of the disc radius
      v: rand(0.0000085, 0.000031),       // unhurried, the book's word
      size: rand(0.9, 2.1),
      phase: rand(0, Math.PI * 2),
      pulse: rand(0.0009, 0.0026)
    };
  }

  const hexes = [];
  for (let i = 0; i < HEX_MAX; i++) hexes.push(newHex(true));
  function newHex(anywhere) {
    const a = Math.random() * Math.PI * 2;
    return {
      a, d: anywhere ? rand(0.9, 1.6) : rand(1.3, 1.7),
      v: rand(0.0000035, 0.0000095),      // slower than anything else out there
      size: rand(7, 15),
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.00007, 0.00007),
      phase: rand(0, Math.PI * 2),
      breath: rand(0.00035, 0.00075)      // the openings that breathed
    };
  }

  // ---- sizing -------------------------------------------------------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Capped at 2 rather than the phone's 3: a third more pixels in every
    // frame buys nothing visible on a starfield and costs real battery.
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2; cy = h / 2;
    radius = Math.min(w, h) * 0.46;
    // After cx/cy/radius, because the field fades against the disc's ellipse.
    buildField();
    // Always redraw, not just when stopped. Setting canvas.width blanks the
    // buffer, so waiting for the next frame leaves the middle of the board
    // empty for however long that takes — visible as a flicker on rotate, and
    // on every render that resizes.
    draw(0);
  }

  // ---- drawing ------------------------------------------------------------
  function draw(dt) {
    const base = TINTS[getMood()] || TINTS.ledger;
    const ap = getApproach ? getApproach() : null;
    const grip = ap && typeof ap.grip === 'number' ? Math.max(0, Math.min(1, ap.grip)) : 0;
    // The arms turn from their shields toward the tide as it closes, so the
    // whole disc tips red at the end instead of staying nine-tenths green.
    const tint = grip > 0
      ? { core: base.core, hot: base.hot, arm: mixRGB(base.arm, [196, 92, 80], grip * 0.8) }
      : base;
    spin += dt * SPIN;

    ctx.clearRect(0, 0, w, h);

    // The universe outside, behind everything. One blit, whatever the star
    // count. Neutral by design and never tinted with the mood: the offscreen
    // would have to be rebuilt on every mood change — a cache to keep in step,
    // which is this codebase's entire failure history — and a field that does
    // not care makes the disc's mood read harder against it.
    const now = performance.now();
    if (field.width) ctx.drawImage(field, 0, 0, w, h);

    // The few that twinkle. Long individual periods, so at any moment one or
    // two are brightening rather than the whole sky shimmering.
    for (let i = 0; i < TWINKLERS && i < bg.length; i++) {
      const s = bg[i];
      const px = s.nx * w, py = s.ny * h;
      const fade = clearOfDisc(px, py);
      if (fade <= 0.02) continue;
      // Mostly near the floor, rising to a peak briefly — sin shaped by a power
      // so the bright moment is short and the rest of the cycle is quiet.
      const wave = (Math.sin((now / s.period) * Math.PI * 2 + s.phase) + 1) / 2;
      const lift = 0.45 + 1.55 * Math.pow(wave, 3.2);
      ctx.globalAlpha = Math.min(1, s.a * fade * lift);
      ctx.fillStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`;
      ctx.beginPath();
      ctx.arc(px, py, s.r * (0.9 + 0.35 * Math.pow(wave, 3.2)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The tide. "In the lower right, where every eye in the room went and
    // stopped, a deep red stain spread across a full quadrant of the display."
    // One gradient, so it can never invalidate the pre-rendered field the way
    // tinting the background stars would have.
    if (grip > 0.02) {
      const tide = ctx.createRadialGradient(w * 1.02, h * 1.02, 0, w * 1.02, h * 1.02, Math.hypot(w, h) * 0.92);
      tide.addColorStop(0, `rgba(${BLIP_RED.join(',')},${(grip * 0.115).toFixed(4)})`);
      tide.addColorStop(0.45, `rgba(${BLIP_RED.join(',')},${(grip * 0.045).toFixed(4)})`);
      tide.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tide;
      ctx.fillRect(0, 0, w, h);
    }

    // core glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.95);
    glow.addColorStop(0, `rgba(${tint.core.join(',')},0.42)`);
    glow.addColorStop(0.28, `rgba(${tint.hot.join(',')},0.15)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * TILT + radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // stars — `now` is taken once at the top of the frame, above
    for (const s of stars) {
      const a = s.angle + spin * (1.6 - s.t);       // inner arms sweep faster
      const r = s.t * radius;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * TILT;
      const flicker = 0.72 + 0.28 * Math.sin(now * s.twinkle + s.phase);
      const c = s.t < 0.32 ? tint.core : s.t > 0.78 ? tint.hot : tint.arm;
      ctx.globalAlpha = Math.min(1, s.alpha * flicker);
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath();
      ctx.arc(x, y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // asteroids
    ctx.strokeStyle = 'rgba(190,200,220,0.9)';
    for (const a of asteroids) {
      a.x += a.vx * dt; a.y += a.vy * dt; a.rot += a.spin * dt;
      if (a.x > 1.12) Object.assign(a, newAsteroid(false));
      const px = a.x * w, py = a.y * h;
      ctx.globalAlpha = a.alpha;
      ctx.beginPath();
      a.shape.forEach((p, k) => {
        const ax = px + Math.cos(p.a + a.rot) * p.r * a.size;
        const ay = py + Math.sin(p.a + a.rot) * p.r * a.size;
        if (k === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(120,128,148,0.55)';
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // The blips, arriving out of the intergalactic night. Count scales with the
    // grip, so they multiply as it closes — one, then ten, then a great many.
    // They creep inward and are returned to the rim on reaching the disc, which
    // keeps them off the middle where the panel carries its text.
    if (grip > 0) {
      const live = Math.round(grip * BLIP_MAX);
      const ry = radius * TILT + radius * 0.28;
      for (let i = 0; i < live; i++) {
        const bl = blips[i];
        bl.d -= bl.v * dt;
        if (bl.d < 0.55) Object.assign(bl, newBlip(false));
        const px = cx + Math.cos(bl.a) * bl.d * radius;
        const py = cy + Math.sin(bl.a) * bl.d * ry;
        if (px < -8 || px > w + 8 || py < -8 || py > h + 8) continue;
        // Unhurried and total: a slow swell rather than a blink.
        const puls = 0.62 + 0.38 * Math.sin(now * bl.pulse + bl.phase);
        ctx.globalAlpha = Math.min(1, (0.30 + 0.55 * grip) * puls);
        ctx.fillStyle = `rgb(${BLIP_RED[0]},${BLIP_RED[1]},${BLIP_RED[2]})`;
        ctx.beginPath();
        ctx.arc(px, py, bl.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // The masses themselves, once it is close. "Vast hexagonal masses, less
    // built than grown, their surfaces pocked with irregular openings that
    // breathed" — so they breathe, on the same idea as the score's pulse, and
    // they drift far slower than anything else in the panel.
    if (grip > 0.5) {
      const show = Math.min(HEX_MAX, Math.round((grip - 0.5) * 2 * HEX_MAX));
      const ry = radius * TILT + radius * 0.28;
      for (let i = 0; i < show; i++) {
        const hx = hexes[i];
        hx.d -= hx.v * dt; hx.rot += hx.spin * dt;
        if (hx.d < 0.85) Object.assign(hx, newHex(false));
        const px = cx + Math.cos(hx.a) * hx.d * radius;
        const py = cy + Math.sin(hx.a) * hx.d * ry;
        if (px < -40 || px > w + 40 || py < -40 || py > h + 40) continue;
        const breathe = 1 + 0.09 * Math.sin(now * hx.breath + hx.phase);
        const rr = hx.size * breathe;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = hx.rot + (k / 6) * Math.PI * 2;
          const ax = px + Math.cos(a) * rr, ay = py + Math.sin(a) * rr * 0.82;
          if (k === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.30 + 0.34 * (grip - 0.5) * 2;
        ctx.fillStyle = 'rgba(26,10,12,0.86)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgb(${HEX_RIM[0]},${HEX_RIM[1]},${HEX_RIM[2]})`;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // ships
    nextShip -= dt;
    if (nextShip <= 0 && ships.length < 2) { launchShip(); nextShip = rand(2600, 8000); }
    else if (nextShip <= 0) nextShip = 1500;

    for (let i = ships.length - 1; i >= 0; i--) {
      const s = ships[i];
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < -0.15 || s.x > 1.15) { ships.splice(i, 1); continue; }
      const px = s.x * w, py = s.y * h;
      const dir = Math.sign(s.vx);

      const tail = ctx.createLinearGradient(px - dir * s.trail, py, px, py);
      tail.addColorStop(0, `rgba(${tint.hot.join(',')},0)`);
      tail.addColorStop(1, `rgba(${tint.hot.join(',')},${s.alpha * 0.55})`);
      ctx.strokeStyle = tail;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px - dir * s.trail, py);
      ctx.lineTo(px, py);
      ctx.stroke();

      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = `rgb(${tint.core.join(',')})`;
      ctx.beginPath();
      ctx.moveTo(px + dir * s.len, py);
      ctx.lineTo(px - dir * s.len * 0.5, py - s.len * 0.42);
      ctx.lineTo(px - dir * s.len * 0.5, py + s.len * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ---- loop ---------------------------------------------------------------
  function frame(now) {
    if (!running) return;
    // Clamped: a backgrounded tab returns with a vast delta, which would jump
    // every ship across the field at once.
    const dt = Math.min(now - (last || now), 48);
    last = now;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', resize);

  resize();
  if (reduced) draw(0); else start();

  return {
    stop() {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
    },
    resize
  };
}
