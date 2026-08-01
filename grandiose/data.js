// Board, decks, personas and quotations for GRANDIOSE — THE LEDGER.
//
// Everything here is data. No logic, no DOM. The engine imports it; the tests
// import it; the UI imports it. If a name or a number is wrong, it is wrong in
// exactly one place.
//
// CANON. Names are drawn from Grandiose: The Rise to Power (S. T. Chalk, 2026).
// Where a square departs from the book a comment says so and why, because the
// setting belongs to the author and the deviations should be easy to overrule.

/* ---------------------------------------------------------------- colour sets */
// gc = cost of one garrison on any square in the set.
// sq = board indices belonging to the set.
export const SETS = {
  syn:  { n: 'Syndicate', c: 'var(--syn)',  gc: 50,  sq: [1, 3] },
  eni:  { n: 'Enigma',    c: 'var(--eni)',  gc: 50,  sq: [6, 8, 10] },
  dom:  { n: 'Dominion',  c: 'var(--dom)',  gc: 100, sq: [12, 16] },
  eden: { n: 'Eden',      c: 'var(--eden)', gc: 100, sq: [13, 14, 15] },
  ven:  { n: 'Venenum',   c: 'var(--ven)',  gc: 150, sq: [19, 20] },
  // Was "Basileia", holding Basileia Prime and Cradle. Both were wrong:
  // Cradle is the capital on Agora — the Union's, then the Federation's — and
  // the book names no Basileian world at all (only the Emperor, the Empire and
  // Vale's Progressive Movement). The top tier is now the seat of power the
  // Leader actually ends the book holding. Two locations inside one capital is
  // the genre convention, not a mistake — cf. Park Lane and Mayfair.
  agora:{ n: 'Agora',     c: 'var(--agora)',gc: 200, sq: [25, 27] }
};

/* ---------------------------------------------------------------------- board */
// t: go | p (property) | f (fleet) | u (utility) | tax | col | con | jail | goto | free
// r: rent ladder — [bare, 1 garrison, 2, 3, citadel]
export const BOARD = [
  { t: 'go',                n: 'The Ledger Opens', a: 'GO' },
  { t: 'p',  s: 'syn',      n: 'Vessa Station',          pr: 60,  r: [8, 25, 75, 225, 300], a: 'VESA' },
  { t: 'col',               n: 'The Column', a: 'COL' },
  { t: 'p',  s: 'syn',      n: 'The Corridor',           pr: 60,  r: [8, 25, 75, 225, 300], a: 'CORR' },
  { t: 'tax',               n: 'Dominion Tithe',         amt: 200, a: 'TITH' },
  { t: 'f',                 n: 'Pillar of Commerce',     pr: 200, a: 'PILR' },
  { t: 'p',  s: 'eni',      n: 'Enigma Uplands',         pr: 100, r: [12, 40, 120, 340, 450], a: 'UPLD' },
  { t: 'jail',              n: 'Neurex Holding Facility', a: 'NRX' },
  { t: 'p',  s: 'eni',      n: 'Enigma Agricultural Belt', pr: 100, r: [12, 40, 120, 340, 450], a: 'BELT' },
  { t: 'con',               n: 'Contingency', a: 'CON' },
  { t: 'p',  s: 'eni',      n: 'Re-dok Station',         pr: 120, r: [16, 50, 150, 400, 520], a: 'RDOK' },
  // Was "Spector", which collides with the opponent of the same name. The deep
  // array is the Leader's own long-range sensor net — Interlude V, "the display
  // carries the deep-array feed, and the feed carries the future".
  { t: 'u',                 n: 'The Deep Array',         pr: 150, a: 'ARRY' },
  { t: 'p',  s: 'dom',      n: 'Ortox Transit',          pr: 140, r: [18, 60, 180, 500, 650], a: 'ORTX' },
  { t: 'p',  s: 'eden',     n: 'Horizon',                pr: 180, r: [22, 80, 240, 640, 800], a: 'HRZN' },
  { t: 'p',  s: 'eden',     n: 'Oasis Fortress',         pr: 180, r: [22, 80, 240, 640, 800], a: 'OASI' },
  { t: 'p',  s: 'eden',     n: 'Eden Farmlands',         pr: 200, r: [26, 90, 260, 700, 880], a: 'FARM' },
  { t: 'p',  s: 'dom',      n: "Varan's Audit House",    pr: 160, r: [22, 70, 200, 550, 700], a: 'AUDT' },
  { t: 'col',               n: 'The Column', a: 'COL' },
  { t: 'f',                 n: 'Orion',                  pr: 200, a: 'ORIN' },
  { t: 'p',  s: 'ven',      n: 'Venenum Yards',          pr: 240, r: [30, 110, 320, 850, 1000], a: 'YRDS' },
  { t: 'p',  s: 'ven',      n: 'Venenum Foundries',      pr: 260, r: [34, 120, 350, 900, 1100], a: 'FNDR' },
  { t: 'goto',              n: 'Absorbed', a: 'ABSD' },
  { t: 'free',              n: 'Neutral Anchorage', a: 'ANCH' },
  { t: 'con',               n: 'Contingency', a: 'CON' },
  { t: 'u',                 n: 'Anthelion Synthesis',    pr: 150, a: 'ANTH' },
  { t: 'p',  s: 'agora',    n: 'The Palace',             pr: 350, r: [50, 175, 500, 1200, 1600], a: 'PLCE' },
  { t: 'tax',               n: 'Compact Levy',           amt: 100, a: 'LEVY' },
  { t: 'p',  s: 'agora',    n: 'Cradle',                 pr: 400, r: [60, 200, 600, 1400, 1900], a: 'CRDL' }
];

