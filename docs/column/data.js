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

export const BUILD = 'column-v1';

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
// TWELVE cards, per Sam, with room to grow. A card deploys `count` bodies —
// "Crawler Swarm" is six crawlers, a Walker is one Walker — because in Sam's
// structure a pick is a pick and there is no cost curve to balance against.
// That has a consequence worth stating plainly: BALANCE HERE COMES ENTIRELY
// FROM COUNTERS, not from price. There is no cheap-but-weak card, only cards
// that beat different things. The first roster carried a `cost` field with no
// reader and a one-body swarm, and the first sweep said so.
//
// N bodies have N times the health AND N times the output, so a card's raw
// strength goes roughly as COUNT SQUARED. Measured, not assumed: taking Line
// Infantry from 5 bodies to 6 while nudging hp and damage moved it from 25.8%
// against the pool to 87.8% -- dead pick to dominant, on what looked like a
// small change. TUNE hp AND dmg; LEAVE count ALONE unless the card's whole
// role is changing.
//
// The same shape bit twice. An AURA scales with the number of enemies inside it
// AND with the square of its radius, so it is quadratic too: volt went 27.8% ->
// 86.6% on aura 1.3 -> 1.6 with the radius moving 17 -> 19. The dials that are
// safe to tune are hp, dmg and rate. count, auraR and splash are not. These are set to put every card near
// the same count^2 x hp x dps and to differ in HOW they spend it.
//
// Fields:
//
//   count  bodies this card deploys
//   hp     health of each body
//   dmg    damage per attack, before the defender's armour
//   rate   ticks between attacks
//   rng    attack range in field units. <= 4 is melee for targeting purposes
//   spd    field units per tick
//   arm    flat damage subtracted from every incoming hit, to a floor of 1
//   splash radius of area damage around the target
//   tgt    'near' | 'big' | 'back'  — who this unit walks towards
//   defl   fraction of RANGED damage refused. The Kraken rule: a shield tuned
//          for weapons fire that slow things pass straight through
//   dot    damage per tick applied for `dotT` ticks after a hit
//   aura   damage per tick to every enemy within `auraR`, needing no attack
//   boom   { r, d } detonation on death
//
// These numbers are a FIRST GUESS, chosen to make the counter-graph expressible
// rather than balanced. test/matchup.mjs exists to tell us they are wrong.
export const UNITS = [
  { id: 'line', n: 'Line Infantry', count: 5,
    hp: 168, dmg: 19, rate: 8, rng: 3, spd: 1.0, tgt: 'near',
    q: 'You’re soldiers of the Union. The fleet has not fired. Until it fires, you check your sectors.' },

  { id: 'walker', n: 'Walker', count: 1,
    hp: 780, dmg: 70, rate: 26, rng: 20, spd: 0.35, arm: 4, splash: 8, tgt: 'near',
    q: 'Four stories of articulated war machine, and the world went white and sideways.' },

  { id: 'ultra', n: 'Ultra Armor', count: 2,
    hp: 425, dmg: 32, rate: 12, rng: 5, spd: 0.7, arm: 9, tgt: 'near',
    q: 'Every round the survivors put on them skidded off the black plate like rain off glass.', qv: 1 },

  { id: 'karkinos', n: 'Karkinos', count: 2,
    hp: 400, dmg: 37, rate: 10, rng: 6, spd: 1.6, tgt: 'back',
    q: 'Front legs punching anchor-deep into the plate and stone, the rear legs following.' },

  { id: 'amabie', n: 'Amabie', count: 1,
    hp: 250, dmg: 112, rate: 32, rng: 62, spd: 0.28, splash: 14, tgt: 'big',
    q: 'A walking artillery piece the size of a customs house.' },

  { id: 'swarm', n: 'Crawler Swarm', count: 10,
    hp: 95, dmg: 10, rate: 4, rng: 2, spd: 2.0, tgt: 'big',
    q: 'They hit the crowded street the way current hits a shoal.' },

  { id: 'brute', n: 'Brute', count: 1,
    hp: 900, dmg: 66, rate: 18, rng: 4, spd: 0.6, arm: 3, tgt: 'near',
    q: 'It went through a Union squad the way weather goes through paper.' },

  { id: 'neurite', n: 'Neurite', count: 3,
    hp: 165, dmg: 21, rate: 9, rng: 32, spd: 0.8, tgt: 'near',
    q: 'They aren’t animals. Whatever is behind their eyes was aiming.', qv: 1 },

  { id: 'acid', n: 'Acid Thrower', count: 2,
    hp: 200, dmg: 10, rate: 14, rng: 30, spd: 0.65, dot: 5, dotT: 60, tgt: 'big',
    q: 'It clung to shields and ate through, sheeted across hulls and kept eating.' },

  { id: 'volt', n: 'Volt Battery', count: 2,
    hp: 320, dmg: 0, rate: 999, rng: 0, spd: 0.78, aura: 1.42, auraR: 18, tgt: 'near',
    q: 'The volt round’s enormous older sibling, charged projectiles that didn’t need to hit to hurt.' },

  { id: 'deflector', n: 'Deflector', count: 2,
    hp: 400, dmg: 24, rate: 12, rng: 4, spd: 0.75, defl: 0.85, tgt: 'near',
    q: 'Its shields are tuned for weapons fire. Pods fall through.', qv: 1 },

  { id: 'fireship', n: 'Fireship', count: 2,
    hp: 200, dmg: 4, rate: 20, rng: 3, spd: 1.15, tgt: 'near', boom: { r: 17, d: 150 },
    q: 'Set autopilot, best speed, into the swarm’s central mass. Then get to your pods.' }
];

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
