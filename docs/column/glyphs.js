// The units, drawn. One place, imported by render.js for the field and by ui.js
// for the cards and the roster.
//
// WHY GLYPHS ARE POSSIBLE AT ALL. A counter is 23-29pt across on Sam's phone and
// the mark inside it is about 14pt. Fifteen silhouettes at 14pt are not reliably
// tellable apart -- which is why this started as letters. But the counter's
// OUTER SHAPE already carries the weight class, so a glyph only has to be
// distinct within its class, and the roster is five heavy, five medium, five
// light. Five shapes at 14pt is still comfortable; the three specials are what
// took each class from four to five, and a SIXTH in any class is the point to
// re-check this argument rather than assume it still holds.
//
// A MISSING GLYPH IS SILENT: `glyph()` below returns an empty string for an id
// it does not know, which is right here -- one unnamed unit must not take the
// battlefield down -- and is why test/matchup.mjs asserts every unit has a mark.
//
// EVERY ONE IS FROM THE BOOK, and the phrase it is drawn from is named beside
// it. Where the manuscript contradicts itself -- the Karkinos has four vast legs
// in one passage and six apiece in another -- the drawing follows the passage
// that describes the unit as a type rather than one machine, and says so.
//
// Coordinates are a -5..5 box. `d` is drawn everywhere; `detail` is drawn only
// at card size, where there is sixteen times the area and a 14pt mark becomes a
// 60pt one.

