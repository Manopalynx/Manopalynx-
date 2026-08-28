// How a battle is drawn, in FIELD UNITS. No DOM, no pixels.
//
// ONE COUNTER PER CARD, which is Sam's choice out of the three treatments in
// test/look.mjs. Bodies still live and die one at a time in the engine; the
// renderer aggregates them. It halves the marks on screen for the same battle,
// and at the end of a match that is the difference between a field you can read
// and a field you cannot: 70 bodies became 35 counters.
//
// IDENTITY BY GLYPH, NOT BY HUE. Twelve colours are not tellable apart on a
// phone; twelve letters are. Colour carries the one thing that must never be
// misread -- which side it is -- and shape carries the weight class, so "square
// is heavy" is learned once and holds for every card in the class.
//
// This module is imported by ui.js and by test/look.mjs. It is deliberately the
// only copy: a letter or a shape written twice will disagree, and the second
// copy is usually the one nobody is looking at.

import { BY_ID, FIELD } from './data.js';
import { glyph } from './glyphs.js';

// YOU ARE AT THE BOTTOM. Sam's note: the cards are down there, so after every
// pick your eye has to travel to the top of the screen to see what you bought.
// Mirrored HERE and nowhere else — the engine still deploys side 0 at low `y`,
// because flipping it would change the deployment jitter and with it every
// seeded battle, every figure in this folder's tests and every saved match.
// One line, in the only layer allowed to have an opinion about screens.
export const flipY = y => FIELD.d - y;

export const CODE = {
  walker: 'W', brute: 'B', ultra: 'U', amabie: 'A', karkinos: 'K', deflector: 'D',
  volt: 'V', acid: 'C', line: 'L', swarm: 'S', neurite: 'N', fireship: 'F'
};

export const SIDE = [
  { fill: '#1b3a52', line: '#6fc6f5', ink: '#dff1ff' },
  { fill: '#4a2418', line: '#f2955c', ink: '#ffe6d6' }
];

// Radii in field units. The field is 100 wide, so on a 393pt phone one unit is
// just under four points and a heavy counter lands at about 28pt across -- above
// the 24pt that is the smallest thing worth asking a thumb to hit.
const SIZE = { heavy: 3.7, medium: 3.2, light: 2.9 };

export function shape(w, x, y, s, fill, line, o = 1) {
  const a = `fill="${fill}" fill-opacity="${o}" stroke="${line}" stroke-width="0.45"`;
  if (w === 'heavy')                                     // square: it holds ground
    return `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" rx="0.6" ${a}/>`;
  if (w === 'medium')                                    // diamond: it does one job
    return `<path d="M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z" ${a}/>`;
  return `<circle cx="${x}" cy="${y}" r="${s}" ${a}/>`;  // circle: it comes in numbers
}

// Bodies -> one entry a card. `c` is the card index the engine stamps on each
// body; grouping by position instead would be a guess, and two Walkers standing
// together would merge into one counter that never dies.
export function groupByCard(live) {
  const by = new Map();
  for (const u of live) {
    const k = u.side + ':' + u.c;
    const g = by.get(k) || { key: k, id: u.id, side: u.side, lvl: u.lvl || 0, x: 0, y: 0, hp: 0, max: 0, n: 0 };
    g.x += u.x; g.y += u.y; g.hp += u.hp; g.max += u.max; g.n++;
    by.set(k, g);
  }
  for (const g of by.values()) { g.x /= g.n; g.y /= g.n; }
  return [...by.values()];
}

/**
 * The whole field as SVG, in field units.
 * @param {object[]} live  bodies, as the resolver's onTick hands them over
 * @param {object}   opt   { pick: 'key' to ring one counter,
 *                          flash: Set of card keys that took a hit this frame,
 *                          pop:   Set of card keys just committed in the draft }
 */
