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

import { BY_ID, FIELD, TERRAIN } from './data.js';
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

// THE GROUND — Sam's note 18. Nine maps, one a persona, and every one of them a
// place in the book. COSMETIC, by his instruction: the resolver does not know a
// map exists, so nothing here re-derives a single figure in this folder. That is
// the whole reason to do it this way round — nine of them can be looked at on a
// phone before anyone decides which ones want teeth.
//
// Drawn in FIELD UNITS on the 100x140 field, like everything else in this file,
// and deliberately quiet: the counters are the thing being read, so no scene goes
// above about 0.1 opacity on anything large. If a map ever competes with a
// marker, the map is wrong.
//
// The functional overlay is drawn on TOP of every scene and is the same on all
// nine -- the two deployment bands and the line of contact are rules the player
// reads, not decoration, and a map that hid them would be a map that lied.

const rows = (n, y0, dy, f) => Array.from({ length: n }, (_, i) => f(y0 + i * dy, i)).join('');
const dots = (n, seed, f) => {
  // A fixed pseudo-random scatter. Not `Math.random`: this module is imported by
  // the page and by two suites, and a ground that differs between them is a
  // ground that cannot be screenshotted twice.
  let a = seed; const r = () => (a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  return Array.from({ length: n }, () => f(r(), r())).join('');
};

const SCENES = {
  // "the great crossroads, the market of markets" — two avenues meeting, and the
  // stalls of a market that has been a garrison since the Dominion took it.
  eden: `<rect width="100" height="140" fill="#141519"/>
    <rect x="38" y="0" width="24" height="140" fill="#20211f" fill-opacity="0.7"/>
    <rect x="0" y="58" width="100" height="24" fill="#20211f" fill-opacity="0.7"/>
    <circle cx="50" cy="70" r="15" fill="none" stroke="#3a3a30" stroke-width="0.5"/>
    <circle cx="50" cy="70" r="9" fill="none" stroke="#3a3a30" stroke-width="0.35"/>
    ${dots(46, 7, (x, y) => `<rect x="${(4 + x * 92).toFixed(1)}" y="${(4 + y * 132).toFixed(1)}" width="3.4" height="2.4" fill="#2c2d26" fill-opacity="0.75"/>`)}`,

  // "their whole armored line has to come up the terrace cuts, here — it's the
  // only grade the walkers can climb". Three rings, and one notch through each.
  terraces: `<rect width="100" height="140" fill="#101a18"/>
    ${rows(3, 34, 34, (y, i) => `<rect x="0" y="${y}" width="100" height="11" fill="#182724" fill-opacity="${0.85 - i * 0.15}"/>
      <line x1="0" y1="${y}" x2="100" y2="${y}" stroke="#2c4640" stroke-width="0.5"/>
      <rect x="${41 + i * 3}" y="${y}" width="${13 - i * 2}" height="11" fill="#101a18"/>`)}
    ${rows(9, 8, 15, y => `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="#16241f" stroke-width="0.25"/>`)}`,

  // "I signed the instrument of vassalage in a room aboard one of their tribute
  // ships. They kept me waiting four hours." A long table, and one empty seat.
  tribute: `<rect width="100" height="140" fill="#0d0f13"/>
    <rect x="18" y="52" width="64" height="36" fill="none" stroke="#2a2f3a" stroke-width="0.6"/>
    <rect x="24" y="58" width="52" height="24" fill="#141922" fill-opacity="0.8"/>
    ${rows(6, 40, 12, y => `<rect x="6" y="${y}" width="4" height="7" fill="#1b2029"/><rect x="90" y="${y}" width="4" height="7" fill="#1b2029"/>`)}
    <rect x="45" y="24" width="10" height="8" fill="none" stroke="#39404d" stroke-width="0.5"/>`,

  // "the Union's silver-on-blue, and above it, on the taller pole, the black
  // insignia of the Onyx Dominion" — and the ranks it was read out to.
  parade: `<rect width="100" height="140" fill="#141a14"/>
    <rect x="0" y="0" width="100" height="34" fill="#1b2419" fill-opacity="0.8"/>
    <rect x="30" y="26" width="40" height="7" fill="#252c20"/>
    <line x1="40" y1="4" x2="40" y2="27" stroke="#3b4433" stroke-width="0.5"/>
    <rect x="40" y="4" width="8" height="5" fill="#0b0b0e"/>
    <line x1="60" y1="10" x2="60" y2="27" stroke="#3b4433" stroke-width="0.5"/>
    <rect x="60" y="10" width="7" height="4.5" fill="#20344a"/>
    ${rows(7, 46, 12, y => rows(11, 8, 8.4, x => `<rect x="${x}" y="${y}" width="2" height="2.6" fill="#1e281c"/>`))}`,

  // "a vessel assembled from the corpses of at least nine other vessels, in a
  // stateroom decorated with trophies whose provenance I chose not to examine".
  // Nine plates, nine tones, and the seams where they were welded together.
  raven: `<rect width="100" height="140" fill="#151013"/>
    ${['#221a1c','#1b1a20','#241d16','#1a2020','#26191a','#1d1b17','#221f22','#191d22','#241c1f']
      .map((c, i) => `<rect x="${(i % 3) * 34}" y="${Math.floor(i / 3) * 47}" width="34" height="47" fill="${c}"/>`).join('')}
    ${rows(2, 47, 47, y => `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="#3a2b2c" stroke-width="0.7" stroke-dasharray="2 1.2"/>`)}
    ${rows(2, 34, 34, x => `<line x1="${x}" y1="0" x2="${x}" y2="140" stroke="#3a2b2c" stroke-width="0.7" stroke-dasharray="2 1.2"/>`)}
    ${dots(11, 19, (x, y) => `<rect x="${(6 + x * 86).toFixed(1)}" y="${(6 + y * 126).toFixed(1)}" width="4" height="5" fill="none" stroke="#4a3a2c" stroke-width="0.4"/>`)}`,

  // "The war room of the Union Palace held the whole galaxy in light above its
  // table." The table is the dark ellipse; the galaxy is what is over it.
  warroom: `<rect width="100" height="140" fill="#0b0f16"/>
    <ellipse cx="50" cy="70" rx="34" ry="26" fill="#111823" stroke="#22303f" stroke-width="0.6"/>
    <ellipse cx="50" cy="70" rx="26" ry="19" fill="none" stroke="#1b2836" stroke-width="0.35"/>
    ${dots(70, 31, (x, y) => {
      const a = x * Math.PI * 4, r = 4 + y * 24;
      return `<circle cx="${(50 + Math.cos(a) * r * 1.25).toFixed(1)}" cy="${(70 + Math.sin(a) * r * 0.85).toFixed(1)}" r="${(0.3 + y * 0.5).toFixed(2)}" fill="#7fd4ff" fill-opacity="${(0.15 + y * 0.3).toFixed(2)}"/>`;
    })}
    ${rows(10, 12, 13, y => `<rect x="4" y="${y}" width="3" height="6" fill="#141c27"/><rect x="93" y="${y}" width="3" height="6" fill="#141c27"/>`)}`,

  // "At the plaza's center stood the stage, flanked by two towers of Vale's
  // smiling face, and an empty podium with its small bouquet of microphones
  // waiting like the future." The banners are over the crowd on floating trestles.
  plaza: `<rect width="100" height="140" fill="#131217"/>
    ${dots(150, 53, (x, y) => `<circle cx="${(3 + x * 94).toFixed(1)}" cy="${(3 + y * 134).toFixed(1)}" r="0.7" fill="#2a2632" fill-opacity="0.9"/>`)}
    <rect x="30" y="60" width="40" height="20" fill="#1d1a24" stroke="#332c3d" stroke-width="0.5"/>
    <rect x="47" y="66" width="6" height="8" fill="#2b2536"/>
    <rect x="16" y="44" width="12" height="34" fill="#1a1822" stroke="#39304a" stroke-width="0.5"/>
    <rect x="72" y="44" width="12" height="34" fill="#1a1822" stroke="#39304a" stroke-width="0.5"/>
    ${[[19,52],[75,52]].map(([x, y]) => `<circle cx="${x + 3}" cy="${y + 4}" r="3.4" fill="none" stroke="#4a3f5e" stroke-width="0.4"/>`).join('')}
    ${rows(3, 14, 9, (y, i) => `<rect x="${20 + i * 14}" y="${y}" width="34" height="4" fill="#241f2e" fill-opacity="0.85"/>`)}`,

  // "They burned the orbitals, then the cities, then the croplands, and then they
  // stayed in orbit an extra day to burn the forests."
  croplands: `<rect width="100" height="140" fill="#14100c"/>
    ${rows(22, 4, 6.2, (y, i) => `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="${i % 3 ? '#1e1712' : '#241a12'}" stroke-width="${i % 3 ? 1.6 : 2.4}"/>`)}
    ${dots(34, 11, (x, y) => `<circle cx="${(3 + x * 94).toFixed(1)}" cy="${(3 + y * 134).toFixed(1)}" r="${(1 + y * 2.5).toFixed(1)}" fill="#0d0a08" fill-opacity="0.85"/>`)}
    ${dots(26, 71, (x, y) => `<circle cx="${(3 + x * 94).toFixed(1)}" cy="${(3 + y * 134).toFixed(1)}" r="0.5" fill="#e07a32" fill-opacity="0.45"/>`)}`,

  // "It was circular and vast, and the walls were pods ... the occupied pods gave
  // off a faint interior light, so that the great dark room glowed in patches,
  // like votive candles in a drowned church."
  // FIFTY-TWO PODS, THIRTY-SEVEN OCCUPIED. Samuel counts them; so does this.
  pods: `<rect width="100" height="140" fill="#0a0d10"/>
    <ellipse cx="50" cy="70" rx="46" ry="64" fill="#0c1116" stroke="#16232a" stroke-width="0.6"/>
    <ellipse cx="50" cy="70" rx="34" ry="48" fill="none" stroke="#121c22" stroke-width="0.4"/>
    ${Array.from({ length: 52 }, (_, i) => {
      const a = (i / 52) * Math.PI * 2, tier = i % 2 ? 1 : 0;
      const rx = (40 - tier * 8), ry = (57 - tier * 11);
      const x = 50 + Math.cos(a) * rx, y = 70 + Math.sin(a) * ry;
      const lit = i % 7 !== 3;                 // 37 of the 52 stand occupied
      return `<rect x="${(x - 1.6).toFixed(1)}" y="${(y - 2.4).toFixed(1)}" width="3.2" height="4.8" rx="1.4"
        fill="${lit ? '#2b4a52' : '#101a1e'}" fill-opacity="${lit ? 0.75 : 0.9}"
        stroke="#1b2c33" stroke-width="0.3"/>` +
        (lit ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#5fd8c8" fill-opacity="0.10"/>` : '');
    }).join('')}`
};

// The two deployment bands and the line of contact, drawn over every scene. These
// are rules rather than decoration -- yours at the bottom, theirs at the top, and
// where the lines meet -- so no map is allowed to hide them.
const OVERLAY =
  `<rect x="0" y="0" width="100" height="22" fill="#f2955c" fill-opacity="0.05"/>` +
  `<rect x="0" y="118" width="100" height="22" fill="#6fc6f5" fill-opacity="0.05"/>` +
  `<line x1="0" y1="70" x2="100" y2="70" stroke="#2c3f54" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`;

// TERRAIN IS DRAWN FROM THE SAME CONSTANT THE RESOLVER READS, so the band on
// screen cannot be in a different place from the band the battle was fought on.
// A second copy of `from`/`to` here is exactly the defect this project has
// already had six times over one price.
//
// It is drawn UNDER the markers and over the scene, at an opacity in the same
// range as the deployment tints above -- the rule for this file is that nothing
// decorative may compete with a counter, because the counters are what a player
// reads. The dashed edges are what makes it legible as an EDGE rather than as a
// wash: the whole decision is whether a body is inside it or outside it.
// WHAT A GROUND IS MADE OF, drawn as itself.
//
// Sam's note: the floors should look like what they represent. The scenes
// already do -- every one of them is built from its own sentence in the novel.
// What did not was the TERRAIN painted over them, which was one green wash and a
// dashed edge whatever the ground was, so a market, a defile and a ship's deck
// were the same rectangle in three colours.
//
// Each band now draws its own material. The rule for this file still holds --
// nothing decorative may compete with a counter -- so all of it sits under 0.16
// opacity and none of it is larger than a marker.
//
// A RANGE CAP DRAWS NOTHING, and that is not an omission. It has no region: it
// shortens every weapon everywhere, so there is no edge to show and shading the
// whole board would say "this part is different" about a rule with no parts.
// The bar names it and the panel explains it; that is job (a), not job (b).
const MATERIAL = {
  // "the great crossroads, the market of markets" — stalls in rows with awnings
  // over them, and the lanes between.
  stalls: (g, h) => rows(4, g.from + 4, (h - 6) / 3, y =>
    rows(7, 8, 13, x =>
      `<rect x="${x}" y="${y}" width="8" height="4.4" fill="#7fd6a0" fill-opacity="0.10"/>` +
      `<line x1="${x}" y1="${y}" x2="${x + 8}" y2="${y}" stroke="#7fd6a0" stroke-opacity="0.22" stroke-width="0.35"/>`)),

  // "into the narrow ground, bunching as the grade forced them together" — the
  // two walls of the cut, and the grade lines cut into them.
  defile: (g, h) =>
    `<rect x="0" y="${g.from}" width="26" height="${h}" fill="#7fd6a0" fill-opacity="0.09"/>` +
    `<rect x="74" y="${g.from}" width="26" height="${h}" fill="#7fd6a0" fill-opacity="0.09"/>` +
    rows(5, g.from + 3, (h - 6) / 4, y =>
      `<line x1="0" y1="${y}" x2="26" y2="${y}" stroke="#7fd6a0" stroke-opacity="0.18" stroke-width="0.3"/>` +
      `<line x1="74" y1="${y}" x2="100" y2="${y}" stroke="#7fd6a0" stroke-opacity="0.18" stroke-width="0.3"/>`),

  // "a vessel assembled from the corpses of at least nine other vessels" —
  // mismatched plates bolted across the deck, none of them lining up.
  plating: (g, h) => rows(3, g.from + 2, (h - 4) / 2, (y, i) =>
    rows(4, 4 + i * 5, 24, (x, k) =>
      `<rect x="${x}" y="${y}" width="${18 + (k % 2) * 4}" height="${h / 3.4}" fill="#7fd6a0" ` +
        `fill-opacity="${0.06 + ((i + k) % 3) * 0.02}" stroke="#7fd6a0" stroke-opacity="0.16" stroke-width="0.3"/>`)),

  // "the stage, flanked by two towers of Vale's smiling face" — the stage in the
  // middle of it and a tower to either side.
  stage: (g, h) =>
    `<rect x="38" y="${g.from + 1}" width="24" height="${h - 2}" fill="#7fd6a0" fill-opacity="0.12" ` +
      `stroke="#7fd6a0" stroke-opacity="0.3" stroke-width="0.4"/>` +
    [20, 72].map(x => `<rect x="${x}" y="${g.from + 2}" width="8" height="${h - 4}" fill="#7fd6a0" ` +
      `fill-opacity="0.14" stroke="#7fd6a0" stroke-opacity="0.32" stroke-width="0.4"/>`).join(''),

  // "they burned the orbitals, then the cities, then the croplands" — the rows
  // are still there and still alight.
  embers: (g, h) => rows(9, g.from + 2, (h - 4) / 8, (y, i) =>
    `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="#f2955c" stroke-opacity="0.10" stroke-width="0.5"/>` +
    rows(6, 6 + (i % 2) * 8, 17, x =>
      `<circle cx="${x}" cy="${y}" r="0.7" fill="#f2955c" fill-opacity="0.28"/>`)),
};

const band = t => {
  const g = TERRAIN[t];
  if (!g || g.from === undefined) return '';
  const h = g.to - g.from;
  const hue = g.burn ? '#f2955c' : '#7fd6a0';
  const edge = y => `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="${hue}" ` +
    `stroke-opacity="0.3" stroke-width="0.35" stroke-dasharray="2 2"/>`;
  const art = MATERIAL[g.art];
  return `<rect x="0" y="${g.from}" width="100" height="${h}" fill="${hue}" fill-opacity="0.04"/>` +
    (art ? art(g, h) : '') + edge(g.from) + edge(g.to);
};

/** The ground for a map id. Unknown ids fall back to Eden rather than to nothing. */
export const ground = (map, terrain = null) =>
  (SCENES[map] || SCENES.eden) + band(terrain) + OVERLAY;

// Kept so nothing that imported the old constant breaks; it is Eden's ground.
export const GROUND = ground('eden');

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