export const GLYPH = {
  /* ---- heavy: square ---------------------------------------------------- */
  // "The walker was four stories of articulated war machine" — legs, a body,
  // and the main cannon that arrives before it does.
  walker: {
    d: ['M-2.4 -0.8 h4.4 v2.4 h-4.4 z',
        'M-1.4 1.6 L-2.9 2.6 L-3.6 4.6', 'M1.2 1.6 L2.7 2.6 L3.4 4.6',
        'M-2.4 -1.8 L3.8 -3.2'],
    detail: ['M-1.4 -0.8 v2.4', 'M-3.6 4.6 h1.6', 'M3.4 4.6 h-1.6', 'M2.6 -2.9 l0.8 -0.2']
  },
  // "mammalian and enormous, four arms, fur matted through with chitin plate"
  brute: {
    d: ['M-2.5 -0.6 a2.6 2.6 0 1 1 5 0 v3 h-5 z',
        'M-2.5 -1.4 L-4.3 -0.4 L-4.6 1.4', 'M-2.5 0.8 L-3.9 2 L-3.9 3.4',
        'M2.5 -1.4 L4.3 -0.4 L4.6 1.4', 'M2.5 0.8 L3.9 2 L3.9 3.4'],
    detail: ['M-1.2 -1.8 h2.4', 'M-1.6 0.6 h3.2', 'M-1.6 1.8 h3.2']
  },
  // "every round the survivors put on them skidded off the black plate" —
  // a plate, and the cannon behind it.
  ultra: {
    d: ['M-2.6 -3.2 h5.2 v3.2 a2.6 3.4 0 0 1 -5.2 0 z', 'M0 -3.2 v6.4'],
    detail: ['M-2.6 -1.4 h5.2', 'M-4.4 -2.6 h1.8', 'M2.6 -2.6 h1.8']
  },
  // "A walking artillery piece the size of a customs house" — "The Amabie
  // opened the wall at dawn."
  amabie: {
    d: ['M-3.4 3.4 h6.8', 'M-1.8 3.4 v-2', 'M-3 1.8 L3.4 -3', 'M2.6 -3.6 L4 -2.2'],
    detail: ['M-3.4 3.4 l-0.6 1', 'M3.4 3.4 l0.6 1', 'M-1.4 0.6 L1.4 -1.4']
  },

  /* ---- medium: diamond -------------------------------------------------- */
  // "crab-bodied urban mechs ... on six legs apiece, railguns folded along
  // their backs". Six, not four: the four-legged passage is one machine,
  // Samuel's, and this card is the type.
  karkinos: {
    d: ['M-2.2 -1 h4.4 v2.2 h-4.4 z',
        'M-2.2 -0.6 L-4.6 -2.4', 'M-2.2 0.2 L-4.8 0.4', 'M-2.2 0.9 L-4.6 2.8',
        'M2.2 -0.6 L4.6 -2.4', 'M2.2 0.2 L4.8 0.4', 'M2.2 0.9 L4.6 2.8'],
    detail: ['M-1.6 -2.4 h3.2', 'M-1 -1 v2.2', 'M1 -1 v2.2']
  },
  // "Its shields are tuned for weapons fire. Pods fall through." The unit and
  // the name are written for the game; the line and the property are the
  // Kraken's, and the drawing is the shield rather than the ship.
  deflector: {
    d: ['M-3.6 1.4 a3.8 3.8 0 0 1 7.2 0', 'M-2.2 2.6 a2.4 2.4 0 0 1 4.4 0',
        'M-2.6 3.4 h5.2'],
    detail: ['M-4.8 0.4 l-1 -0.6', 'M4.8 0.4 l1 -0.6', 'M0 -3.4 v1.4']
  },
  // "the volt round's enormous older sibling, charged projectiles that didn't
  // need to hit to hurt"
  volt: {
    d: ['M0.9 -4 L-2 0.3 L0.2 0.3 L-0.9 4 L2.4 -0.7 L0.2 -0.7 z'],
    detail: ['M-4.4 -2.6 a4.6 4.6 0 0 0 0 5.2', 'M4.4 -2.6 a4.6 4.6 0 0 1 0 5.2']
  },
  // "The stuff clung to shields and ate through, sheeted across hulls and kept
  // eating" — a drop, and what it leaves.
  acid: {
    d: ['M0 -3.6 C2.8 -0.8 2.8 2.6 0 2.6 C-2.8 2.6 -2.8 -0.8 0 -3.6 z'],
    detail: ['M-3.4 3.8 v1.2', 'M0 3.8 v1.4', 'M3.4 3.8 v1.2', 'M-1 -1.4 a1.4 1.4 0 0 0 0 2']
  },

  /* ---- light: circle ---------------------------------------------------- */
  // "You're soldiers of the Union. ... you check your sectors." Three of them,
  // because a light card deploys three bodies.
  line: {
    d: ['M-2.6 3 v-2.4', 'M0 3 v-3', 'M2.6 3 v-2.4',
        'M-2.6 -1.4 a0.9 0.9 0 1 1 0.01 0', 'M0 -2 a0.9 0.9 0 1 1 0.01 0',
        'M2.6 -1.4 a0.9 0.9 0 1 1 0.01 0'],
    detail: ['M-3.6 0.4 h2', 'M-1 -0.2 h2', 'M1.6 0.4 h2']
  },
  // "the dog-sized crawlers, coming out of the ground itself" — "another
  // crawler mid-leap, airborne". Drawn mid-leap.
  swarm: {
    d: ['M-2.9 1.5 q2.9 -3.8 5.8 0 z', 'M-1.9 1.5 L-3.2 3.8', 'M1.9 1.5 L3.2 3.8',
        'M2.5 0.1 L4.3 -1', 'M2.5 0.9 L4.3 0.4'],
    detail: ['M-1.4 0.6 q1.4 -1.6 2.8 0', 'M-2.9 1.5 L-4.3 2.6', 'M0 1.5 L0 3.6']
  },
  // "staring into the camera with lid-to-lid black eyes" — "Understand what
  // the Neurite is: a sensory organ."
  neurite: {
    d: ['M-4.2 0 q4.2 -4 8.4 0 q-4.2 4 -8.4 0 z', 'M0 -1.1 a1.1 1.1 0 1 1 0.01 0'],
    detail: ['M-4.9 -2.2 l-0.7 -0.9', 'M4.9 -2.2 l0.7 -0.9', 'M-2.6 2.9 l-0.5 1', 'M2.6 2.9 l0.5 1']
  },
  // "Set autopilot, best speed, into the swarm's central mass." A hull with
  // nobody left aboard, and what it is for.
  fireship: {
    d: ['M-3.6 0.8 L3.6 0.8 L2.2 3 L-2.2 3 z', 'M0 -3.4 q1.8 1.6 0 3.2 q-1.8 -1.6 0 -3.2 z'],
    detail: ['M-2 0.8 v-1.4', 'M2 0.8 v-1.4', 'M-3.6 0.8 l-1 -0.6', 'M3.6 0.8 l1 -0.6']
  },

  /* ---- the specials, bought rather than drafted ------------------------- */
  // "limbs, each one longer than a cruiser, moving with a fluid, boneless
  // wrongness" — it took a battleship and squeezed.
  kraken: {
    d: ['M-1.8 -1.4 a2 2.2 0 1 1 3.6 0 v1.6 h-3.6 z',
        'M-1.8 0.4 q-2.6 0.6 -2.4 3.6', 'M-0.6 1.8 q-1.4 1.4 -1 3.2',
        'M0.6 1.8 q1.4 1.4 1 3.2', 'M1.8 0.4 q2.6 0.6 2.4 3.6'],
    detail: ['M-0.9 -1.5 a0.5 0.5 0 1 1 0.01 0', 'M0.9 -1.5 a0.5 0.5 0 1 1 0.01 0',
             'M-4.2 4 l-0.7 0.8', 'M4.2 4 l0.7 0.8']
  },
  // "They burned the orbitals, then the cities, then the croplands, and then
  // they stayed in orbit an extra day to burn the forests."
  purifier: {
    d: ['M0 -4.2 q2.4 2.4 1.4 4.4 q-0.7 1.4 -1.4 1.4 q-0.7 0 -1.4 -1.4 q-1 -2 1.4 -4.4 z',
        'M-3.8 2.4 h7.6', 'M-3 4.2 h6'],
    detail: ['M-2.6 0.8 q0.8 -1.4 0 -2.6', 'M2.6 0.8 q-0.8 -1.4 0 -2.6', 'M0 1.4 v1']
  },
  // "The Adarnas dropped through smoke the whole way down ... a platoon at his
  // back." The hull, and the drop beneath it.
  adarnas: {
    d: ['M-4 -2.4 L4 -2.4 L2.4 0.4 L-2.4 0.4 z', 'M-2.6 -2.4 v-1.4', 'M2.6 -2.4 v-1.4',
        'M-1.6 1.4 v3', 'M0 1.4 v3.4', 'M1.6 1.4 v3'],
    detail: ['M-4 -2.4 l-1 -1', 'M4 -2.4 l1 -1', 'M-0.9 -1.4 h1.8']
  }
};

/**
 * One unit's mark, as SVG, centred on (cx, cy).
 * @param {string} id     unit id
 * @param {number} cx     centre, in the caller's units
 * @param {number} cy
 * @param {number} r      half-width to fill, in the caller's units
 * @param {string} colour stroke
 * @param {number} width  stroke width in GLYPH units (scaled with the drawing)
 * @param {boolean} rich  draw the detail strokes too — card size only
 */
export function glyph(id, cx, cy, r, colour, width = 1.15, rich = false) {
  const g = GLYPH[id];
  if (!g) return '';
  const k = r / 5;
  const paths = rich ? g.d.concat(g.detail) : g.d;
  return `<g transform="translate(${cx} ${cy}) scale(${k.toFixed(4)})" fill="none"
     stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">` +
    paths.map(d => `<path d="${d}"/>`).join('') + '</g>';
}