export function draw(live, opt = {}) {
  const flash = opt.flash || new Set();
  const pop = opt.pop || new Set();
  return groupByCard(live).map(g => {
    g.y = flipY(g.y);
    const spec = BY_ID[g.id], c = SIDE[g.side];
    const s = SIZE[spec.w];
    // CLAMPED. The resolver samples positions from the array it captured at the
    // start of the tick, so a body killed during that tick is still in the frame
    // with negative health -- and a strength bar of width -2.1 is not a small
    // visual slip, it is an SVG error every frame and a bar that vanishes a tick
    // before the counter does.
    const hurt = Math.max(0, Math.min(1, g.hp / g.max));
    // TOOK A HIT THIS FRAME. A white rim and a half-unit shake, both driven by
    // the resolver's own log rather than by anything the screen guessed: if a
    // marker flinches, something in the battle actually landed on it.
    const hit = flash.has(g.key);
    const shake = hit ? (g.n % 2 ? 0.5 : -0.5) : 0;
    // JUST COMMITTED. A ring that lands on the counter, so a pick answers on the
    // field instead of in a sentence you have to press past.
    const landed = pop.has(g.key)
      ? `<circle class="pop" cx="${g.x}" cy="${g.y}" r="${s + 2.6}" fill="none"
           stroke="${c.line}" stroke-width="0.7"/>` : '';
    const ring = opt.pick === g.key
      ? `<circle cx="${g.x}" cy="${g.y}" r="${s + 2.2}" fill="none" stroke="${c.line}"
           stroke-width="0.5" stroke-dasharray="1.6 1.2" opacity="0.9"/>` : '';
    // Wrapped, and tagged with the card it is. A tap has to be able to ask what
    // a marker is -- "inspect what worked" is the step the whole loop hangs on,
    // and a field of letters you cannot interrogate teaches nobody the counters.
    // data-x/data-y are the renderer saying where it put this counter. A tap
    // target, and the only honest way for a check to ask whether your army is
    // drawn at the bottom of the field.
    return `<g data-key="${g.key}" data-id="${g.id}" data-side="${g.side}"` +
      ` data-x="${g.x.toFixed(2)}" data-y="${g.y.toFixed(2)}"` +
      (shake ? ` transform="translate(${shake} 0)"` : '') + `>` + ring +
      landed + (hit ? shape(spec.w, g.x, g.y, s + 1.2, 'none', '#ffffff', 0) : '') +
      shape(spec.w, g.x, g.y, s, c.fill, c.line) +
      // Strength left as a bar under the counter. A card at 20% is the thing a
      // player needs to see before choosing the next pick, and fading the whole
      // marker hides it against a dark field exactly when it matters.
      `<rect x="${g.x - s}" y="${g.y + s + 0.6}" width="${s * 2}" height="0.9" fill="#000" fill-opacity="0.55"/>` +
      `<rect x="${g.x - s}" y="${g.y + s + 0.6}" width="${(s * 2 * hurt).toFixed(2)}" height="0.9" fill="${c.line}"/>` +
      // THE UNIT, not a letter for it. The mark only has to be distinct from the
      // three others in its own weight class, because the counter's outer shape
      // has already said which class it is -- and the roster is exactly four
      // heavy, four medium, four light.
      glyph(g.id, g.x, g.y, s * 0.62, c.ink, 1.15) +
      (spec.count > 1
        ? `<text x="${g.x + s + 0.4}" y="${g.y - s + 1.8}" font-size="2.3" fill="${c.line}"
             font-family="system-ui,sans-serif">${g.n}</text>` : '') +
      (g.lvl
        ? `<text x="${g.x - s - 0.6}" y="${g.y + 1.1}" text-anchor="end" font-size="2.6" fill="#ffd479"
             font-family="system-ui,sans-serif">${'▲'.repeat(g.lvl)}</text>` : '') +
      '</g>';
  }).join('');
}

