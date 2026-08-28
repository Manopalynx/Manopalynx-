// Units, personas and constants for GRANDIOSE — THE COLUMN.
//
// Everything here is data. No logic, no DOM. The engine imports it; the tests
// import it; the interface will import it. If a number is wrong, it is wrong in
// exactly one place.
//
// CANON. Every unit is from Grandiose: The Rise to Power (S. T. Chalk, 2026).
// `q` is the line shown with the unit; `qv: 1` means it is the author's, lifted
// from the manuscript and trimmed only at its ends. No `qv` means it was
// written for the game and is the first thing to strike if it does not sound
// like the book. The manuscript is NOT in this repository and must not be — the
// repository is public and the novel is his.
//
// An early draft of the design document gave Varan a line that reads exactly
// like the book and appears in it zero times; it was a persona line written for
// the Ledger. Nothing here is attributed to the author unless it has been
// checked against the manuscript, which is why most of these carry no `qv`.

export const BUILD = 'column-v5';

/* ------------------------------------------------------------- the battlefield */
// Portrait. The armies start at opposite ends of a field deeper than it is wide,
// because that is the shape of the phone this is played on. Distances are in
// field units, not pixels — the renderer scales them and the engine never knows
// what a pixel is.
export const FIELD = { w: 100, d: 140 };

// One tick is a tenth of a second of game time. The resolver is fixed-timestep
// and seeded, so a battle is a pure function of (armyA, armyB, seed) and can be
// replayed exactly. That is the only reason any figure below can be asserted.
export const TICK = 0.1;
export const MAX_TICKS = 3000;          // 5 minutes; a battle this long is a draw

/* -------------------------------------------------------------------- the units */
// THREE WEIGHT CLASSES, per Sam. A card deploys bodies according to its class
// and nothing else, so battlefield population is bounded by construction rather
// than by tuning:
//
//   heavy  1 body    medium  2 bodies    light  3 bodies
//
// `count` is DERIVED from the class and is not a field a card may set, because
// the previous roster let a Crawler Swarm deploy ten and that one number put 171
// bodies on a phone screen by the end of a match.
//
// THESE ARE NOT EQUAL-POWER CARDS, deliberately. The earlier roster tried to put
// every card near the same count^2 x hp x dps; Sam's direction rejects that.
// A heavy is individually formidable, a light is weak per body and earns its
// place through numbers, and the classes are meant to be strategically
// different rather than mathematically identical. Balance comes from counters:
//
//   light swarms overwhelm slow single-target attackers
//   AOE punishes light, because three bodies stand close enough to share a blast
//   heavy hp absorbs AOE efficiently, because a splash hits one body not three
//   damage-over-time ignores armour, so it is what punishes a heavy
//   fast units bypass a frontline and reach ranged and support
//
// Good composition should have several of those running at once, which is why
// the go/no-go now measures MIXED armies rather than single-card ones.
//
// Fields (count is derived; w is the class):
//
//   w      'heavy' | 'medium' | 'light' — decides how many bodies deploy
//   hp     health of each body
//   dmg    damage per attack, before the defender's armour
//   rate   ticks between attacks
//   rng    attack range in field units. <= 4 is melee for targeting purposes
//   spd    field units per tick
//   arm    flat damage subtracted from every incoming hit, to a floor of 1
//   splash radius of area damage around the target
//   tgt    'near' | 'big' | 'back'  — who it shoots, among what it can reach
//   move   'line' (default) | 'seek'. A LINE card advances with the rest of its
//          army and holds formation; a SEEK card leaves the line and crosses for
//          whatever `tgt` names. Three cards seek, and the book says so of each:
//          the Karkinos "hauled itself over the wall's crown", the crawlers move
//          "up the walls and along the ceiling, moving in all planes at once",
//          and the fireship's whole purpose is to reach the enemy's centre.
//          One global movement rule was tried and it deleted those three units:
//          the counter graph went 3 of 3 to 0 of 3 and all three fell out of
//          every cycle, because their identity is WHERE THEY WALK.
//   defl   fraction of RANGED damage refused. The Kraken rule: a shield tuned
//          for weapons fire that slow things pass straight through
//   dot    damage per tick applied for `dotT` ticks after a hit
//   aura   damage per tick to every enemy within `auraR`, needing no attack
//   boom   { r, d } detonation on death
//
// These numbers are a FIRST GUESS, chosen to make the counter-graph expressible
// rather than balanced. test/matchup.mjs exists to tell us they are wrong.
export const WEIGHT = { heavy: 1, medium: 2, light: 3 };

/* ------------------------------------------------------------------ upgrades */
// Sam's design point 3: reinforcement cards AND upgrade cards. A reinforcement
// pick adds a card, and therefore bodies. An UPGRADE pick adds nothing to the
// field and makes what is already standing on it stronger.
//
// That is the answer to the crowd. A match currently ends with about 107 bodies
// on a 393pt-wide screen, and no amount of drawing fixes a field that dense; the
// upgrade pick is the only lever that reduces it without touching the round
// structure or the square law, because a pick spent on an upgrade is a pick not
// spent on three more crawlers.
//
// An upgrade is offered ONLY for a unit type the army already fields. An upgrade
// to nothing is a wasted pick and the player cannot be asked to guess whether it
// applies. Each level multiplies health and every damage channel; it never
// touches `count`, armour, range or speed, so an upgrade makes a card more of
// itself and cannot turn it into a different card.
//
// These three numbers are a first guess. test/match.mjs measures what they do to
// army size and to how often the draft decides the battle.
export const UPGRADE = {
  step: 0.35,     // +35% health and damage per level
  max: 3,         // levels above base
  chance: 0.5     // how often an eligible offered card arrives as an upgrade
};