export const N = BOARD.length;          // 28
export const GO = 0;
export const JAIL = 7;
export const GOTO = 21;
export const FLEETS = [5, 18];
export const UTILS = [11, 24];

/* ------------------------------------------------------------------- traffic */
// Long-run share of turns ending on each square, as a percentage.
//
// Verified rather than asserted: test/traffic.test.mjs re-derives this by
// simulating the engine's own movement rules and fails if any square drifts
// more than 0.5pp from the value below. It is a solved figure, not a guess —
// but it is not exact, and nothing in the UI should claim that it is.
//
// Doubles have no movement consequence in this game (no extra roll, no
// three-doubles rule) — they only release you from the Facility. The table is
// solved for the rules as implemented.
export const TRAFFIC = [
  3.94, 3.06, 2.69, 3.16, 3.24, 3.56, 3.64, 8.14, 3.34, 1.83, 3.48, 4.02, 3.63, 4.42,
  3.83, 4.00, 3.69, 3.46, 4.43, 3.99, 4.03, 0.00, 3.92, 1.88, 3.93, 3.56, 3.39, 3.70
];

/* --------------------------------------------------------------------- decks */
// Each card is one effect. Movement cards resolve their destination normally.
export const CONTINGENCY = [
  { x: 'You are commanded to Cradle. The capital wishes to see who it belongs to.', go: 27 },
  { x: 'The ledger opens afresh. Advance to the start of the column.', go: 0 },
  { x: 'Eden holds, or it does not. Advance to Horizon.', go: 13 },
  { x: 'Requisition order. Report to the nearest fleet.', fleet: 1 },
  { x: 'The *Orion* signals for you. Advance to it.', go: 18 },
  { x: 'A manifest you were not meant to read. Take ₡150 from the bank.', cash: 150 },
  { x: 'The Overseer has taken an interest in your accounts. Go to the Neurex Holding Facility.', jail: 1 },
  { x: 'You are three squares further back than your paperwork claims.', back: 3 },
  { x: 'Anthelion synthesis dividend. Collect ₡100.', cash: 100 },
  { x: 'Dominion audit. Varan finds ₡120 that should not have been there.', cash: -120 },
  { x: 'Garrison resupply billed to you. Pay ₡25 per garrison held.', perGarrison: 25 },
  { x: 'A world petitions for protection under the Compact. Collect ₡200.', cash: 200 },
  { x: 'The nearest utility falls under emergency requisition. Advance to it.', util: 1 },
  { x: 'Insurance registry irregularity. Pay ₡90.', cash: -90 },
  { x: 'Salvage rights on a Purifier hulk. Collect ₡180.', cash: 180 },
  { x: 'Your name appears in a column you did not write. Pay ₡60.', cash: -60 }
];

export const COLUMN = [
  { x: 'The column is settled in your favour. Collect ₡200.', cash: 200 },
  { x: 'Back to the beginning of the ledger. Advance to Go.', go: 0 },
  { x: 'The Neurex has assessed you as a candidate. Go to the Holding Facility.', jail: 1 },
  { x: 'Tithe rebate from a world that overpaid. Collect ₡120.', cash: 120 },
  { x: 'Hull inspection. Pay ₡80.', cash: -80 },
  { x: 'A debt you had written off is repaid with interest. Collect ₡160.', cash: 160 },
  { x: 'Union pension obligations. Pay ₡110.', cash: -110 },
  { x: 'Confetti still being swept from the plaza drains. Ceremonial costs, ₡70.', cash: -70 },
  { x: 'Freight tonnage under-declared, and nobody asked. Collect ₡140.', cash: 140 },
  { x: 'Medal ceremony on Agora. The metal is free; the reception is not. Pay ₡50.', cash: -50 },
  { x: 'Progressive capitals remit early. Collect ₡90.', cash: 90 },
  { x: 'A cure, and a lever, from one vial. Collect ₡250.', cash: 250 },
  { x: 'Occupation costs on a world that will not settle. Pay ₡130.', cash: -130 },
  { x: 'Second ledger reconciled. Collect ₡100.', cash: 100 },
  { x: 'Citadel maintenance. Pay ₡75 per citadel held.', perCitadel: 75 },
  { x: 'The Corridor is still burning, and burning is not free. Pay ₡100.', cash: -100 }
];

