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
const TWIST = 2.9;              // radians of sweep per unit radius
const TILT = 0.52;              // vertical squash — the disc seen at an angle
const SPIN = 0.000045;          // radians per millisecond, i.e. very slow

// Mood tints, keyed to the same states the score uses.
const TINTS = {
  ledger:   { core: [255, 226, 170], arm: [150, 178, 224], hot: [217, 164, 65] },
  auction:  { core: [255, 214, 150], arm: [224, 160, 120], hot: [224, 119, 106] },
  facility: { core: [190, 220, 235], arm: [120, 150, 190], hot: [ 94, 207, 200] },
  vassal:   { core: [222, 200, 240], arm: [150, 130, 200], hot: [139, 125, 216] },
  ascend:   { core: [255, 240, 205], arm: [180, 205, 240], hot: [255, 205, 110] }
};

const rand = (a, b) => a + Math.random() * (b - a);

export function startGalaxy(canvas, getMood) {
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
    // Always redraw, not just when stopped. Setting canvas.width blanks the
    // buffer, so waiting for the next frame leaves the middle of the board
    // empty for however long that takes — visible as a flicker on rotate, and
    // on every render that resizes.
    draw(0);
  }

  // ---- drawing ------------------------------------------------------------
  function draw(dt) {
    const tint = TINTS[getMood()] || TINTS.ledger;
    spin += dt * SPIN;

    ctx.clearRect(0, 0, w, h);

    // core glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.95);
    glow.addColorStop(0, `rgba(${tint.core.join(',')},0.42)`);
    glow.addColorStop(0.28, `rgba(${tint.hot.join(',')},0.15)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * TILT + radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // stars
    const now = performance.now();
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
