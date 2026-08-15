// Board, decks, personas and quotations for GRANDIOSE — THE LEDGER.
//
// Everything here is data. No logic, no DOM. The engine imports it; the tests
// import it; the UI imports it. If a name or a number is wrong, it is wrong in
// exactly one place.
//
// CANON. Names are drawn from Grandiose: The Rise to Power (S. T. Chalk, 2026).
// Where a square departs from the book a comment says so and why, because the
// setting belongs to the author and the deviations should be easy to overrule.
//
// Every square carries `q`, the line shown under its name in the info panel.
// `qv: 1` means the line is the author's, lifted from the novel and trimmed only
// at its ends. No `qv` means it was written for the game and is the first thing
// to strike if it does not sound like the book. Thirty of forty are the author's.
// The interface shows quoted lines in italic and written ones plainly, so the
// distinction is visible at the table and not only in this file.

// The build, shown in the menu so a screenshot says which version it came from.
// Sam plays from the Home Screen where a stale service worker looks identical to
// a current one, so "the fix didn't land" was previously unanswerable by either
// of us. `CACHE` in sw.js must match this exactly; build.test.mjs asserts it.
export const BUILD = 'grandiose-v56';

/* ---------------------------------------------------------------- colour sets */
// gc = cost of one garrison on any square in the set.
// sq = board indices belonging to the set.
export const SETS = {
  syn:  { n: 'Syndicate',  c: 'var(--syn)',   gc: 50,  sq: [1, 3] },
  eni:  { n: 'Enigma',     c: 'var(--eni)',   gc: 50,  sq: [6, 8, 9] },
  dom:  { n: 'Dominion',   c: 'var(--dom)',   gc: 100, sq: [11, 13, 14] },
  eden: { n: 'Eden',       c: 'var(--eden)',  gc: 100, sq: [16, 18, 19] },
  ven:  { n: 'Venenum',    c: 'var(--ven)',   gc: 150, sq: [21, 23, 24] },
  // Keth, Oranthe and Vasa are the three fever systems that acceded to the
  // Compact because the Union held the Anthelion cure — "they will not
  // experience it as coercion, they will experience it as rescue". Three worlds
  // bought with medicine, and now a colour group you complete and charge rent on.
  com:  { n: 'The Compact', c: 'var(--com)',  gc: 150, sq: [26, 27, 29] },
  // All three are the book's. The earlier note here was wrong twice over: it
  // claimed the novel names no Basileian world, and it called the Marches and
  // the Court inventions. The novel names several — "the Rezar marches to the
  // core routes", and Re-dok, whose station carries "ten centuries of Basileian
  // history" and through whose customs Samuel walks a disassembled rifle on his
  // way to the plaza. Vale's Plaza is where he uses it.
  bas:  { n: 'Basileia',   c: 'var(--bas)',   gc: 200, sq: [31, 32, 34] },
  agora:{ n: 'Agora',      c: 'var(--agora)', gc: 200, sq: [37, 39] }
};