export const UNITS = [
  // ---- heavy: one body, individually formidable -------------------------
  { id: 'walker', n: 'Walker', w: 'heavy',
    hp: 820, dmg: 75, rate: 26, rng: 20, spd: 0.35, arm: 4, splash: 8, tgt: 'near',
    q: 'Four stories of articulated war machine, and the world went white and sideways.' },

  { id: 'brute', n: 'Brute', w: 'heavy',
    hp: 980, dmg: 70, rate: 18, rng: 4, spd: 0.62, arm: 3, tgt: 'near',
    q: 'It went through a Union squad the way weather goes through paper.' },

  { id: 'ultra', n: 'Ultra Armor', w: 'heavy',
    hp: 780, dmg: 72, rate: 11, rng: 5, spd: 0.62, arm: 12, tgt: 'near',
    q: 'Every round the survivors put on them skidded off the black plate like rain off glass.', qv: 1 },

  { id: 'amabie', n: 'Amabie', w: 'heavy',
    hp: 300, dmg: 130, rate: 32, rng: 62, spd: 0.28, splash: 16, tgt: 'big',
    q: 'A walking artillery piece the size of a customs house.' },

  // ---- medium: two bodies, specialised roles -----------------------------
  // Four legs, not six -- "waiting on its four vast legs". It breaches by
  // climbing: over the wall rather than through the gate, which is why it seeks.
  { id: 'karkinos', n: 'Karkinos', w: 'medium',
    hp: 380, dmg: 40, rate: 10, rng: 6, spd: 1.6, tgt: 'back', move: 'seek',
    q: 'Front legs punching anchor-deep into the plate and stone, the rear legs following.' },

  // INVENTED. "Deflector" appears in the manuscript zero times -- the name and
  // the unit are written for the game. Only its line is the author's, and that
  // line is the Kraken's shield, which is where the property comes from.
  { id: 'deflector', n: 'Deflector', w: 'medium',
    hp: 420, dmg: 26, rate: 12, rng: 4, spd: 0.72, defl: 0.85, tgt: 'near',
    q: 'Its shields are tuned for weapons fire. Pods fall through.', qv: 1 },

  { id: 'volt', n: 'Volt Battery', w: 'medium',
    hp: 330, dmg: 0, rate: 999, rng: 0, spd: 0.78, aura: 1.5, auraR: 18, tgt: 'near',
    q: 'The volt round’s enormous older sibling, charged projectiles that didn’t need to hit to hurt.' },

  // Damage over time is not reduced by armour, which is what makes this the
  // answer to a heavy rather than one more ranged attacker.
  { id: 'acid', n: 'Acid Thrower', w: 'medium',
    hp: 230, dmg: 12, rate: 14, rng: 30, spd: 0.65, dot: 6, dotT: 60, tgt: 'big',
    q: 'It clung to shields and ate through, sheeted across hulls and kept eating.' },

  // ---- light: three bodies, strong in numbers, soft to AOE ---------------
  { id: 'line', n: 'Line Infantry', w: 'light',
    hp: 215, dmg: 33, rate: 8, rng: 3, spd: 1.05, tgt: 'near',
    q: 'You’re soldiers of the Union. The fleet has not fired. Until it fires, you check your sectors.' },

  { id: 'swarm', n: 'Crawler Swarm', w: 'light',
    hp: 155, dmg: 27, rate: 4, rng: 2, spd: 2.1, tgt: 'big', move: 'seek',
    q: 'They hit the crowded street the way current hits a shoal.' },

  { id: 'neurite', n: 'Neurite', w: 'light',
    hp: 180, dmg: 31, rate: 9, rng: 32, spd: 0.85, tgt: 'near',
    q: 'They aren’t animals. Whatever is behind their eyes was aiming.', qv: 1 },

  { id: 'fireship', n: 'Fireship', w: 'light',
    hp: 175, dmg: 4, rate: 20, rng: 3, spd: 1.15, tgt: 'near', move: 'seek', boom: { r: 15, d: 120 },
    q: 'Set autopilot, best speed, into the swarm’s central mass. Then get to your pods.' }
];

// Derived, so a card cannot disagree with its own class.
UNITS.forEach(u => { u.count = WEIGHT[u.w]; });

export const BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]));

/* ------------------------------------------------------------------- the match */
// Sam's structure, taken as given:
//   five lives; three picks a round, each one a blind simultaneous commitment
//   revealed to both sides before the next; the round ends when one army is
//   wiped out; the loser drops a life, everything resets to starting positions,
//   and the loser opens the next round with one extra pick.
export const RULES = {
  lives: 5,
  picksPerRound: 3,
  loserBonusPicks: 1,
  offer: 3,             // cards shown per pick
  maxRounds: 20         // a match is 5-9 rounds; this only catches a runaway
};

/* ----------------------------------------------------------------- the personas */
// The personality IS the drafting policy. Voice lines can come later; a persona
// that only talks is decoration. Each `pick` receives the offered cards and the
// board so far and returns an index.
//
// Named for the book's own auditors and spenders. The descriptions are written
// for the game, not quoted, except where marked.
export const PERSONAS = {
  varan: {
    n: 'Varan',
    d: 'Drafts to deny. Takes what you need rather than what he needs — the auditor reading for the shape of what is not there.'
  },
  harlow: {
    n: 'Harlow',
    d: 'Drafts to keep. Durable, refuses trades, nothing dies that did not have to.'
  },
  hale: {
    n: 'Hale',
    d: 'Drafts to schedule. Front-loads, presses tempo, closes early.'
  },
  vex: {
    n: 'Vex',
    d: 'Drafts to profit. Takes the biggest number on the card, every time.'
  },
  leader: {
    n: 'The Leader',
    d: 'Drafts to spend. Concedes early rounds deliberately to buy the late one.'
  }
};
