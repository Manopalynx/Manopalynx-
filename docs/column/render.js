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

import { BY_ID } from './data.js';

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
 * @param {object}   opt   { pick: 'key' to ring one counter }
 */
export function draw(live, opt = {}) {
  return groupByCard(live).map(g => {
    const spec = BY_ID[g.id], c = SIDE[g.side];
    const s = SIZE[spec.w];
    // CLAMPED. The resolver samples positions from the array it captured at the
    // start of the tick, so a body killed during that tick is still in the frame
    // with negative health -- and a strength bar of width -2.1 is not a small
    // visual slip, it is an SVG error every frame and a bar that vanishes a tick
    // before the counter does.
    const hurt = Math.max(0, Math.min(1, g.hp / g.max));
    const ring = opt.pick === g.key
      ? `<circle cx="${g.x}" cy="${g.y}" r="${s + 2.2}" fill="none" stroke="${c.line}"
           stroke-width="0.5" stroke-dasharray="1.6 1.2" opacity="0.9"/>` : '';
    // Wrapped, and tagged with the card it is. A tap has to be able to ask what
    // a marker is -- "inspect what worked" is the step the whole loop hangs on,
    // and a field of letters you cannot interrogate teaches nobody the counters.
    return `<g data-key="${g.key}" data-id="${g.id}">` + ring +
      shape(spec.w, g.x, g.y, s, c.fill, c.line) +
      // Strength left as a bar under the counter. A card at 20% is the thing a
      // player needs to see before choosing the next pick, and fading the whole
      // marker hides it against a dark field exactly when it matters.
      `<rect x="${g.x - s}" y="${g.y + s + 0.6}" width="${s * 2}" height="0.9" fill="#000" fill-opacity="0.55"/>` +
      `<rect x="${g.x - s}" y="${g.y + s + 0.6}" width="${(s * 2 * hurt).toFixed(2)}" height="0.9" fill="${c.line}"/>` +
      `<text x="${g.x}" y="${g.y + 1.25}" text-anchor="middle" font-size="3.6" font-weight="700"
         fill="${c.ink}" font-family="system-ui,sans-serif">${CODE[g.id]}</text>` +
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
  `<rect x="0" y="0" width="100" height="22" fill="#6fc6f5" fill-opacity="0.05"/>` +
  `<rect x="0" y="118" width="100" height="22" fill="#f2955c" fill-opacity="0.05"/>` +
  `<line x1="0" y1="70" x2="100" y2="70" stroke="#2c3f54" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`;