/* ---------------------------------------------------------------------- board */
// Monopoly's exact skeleton: 22 properties in eight sets (2·3·3·3·3·3·3·2),
// four fleets, two utilities, three Contingency, three Column, two taxes and
// four corners. Prices and rents follow its ladder too — a century of
// balancing is worth inheriting rather than reinventing.
//
// t: go | p (property) | f (fleet) | u (utility) | tax | col | con | jail | goto | free
// r: rent ladder — [bare, 1 garrison, 2, 3, citadel]
// a: four-character code. 40 squares round a 393pt perimeter leaves ~33px a
//    side, so no full name fits at any cell shape; the centre panel names it.
//    Two codes of the same length may not differ by a single character — at
//    10px they are the same glyph-shape to a player mid-turn. That rule caught
//    COL against CON, which are the two DECKS and so the worst possible pair to
//    confuse, and VESA against VASA, ORAN against ORIN, ANCH against ANTH and
//    ARCH. Held by "the short codes are distinct enough to tell apart".
export const BOARD = [
  { t: 'go', n: 'The Ledger Opens', a: 'GO',
    q: 'Every conquest would be entered twice: once in their ledger, as territory pacified in the Dominion\'s name, and once in ours.', qv: 1 },
  { t: 'p', s: 'syn', n: 'Vessa Station', pr: 60, r: [2, 10, 30, 90, 250], a: 'VSTA',
    q: 'I was on Vessa Station when their fleet took the Corridor.', qv: 1 },
  { t: 'col', n: 'The Column', a: 'CLMN',
    q: 'A column of figures is an argument that never has to raise its voice.' },
  { t: 'p', s: 'syn', n: 'The Corridor', pr: 60, r: [4, 20, 60, 180, 450], a: 'CORR',
    q: 'Twelve billion people lived in the Corridor. The Purifiers did not take a single prisoner, because a prisoner is a thing you intend to trade.', qv: 1 },
  { t: 'tax', n: 'Dominion Tithe', amt: 200, a: 'TITH',
    q: 'We would conquer with enthusiasm and hand over the tribute with a bow.', qv: 1 },
  { t: 'f', n: 'Pillar of Commerce', pr: 200, a: 'PILR',
    q: 'They let us keep the name; they thought it was quaint.', qv: 1 },
  { t: 'p', s: 'eni', n: 'Enigma Uplands', pr: 100, r: [6, 30, 90, 270, 550], a: 'UPLD',
    q: 'Above the belt the soil thins and the farms give out, and what is left is wind, terraces, and people who climbed up here to be left alone.' },
  { t: 'con', n: 'Contingency', a: 'CON',
    q: 'Nothing here arrives unbudgeted. Some of it simply arrives early.' },
  { t: 'p', s: 'eni', n: 'Enigma Agricultural Belt', pr: 100, r: [6, 30, 90, 270, 550], a: 'BELT',
    q: 'The wind came off the agricultural belt smelling of turned earth and the flowering season, the way it had smelled every spring of his life.', qv: 1 },
  { t: 'p', s: 'eni', n: 'Arvanis', pr: 120, r: [8, 40, 100, 300, 600], a: 'ARVN',
    q: 'The nation of Arvanis has refused integration three times. Its mineral output is required.', qv: 1 },
  { t: 'jail', n: 'Overseer Detention', a: 'OVSR',
    q: 'An Overseer is an official, and officials have a price.' },
  { t: 'p', s: 'dom', n: 'Ortox Transit', pr: 140, r: [10, 50, 150, 450, 750], a: 'ORTX',
    q: 'The Orion under Hale from the west through Ortox; the Harpa from the east; the system boxed.', qv: 1 },
  { t: 'u', n: 'The Deep Array', pr: 150, a: 'ARRY',
    q: 'The blips multiply past the deep array\'s patience, red and unhurried and total, ten thousand galaxies of testimony behind them.', qv: 1 },
  { t: 'p', s: 'dom', n: "Varan's Audit House", pr: 140, r: [10, 50, 150, 450, 750], a: 'AUDT',
    q: 'Every ledger in the sector is reconciled here, and every reconciliation finds something. That is what a reconciliation is for.' },
  { t: 'p', s: 'dom', n: 'The Tribute Ships', pr: 160, r: [12, 60, 180, 500, 900], a: 'TRIB',
    q: 'I signed the instrument of vassalage in a room aboard one of their tribute ships. They kept me waiting four hours.', qv: 1 },
  { t: 'f', n: 'Orion', pr: 200, a: 'ORIN',
    q: 'Full evacuation, all remaining forces to the Orion.', qv: 1 },
  { t: 'p', s: 'eden', n: 'Horizon', pr: 180, r: [14, 70, 200, 550, 950], a: 'HRZN',
    q: 'We hold it because every day it stands, the rest of Eden believes.', qv: 1 },
  { t: 'col', n: 'The Column', a: 'CLMN',
    q: 'Somebody wrote this down, and writing it down is what made it true.' },
  { t: 'p', s: 'eden', n: 'Oasis Fortress', pr: 180, r: [14, 70, 200, 550, 950], a: 'OASI',
    q: 'Walls thirty meters of layered plate and stone, artillery nests, sniper towers, gun emplacements in interlocking arcs.', qv: 1 },
  { t: 'p', s: 'eden', n: 'The Eden Archive', pr: 200, r: [16, 80, 220, 600, 1000], a: 'ARCV',
    q: 'The drone\'s data and the Eden archive cross-confirm, sir.', qv: 1 },
  { t: 'free', n: 'Neutral Anchorage', a: 'ANCH',
    q: 'Nobody\'s guns, nobody\'s tariffs, nobody\'s flag. It stays that way exactly as long as it is useful to everyone.' },
  { t: 'p', s: 'ven', n: 'Venenum War-Stock', pr: 220, r: [18, 90, 250, 700, 1050], a: 'STOK',
    q: 'Venenum is the Dominion\'s forge — the yards, the foundries, the war-stock of a sector.', qv: 1 },
  { t: 'con', n: 'Contingency', a: 'CON',
    q: 'The plan survives until the galaxy is consulted.' },
  { t: 'p', s: 'ven', n: 'Venenum Yards', pr: 220, r: [18, 90, 250, 700, 1050], a: 'YRDS',
    q: 'The forge seized — seized, not razed.', qv: 1 },
  { t: 'p', s: 'ven', n: 'Venenum Foundries', pr: 240, r: [20, 100, 300, 750, 1100], a: 'FNDR',
    q: 'I want those foundries stamping our hull numbers within a year.', qv: 1 },
  { t: 'f', n: 'Harpa', pr: 200, a: 'HARP',
    q: 'The Harpa fleet resolved out of its own jump at the system\'s far side, right on the mark, and the pincer began to close.', qv: 1 },
  { t: 'p', s: 'com', n: 'Keth', pr: 260, r: [22, 110, 330, 800, 1150], a: 'KETH',
    q: 'The quarantines have held it to three worlds. Keth. Oranthe. Vasa.', qv: 1 },
  { t: 'p', s: 'com', n: 'Oranthe', pr: 260, r: [22, 110, 330, 800, 1150], a: 'ORNT',
    q: 'My cure will go to Keth and Oranthe and Vasa wearing your flag, at whatever price your leaders decide those lives are worth.', qv: 1 },
  { t: 'u', n: 'Anthelion Synthesis', pr: 150, a: 'ANTL',
    q: 'Keth, Oranthe and Vasa remain dependent on the Anthelion synthesis, which is now ours.', qv: 1 },
  { t: 'p', s: 'com', n: 'Vasa', pr: 280, r: [24, 120, 360, 850, 1200], a: 'VASA',
    q: 'Vasa is a trade hub, Commander.', qv: 1 },
  { t: 'goto', n: 'Absorbed', a: 'ABSD',
    q: 'We do not form alliances. Alliance presumes two parties persisting. We absorb. We consume.', qv: 1 },
  { t: 'p', s: 'bas', n: 'The Rezar Marches', pr: 300, r: [26, 130, 390, 900, 1275], a: 'REZR',
    q: 'By spring the buffer will run unbroken from the Rezar marches to the core routes.', qv: 1 },
  { t: 'p', s: 'bas', n: 'Re-dok Station', pr: 300, r: [26, 130, 390, 900, 1275], a: 'RDOK',
    q: 'Six levels of platforms under a single vaulted roof, and the walls were mosaic — ten centuries of Basileian history in ten million pieces of colored stone.', qv: 1 },
  { t: 'col', n: 'The Column', a: 'CLMN',
    q: 'The figure was correct. That was never the part in question.' },
  // CANON. The plaza is real and is where Vale is assassinated, but the book
  // never names it — it is "a plaza on Re-dok". "Vale's Plaza" is the game's
  // coinage and is the author's to overrule. The quoted line below is verbatim.
  { t: 'p', s: 'bas', n: "Vale's Plaza", pr: 320, r: [28, 150, 450, 1000, 1400], a: 'PLAZ',
    q: 'At the plaza\'s center stood the stage, flanked by two towers of Vale\'s smiling face, and an empty podium with its small bouquet of microphones waiting like the future.', qv: 1 },
  { t: 'f', n: "Raven's Claw", pr: 200, a: 'RAVN',
    q: 'A vessel assembled from the corpses of at least nine other vessels.', qv: 1 },
  { t: 'con', n: 'Contingency', a: 'CON',
    q: 'Somewhere a clerk has already decided this, and the clerk is not available.' },
  { t: 'p', s: 'agora', n: 'The Palace', pr: 350, r: [35, 175, 500, 1100, 1500], a: 'PLCE',
    q: 'The council chamber of the Union Palace had been built to make men feel the weight of history, and it worked on everyone except the man it belonged to.', qv: 1 },
  { t: 'tax', n: 'Compact Levy', amt: 100, a: 'LEVY',
    q: 'They will not experience it as coercion. They will experience it as rescue.', qv: 1 },
  { t: 'p', s: 'agora', n: 'Cradle', pr: 400, r: [50, 200, 600, 1400, 2000], a: 'CRDL',
    q: 'The people of Cradle believed they were safe because they were strong.', qv: 1 },
];