// The ground: a grid, the line of contact, and the two deployment bands. No
// terrain, because the engine has none — a renderer that draws ground the rules
// do not know about is the screen disagreeing with the game.
export const GROUND =
  `<rect x="0" y="0" width="100" height="140" fill="#0e1620"/>` +
  Array.from({ length: 9 }, (_, i) =>
    `<line x1="${(i + 1) * 10}" y1="0" x2="${(i + 1) * 10}" y2="140" stroke="#16222f" stroke-width="0.25"/>`).join('') +
  Array.from({ length: 13 }, (_, i) =>
    `<line x1="0" y1="${(i + 1) * 10}" x2="100" y2="${(i + 1) * 10}" stroke="#16222f" stroke-width="0.25"/>`).join('') +
  // Bands follow the flip: yours at the bottom, theirs at the top.
  `<rect x="0" y="0" width="100" height="22" fill="#f2955c" fill-opacity="0.05"/>` +
  `<rect x="0" y="118" width="100" height="22" fill="#6fc6f5" fill-opacity="0.05"/>` +
  `<line x1="0" y1="70" x2="100" y2="70" stroke="#2c3f54" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`;


/* ------------------------------------------------------------------ effects */
// Sam's notes 1 and 2: projectiles, area damage and a flinch. All of it is read
// from the resolver's REPLAY LOG, which has existed since the engine was written
// and which nothing had ever drawn — the screen could not show what hit what
// because it was never told, and a battle was a crowd of markers thinning out
// for no visible reason.
//
// Nothing here invents a rule. A tracer is drawn when the attacker's range is
// what the resolver calls ranged; a splash ring uses the attacker's own `splash`
// radius; a detonation uses its own `boom.r`. If a ring is the wrong size, the
// number is wrong in data.js and it is wrong in the fight too.
const RANGED = 4;              // the resolver's own melee cutoff

/**
 * @param {object[]} events  one tick's events from the replay log
 * @param {Map}      byKey   log key -> body, from the same tick's frame
 * @returns {{svg:string, flash:Set<string>}}
 */
export function effects(events, byKey) {
  let svg = '';
  const flash = new Set();
  for (const ev of events) {
    const a = byKey.get(ev.a);
    const b = ev.b === undefined ? null : byKey.get(ev.b);

    if (ev.e === 'hit' && a && b) {
      const spec = BY_ID[a.id], c = SIDE[a.side].line;
      const ax = a.x, ay = flipY(a.y), bx = b.x, by = flipY(b.y);
      if (spec.rng > RANGED) {
        svg += `<line class="fx" x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" ` +
               `x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${c}" ` +
               `stroke-width="0.35" stroke-opacity="0.75" stroke-linecap="round"/>`;
      }
      if (spec.splash) {
        svg += `<circle class="fx" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" ` +
               `r="${spec.splash}" fill="${c}" fill-opacity="0.11" ` +
               `stroke="${c}" stroke-width="0.3" stroke-opacity="0.5"/>`;
      } else {
        svg += `<circle class="fx" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" ` +
               `r="1.1" fill="${c}" fill-opacity="0.9"/>`;
      }
      flash.add(b.side + ':' + b.c);

    } else if (ev.e === 'boom' && a && BY_ID[a.id].boom) {
      svg += `<circle class="fx" cx="${a.x.toFixed(1)}" cy="${flipY(a.y).toFixed(1)}" ` +
             `r="${BY_ID[a.id].boom.r}" fill="#ffd479" fill-opacity="0.22" ` +
             `stroke="#ffd479" stroke-width="0.5" stroke-opacity="0.85"/>`;
    }
  }
  return { svg, flash };
}

// An aura needs no attack and no target, so it never appears in the log — it is
// simply expensive to stand near. Drawn as standing ground rather than as an
// event, because that is what it is.
export function auras(live) {
  let svg = '';
  for (const u of live) {
    const spec = BY_ID[u.id];
    if (!spec.aura) continue;
    // Class `aura`, not `fx`. An aura is standing ground and is drawn whether or
    // not anything happened; `fx` means an event came out of the log, and the
    // suite's differential — nothing drawn on a still field, something drawn
    // mid-battle — is only worth anything if the two are not mixed.
    svg += `<circle class="aura" cx="${u.x.toFixed(1)}" cy="${flipY(u.y).toFixed(1)}" ` +
           `r="${spec.auraR}" fill="${SIDE[u.side].line}" fill-opacity="0.05" ` +
           `stroke="${SIDE[u.side].line}" stroke-width="0.25" stroke-opacity="0.28" ` +
           `stroke-dasharray="1 1.4"/>`;
  }
  return svg;
}