/* ------------------------------------------------------------------ opponents */
export const PERSONAS = {
  spector: {
    n: 'Spector', c: '#5ECFC8',
    d: 'An unshackled intelligence. Reads the board as arithmetic, wants Eden and Enigma, hoards garrisons, says very little.',
    won:  ['Correct.', 'The arithmetic held.', 'As modelled.', 'Expected.'],
    lost: ['Your valuation exceeds mine. I note it.', 'Overpriced. You may keep it.', 'I bid what it is worth. You did not.'],
    buy:  ['Traffic, not rent.', 'This one pays back.', 'Sixteen turns.', 'Noted.'],
    rent: ['A cost I priced in.', 'Entered.'],
    jail: ['Assessment is a fixed cost.', 'Irrelevant.'],
    vassal: ['You are now an entry in my column.', 'Absorbed. Not unlike them.'],
    fell: ['Recalculating from a worse position.', 'A miscount. Mine.']
  },
  varan: {
    n: 'High Commander Varan', c: '#E0776A',
    d: 'Arrives with the punctuality of a foreclosure. Bids to deny rather than to acquire, and audits everything.',
    won:  ['Denied.', 'I did not want it. You wanted it more.', 'This is what an audit costs.', 'Withheld.'],
    lost: ['Enjoy the overhead.', 'You have bought a liability and called it an asset.', 'I have made it expensive. That was the objective.'],
    buy:  ['Filed.', 'It is not yours. That is sufficient.', 'A holding, not a purchase.'],
    rent: ['Under protest, and under review.', 'I shall want a receipt.'],
    jail: ['This facility is improperly documented.', 'I intend to file a complaint.'],
    vassal: ['You will find the terms punitive. They are meant to be.', 'Sign here. There is only one copy.'],
    fell: ['This is an irregularity. It will be corrected.', 'I do not recognise this outcome.']
  },
  vale: {
    n: 'Adran Vale', c: '#D9A441',
    d: 'Smiling with the particular warmth of a man who has never once needed to fake it. Chases capitals, overpays gladly, loses slowly.',
    won:  ['Cradle! Well — it had to be someone.', 'The people will approve.', 'Worth every credit. Every one.', 'A capital, at last.'],
    lost: ['Ah well. There will be other capitals.', 'You are welcome to the provincial ones.', 'No hard feelings whatsoever.'],
    buy:  ['A prestigious address.', 'Reform begins with good property.', 'Marvellous.'],
    rent: ['Gladly. Genuinely, gladly.', 'Money is only money.'],
    jail: ['A misunderstanding, obviously.', 'I shall address the crowd from here.'],
    vassal: ['You may keep your flag. I insist.', 'Think of it as representation.'],
    fell: ['A temporary reversal of fortunes.', 'The movement endures!']
  }
};

/* --------------------------------------------------------------- the Leader */
// The Leader narrates and does not play. He is the house.
export const LEADER_LINES = [
  'The entry is posted. Whether it was worth posting is a question for later columns.',
  'I have seen worlds change hands for less, and men killed for a great deal less than that.',
  'Amateurs count what they own. I count what it costs to keep.',
  'A price was agreed. That is the whole of it. Everything else is decoration.',
  'Somebody has just paid too much and does not yet know it. They will.',
  'Strength is a currency, and currencies are spent.',
  'I did not tell a single lie today. I simply kept a second ledger nobody asked for.',
  'Desperation is the fastest constitutional process there is.',
  'They believe they are safe because they are strong. The survey data disagrees.',
  'Everything has a price. The only question is whose column it lands in.'
];

export const EPIGRAPH = {
  text: 'Everything has a price, and the price is always entered in somebody’s column. ' +
        'Empires believe they are exempt from this. They are not. They are simply large ' +
        'enough that the entry takes longer to post.',
  cite: 'The Leader, Interlude I'
};

/* ------------------------------------------------------------------ economy */
export const RULES = {
  startingCash: 1800,
  passGo: 200,
  garrisonPool: 16,
  citadelPool: 6,
  amendCosts: [500, 700, 900],   // cost of nudging one square, by amendments used
  amendsPerGame: 3,
  garrisonUpkeep: 10,            // per garrison, per turn
  citadelUpkeep: 30,             // per citadel, per turn
  vassalUpkeep: [75, 200, 375, 500],  // by number of vassals held
  debtInterest: 0.10,            // per turn, on a bank debt marker
  // Redemption is 55% of list — half back plus a tenth in interest. Held as a
  // ratio rather than 0.55 because the float form rounds a credit wrong on
  // Cradle (400 * 0.55 === 220.00000000000003).
  mortgageRedeemNumerator: 11,
  mortgageRedeemDenominator: 20,
  revoltBase: 1400,              // strength needed for a first declaration
  revoltStep: 300,               // added per previous declaration
  revoltCost: 500,
  facilityAttempts: 3            // doubles, or three attempts, and no payment
};