export const N = BOARD.length;          // 40
export const GO = 0;
export const JAIL = 10;
export const GOTO = 30;
export const FLEETS = [5, 15, 25, 35];
export const UTILS = [12, 28];
// Monopoly's railroad ladder, by how many you hold.
export const FLEET_RENT = [0, 25, 50, 100, 200];

/* ------------------------------------------------------------------- traffic */
// Long-run share of turns ending on each square, as a percentage.
//
// Verified rather than asserted: test/traffic.test.mjs re-derives this by
// simulating the engine's own movement rules and fails if any square drifts
// more than 0.5pp from the value below. It is a solved figure, not a guess —
// but it is not exact, and nothing in the UI should claim that it is.
//
// Solved WITH doubles: a doubles roll moves again, and a third in a row sends
// you to Detention. Both shape this table, which is why Detention dominates it.
export const TRAFFIC = [
  3.11, 2.15, 1.91, 2.20, 2.37, 2.39, 2.31, 1.15, 2.31, 2.28, 6.19, 2.21, 2.73, 2.25,
  2.53, 3.08, 3.27, 2.38, 2.93, 2.93, 2.96, 2.78, 1.50, 2.80, 2.77, 2.96, 2.76, 2.70,
  2.85, 2.59, 0.00, 2.65, 2.62, 2.34, 2.49, 2.40, 1.14, 2.18, 2.18, 2.65
];

/* --------------------------------------------------------------------- decks */
// Each card is one effect. Movement cards resolve their destination normally.
//
// A movement card must NAME the square it sends you to, and `go` must be that
// square's index. These three were written for the 28-square board and never
// remapped: "commanded to Cradle" sent you to Oranthe, "Advance to Horizon"
// to Varan's Audit House, and the Orion to Oasis Fortress. Nothing failed —
// the card simply lied and the game carried on. The test
// "a movement card names the square it sends you to" now holds this.
export const CONTINGENCY = [
  { x: 'You are commanded to Cradle. The capital wishes to see who it belongs to.', go: 39 },
  { x: 'A new page, and your name at the top of it. Advance to The Ledger Opens.', go: 0 },
  { x: 'Eden holds, or it does not. Advance to Horizon.', go: 16 },
  { x: 'Requisition order. Report to the nearest fleet.', fleet: 1 },
  { x: 'The *Orion* signals for you. Advance to it.', go: 15 },
  { x: 'The Overseer has taken an interest in your accounts. Report to detention.', jail: 1 },
  { x: 'You are three squares further back than your paperwork claims.', back: 3 },
  { x: 'Anthelion synthesis dividend. Collect ₡100.', cash: 100 },
  { x: 'Dominion audit. Varan finds ₡120 in your ledger that should not be there. Forfeit it.', cash: -120 },
  { x: 'Garrison resupply billed to you. Pay ₡25 per garrison held.', perGarrison: 25 },
  { x: 'A world petitions for protection under the Compact. Collect ₡200.', cash: 200 },
  { x: 'The nearest utility falls under emergency requisition. Advance to it.', util: 1 },
  { x: 'An Overseer owes you a favour and is careless enough to put it in writing. Keep it against a future detention.', pardon: 1 },
  { x: 'A forward assessment passes through the system. It does not negotiate, does not tire, and does not stop — and everything it costs to look at it comes out of your ledger. Pay ₡80 to the bank.', cash: -80 },
  { x: 'Salvage rights on a Purifier hulk. Collect ₡180.', cash: 180 },
  { x: 'You are named host of the Compact assembly, and hosts settle the accounts. Pay ₡60 to every other overlord.', each: -60 }
];

export const COLUMN = [
  { x: 'The column is settled in your favour. Collect ₡200.', cash: 200 },
  { x: 'Back to the first page. Advance to The Ledger Opens.', go: 0 },
  { x: 'Your name appears on a list you were not shown. Report to Overseer detention.', jail: 1 },
  { x: 'Tithe rebate from a world that overpaid. Collect ₡120.', cash: 120 },
  { x: 'Hull inspection. Pay ₡80.', cash: -80 },
  { x: 'A debt you had written off is repaid with interest. Collect ₡160.', cash: 160 },
  { x: 'Union pension obligations. Pay ₡110.', cash: -110 },
  { x: 'A clerk who owes you more than they can repay loses your file for a while. Keep it against a future detention.', pardon: 1 },
  { x: 'Freight tonnage under-declared, and nobody asked. Collect ₡140.', cash: 140 },
  { x: 'Medal ceremony on Agora. The metal is free; the reception is not. Pay ₡50.', cash: -50 },
  { x: 'A tithe you had forgotten is called in, and nobody is placed to refuse. Collect ₡60 from every other overlord.', each: 60 },
  { x: 'A cure, and a lever, from one vial. Collect ₡250.', cash: 250 },
  { x: 'Occupation costs on a world that will not settle. Pay ₡130.', cash: -130 },
  { x: 'Second ledger reconciled. Collect ₡100.', cash: 100 },
  { x: 'Citadel maintenance. Pay ₡75 per citadel held.', perCitadel: 75 },
  { x: 'The Corridor is still burning, and burning is not free. Pay ₡100.', cash: -100 }
];

/* ---------------------------------------------------------------- the swarm */
// What the deep array says, and when. `at` is the fraction of the game elapsed.
// Four stages rather than a countdown: the point is that the tone changes while
// the table is still arguing about colour sets, so the end arrives as pressure
// rather than as a number running out. Written to escalate — filed, resolved,
// agreed, and finally not worth reporting because everyone can see it.
export const SWARM_STAGES = [
  { at: 0.25, t: 'The deep array logs a bearing it cannot resolve. It is filed, and the filing is the end of it.' },
  { at: 0.50, t: 'The bearing resolves. Extragalactic, closing, and the count is not small.' },
  { at: 0.75, t: 'Every projection now agrees on the arrival and disagrees only about the hour.' },
  { at: 0.95, t: 'The blips multiply past the deep array\'s patience. Whatever is settled by now is settled.' }
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
  // Monopoly's ladder with a little more float. Measured: at two seats and 48
  // circuits this lifts absorption from 40% of games to 53%, because players
  // stop being too cash-starved by the buying phase to ever build.
  startingCash: 2000,
  passGo: 200,
  garrisonPool: 32,
  citadelPool: 12,
  amendCosts: [500, 700, 900],   // cost of nudging one square, by amendments used
  amendsPerGame: 3,
  garrisonUpkeep: 10,            // per garrison, per turn
  citadelUpkeep: 30,             // per citadel, per turn
  // By number of vassals held. LEFT ALONE ON PURPOSE, and the reason is the
  // most useful thing measured about this game so far.
  //
  // The bill is punishing: an opponent holding a vassal could not cover it out
  // of cash 56% of the time and carried a debt marker 36% of the time, and it
  // falls just as hard on a human. Halving it fixes exactly that -- stranding
  // to 27%, markers to 14%.
  //
  // It also costs the conquest ending, because THIS BILL IS WHAT CREATES
  // VASSALS. Absorption needs somebody bankrupted into somebody else, and the
  // upkeep is a large part of what does the bankrupting. Relieve it and there
  // are fewer arrangements to win by. Measured with sweep.mjs at 60 games a
  // cell, halved against shipped: three seats 70% -> 52% at 96 circuits and
  // 78% -> 57% at 120; four seats 80% -> 65% at 120. The two-seat row, which
  // has no opponent in it, is identical to the digit either way -- which is
  // what says the difference is the change and not the noise.
  //
  // So the drain Sam reported and the ending the game is built around are the
  // same mechanism seen from two sides. Lowering this number is a design
  // decision about which of them matters more, not a fix, and it is his.
  vassalUpkeep: [75, 200, 375, 500],
  debtInterest: 0.10,            // per turn, on a bank debt marker
  // Redemption is 55% of list — half back plus a tenth in interest. Held as a
  // ratio rather than 0.55 because the float form rounds a credit wrong on
  // Cradle (400 * 0.55 === 220.00000000000003).
  mortgageRedeemNumerator: 11,
  mortgageRedeemDenominator: 20,
  // The circuit limit is the swarm arriving, and the count is on screen from the
  // first turn. The array reports at the fractions of the game below; inside
  // this many circuits the counter itself turns.
  swarmWarning: 12,
  // Squares a single contract may carry each way. Three covers every realistic
  // deal — two lesser worlds for the one that closes a set, with cash on top —
  // and keeps the sheet readable on a phone.
  tradeMax: 3,
  // A refusal used to be written to the log and forgotten, so an opponent
  // re-derived the same best target every turn and asked for it again,
  // identically. Measured over 30 full games with a human seat that always
  // refuses: 71 proposals a game, one every circuit, 95% of them an exact
  // repeat, and one contract re-proposed 96 times in a single game.
  // Cash an opponent keeps back before buying a square out of pledge. High
  // enough that redeeming does not simply force the next liquidation — the
  // failure mode here is a pledge/redeem oscillation, not slowness.
  //
  // Swept over 40 games at each of 400/500/600/700, counting redemptions, the
  // squares that were pledged straight back again (the oscillation), and how
  // many of the owner's own turns the median pledge survives:
  //
  //   400  40% redeemed  29% re-pledged  median 11 turns
  //   500  34% redeemed  21% re-pledged  median 14 turns
  //   600  27% redeemed  14% re-pledged  median 18 turns
  //   700  22% redeemed  16% re-pledged  median 21 turns
  //
  // 500 halves the median against the 23 turns measured with no redemption at
  // all, at a fifth of pledges bouncing. Garrisons and citadels built per game
  // are unchanged across the range (8.3–9.7, inside the noise at 40 games), so
  // this is not being paid for out of development.
  redeemReserve: 500,
  // Cash an opponent keeps back while a debt marker stands.
  //
  // repayDebt() had one call site — the human's Repay button — so an opponent
  // that took a marker never cleared it. Measured over 40 games: 49 markers
  // taken, none ever repaid, and a marker locks its holder out of buying,
  // bidding, building, citadels, contracts and redeeming while compounding
  // every turn. The worst reached ₡8,837 on a seat still sitting at the table.
  //
  // Clearing it comes before everything, because everything is what it blocks.
  // How fast is a matter of character: Varan audits, and an outstanding marker
  // is an irregularity he will not leave standing. Spector prices the interest
  // against what else the cash could do and clears it. Vale means it when he
  // says money is only money, and would rather hold enough to buy an address.
  debtKeep: { spector: 100, varan: 0, vale: 200 },
  // A marker at least this large and they will RAISE money to clear it —
  // pledging and selling down the way they would for any other payment they
  // cannot cover — rather than only spending what happens to be lying around.
  //
  // That distinction is the whole fix. Spending loose cash never catches a
  // marker that compounds every turn: measured that way Vale cleared 0 of 16
  // and one of his markers reached ₡21,072, which is not character, it is the
  // same defect wearing a hat. Varan's 1 means any marker at all.
  debtUrgent: { spector: 250, varan: 1, vale: 700 },
  // Cash below which an opponent will consider SELLING a square rather than
  // only ever offering to buy one. seekContract has always returned direction 1,
  // so in 13.7% of opponent turns it was short of cash while holding a square
  // another player needed, and had no way to say so.
  //
  // Vale sells most readily — the provincial ones were never the point. Spector
  // sells when it is short and prices it. Varan barely sells at all.
  sellNeed: { spector: 600, varan: 400, vale: 900 },
  // ...and asks this multiple of what the square is worth to the BUYER, which
  // is the only valuation that matters when you are the one selling.
  // Varan's 2.2 is meant to be refused most of the time. He is not in the
  // business of improving your position, and if he does it will cost you.
  sellPremium: { spector: 1.25, varan: 1.8, vale: 1.0 },
  // How far below its own asking price each will go when the buyer cannot cover
  // it. Varan's 1 means he will not go below it at all — he withdraws instead,
  // which is the only thing that makes his premium mean anything. Capping every
  // ask at what the buyer could afford was measured to erase the difference
  // between the three of them entirely: Varan's 2.2 was discounted away and he
  // closed 39% of his sales, more than Spector.
  sellDiscount: { spector: 0.8, varan: 1, vale: 0.45 },
  sellFloorFraction: 0.5,        // never below half list price, whatever the buyer thinks

  // ---- settling with the Overseer -------------------------------------
  // payFacilityFee was another human-only button: an opponent sat all three
  // attempts unless it rolled doubles or held a favour, and 371 of 924 detained
  // turns it had the fee several times over.
  //
  // Whether walking out is worth ₡150 depends on what a lap is still worth, so
  // the test is how much of the board is still unbought. Early, a lap buys
  // squares; late, a lap is a tour of everyone else's citadels and the cell is
  // the safest address on the board. Each of them draws that line differently:
  // Varan will not sit in an improperly documented facility and pays almost to
  // the end; Vale is perfectly happy to address the crowd from where he is.
  facilityPayUntil: { spector: 0.30, varan: 0.10, vale: 0.55 },
  facilityFeeReserve: 350,       // and not if paying it would empty the purse

  // ---- what a credit is worth when you have none ------------------------
  // Opponents priced squares in LIST money while the game is played in much
  // less than that. Measured over 30 games: 8,000 credits are dealt, the whole
  // buyable board is 5,690, and by circuit 36 the board is entirely owned and
  // the table holds about 1,400 between four -- 15% of the start, where it then
  // sits. So the second half of every game is played on a sixth of the cash the
  // price list was written for.
  //
  // Against that, an opponent wanting a median 3.3x list for one square is not
  // greed, it is a unit mismatch: positionValue is denominated in list prices
  // and the economy is not. Varan holding ~140 credits still asked ~950 for a
  // 180 square, which is the offer Sam reported being refused.
  //
  // So a credit is worth MORE to a player who is short of them. contractValue
  // weighs the cash leg by this, scaled against sellNeed -- the threshold that
  // already says what each of them counts as short. It cuts both ways and that
  // is the point: a broke opponent wants cash more, and also parts with it more
  // reluctantly, which is exactly how being poor works.
  //
  // Varan's 0.6 is the lowest deliberately. seekSale already establishes that
  // he keeps a thin purse on purpose and must not become the softest seller at
  // the table just for being empty -- his sellNeed of 400 is the lowest too, so
  // he reads as short less often for the same money. Vale's 1.2 matches his
  // sellDiscount of 0.45: he is the one who would rather have the money.
  cashHunger: { spector: 1.0, varan: 0.6, vale: 1.2 },

  // ---- letting a vassal go ---------------------------------------------
  // An overlord pays vassalUpkeep every turn and collects a tithe only when
  // somebody lands on the vassal's squares, which is rare -- a vassal is by
  // definition somebody who ran out of money. The arrangement is a price paid
  // for the conquest ending and for the share of their holdings that counts,
  // not an income. So it has to be affordable, and there has to be a way out.
  //
  // Until this existed there was not one: releaseVassal had a single caller,
  // the human button in ui.js. Measured over 40 games before it was wired up,
  // an opponent holding a vassal could not cover that turn's upkeep line 48%
  // of the time against a 19% baseline holding none, and 48 opponents were
  // still holding one when the game ended.
  //
  // The multiple is of the whole upkeep bill, not the vassal's share of it, so
  // garrisons and citadels count toward the squeeze that ends the arrangement.
  // Varan's 0.5 makes him hold on until he is in half again as deep as the
  // others -- he audits, and an instrument he signed is not lightly torn up.
  // Vale's 1.5 lets go early, the same instinct as his sellDiscount of 0.45.
  //
  // A marker outstanding is required as well as the cash test -- see aiRelease.
  // Releasing merely on a thin turn shed the vassals the conquest ending needs
  // and cost 24 points of it. Gated on distress it costs 8 to 15 at the long
  // circuits and clears the compounding markers that were the real complaint:
  // an opponent lord carried one 36% of the time before this and 5% after.
  vassalLetGo: { spector: 1.0, varan: 0.5, vale: 1.5 },

  // ---- amending the manifest -------------------------------------------
  // Also human-only. A nudge of one square costs ₡500 and there are three a
  // game, so this is not a routine dodge — it is worth it for a citadel and
  // almost nothing else. An opponent takes it when the square it is standing on
  // costs this multiple of the fee more than the next one along.
  //
  // Varan's 0.75 is him reaching for paperwork first; Vale's 1.5 is a man who
  // would rather pay the rent than make a fuss about it.
  amendMargin: { spector: 1.0, varan: 0.75, vale: 1.5 },
  amendReserve: 400,             // cash kept back after the fee
  amendDetentionCost: 400,       // what an opponent reckons being filed is worth avoiding
  refusalCooldown: 3,            // circuits before the same ask may return
  refusalCap: 3,                 // refusals of one square before it is dropped for good
  refusalRaise: 1.15,            // and it may only return with an offer this much better
  humanAsksPerCircuit: 1,        // backstop: opponents share one interruption a circuit
  // ---- vassalage and the tithe ------------------------------------------
  // Strength is what a vassal buries against their overlord, and it used to
  // come only from the overlord's cut of rent the VASSAL collected. A vassal is
  // by definition somebody who ran out of money, so almost nobody lands on
  // their squares and there is almost nothing to take a share of: measured over
  // 80 games, strength reached a median of 0 and a maximum of 87 against the
  // 1400 needed, and not one vassal in 128 arrangements ever declared.
  //
  // It now also accrues at the tithe rate every turn the arrangement stands, so
  // the rate is the clock on how long an overlord keeps them.
  //
  // 250 rather than the 550 the arithmetic first suggested, because the
  // arithmetic left out the contests. A vassal who falls again to a different
  // creditor is fought over, and resolving that either wipes their buried
  // strength or halves it — measured, 82 contests across 60 games, roughly one
  // per arrangement. So the clock is reset about as often as it runs, and a
  // threshold set from the raw accrual rate is one a vassal never reaches: at a
  // pinned 55% the median peak was 275 against 550.
  //
  // Swept at 45 games a cell, the share of arrangements ending in a declaration:
  //
  //     base |  10%   25%   40%   55%
  //      150 |  18%   35%   42%   52%
  //      250 |   8%   25%   37%   46%
  //      400 |   3%   18%   26%   39%
  //
  // 250 is the spread worth having: take a tenth and you keep them almost
  // always, take the lot and you lose them about half the time.
  revoltBase: 250,               // strength needed for a first declaration
  revoltStep: 300,               // added per previous declaration
  // And the second lock. Declaring cost 500 against a vassal's median cash of
  // 186 — the most one ever held while sworn was 1012 — so even an armed vassal
  // usually could not afford to move. An OPPONENT also kept back a further 400
  // on top, which alone was the difference between 16% of vassals ever being
  // able to declare and 2%: a buffer larger than the thing it buffered. It is
  // gone, and opponents now face exactly the bar the interface quotes a human.
  revoltCost: 150,
  // ---- carrying on past an ending ---------------------------------------
  // A swarm ending stops at the limit, so playing on needs more circuits — and
  // enough of them to be worth having. The approach opens at 15 circuits out
  // and the score turns at 10, so +12 lands a player at a distance of 12: back
  // inside the invasion they just watched arrive, music already ducked and the
  // sky already red. 20 puts them clear of it with a run-up to spend.
  playOnExtra: 20,
  // A CONQUEST ends with circuits still on the clock — it was the victory
  // condition, not the limit — so carrying on wants the ones that were left,
  // not more on top. This is only the floor for the case where somebody takes
  // the galaxy on the last circuit and there is nothing left to play.
  playOnLeast: 6,
  // The rates an overlord may set, and what each of them picks.
  //
  // The tithe used to be one line — `random(G) < 0.3` and a pick from a shared
  // table — so all three set the same rate. Measured over 60 games they landed
  // at 30.3%, 33.0% and 30.7%: the auditor whose terms are meant to be punitive
  // and the reformer who insists you keep your flag taxed identically.
  //
  // What the rate actually decides is NOT income. Measured, a tithe returns
  // ₡0.3 a turn against ₡108 of upkeep — holding a vassal is a loss, paid for
  // by the conquest victory and by the share of their holdings that counts
  // toward your total. So the rate scales what they are worth to you at the
  // end, and how fast they build toward being free of you.
  titheRates: [10, 25, 40, 55],
  //   varan  the top of the range, and content to be revolted against
  //   vale   the bottom: long quiet arrangements, and you may keep your flag
  //   spector null — he computes it, being the only one who would
  tithePolicy: { varan: 55, vale: 10, spector: null },
  doublesToDetention: 3,         // three doubles in a row and you are filed
  facilityAttempts: 3,           // doubles, or pay the fee, or three attempts
  facilityFee: 150               // an Overseer is an official, and officials have a price
};
