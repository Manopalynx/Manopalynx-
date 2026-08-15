// GRANDIOSE — THE LEDGER: rules engine.
//
// No DOM, no timers, no Math.random. Every game is a pure function of its seed
// and the actions applied to it, which is the only reason the arithmetic in
// here can be tested at all — and testing the arithmetic is the point. The
// numbers on this board never crash when they are wrong. They just quietly
// report the wrong thing for the whole game.
//
// The engine never animates and never waits. Movement returns the path it took
// and lets the UI walk it; anything needing a decision parks the game in a
// phase and returns.

import {
  SETS, BOARD, N, GO, JAIL, GOTO, FLEETS, UTILS, FLEET_RENT, TRAFFIC, SWARM_STAGES,
  CONTINGENCY, COLUMN, PERSONAS, LEADER_LINES, RULES
} from './data.js';

/* ============================================================ random */
// mulberry32, with its state held ON the game rather than in a closure.
// That is not a style choice: a closure cannot be written to localStorage, and
// the game has to survive the phone locking mid-turn. State is a plain number,
// so the whole game serialises with JSON.stringify and resumes exactly.
export function random(G) {
  G.rngState = (G.rngState + 0x6D2B79F5) >>> 0;
  let t = Math.imul(G.rngState ^ (G.rngState >>> 15), 1 | G.rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (G, arr) => arr[Math.floor(random(G) * arr.length)];
function shuffled(G, n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random(G) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================ setup */
export function createGame({ seats, seed = 1, circuits = 72 } = {}) {
  const G = {
    seed,
    rngState: seed >>> 0,
    circuits,
    players: [],
    cur: 0,
    circuit: 1,
    turn: 0,
    phase: 'roll',
    // Refused contracts, so an opponent learns from being told no. See RULES
    // for the measurements that made this necessary.
    refusals: [],
    humanAsked: -1,               // circuit an opponent last interrupted a human
    dice: [0, 0],
    garrisonPool: RULES.garrisonPool,
    citadelPool: RULES.citadelPool,
    log: [],
    over: false,
    winner: null,
    endReason: null,
    auction: null,
    contest: null,
    pendingCard: null,
    settlement: null,   // a bill parked while a human decides how to raise it
    swarmMark: 0,       // how many deep-array reports have been made
    swarmFrom: 1,       // and the circuit they are measured from — see extendGame
    doublesRun: 0,      // consecutive doubles this turn
    rollAgain: false    // a doubles roll buys another before the turn settles
  };
  seats.forEach((s, i) => G.players.push({
    i,
    name: s.name,
    kind: s.kind,                  // 'human' | 'ai'
    persona: s.persona || null,
    cash: RULES.startingCash,
    pos: 0,
    inFacility: false,
    attempts: 0,
    pardons: 0,                    // Overseer favours held against a future detention
    holdings: [],                  // {sq, garrisons, citadel, mortgaged}
    amends: RULES.amendsPerGame,
    lord: null,
    vassals: [],
    strength: 0,                   // the second ledger
    declarations: 0,
    tithe: 25,
    debt: 0
  }));
  // Decks are dealt from a shuffled order and reshuffled when exhausted, so a
  // deck cannot be counted after one pass the way the original could.
  G.decks = {
    con: { order: shuffled(G, CONTINGENCY.length), at: 0 },
    col: { order: shuffled(G, COLUMN.length), at: 0 }
  };
  return G;
}

/* ============================================================ accessors */
export const current = G => G.players[G.cur];
export const square = i => BOARD[i];
export const ownerOf = (G, i) => G.players.find(p => p.holdings.some(h => h.sq === i)) || null;
export const holding = (p, i) => p.holdings.find(h => h.sq === i) || null;

export function ownsSet(G, p, key) {
  return SETS[key].sq.every(i => {
    const o = ownerOf(G, i);
    return o && o.i === p.i;
  });
}
export const countType = (p, t) => p.holdings.filter(h => BOARD[h.sq].t === t).length;
export const garrisonsOf = p => p.holdings.reduce((s, h) => s + (h.citadel ? 0 : h.garrisons), 0);
export const citadelsOf = p => p.holdings.reduce((s, h) => s + (h.citadel ? 1 : 0), 0);

/* ============================================================ valuation */
// Holdings only — no vassal tribute. Used as the base of tribute itself, so it
// must not recurse.
export function holdingsValue(p) {
  let v = p.cash;
  for (const h of p.holdings) {
    const b = BOARD[h.sq];
    // A square with no price cannot be bought — buy() refuses one and an
    // auction never opens on one — so a holding on a tax square or a corner
    // means the save is damaged, not that the rules changed. Skipped rather
    // than added: `undefined` here makes the whole total NaN, and this total is
    // what the final sheet prints and what standings SORTS THE WINNER BY. A
    // NaN comparison is false both ways round, so the order becomes whatever
    // the sort happened to do, and the game names its champion out of a hat
    // while every figure on screen reads ₡NaN.
    if (!b || !b.pr) continue;
    v += h.mortgaged ? Math.floor(b.pr / 2) : b.pr;
    if (b.s) v += (h.citadel ? 5 : h.garrisons) * SETS[b.s].gc;
  }
  return v;
}

// Full net worth: holdings, less debt, plus this player's share of each vassal.
// One level deep by construction — a vassal's own vassals are counted inside
// their holdings value, not compounded again.
export function netWorth(G, p) {
  let v = holdingsValue(p) - p.debt;
  for (const vi of p.vassals) {
    v += Math.floor(holdingsValue(G.players[vi]) * p.tithe / 100);
  }
  return v;
}

export function upkeep(p) {
  let u = garrisonsOf(p) * RULES.garrisonUpkeep + citadelsOf(p) * RULES.citadelUpkeep;
  if (p.vassals.length) {
    u += RULES.vassalUpkeep[Math.min(p.vassals.length - 1, RULES.vassalUpkeep.length - 1)];
  }
  return u;
}

export function rentOf(G, i, roll = 7) {
  const b = BOARD[i];
  const o = ownerOf(G, i);
  if (!o) return 0;
  const h = holding(o, i);
  if (h.mortgaged) return 0;
  if (b.t === 'f') return FLEET_RENT[countType(o, 'f')] || 0;
  if (b.t === 'u') return (countType(o, 'u') === UTILS.length ? 10 : 4) * roll;
  if (h.citadel) return b.r[4];
  if (h.garrisons > 0) return b.r[h.garrisons];
  return ownsSet(G, o, b.s) ? b.r[0] * 2 : b.r[0];
}

// Opponent turns to recover a full set built to three garrisons. Traffic is a
// per-turn landing chance for ONE opponent, so this is per-opponent turns.
export function paybackTurns(key, traffic) {
  const s = SETS[key];
  const cost = s.sq.reduce((a, i) => a + BOARD[i].pr, 0) + s.gc * 3 * s.sq.length;
  const income = s.sq.reduce((a, i) => a + traffic[i] / 100 * BOARD[i].r[3], 0);
  return Math.round(cost / income);
}

export const revoltThreshold = p => RULES.revoltBase + RULES.revoltStep * p.declarations;

// Solved once from the board. Opponents reason about a set's payback RELATIVE
// to the rest of the board rather than against a fixed constant, because a
// constant tuned for one board silently stops meaning anything on the next one
// — which is exactly what happened when this went from 28 squares to 40.
const PAYBACK = Object.fromEntries(
  Object.keys(SETS).map(k => [k, paybackTurns(k, TRAFFIC)]));
const PAYBACK_BEST = Math.min(...Object.values(PAYBACK));
const PAYBACK_WORST = Math.max(...Object.values(PAYBACK));

/* ============================================================ log */
function note(G, text) { G.log.unshift({ kind: 'note', text, circuit: G.circuit }); trim(G); }
function leader(G, force = false) {
  if (!force && random(G) >= 0.34) return;
  G.log.unshift({ kind: 'leader', text: pick(G, LEADER_LINES), circuit: G.circuit });
  trim(G);
}
function leaderSays(G, text) { G.log.unshift({ kind: 'leader', text, circuit: G.circuit }); trim(G); }
function persona(G, p, key) {
  const a = PERSONAS[p.persona];
  if (!a || !a[key]) return;
  G.log.unshift({ kind: 'voice', text: pick(G, a[key]), who: p.i, circuit: G.circuit });
  trim(G);
}
const trim = G => { if (G.log.length > 120) G.log.pop(); };

/* ============================================================ money */
// Returns true if settled in full. A shortfall against another PLAYER becomes
// vassalage; a shortfall against the BANK becomes a debt marker. Nobody is
// ever removed from the table — that is the whole design.
export function pay(G, from, to, amount) {
  if (amount <= 0) return true;
  // The FULL amount, not the shortfall. liquidate() raises until cash reaches
  // the figure it is given, so passing the gap made it stop one gap short: a
  // player owing 500 while holding 100 raised to 400, was still short, and was
  // bankrupted with sellable assets still on the board.
  if (from.cash < amount) liquidate(G, from, amount);
  if (from.cash >= amount) {
    from.cash -= amount;
    if (to) to.cash += amount;
    return true;
  }
  const short = amount - from.cash;
  if (to) to.cash += from.cash;
  from.cash = 0;
  if (to) vassalise(G, from, to);
  else {
    from.debt += short;
    note(G, `${from.name} cannot settle with the bank. Restructuring — debt marker ${money(short)} at ${Math.round(RULES.debtInterest * 100)}% per turn.`);
    leaderSays(G, 'Debt is not a wound. It is an entry, and entries can be settled. Slowly.');
  }
  return false;
}

// Raise cash, worst asset first.
//
// This used to break CITADELS first — your single biggest rent earner — before
// touching a worthless brown property you would never miss. No player would
// ever do that. The order now matches what a rational holder does: mortgage
// dead holdings (reversible, and they earn least), then sell garrisons from the
// set that pays back slowest, and treat a citadel as the last thing to go.
export function liquidate(G, p, need) {
  const before = p.cash;
  let citadels = 0, garrisons = 0;
  const mortgaged = [];
  let guard = 0;

  const worstFirst = (a, b) => {
    const pa = PAYBACK[BOARD[a.sq].s] ?? 0, pb = PAYBACK[BOARD[b.sq].s] ?? 0;
    return pb - pa;                       // higher payback = slower = sell first
  };

  while (p.cash < need && guard++ < 200) {
    // 1. Mortgage what is not built on, cheapest first. Reversible, and an
    //    unbuilt holding is earning bare rent at best.
    const m = p.holdings
      .filter(h => !h.mortgaged && !h.garrisons && !h.citadel)
      .sort((a, b) => BOARD[a.sq].pr - BOARD[b.sq].pr)[0];
    if (m) { m.mortgaged = 1; mortgaged.push(BOARD[m.sq].n); p.cash += Math.floor(BOARD[m.sq].pr / 2); continue; }

    // 2. Sell garrisons, from the slowest-paying set first.
    const g = p.holdings.filter(h => h.garrisons > 0).sort(worstFirst)[0];
    if (g) { g.garrisons--; G.garrisonPool++; garrisons++; p.cash += Math.floor(SETS[BOARD[g.sq].s].gc / 2); continue; }

    // 3. A citadel, and only because there is nothing else left.
    const cit = p.holdings.filter(h => h.citadel).sort(worstFirst)[0];
    if (cit) {
      const gc = SETS[BOARD[cit.sq].s].gc;
      citadels++;
      if (G.garrisonPool < 3) { cit.citadel = 0; cit.garrisons = 0; G.citadelPool++; p.cash += Math.floor(gc * 5 / 2); continue; }
      cit.citadel = 0; cit.garrisons = 3; G.citadelPool++; G.garrisonPool -= 3;
      p.cash += Math.floor(gc * 5 / 2);
      continue;
    }
    break;
  }

  // Say what was sold. This used to happen in complete silence: a player could
  // have their citadels broken and half their board mortgaged to cover a rent,
  // and the ledger would not carry a single line about it. Losing your position
  // is exactly the thing a ledger should record.
  const parts = [];
  if (citadels) parts.push(`breaks ${citadels} citadel${citadels === 1 ? '' : 's'}`);
  if (garrisons) parts.push(`sells ${garrisons} garrison${garrisons === 1 ? '' : 's'}`);
  if (mortgaged.length) {
    parts.push(mortgaged.length > 2
      ? `mortgages ${mortgaged.length} holdings`
      : `mortgages ${mortgaged.join(' and ')}`);
  }
  if (parts.length) {
    note(G, `${p.name} raises ${money(p.cash - before)} to settle — ${parts.join(', ')}.`);
    if (mortgaged.length >= 3 || citadels) leader(G);
  }
}

export function payRent(G, from, to, amount) {
  let cut = 0, lord = null;
  if (to.lord !== null) {
    lord = G.players[to.lord];
    cut = Math.floor(amount * lord.tithe / 100);
  }
  if (lord && lord.i === from.i) {
    note(G, `${from.name} pays ${money(amount)} to ${to.name}, of which ${money(cut)} returns as tithe — net ${money(amount - cut)}. A vassal cannot fully charge its overlord.`);
  } else {
    note(G, `${from.name} pays ${money(amount)} to ${to.name}${cut ? ` — ${money(cut)} tithed onward to ${lord.name}` : ''}.`);
  }
  const settled = pay(G, from, to, amount);
  if (settled && cut) {
    to.cash -= cut;
    lord.cash += cut;
    to.strength += cut;      // every credit tithed is a credit counted
  }
  if (from.kind === 'ai') persona(G, from, 'rent');
  leader(G);
  return settled;
}

export const money = v =>
  (v < 0 ? '-₡' : '₡') + Math.abs(Math.round(v)).toLocaleString('en-GB');

// The short name a player goes by on screen. Opponents go by the name you would
// use at the table, which is the LAST word -- "Varan", not "High Commander";
// humans keep their first name.
//
// One definition because there were three, and two of them took the opposite
// end of the same string. The board called him Vale and the trade sheet called
// him Adran, off one persona named 'Adran Vale', and the trade sheet called
// Varan "High". The two "vassal · X" labels -- one here, one in ui.js -- were
// separately written and separately wrong. Anything rendering a player's name
// short must call this; nothing may split the string itself.
export const displayName = p =>
  p.kind === 'ai' ? p.name.split(' ').pop() : p.name.split(' ')[0];

// Everything a player could raise by pledging and selling down, without any of
// it being decided for them.
export function raisableValue(G, p) {
  let v = 0;
  for (const h of p.holdings) {
    const b = BOARD[h.sq];
    const gc = b.s ? SETS[b.s].gc : 0;
    if (h.citadel) v += Math.floor(gc * 5 / 2);
    else v += h.garrisons * Math.floor(gc / 2);
    if (!h.mortgaged) v += pledgeValue(h.sq);
  }
  return v;
}

/* ============================================================ settlement */
// A bill a human cannot cover from cash parks here instead of the engine
// quietly stripping their board for them. They choose what goes — or press
// Auto and get the same order the opponents use.
//
// Only rent, tax and upkeep park. Card penalties are small and not worth
// interrupting a turn for.
export function parkForSettlement(G, from, to, amount, then) {
  if (from.kind !== 'human') return false;
  if (from.cash >= amount) return false;
  if (raisableValue(G, from) <= 0) return false;      // nothing left to decide
  G.settlement = { player: from.i, to: to === null ? null : to.i, owed: amount, then };
  G.phase = 'settle';
  return true;
}

// The Auto button, and what every opponent does: pledge dead holdings, then
// garrisons from the slowest-paying set, and a citadel only as a last resort.
export function autoSettle(G) {
  const st = G.settlement;
  if (!st) return false;
  liquidate(G, G.players[st.player], st.owed);
  return true;
}

// Perform the parked payment with whatever the player managed to raise. If it
// still is not enough, the usual consequence follows — a debt marker to the
// bank, or an oath to a player.
export function settleNow(G) {
  const st = G.settlement;
  if (!st) return false;
  const from = G.players[st.player];
  const to = st.to === null ? null : G.players[st.to];
  G.settlement = null;

  if (st.then === 'rent') {
    payRent(G, from, to, st.owed);
    if (G.phase !== 'contest' && !G.over) G.phase = 'end';
  } else if (st.then === 'tax') {
    pay(G, from, null, st.owed);
    note(G, `${from.name} settles ${money(st.owed)}.`);
    if (G.phase !== 'contest' && !G.over) G.phase = 'end';
  } else if (st.then === 'upkeep') {
    pay(G, from, null, st.owed);
    note(G, `${from.name} pays ${money(st.owed)} in upkeep.`);
    finishTurn(G);
  }
  return true;
}

/* ============================================================ vassalage */
function vassalise(G, p, to) {
  const previous = p.lord;
  if (previous !== null && previous !== to.i) {
    openContest(G, p, G.players[previous], to);
    return;
  }
  if (previous !== null) return;            // already sworn to this creditor
  bind(G, p, to);
  p.strength = 0;
  note(G, `${p.name} cannot settle the column and enters vassalage under ${to.name}.`);
  leaderSays(G, `A price was reached. ${p.name} keeps a flag and loses the arithmetic behind it. I have signed such an instrument myself.`);
  if (to.kind === 'ai') persona(G, to, 'vassal');
  if (p.kind === 'ai') persona(G, p, 'fell');
  checkVictory(G);
}

function bind(G, p, to) {
  // If the creditor is anywhere beneath the debtor in the chain of oaths,
  // binding p to it would close a loop — A sworn to B sworn to C sworn to A —
  // and every walk of the chain after that would never terminate.
  //
  // The direct case (your own vassal bankrupts you) inverts. So does the
  // indirect one: whichever player in that chain is sworn directly to p throws
  // p off, and only then can p swear to its creditor.
  let at = to, guard = 0;
  while (at.lord !== null && guard++ < G.players.length + 1) {
    if (at.lord === p.i) {
      p.vassals = p.vassals.filter(x => x !== at.i);
      at.lord = null;
      note(G, `The roles invert. ${at.name} throws off ${p.name}.`);
      break;
    }
    at = G.players[at.lord];
  }
  p.lord = to.i;
  to.vassals.push(p.i);
}

export function claimValue(bidder, vassal, isIncumbent) {
  let v = holdingsValue(vassal) * (bidder.tithe / 100) * 2.2;
  if (bidder.persona === 'varan') v *= isIncumbent ? 1.5 : 1.35;
  if (bidder.persona === 'vale') v *= 0.8;
  if (isIncumbent) v *= 1.2;
  return Math.max(0, Math.round(Math.min(v, bidder.cash * 0.55)));
}

function openContest(G, vassal, incumbent, claimant) {
  G.phase = 'contest';
  G.contest = {
    vassal: vassal.i, incumbent: incumbent.i, claimant: claimant.i,
    bids: {}, queue: [], at: 0
  };
  for (const x of [incumbent, claimant]) {
    if (x.kind === 'ai') G.contest.bids[x.i] = claimValue(x, vassal, x.i === incumbent.i);
    else G.contest.queue.push(x.i);
  }
  note(G, `${vassal.name} falls, but is already sworn to ${incumbent.name}. ${claimant.name} presses a competing claim.`);
  leaderSays(G, 'Two creditors, one debtor, and only one column it can post to. This is the oldest argument there is.');
  if (!G.contest.queue.length) resolveContest(G);
}

export function submitClaim(G, playerIndex, amount) {
  const c = G.contest;
  if (!c || c.queue[c.at] !== playerIndex) return false;
  c.bids[playerIndex] = clampBid(G.players[playerIndex], amount);
  c.at++;
  if (c.at >= c.queue.length) resolveContest(G);
  return true;
}

function resolveContest(G) {
  const c = G.contest;
  const v = G.players[c.vassal], a = G.players[c.incumbent], b = G.players[c.claimant];
  const bidA = c.bids[a.i] || 0, bidB = c.bids[b.i] || 0;
  const winner = bidB > bidA ? b : a;               // a tie holds for the incumbent
  winner.cash -= c.bids[winner.i] || 0;
  c.moved = winner.i === b.i;
  if (c.moved) {
    a.vassals = a.vassals.filter(x => x !== v.i);
    v.lord = null;
    bind(G, v, b);
    v.strength = 0;
  } else {
    v.strength = Math.floor(v.strength * 0.5);
  }
  c.resolved = true;
  note(G, `${winner.name} takes the claim on ${v.name} for ${money(c.bids[winner.i] || 0)}.`);
  checkVictory(G);
}

export function closeContest(G) {
  G.contest = null;
  if (!G.over) G.phase = 'end';
}

// Holding people costs upkeep every turn, and until now there was no way to
// stop paying it. An overlord may let a vassal go whenever they like: the
// vassal walks free with whatever they had buried, and the overhead ends.
export function releaseVassal(G, lord, vassalIndex) {
  if (!lord.vassals.includes(vassalIndex)) return false;
  const v = G.players[vassalIndex];
  lord.vassals = lord.vassals.filter(x => x !== vassalIndex);
  v.lord = null;
  v.strength = 0;                 // there is nothing left to bury it against
  note(G, `${lord.name} releases ${v.name}. The arrangement ends, and the upkeep with it.`);
  leaderSays(G, 'An instrument torn up is still an instrument. Somebody kept the copy.');
  checkVictory(G);
  return true;
}

// The one way the rate changes, for anybody.
//
// An opponent used to assign p.tithe directly, which skipped the line below —
// so a human could raise their own tithe and have it entered in the ledger,
// while Varan swung from 10% to 55% in silence. A vassal could look the current
// figure up on their own sheet but was never told it had moved, and the rate is
// the clock on their freedom.
export function setTithe(G, p, rate) {
  const r = RULES.titheRates.includes(rate) ? rate : RULES.titheRates[0];
  if (p.tithe === r) return false;
  p.tithe = r;
  note(G, `${p.name} sets the tithe at ${r}%.`);
  return true;
}

export function declareIndependence(G, p) {
  if (p.lord === null || p.strength < revoltThreshold(p) || p.cash < RULES.revoltCost) return false;
  const lord = G.players[p.lord];
  p.cash -= RULES.revoltCost;
  lord.vassals = lord.vassals.filter(x => x !== p.i);
  p.lord = null;
  p.strength = 0;
  p.declarations++;
  note(G, `${p.name} declares. The arrangement with ${lord.name} is ended.`);
  leaderSays(G, 'They kept a second ledger. Of course they did. I taught the galaxy how.');
  return true;
}

function checkVictory(G) {
  const free = G.players.filter(p => p.lord === null);
  if (free.length === 1 && G.players.length > 1) {
    G.over = true;
    G.winner = free[0].i;
    G.endReason = 'conquest';
    G.phase = 'over';
    leaderSays(G, `Every column now posts to one page. ${free[0].name} holds the galaxy, and the ledger is closed.`);
  }
}

/* ============================================================ movement */
// Returns the squares stepped through, so the UI can animate a walk the engine
// has already finished. Passing (or landing on) Go pays, going backwards never does.
function advance(G, p, steps, { backwards = false, award = true } = {}) {
  const path = [];
  for (let k = 0; k < steps; k++) {
    p.pos = (((p.pos + (backwards ? -1 : 1)) % N) + N) % N;
    path.push(p.pos);
    if (!backwards && award && p.pos === GO) {
      p.cash += RULES.passGo;
      note(G, `${p.name} passes the ledger opening. +${money(RULES.passGo)}.`);
    }
  }
  return path;
}

function forwardDistanceTo(from, targets) {
  for (let k = 1; k <= N; k++) if (targets.includes((from + k) % N)) return k;
  return 0;
}

function toFacility(G, p) {
  G.rollAgain = false;              // arriving here ends your turn, doubles or not
  G.doublesRun = 0;
  p.pos = JAIL;
  p.inFacility = true;
  p.attempts = 0;
  note(G, `${p.name} is taken to the Holding Facility.`);
  if (p.kind === 'ai') persona(G, p, 'jail');
}

/* ============================================================ turn flow */
// What is about to happen on the square the current player is standing on,
// BEFORE they commit to it. "Resolve" told them nothing until it was already
// done. Structured rather than phrased, so the wording lives in the interface
// and the arithmetic is testable here.
export function previewAt(G, p, sq, roll = G.dice[0] + G.dice[1]) {
  const b = BOARD[sq];
  const at = { square: sq, name: b.n };
  if (b.t === 'goto') return { ...at, kind: 'detention' };
  if (b.t === 'tax') return { ...at, kind: 'tax', amount: b.amt };
  if (b.t === 'con' || b.t === 'col') return { ...at, kind: 'card' };
  if (b.t === 'free' || b.t === 'go' || b.t === 'jail') return { ...at, kind: 'nothing' };

  const owner = ownerOf(G, sq);
  if (!owner) return { ...at, kind: 'unowned', amount: b.pr };
  if (owner.i === p.i) return { ...at, kind: 'own' };
  const amount = rentOf(G, sq, roll);
  if (amount === 0) return { ...at, kind: 'pledged' };
  return { ...at, kind: 'rent', amount, to: owner.i };
}

export const landingPreview = G => previewAt(G, current(G), current(G).pos);

// What a drawn card is about to do, before it is entered. The flavour text is
// written to be read, not to be precise — "Varan finds ₡120 that should not
// have been there" does not say who ends up holding it. This does.
//
// A card that moves you also resolves the square it drops you on, with no stop
// in between, so the arrival is part of the effect and is reported with it.
export function cardEffect(G, card, who = current(G)) {
  const e = {
    cash: card.cash ?? null,
    per: null,
    each: null,
    pardon: card.pardon || null,
    detention: !!card.jail,
    to: null, name: null,
    passesStart: false, award: RULES.passGo,
    then: null
  };
  if (card.each) {
    const others = G.players.length - 1;
    e.each = { rate: Math.abs(card.each), others, total: Math.abs(card.each) * others,
               incoming: card.each > 0 };
  }
  if (card.perGarrison) {
    const n = garrisonsOf(who);
    e.per = { of: 'garrison', rate: card.perGarrison, count: n, total: n * card.perGarrison };
  }
  if (card.perCitadel) {
    const n = citadelsOf(who);
    e.per = { of: 'citadel', rate: card.perCitadel, count: n, total: n * card.perCitadel };
  }
  // Detention is a move, but never a lap — you are taken, not sent round.
  if (card.jail) { e.to = JAIL; e.name = BOARD[JAIL].n; return e; }

  let award = true;
  if (card.go !== undefined) e.to = card.go;
  else if (card.back) { e.to = (((who.pos - card.back) % N) + N) % N; award = false; }
  else if (card.fleet) e.to = (who.pos + forwardDistanceTo(who.pos, FLEETS)) % N;
  else if (card.util) e.to = (who.pos + forwardDistanceTo(who.pos, UTILS)) % N;
  if (e.to === null) return e;

  e.name = BOARD[e.to].n;
  if (award) {
    const steps = (((e.to - who.pos) % N) + N) % N;
    for (let k = 1; k <= steps; k++) if ((who.pos + k) % N === GO) e.passesStart = true;
  }
  e.then = previewAt(G, who, e.to);
  return e;
}

export function roll(G, d1, d2) {
  if (G.phase !== 'roll' || G.over) return null;
  const p = current(G);
  // An opponent holding a favour spends it rather than sitting there, and
  // settles with the Overseer if it would rather be out than not. A human is
  // offered both buttons instead, and may prefer to keep the favour or the
  // cell. Both here, before the dice, which is exactly where the human's own
  // two buttons sit.
  if (p.inFacility && p.kind === 'ai') {
    if (p.pardons > 0) usePardon(G, p);
    else aiPayFacilityFee(G, p);
  }
  const a = d1 ?? 1 + Math.floor(random(G) * 6);
  const b = d2 ?? 1 + Math.floor(random(G) * 6);
  G.dice = [a, b];
  const total = a + b, doubles = a === b;
  const wasDetained = p.inFacility;

  if (p.inFacility) {
    if (doubles) {
      p.inFacility = false; p.attempts = 0;
      note(G, `${p.name} walks out on doubles.`);
    } else {
      p.attempts++;
      if (p.attempts >= RULES.facilityAttempts) {
        // A favour held is spent here rather than wasted. Charging the fee to
        // somebody holding a free way out would be a trap, not a decision.
        if (p.pardons > 0) {
          p.attempts = 0;
          usePardon(G, p);
        } else {
          p.inFacility = false; p.attempts = 0;
          pay(G, p, null, RULES.facilityFee);
          note(G, `${p.name} pays ${money(RULES.facilityFee)} and is released.`);
        }
      } else {
        note(G, `${p.name} remains in the Holding Facility. Attempt ${p.attempts} of ${RULES.facilityAttempts}.`);
        G.phase = 'end';
        return { path: [], doubles, total, held: true };
      }
    }
  }
  // Doubles roll again — and a third in a row is a pattern an Overseer notices.
  if (!wasDetained && doubles) {
    G.doublesRun++;
    if (G.doublesRun >= RULES.doublesToDetention) {
      G.doublesRun = 0;
      G.rollAgain = false;
      note(G, `${p.name} rolls a third doubles. That is a pattern, and patterns get filed.`);
      toFacility(G, p);
      G.phase = 'end';
      return { path: [], doubles, total, held: false, caught: true };
    }
    G.rollAgain = true;
  } else {
    G.doublesRun = 0;
    G.rollAgain = false;
  }

  const path = advance(G, p, total);
  G.phase = 'landed';
  return { path, doubles, total, held: false };
}

// Settle with the Overseer and walk out before rolling. The alternative was
// three turns with no decision in them, which is dead air in a game this short.
// An Overseer's favour, spent. Free, and it does not end the turn — you walk
// out and roll as normal, exactly as if you had settled the fee.
export function usePardon(G, p = current(G)) {
  if (!p || !p.inFacility || p.pardons < 1) return false;
  p.pardons--;
  p.inFacility = false;
  p.attempts = 0;
  note(G, `${p.name} produces an Overseer's favour and walks out. ${p.pardons} left.`);
  leader(G);
  return true;
}

export function payFacilityFee(G) {
  const p = current(G);
  if (G.phase !== 'roll' || !p.inFacility || p.cash < RULES.facilityFee) return false;
  pay(G, p, null, RULES.facilityFee);
  p.inFacility = false;
  p.attempts = 0;
  note(G, `${p.name} settles with the Overseer for ${money(RULES.facilityFee)} and walks out.`);
  leader(G);
  return true;
}

export const amendCost = p => RULES.amendCosts[RULES.amendsPerGame - p.amends] ?? RULES.amendCosts.at(-1);

export function amendManifest(G) {
  const p = current(G);
  if (G.phase !== 'landed' || p.amends <= 0) return null;
  const cost = amendCost(p);
  if (p.cash < cost) return null;
  p.cash -= cost;
  p.amends--;
  const path = advance(G, p, 1);
  note(G, `${p.name} amends the manifest for ${money(cost)} — now on ${BOARD[p.pos].n}.`);
  leader(G);
  return { path };
}

// Resolve whatever the current player is standing on. Chains through cards and
// the moves they cause, and stops at any phase that needs a decision.
export function resolveLanding(G) {
  const p = current(G);
  let guard = 0;
  while (guard++ < 12) {
    const b = BOARD[p.pos];
    if (b.t === 'goto') { toFacility(G, p); G.phase = 'end'; return; }
    if (b.t === 'tax') {
      if (parkForSettlement(G, p, null, b.amt, 'tax')) return;
      pay(G, p, null, b.amt);
      note(G, `${p.name} pays the ${b.n} — ${money(b.amt)}.`);
      G.phase = G.phase === 'contest' ? 'contest' : 'end';
      return;
    }
    if (b.t === 'con' || b.t === 'col') {
      const card = drawCard(G, b.t === 'con');
      G.pendingCard = { card, isContingency: b.t === 'con' };
      G.phase = 'card';
      return;                                  // UI acknowledges, then applyCard
    }
    if (b.t === 'free' || b.t === 'go' || b.t === 'jail') { G.phase = 'end'; return; }

    const owner = ownerOf(G, p.pos);
    if (!owner) { G.phase = 'offer'; return; }
    if (owner.i === p.i) { G.phase = 'end'; return; }
    const rent = rentOf(G, p.pos, G.dice[0] + G.dice[1]);
    if (rent === 0) { note(G, `${BOARD[p.pos].n} is pledged. Nothing due.`); G.phase = 'end'; return; }
    if (parkForSettlement(G, p, owner, rent, 'rent')) return;
    payRent(G, p, owner, rent);
    if (G.phase !== 'contest' && !G.over) G.phase = 'end';
    return;
  }
  G.phase = 'end';
}

function drawCard(G, isContingency) {
  const deck = isContingency ? CONTINGENCY : COLUMN;
  const d = isContingency ? G.decks.con : G.decks.col;
  if (d.at >= d.order.length) { d.order = shuffled(G, deck.length); d.at = 0; }
  return deck[d.order[d.at++]];
}

export function applyCard(G) {
  const pending = G.pendingCard;
  if (!pending) return null;
  const c = pending.card;
  const p = current(G);
  G.pendingCard = null;
  note(G, `${p.name} — ${c.x.replace(/\*/g, '')}`);

  if (c.cash) { if (c.cash > 0) p.cash += c.cash; else pay(G, p, null, -c.cash); }
  if (c.perGarrison) pay(G, p, null, garrisonsOf(p) * c.perGarrison);
  if (c.perCitadel) pay(G, p, null, citadelsOf(p) * c.perCitadel);
  if (c.pardon) {
    p.pardons += c.pardon;
    note(G, `${p.name} holds ${p.pardons} Overseer favour${p.pardons === 1 ? '' : 's'}.`);
  }
  // The only cards that move money between players rather than to the bank.
  // Paid one at a time, because any one of them can bankrupt somebody and that
  // has to resolve before the next.
  if (c.each) {
    const amount = Math.abs(c.each);
    for (const q of G.players) {
      if (q.i === p.i) continue;
      if (c.each > 0) pay(G, q, p, amount); else pay(G, p, q, amount);
      if (G.phase === 'contest' || G.over) break;
    }
  }
  if (G.phase === 'contest' || G.over) return { path: [] };

  if (c.jail) { toFacility(G, p); G.phase = 'end'; return { path: [] }; }
  let path = [];
  if (c.go !== undefined) path = advance(G, p, (((c.go - p.pos) % N) + N) % N);
  else if (c.back) path = advance(G, p, c.back, { backwards: true, award: false });
  else if (c.fleet) path = advance(G, p, forwardDistanceTo(p.pos, FLEETS));
  else if (c.util) path = advance(G, p, forwardDistanceTo(p.pos, UTILS));
  else { G.phase = 'end'; return { path: [] }; }

  resolveLanding(G);
  return { path };
}

export function endTurn(G) {
  if (G.over) return;
  const p = current(G);
  // A doubles roll buys another roll. Upkeep is charged once per turn, not per
  // roll, so the turn is not settled until the doubles run ends.
  if (G.rollAgain && !p.inFacility) {
    G.rollAgain = false;
    G.phase = 'roll';
    G.dice = [0, 0];
    return;
  }
  G.rollAgain = false;
  G.doublesRun = 0;
  const u = upkeep(p);
  if (u > 0) {
    if (parkForSettlement(G, p, null, u, 'upkeep')) return;
    pay(G, p, null, u);
    note(G, `${p.name} pays ${money(u)} in upkeep.`);
  }
  finishTurn(G);
}

// Everything after upkeep is settled: interest, then the next player.
function finishTurn(G) {
  const p = current(G);
  // Every turn under the arrangement is a turn counted.
  //
  // Strength used to come only from the overlord's cut of rent the VASSAL
  // collected — and a vassal is by definition somebody who ran out of money, so
  // almost nobody lands on their squares and there is almost nothing to take a
  // share of. Measured over 80 games: a median of 0, a maximum of 87 against
  // the 1400 then needed, and not one declaration in 128 arrangements. The
  // whole second half of vassalage was unreachable.
  //
  // It accrues at the tithe rate now, so the rate an overlord sets is the clock
  // on how long they keep them. Here rather than in endTurn because a human who
  // cannot cover their upkeep parks in the settle phase and finishes the turn
  // through settleNow instead — both routes come through this function, and
  // exactly once.
  for (const vi of p.vassals) G.players[vi].strength += p.tithe;
  if (p.debt) p.debt += Math.ceil(p.debt * RULES.debtInterest);
  if (G.phase === 'contest' || G.over) return;

  G.cur = (G.cur + 1) % G.players.length;
  G.turn++;
  if (G.cur === 0) {
    G.circuit++;
    if (G.circuit > G.circuits) {
      G.over = true;
      G.endReason = 'circuit-limit';
      G.phase = 'over';
      G.winner = [...G.players].sort((a, b) => netWorth(G, b) - netWorth(G, a))[0].i;
      leaderSays(G, 'They do not stop. They were never going to stop. Totals, then — and let it come audited.');
      return;
    }
    announceSwarm(G);
  }
  G.phase = 'roll';
  G.dice = [0, 0];
}

// The circuit limit is the swarm arriving, and the deep array is what sees it
// coming. Reported at the warning distance and again each time the remaining
// count halves, so the last stretch of a game has a shape.
export function swarmDistance(G) {
  return Math.max(0, G.circuits - G.circuit + 1);
}

export function announceSwarm(G) {
  // Measured from the start of the CURRENT stretch, not from circuit one. After
  // playing on, a game at circuit 49 of 68 is 71% elapsed overall — so a reset
  // report count would announce stage two immediately and stage three a few
  // circuits later, dropping the player into the middle of a buildup they were
  // meant to watch begin. `swarmFrom` is the circuit the run restarted at, and
  // for a game that has never been extended it is 1, which is what this always
  // was.
  const from = G.swarmFrom ?? 1;
  const span = Math.max(1, G.circuits - from + 1);
  const elapsed = (G.circuit - from) / span;
  // The highest stage passed, not every stage passed: a short game can cross two
  // at once and two paragraphs of doom in one turn is comedy, not tension.
  let reached = -1;
  for (let k = 0; k < SWARM_STAGES.length; k++) if (elapsed >= SWARM_STAGES[k].at) reached = k;
  if (reached < (G.swarmMark ?? 0)) return;
  if (reached < 0) return;
  leaderSays(G, `${SWARM_STAGES[reached].t} ${swarmDistance(G)} circuits.`);
  G.swarmMark = reached + 1;
}

// How many circuits carrying on should add, which is not the same question at
// the two endings. Exported so the button can say the true figure rather than a
// number that happens to match.
export function playOnCircuits(G) {
  const left = G.circuits - G.circuit + 1;
  return G.endReason === 'conquest'
    ? Math.max(0, RULES.playOnLeast - left)     // it stopped early; use what is left
    : RULES.playOnExtra;
}

export function extendGame(G, extra = playOnCircuits(G)) {
  // Read before it is cleared: a game that ended because one player holds
  // everybody is a different thing to carry on from than one that ran out of
  // circuits, and the Leader should not say nobody has settled when somebody
  // very plainly has.
  const was = G.endReason;
  if (extra > 0) {
    G.circuits += extra;
    G.swarmMark = 0;                // the array reports again over the new run
    G.swarmFrom = G.circuit;        // ...and measures it from here, not circuit one
  }
  G.over = false;
  G.winner = null;
  G.endReason = null;
  G.phase = 'roll';
  G.dice = [0, 0];
  leaderSays(G, was === 'conquest'
    ? 'Every column posts to one page, and every page is still being kept. '
      + `${swarmDistance(G)} circuits still stand on the clock.`
    : `Nobody has settled, and the column stays open. ${extra} more circuits, then.`);
}

/* ============================================================ acquisition */
export function buy(G, p, index = p.pos) {
  const b = BOARD[index];
  if (!b.pr || ownerOf(G, index) || p.cash < b.pr || p.debt) return false;
  p.cash -= b.pr;
  p.holdings.push({ sq: index, garrisons: 0, citadel: 0, mortgaged: 0 });
  note(G, `${p.name} takes ${b.n} for ${money(b.pr)}.`);
  if (p.kind === 'ai') persona(G, p, 'buy');
  leader(G);
  G.phase = 'end';
  return true;
}

const clampBid = (p, v) => Math.max(0, Math.min(p.cash, Math.floor(Number(v) || 0)));

export function openAuction(G, index, sitOut = []) {
  const eligible = G.players.filter(p => !p.debt && p.cash > 0 && !sitOut.includes(p.i));
  if (!eligible.length) {
    note(G, 'No bidder is solvent. The holding stays unclaimed.');
    G.phase = 'end';
    return false;
  }
  G.auction = { sq: index, bids: {}, queue: [], at: 0, resolved: false,
                round: 1, tiedAt: 0, tiebreak: null };
  for (const i of sitOut) G.auction.bids[i] = 0;      // recorded, not asked
  for (const p of eligible) {
    if (p.kind === 'ai') G.auction.bids[p.i] = aiBid(G, p, index);
    else G.auction.queue.push(p.i);
  }
  note(G, `${BOARD[index].n} goes to sealed bid.`);
  G.phase = 'auction';
  if (!G.auction.queue.length) resolveAuction(G);
  return true;
}

export function submitBid(G, playerIndex, amount) {
  const a = G.auction;
  if (!a || a.queue[a.at] !== playerIndex) return false;
  let bid = clampBid(G.players[playerIndex], amount);
  // You cannot withdraw below what you already committed in the first round.
  if (a.round === 2) bid = Math.max(bid, Math.min(a.tiedAt, G.players[playerIndex].cash));
  a.bids[playerIndex] = bid;
  a.at++;
  if (a.at >= a.queue.length) resolveAuction(G);
  return true;
}

// A tie for first used to be settled by a coin flip that nobody was told about.
// Measured at 19% of auctions when two players both reach for the same round
// number, which is the single likeliest thing to happen at a sealed-bid table.
// Now the tied bidders — and only they — bid once more.
function openRunoff(G, ids, at) {
  const a = G.auction;
  const held = { ...a.bids };
  a.round = 2;
  a.tiedAt = at;
  a.bids = {};
  a.queue = [];
  a.at = 0;
  for (const p of G.players) if (!ids.includes(p.i)) a.bids[p.i] = 0;
  note(G, `${ids.map(i => G.players[i].name).join(' and ')} tie at ${money(at)} on ` +
          `${BOARD[a.sq].n}. The tied bidders go again.`);
  for (const i of ids) {
    const p = G.players[i];
    // An opponent re-prices the square rather than simply raising: aiBid carries
    // its own jitter, so a second identical figure is close to impossible. It
    // may never bid below what it already committed.
    if (p.kind === 'ai') a.bids[i] = Math.max(held[i] || 0, aiBid(G, p, a.sq));
    else a.queue.push(i);
  }
  if (!a.queue.length) resolveAuction(G);
}

function resolveAuction(G) {
  const a = G.auction;
  const b = BOARD[a.sq];
  const entries = Object.entries(a.bids).map(([i, v]) => ({ p: G.players[+i], v }));
  const top = entries.reduce((m, e) => Math.max(m, e.v), 0);
  if (top > 0 && (a.round || 1) < 2) {
    const tied = entries.filter(e => e.v === top);
    if (tied.length > 1) { openRunoff(G, tied.map(e => e.p.i), top); return; }
  }
  // Still level after the runoff: turn order from whoever is playing, stated
  // out loud. Deterministic, so a replayed seed gives the same auction.
  const seat = i => ((i - G.cur) % G.players.length + G.players.length) % G.players.length;
  const ranked = entries.sort((x, y) => y.v - x.v || seat(x.p.i) - seat(y.p.i));
  if (top > 0 && ranked.filter(e => e.v === top).length > 1) {
    a.tiebreak = 'order';
    note(G, `Level again at ${money(top)}. It goes on turn order, to ${ranked[0].p.name}.`);
  }
  a.ranked = ranked;
  a.resolved = true;
  const win = ranked[0];
  if (!win || win.v <= 0) {
    a.winner = null;
    note(G, `No bid on ${b.n}. It remains unclaimed.`);
    return;
  }
  win.p.cash -= win.v;
  win.p.holdings.push({ sq: a.sq, garrisons: 0, citadel: 0, mortgaged: 0 });
  a.winner = win.p.i;
  a.price = win.v;
  note(G, `${win.p.name} wins ${b.n} at sealed bid for ${money(win.v)}.`);
  if (win.p.kind === 'ai') persona(G, win.p, 'won');
  const runnerUp = ranked.slice(1).find(e => e.p.kind === 'ai' && e.v > 0);
  if (runnerUp) persona(G, runnerUp.p, 'lost');
  leader(G);
}

export function closeAuction(G) {
  G.auction = null;
  if (!G.over) G.phase = 'end';
}

/* ============================================================ development */
export function canBuild(G, p, sq) {
  const h = holding(p, sq);
  const b = BOARD[sq];
  if (!h || !b.s || h.mortgaged || h.citadel || p.debt) return false;
  if (!ownsSet(G, p, b.s)) return false;
  return h.garrisons < 3 && G.garrisonPool > 0 && p.cash >= SETS[b.s].gc;
}
export function build(G, p, sq) {
  if (!canBuild(G, p, sq)) return false;
  const gc = SETS[BOARD[sq].s].gc;
  const h = holding(p, sq);
  p.cash -= gc; h.garrisons++; G.garrisonPool--;
  note(G, `${p.name} garrisons ${BOARD[sq].n} (${h.garrisons}).`);
  return true;
}

export function canRaiseCitadel(G, p, sq) {
  const h = holding(p, sq);
  const b = BOARD[sq];
  if (!h || !b.s || h.mortgaged || h.citadel || p.debt) return false;
  if (!ownsSet(G, p, b.s)) return false;
  return h.garrisons === 3 && G.citadelPool > 0 && p.cash >= SETS[b.s].gc;
}
export function raiseCitadel(G, p, sq) {
  if (!canRaiseCitadel(G, p, sq)) return false;
  const h = holding(p, sq);
  p.cash -= SETS[BOARD[sq].s].gc;
  h.citadel = 1; h.garrisons = 0;
  G.citadelPool--; G.garrisonPool += 3;
  note(G, `${p.name} raises a citadel on ${BOARD[sq].n} — three garrisons return to the pool.`);
  return true;
}

export function sellDevelopment(G, p, sq) {
  const h = holding(p, sq);
  if (!h) return false;
  const gc = SETS[BOARD[sq].s].gc;
  if (h.citadel) {
    if (G.garrisonPool < 3) return false;      // cannot break a citadel the pool cannot absorb
    h.citadel = 0; h.garrisons = 3;
    G.citadelPool++; G.garrisonPool -= 3;
    p.cash += Math.floor(gc * 5 / 2);
    return true;
  }
  if (h.garrisons > 0) { h.garrisons--; G.garrisonPool++; p.cash += Math.floor(gc / 2); return true; }
  return false;
}

// PLEDGE, not mortgage. "Rent" already means what an opponent pays you, so
// using it for raising money against your own holdings would point the same
// word in two directions. The stored field is still `mortgaged` so that games
// saved before the rename still load.
export const pledgeValue = sq => Math.floor(BOARD[sq].pr / 2);
export const redeemCost = sq =>
  Math.ceil(BOARD[sq].pr * RULES.mortgageRedeemNumerator / RULES.mortgageRedeemDenominator);

export function pledge(G, p, sq) {
  const h = holding(p, sq);
  if (!h || h.mortgaged || h.garrisons || h.citadel) return false;
  h.mortgaged = 1;
  p.cash += pledgeValue(sq);
  note(G, `${p.name} pledges ${BOARD[sq].n} for ${money(pledgeValue(sq))}.`);
  return true;
}
export const mortgage = pledge;   // old name, kept so nothing silently breaks

export function redeem(G, p, sq) {
  const h = holding(p, sq);
  if (!h || !h.mortgaged) return false;
  // Half the price back, plus a tenth in interest. Written as a whole-number
  // ratio on purpose: pr * 0.55 is 220.00000000000003 for Cradle, and ceil()
  // then quietly overcharges a credit. Money never touches a float here.
  const cost = redeemCost(sq);
  if (p.cash < cost) return false;
  p.cash -= cost;
  h.mortgaged = 0;
  note(G, `${p.name} redeems ${BOARD[sq].n} for ${money(cost)}.`);
  return true;
}
// `amount` defaults to everything on hand, which is what the human's Repay
// button has always done. An opponent names a smaller figure because it keeps a
// working reserve — clearing a marker only to be unable to cover the next rent
// puts the marker straight back, larger.
export function repayDebt(G, p, amount = p.cash) {
  const a = Math.max(0, Math.min(Math.floor(amount), p.cash, p.debt));
  if (!a) return 0;
  p.cash -= a; p.debt -= a;
  if (!p.debt) note(G, `${p.name} clears the debt marker and may trade again.`);
  else note(G, `${p.name} pays ${money(a)} against the debt marker — ${money(p.debt)} outstanding.`);
  return a;
}

/* ============================================================ contracts */
// A pledged square MAY be traded. It is the only exit its owner has: measured
// over 40 games, a pledged square is one short of somebody else's set on 40% of
// all turns, and its owner could afford to redeem it themselves only 6.6% of
// the time. Both sides want the deal and the rules used to forbid it.
//
// What does not move is anything built. That rule stands.
export function tradable(G, p, sq) {
  const h = holding(p, sq);
  if (!h || h.garrisons > 0 || h.citadel) return false;
  const b = BOARD[sq];
  if (!b.s) return true;
  // Nothing in a set may move while anything in that set is built up.
  return !SETS[b.s].sq.some(j => {
    const o = ownerOf(G, j);
    if (!o) return false;
    const hh = holding(o, j);
    return hh && (hh.garrisons > 0 || hh.citadel);
  });
}

// A square changes hands as it stands. Nothing built can move — tradable()
// refuses that — but a PLEDGE moves with the square and must, or the buyer is
// handed a redemption worth 55% of list for nothing and the ledger calls it a
// sale. Both places that rebuild a holding used to hard-code mortgaged: 0,
// which was harmless for exactly as long as a pledged square could not be
// traded, which is why it sat there unnoticed.
//
// Read before either side is filtered: the square is still on the seller's
// sheet at that point and nowhere else.
const moved = (p, sq) => {
  const h = holding(p, sq);
  return { sq, garrisons: 0, citadel: 0, mortgaged: h && h.mortgaged ? 1 : 0 };
};

export function settleContract(G, { from, to, give, get, cash, direction }) {
  const a = G.players[from], b = G.players[to];
  const gets = sqList(get), gives = sqList(give);
  const outgoing = gives.map(sq => moved(a, sq));
  const incoming = gets.map(sq => moved(b, sq));
  if (gives.length) {
    a.holdings = a.holdings.filter(h => !gives.includes(h.sq));
    b.holdings.push(...outgoing);
  }
  if (gets.length) {
    b.holdings = b.holdings.filter(h => !gets.includes(h.sq));
    a.holdings.push(...incoming);
  }
  const amount = Math.max(0, Math.floor(cash || 0));
  if (amount) {
    if (direction === 1) { const v = Math.min(amount, a.cash); a.cash -= v; b.cash += v; }
    else { const v = Math.min(amount, b.cash); b.cash -= v; a.cash += v; }
  }
  const parts = [];
  const names = list => list.map(sq => BOARD[sq].n).join(', ');
  if (gets.length) parts.push(`${a.name} takes ${names(gets)}`);
  if (gives.length) parts.push(`${b.name} takes ${names(gives)}`);
  if (amount) parts.push(`${money(amount)} to ${direction === 1 ? b.name : a.name}`);
  note(G, `Contract settled — ${parts.join(', ') || 'nothing changed hands'}.`);
  leaderSays(G, pick(G, [
    'A price was agreed. That is the whole of it.',
    'Two ledgers reconciled. Both parties believe they won. One of them is right.',
    'Everything has a price. Somebody has just discovered theirs.'
  ]));
  return true;
}

// A square that would complete a set for `p` if they could get it, together
// with who holds it. This is the only trade worth seeking: rents stay at
// bare-square level until a set closes, so set completion is what moves the game.
export function setCompletingTargets(G, p) {
  const out = [];
  for (const [key, s] of Object.entries(SETS)) {
    let mine = 0, target = null, blocked = false;
    for (const i of s.sq) {
      const o = ownerOf(G, i);
      if (!o) { blocked = true; break; }          // still buyable — no trade needed
      if (o.i === p.i) mine++;
      else if (target) { blocked = true; break; } // two different holders: one trade cannot close it
      else target = { sq: i, owner: o, set: key };
    }
    if (blocked || !target || mine !== s.sq.length - 1) continue;
    if (!tradable(G, target.owner, target.sq)) continue;
    out.push(target);
  }
  return out;
}

// A square in a set `p` has already started, held by one other player. Not a
// completing square — just progress. Opponents used to seek only the last
// square of a set, which meant one holding out of three made them mute: they
// could close a position but never build one.
export function setBuildingTargets(G, p) {
  const out = [];
  for (const [key, s] of Object.entries(SETS)) {
    let mine = 0;
    const gettable = [];
    for (const i of s.sq) {
      const o = ownerOf(G, i);
      if (!o) { mine = -1; break; }                 // still buyable outright
      if (o.i === p.i) mine++;
      else if (tradable(G, o, i)) gettable.push({ sq: i, owner: o, set: key });
    }
    if (mine <= 0 || !gettable.length) continue;
    if (mine === s.sq.length - 1) continue;         // that is a completing target
    out.push(...gettable);
  }
  return out;
}

// The square a RIVAL needs. Varan buys it so that they cannot — the whole of his
// character is bidding to deny rather than to acquire, and until now that only
// showed up in auctions.
export function denialTargets(G, p) {
  const out = [];
  for (const [key, s] of Object.entries(SETS)) {
    const owners = s.sq.map(i => ownerOf(G, i));
    if (owners.some(o => !o)) continue;
    const counts = new Map();
    for (const o of owners) counts.set(o.i, (counts.get(o.i) || 0) + 1);
    for (const [pi, n] of counts) {
      if (pi === p.i || n !== s.sq.length - 1) continue;
      const sq = s.sq.find(i => ownerOf(G, i).i !== pi);
      const holder = ownerOf(G, sq);
      if (holder.i === p.i || !tradable(G, holder, sq)) continue;
      out.push({ sq, owner: holder, set: key, denies: pi });
    }
  }
  return out;
}

// Builds the best contract `p` can offer for a set-completing square, or null.
// `lens` selects whose valuation model to reason with, so a human seat in the
// test harness can use the same search without pretending to be an opponent.
export function seekContract(G, p, lens = p.persona || 'spector') {
  if (p.debt) return null;
  const asLens = { ...p, persona: lens };

  // Closing a set always comes first — it is the only thing that changes rent.
  // What each of them does when there is no set to close is where they differ.
  let targets = setCompletingTargets(G, p);
  if (targets.length) {
    targets.sort((a, b) => aiValue(G, asLens, b.sq) - aiValue(G, asLens, a.sq));
  } else if (lens === 'varan') {
    // Varan would rather stop you than help himself.
    targets = denialTargets(G, p);
    if (!targets.length) targets = setBuildingTargets(G, p);
    targets.sort((a, b) => BOARD[b.sq].pr - BOARD[a.sq].pr);
  } else if (lens === 'vale') {
    // Vale chases the address, not the arithmetic.
    targets = setBuildingTargets(G, p);
    targets.sort((a, b) => aiValue(G, asLens, b.sq) - aiValue(G, asLens, a.sq));
  } else {
    // Spector builds where the board pays back fastest.
    targets = setBuildingTargets(G, p);
    targets.sort((a, b) => (PAYBACK[BOARD[a.sq].s] ?? 99) - (PAYBACK[BOARD[b.sq].s] ?? 99));
  }
  // Drop anything already refused and still binding. Done after the sort, so
  // the second choice is genuinely the second best rather than whatever
  // happened to survive the filter first.
  targets = targets.filter(t => !refusalBlocks(G, p.i, t.owner.i, t.sq));
  if (!targets.length) return null;
  const target = targets[0];
  const them = G.players[target.owner.i];
  if (them.debt) return null;

  const reserve = 300;
  // Closing a set is worth a premium. Denying one is worth more to Varan than
  // owning it. Merely building is worth less than either.
  const eagerness = target.denies !== undefined ? 1.6
    : setCompletingTargets(G, p).length ? 1.4
    : 0.95;
  // netValue, not aiValue: a pledged square costs its buyer the redemption on
  // top of whatever is agreed, and an opponent that did not know would offer
  // the live price for a dead square.
  const ceiling = Math.min(Math.round(netValue(G, asLens, target.sq) * eagerness), p.cash - reserve);
  if (ceiling < Math.floor(BOARD[target.sq].pr * 0.5)) return null;

  // A sweetener, if we hold something spare that does not break a set of ours.
  const completing = new Set(targets.map(t => t.set));
  const spare = p.holdings
    .filter(h => tradable(G, p, h.sq))
    .filter(h => !BOARD[h.sq].s || !completing.has(BOARD[h.sq].s))
    .sort((a, b) => aiValue(G, asLens, a.sq) - aiValue(G, asLens, b.sq))[0] || null;
  const give = spare ? spare.sq : null;

  let cash = ceiling;
  if (them.kind === 'ai') {
    // Pay just enough to clear their bar rather than the whole ceiling.
    const bar = { spector: 60, varan: 240, vale: -40 }[them.persona] ?? 0;
    const needed = netValue(G, them, target.sq)
      - (give !== null ? netValue(G, them, give) : 0) + bar + 40;
    cash = Math.min(ceiling, Math.max(0, Math.round(needed)));
  }
  // If this was refused before and the cooldown has passed, it may only come
  // back better. An opponent that returns with the same figure has not
  // negotiated, it has repeated itself.
  const prior = refusalFor(G, p.i, them.i, target.sq);
  if (prior && cash < Math.ceil(prior.paid * RULES.refusalRaise)) {
    const raised = Math.ceil(prior.paid * RULES.refusalRaise);
    if (raised > ceiling) return null;            // cannot afford to improve
    cash = raised;
  }
  return { from: p.i, to: them.i, get: target.sq, give, cash: Math.max(0, cash), direction: 1 };
}

/* ---------------------------------------------------- learning from a refusal */
// An opponent used to be told no and carry on as though it had not happened.
// seekContract re-derives the same best target every turn — the square that
// closes its set, which has not changed — so it asked for it again, identically.
// Measured over 30 games against a seat that always refuses: 71 proposals a
// game, 95% of them exact repeats, one contract re-proposed 96 times.
//
// What is remembered is (proposer, holder, square), because that is the ask.
// What makes the memory lapse is the board moving underneath it.

// The state that made the ask what it was. If this changes, the refusal was
// about a different proposition and should not bind — picking up another square
// in the set genuinely alters the deal, and an opponent that could not see that
// would be stubborn rather than principled.
function refusalSig(G, holderIdx, proposerIdx, sq) {
  const b = BOARD[sq];
  // Ordered by who actually holds the square, taken from the board rather than
  // from the caller. On a purchase the holder is the party being asked; on a
  // sale it is the party asking, and a signature that assumed the first would
  // never match the second — the refusal would be stored and then never found,
  // which is silently no memory at all.
  const own = ownerOf(G, sq);
  if (own && own.i !== holderIdx && own.i === proposerIdx) {
    [holderIdx, proposerIdx] = [proposerIdx, holderIdx];
  }
  const held = idx => new Set(G.players[idx].holdings.map(h => h.sq));
  const a = held(holderIdx), c = held(proposerIdx);
  if (b.s) {
    const mine = SETS[b.s].sq.filter(x => a.has(x)).join('.');
    const theirs = SETS[b.s].sq.filter(x => c.has(x)).join('.');
    return `${mine}/${theirs}`;
  }
  const kind = x => BOARD[x].t === b.t;
  return `${[...a].filter(kind).length}/${[...c].filter(kind).length}`;
}

export function recordRefusal(G, c) {
  if (!c) return;
  if (!Array.isArray(G.refusals)) G.refusals = [];
  // Only cash the proposer offered counts as the price already tried.
  const paid = c.direction === 1 ? Math.max(0, Math.floor(c.cash || 0)) : 0;
  // What the ask was ABOUT. Buying, that is the square being asked for; selling,
  // it is the square being pushed. Recording the get-side of a sale records
  // nothing at all, and an opponent with no memory of a refused sale would
  // re-propose it every turn — the exact defect the refusal memory exists to
  // stop, arriving again through a new door.
  for (const sq of (c.direction === 2 ? sqList(c.give) : sqList(c.get))) {
    const sig = refusalSig(G, c.to, c.from, sq);
    const rec = G.refusals.find(r => r.from === c.from && r.to === c.to && r.sq === sq);
    if (rec) {
      rec.count++; rec.circuit = G.circuit; rec.sig = sig;
      rec.paid = Math.max(rec.paid, paid);
    } else {
      G.refusals.push({ from: c.from, to: c.to, sq, circuit: G.circuit, count: 1, paid, sig });
    }
  }
  // Bounded, like the log. A long game must not accumulate these forever.
  if (G.refusals.length > 80) G.refusals.splice(0, G.refusals.length - 80);
}

// The live refusal for this ask, or null if there is none or it has lapsed.
export function refusalFor(G, from, to, sq) {
  if (!Array.isArray(G.refusals)) return null;
  const rec = G.refusals.find(r => r.from === from && r.to === to && r.sq === sq);
  if (!rec) return null;
  if (rec.sig !== refusalSig(G, to, from, sq)) return null;   // the board moved on
  return rec;
}

// Whether the ask may be made at all. Cash is checked separately, once the
// offer has been built and there is a figure to compare.
export function refusalBlocks(G, from, to, sq) {
  const rec = refusalFor(G, from, to, sq);
  if (!rec) return false;
  if (rec.count >= RULES.refusalCap) return true;              // asked and answered
  return (G.circuit - rec.circuit) < RULES.refusalCooldown;    // not yet
}

// Validates a proposal against the board before anyone is asked to agree to it.
export function contractIsLegal(G, c) {
  if (!c || c.from === c.to) return false;
  const a = G.players[c.from], b = G.players[c.to];
  if (!a || !b || a.debt || b.debt) return false;
  const gets = sqList(c.get), gives = sqList(c.give);
  if (gets.length > RULES.tradeMax || gives.length > RULES.tradeMax) return false;
  // A square named twice, or named on both sides, is not a trade — it is a bug
  // in whatever built the contract, and it would move a holding twice.
  const all = [...gets, ...gives];
  if (new Set(all).size !== all.length) return false;
  for (const sq of gets) if (!holding(b, sq) || !tradable(G, b, sq)) return false;
  for (const sq of gives) if (!holding(a, sq) || !tradable(G, a, sq)) return false;
  if (!gets.length && !gives.length && !c.cash) return false;
  // The payer must actually hold the money. settleContract clamps to what they
  // have, which was harmless while every contract was an opponent offering cash
  // it had already counted — but an opponent can now ask a HUMAN to pay, and a
  // human who accepts "pay ₡5,000" holding ₡300 would have taken the square for
  // ₡300 and the log would have called it settled.
  const amount = Math.max(0, Math.floor(c.cash || 0));
  if (amount) {
    const payer = c.direction === 1 ? a : b;
    if (payer.cash < amount) return false;
  }
  return true;
}

// Puts a proposal to its target. An opponent answers at once; a human is parked
// in the 'contract' phase for respondToContract().
export function proposeContract(G, c) {
  if (!contractIsLegal(G, c)) return { ok: false, reason: 'illegal' };
  const them = G.players[c.to];
  if (them.kind === 'human') {
    G.contract = { ...c, resumePhase: G.phase };
    G.phase = 'contract';
    return { ok: true, pending: true };
  }
  const proposer = G.players[c.from];
  const accepted = aiAcceptsContract(G, them, proposer, c);
  const lines = CONTRACT_LINES[them.persona] || { yes: ['—'], no: ['—'] };
  G.log.unshift({
    kind: 'voice', who: them.i, circuit: G.circuit,
    text: pick(G, accepted ? lines.yes : lines.no)
  });
  trim(G);
  if (accepted) { settleContract(G, c); return { ok: true, pending: false, accepted: true }; }

  recordRefusal(G, c);
  note(G, `${them.name} refuses the contract.`);
  const counter = aiCounter(G, them, proposer, c);
  if (counter) {
    const line = {
      spector: `It prices at ${money(counter.cash)}. That is the figure, not an opening position.`,
      varan: `${money(counter.cash)}. I am under no obligation to be reasonable.`,
      vale: `Make it ${money(counter.cash)} and we shall say no more about it.`
    }[them.persona] || `${money(counter.cash)}.`;
    G.log.unshift({ kind: 'voice', who: them.i, circuit: G.circuit, text: line });
    trim(G);
  }
  return { ok: true, pending: false, accepted: false, counter };
}

export function respondToContract(G, accept) {
  const c = G.contract;
  if (!c) return false;
  G.contract = null;
  G.phase = c.resumePhase || 'end';
  if (!accept) {
    recordRefusal(G, c);
    note(G, `${G.players[c.to].name} refuses the contract.`);
    return false;
  }
  if (!contractIsLegal(G, c)) { note(G, 'The contract lapsed before it could be signed.'); return false; }
  settleContract(G, c);
  return true;
}

const CONTRACT_LINES = {
  spector: {
    yes: ['The arithmetic favours it. Done.', 'Accepted. It prices correctly.'],
    no: ['No. Your side is worth more than mine.', 'Declined. The numbers do not meet.']
  },
  varan: {
    yes: ['Filed, and against my better judgement.', 'Approved. Do not read anything into it.'],
    no: ['Denied.', 'I am not in the business of improving your position.', 'No. Next.']
  },
  vale: {
    yes: ['Delightful. Let us shake on it.', 'Yes! I do enjoy an arrangement.'],
    no: ['Ah — I think not, on reflection.', 'A charming idea, and no.']
  }
};

/* ============================================================ opponents */
// What a square is worth to `p` once buying it out of pledge is allowed for.
// seekContract and seekSale price one square at a time rather than through
// positionValue, so they need this; everything that goes through contractValue
// already has it.
export function netValue(G, p, sq) {
  const o = ownerOf(G, sq);
  const h = o ? holding(o, sq) : null;
  return aiValue(G, p, sq) - (h && h.mortgaged ? redeemCost(sq) : 0);
}

export function aiValue(G, p, sq, ignore = null) {
  const b = BOARD[sq];
  if (!b.pr) return 0;
  if (!b.s) return Math.round(b.pr * (p.persona === 'spector' ? 1.15 : p.persona === 'varan' ? 1.25 : 0.95));

  const s = SETS[b.s];
  // `ignore` leaves one square out of the count. aiValue was written to price a
  // square you do NOT hold, so `mine` means "the rest of the set I already have".
  // Valuing a post-trade board without this, every square counts itself, and a
  // lone worthless world picks up the foothold bonus meant for a second one.
  const mine = s.sq.filter(i => i !== ignore && (() => {
    const o = ownerOf(G, i); return o && o.i === p.i;
  })()).length;
  const free = s.sq.filter(i => !ownerOf(G, i)).length;
  let v;
  if (p.persona === 'spector') {
    // Best payback on the board is worth 1.25x list, worst 0.75x. Scaled to the
    // board rather than to a magic number, so Spector still buys the good half
    // outright instead of declining everything and forcing an auction.
    const spread = Math.max(1, PAYBACK_WORST - PAYBACK_BEST);
    v = b.pr * (1.25 - 0.5 * (PAYBACK[b.s] - PAYBACK_BEST) / spread);
    if (mine > 0) v *= 1 + 0.45 * mine;
    if (mine === 0 && mine + free < s.sq.length) v *= 0.55;
  } else if (p.persona === 'vale') {
    // Every set needs an entry. A missing one produced NaN, which then flowed
    // into a bid, a displayed price and very nearly a player's cash balance.
    const prestige = {
      bas: 1.85,      // his own empire; he is the Basileian reformer
      agora: 1.60, ven: 1.15, com: 1.00, dom: 0.95, syn: 0.80, eden: 0.75, eni: 0.70
    }[b.s] ?? 1;
    v = b.pr * prestige * (mine > 0 ? 1.4 : 1);
  } else {
    const rivals = s.sq.map(i => ownerOf(G, i)).filter(o => o && o.i !== p.i);
    const oneRivalHolds = rivals.length && new Set(rivals.map(o => o.i)).size === 1;
    v = b.pr * (oneRivalHolds ? 1.95 : 1.15) * (mine > 0 ? 1.3 : 1);
  }
  // Nothing downstream of here tolerates a non-number: a NaN valuation becomes
  // a NaN bid, a NaN price on screen, and a NaN cash balance that every
  // "cash < 0" check in the codebase reads as fine.
  return Number.isFinite(v) ? Math.round(v) : b.pr;
}

export function aiBid(G, p, sq) {
  const v = aiValue(G, p, sq);
  const cap = p.persona === 'varan' ? 0.72 : p.persona === 'vale' ? 0.65 : 0.55;
  let bid = Math.min(v, Math.floor(p.cash * cap));
  bid = Math.round(bid * (0.9 + random(G) * 0.2));
  if (bid < Math.floor(BOARD[sq].pr * 0.35)) bid = 0;
  if (!Number.isFinite(bid)) bid = 0;
  return Math.max(0, Math.min(p.cash, bid));
}

export function aiWantsToBuy(G, p, sq) {
  const b = BOARD[sq];
  return !p.debt && p.cash > b.pr + 180 && aiValue(G, p, sq) >= b.pr;
}

// What handing this square over does FOR SOMEBODY ELSE, priced from `who`'s
// point of view. Previously this only fired when the square completed a rival's
// set outright — so a rival one square away was worth nothing to anyone but
// Varan, who noticed it by a different route. Now the threat is graduated, and
// each of them reads it differently.
const THREAT = {
  //          completes their set   brings them within one
  spector:  { full: 1.9,            near: 0.70 },   // reads it as arithmetic
  varan:    { full: 2.6,            near: 1.10 },   // reads it as a thing to prevent
  vale:     { full: 0.8,            near: 0.10 }    // barely reads it at all
};

export function threatPenalty(G, who, give) {
  const b = BOARD[give];
  if (!b.s) return 0;
  const set = SETS[b.s];
  const counts = new Map();
  for (const j of set.sq) {
    if (j === give) continue;
    const o = ownerOf(G, j);
    if (o && o.i !== who.i) counts.set(o.i, (counts.get(o.i) || 0) + 1);
  }
  const best = counts.size ? Math.max(...counts.values()) : 0;
  const after = best + 1;                         // what the best-placed rival would hold
  const t = THREAT[who.persona] || THREAT.spector;
  // Rounded. This figure reaches a counter-offer and a displayed price, and
  // 180 * 0.7 is 125.99999999999999 — the same shape as the ₡221 redemption.
  if (after >= set.sq.length) return Math.round(b.pr * t.full);
  if (after === set.sq.length - 1) return Math.round(b.pr * t.near);
  return 0;
}

// A contract carries up to RULES.tradeMax squares each way. Older saves and
// older call sites pass a bare index or null, so everything normalises here
// rather than in eight places.
export const sqList = v =>
  v === null || v === undefined ? [] : Array.isArray(v) ? v.slice() : [v];

// The board a contract would produce. aiValue and the threat test both read
// ownership straight off the board, so the honest way to price a bundle is to
// build the board it makes and price THAT. Adding up the pieces is what lets
// somebody hand over three squares that complete nothing and have the total
// come out ahead of the one square that completes a set.
function boardAfter(G, whoIdx, otherIdx, gets, gives) {
  const players = G.players.slice();
  const a = { ...players[whoIdx] }, b = { ...players[otherIdx] };
  // The same rule as settleContract: a pledge travels with its square. Pricing
  // a trade against a board where the pledge had evaporated valued a dead
  // square as a live one on both sides at once.
  const taking = gets.map(sq => moved(players[otherIdx], sq));
  const parting = gives.map(sq => moved(players[whoIdx], sq));
  a.holdings = players[whoIdx].holdings.filter(h => !gives.includes(h.sq)).concat(taking);
  b.holdings = players[otherIdx].holdings.filter(h => !gets.includes(h.sq)).concat(parting);
  players[whoIdx] = a; players[otherIdx] = b;
  return { ...G, players };
}

// What every square this player holds is worth to them on a given board. The
// difference between two of these is the only figure a bundle can be priced by:
// a square that completes a set lifts the value of the ones already held, and
// a square that completes nothing lifts nothing.
// A pledged holding is worth what it will be worth MINUS what it costs to make
// it worth that. This is the one place the whole contract layer needs to learn
// it: contractValue is a difference of two positionValues, so subtracting the
// redemption here prices a pledged square correctly for buyer and seller at
// once, and does it without touching aiValue — which also drives bidding and
// buying, and would move auction behaviour if it changed underneath them.
//
// Note what is deliberately NOT subtracted: the uplift a pledged square gives
// the rest of its set. It counts as owned for ownsSet, so acquiring it doubles
// the rent on its siblings and unlocks building on them straight away, pledged
// or not. aiValue reads ownership, so that arrives here for free — which is
// exactly why one of these is worth having and worth disclosing.
const positionValue = (G, p) =>
  p.holdings.reduce((n, h) =>
    n + aiValue(G, p, h.sq, h.sq) - (h.mortgaged ? redeemCost(h.sq) : 0), 0);

// Handing over squares can put a rival one short of a set, or finish it. Charged
// once per SET on the resulting board — charging per square counted a two-square
// gift to the same set twice, and missed that the two together complete it.
function bundleThreat(after, who, gives) {
  const bySet = new Map();
  for (const sq of gives) {
    const b = BOARD[sq];
    if (b.s) bySet.set(b.s, (bySet.get(b.s) || 0) + b.pr);
  }
  const t = THREAT[who.persona] || THREAT.spector;
  let total = 0;
  for (const [key, price] of bySet) {
    const set = SETS[key];
    const counts = new Map();
    for (const j of set.sq) {
      const o = ownerOf(after, j);
      if (o && o.i !== who.i) counts.set(o.i, (counts.get(o.i) || 0) + 1);
    }
    const best = counts.size ? Math.max(...counts.values()) : 0;
    if (best >= set.sq.length) total += Math.round(price * t.full);
    else if (best === set.sq.length - 1) total += Math.round(price * t.near);
  }
  return total;
}

export function contractValue(G, who, get, give, cashIn, otherIdx) {
  const gets = sqList(get), gives = sqList(give);
  if (otherIdx === undefined || otherIdx === null) {
    // No counterparty named: fall back to the old per-square sum. Only reachable
    // from a caller that predates bundles.
    let v = cashIn;
    for (const sq of gets) v += aiValue(G, who, sq);
    for (const sq of gives) { v -= aiValue(G, who, sq); v -= threatPenalty(G, who, sq); }
    return v;
  }
  const after = boardAfter(G, who.i, otherIdx, gets, gives);
  const gain = positionValue(after, after.players[who.i]) - positionValue(G, who);
  return cashIn + gain - bundleThreat(after, who, gives);
}

const BAR = { spector: 60, varan: 240, vale: -40 };

function acceptanceBar(G, them, proposer) {
  const bar = BAR[them.persona] ?? 0;
  const leaderNow = [...G.players].sort((a, b) => netWorth(G, b) - netWorth(G, a))[0];
  const spite = them.persona === 'varan' && leaderNow.i === proposer.i ? 260 : 0;
  return bar + spite;
}

export function aiAcceptsContract(G, them, proposer, { give, get, cash, direction }) {
  const cashToThem = direction === 1 ? cash : -cash;
  return contractValue(G, them, give, get, cashToThem, proposer.i)
    > acceptanceBar(G, them, proposer);
}

// The least cash that WOULD have carried it, and what each of them does with
// that number. A refusal that just says no is a coin flip; a refusal that names
// a price is a negotiation, which is what this game is supposed to be about.
export function aiCounter(G, them, proposer, c) {
  // Solve the acceptance test for cash rather than searching for it. The test
  // is contractValue(them, ..., cashToThem) > bar, and cashToThem is +cash when
  // the proposer pays and -cash when they do.
  const withoutCash = contractValue(G, them, c.give, c.get, 0, proposer.i);
  const bar = acceptanceBar(G, them, proposer);

  // THEY are the ones paying. Until now this returned null, so a player trying
  // to SELL — the direction that only became reachable with seekSale, and the
  // one a pledged square is nearly always disposed of through — was told no and
  // given no figure. A refusal that names a price is a negotiation; one that
  // does not is a coin flip, which is the whole reason this function exists.
  if (c.direction === 2) {
    const most = Math.floor(withoutCash - bar) - 1;   // the most it is worth to them
    if (most >= c.cash) return null;                  // they would have taken it
    let offer;
    if (them.persona === 'spector') offer = most;     // the true figure, stated
    else if (them.persona === 'vale') offer = most;   // he does not haggle downward
    else offer = Math.round(most * 0.7);              // Varan opens below his own ceiling
    if (offer <= 0) return null;                      // no price would carry it
    if (offer > them.cash) offer = them.cash;         // and it has to be money he holds
    return offer > 0 ? { ...c, cash: offer } : null;
  }

  const needed = Math.ceil(bar - withoutCash) + 1;
  if (needed <= c.cash) return null;               // they would have taken it

  let ask;
  if (them.persona === 'spector') {
    ask = needed;                                  // the true figure, stated
  } else if (them.persona === 'vale') {
    ask = Math.max(needed, Math.round(needed * 0.88));  // shades his own price down
  } else {
    // Varan does not always deign to counter, and never at cost.
    if (random(G) < 0.4) return null;
    ask = Math.round(needed * 1.35);
  }
  if (ask > proposer.cash) return null;            // pointless to name a price they cannot meet
  return { ...c, cash: ask };
}

// Everything an opponent does after resolving its square: build, then consider
// throwing off an overlord, then adjust its tithe.
// Buying a square back out of pledge.
//
// This did not exist. redeem() had exactly one call site — the human's Manage
// button — so for every opponent, pledging was not borrowing against a square,
// it was selling it permanently for half its price. Measured over 25 full
// games before this: 353 pledges, none ever redeemed, a median pledge lasting
// 23 of the owner's own turns, and 56% of all turns with at least one dead
// square somewhere on the board.
//
// Taken BEFORE the build loop, which spends down to its own reserve. A pledged
// square earns nothing and cannot be built on, so getting it back is a
// structural repair where a garrison is an incremental one — but the reserve
// here is deliberately higher than the build reserve, so an opponent only buys
// back when it is genuinely flush rather than at the cost of its own defence.
export function aiRedeem(G, p) {
  if (p.debt) return false;
  const reserve = p.persona === 'varan' ? RULES.redeemReserve - 200 : RULES.redeemReserve;
  const pledged = p.holdings.filter(h => h.mortgaged);
  if (!pledged.length) return false;
  // A square in a set it already holds comes first: that is the one it can
  // build on once it is back, and the one whose rent doubles. Cheapest first
  // within that, so a thin turn still recovers something.
  pledged.sort((a, b) => {
    const setA = BOARD[a.sq].s && ownsSet(G, p, BOARD[a.sq].s) ? 1 : 0;
    const setB = BOARD[b.sq].s && ownsSet(G, p, BOARD[b.sq].s) ? 1 : 0;
    return setB - setA || redeemCost(a.sq) - redeemCost(b.sq);
  });
  let any = false;
  for (const h of pledged) {
    if (p.cash - redeemCost(h.sq) < reserve) continue;
    if (redeem(G, p, h.sq)) any = true;
  }
  return any;
}

// Clearing a debt marker.
//
// repayDebt() had one call site, the human's Repay button, so for every
// opponent a marker was permanent. Over 40 games: 49 taken, 0 cleared. The
// marker compounds every turn and blocks buying, bidding, building, citadels,
// contracts and redeeming — a seat that takes one is out of the game while
// still sitting at the table, and nothing about that failed or was reported.
//
// First in aiDevelop, ahead of redeeming, because a marker blocks redeeming too.
export function aiRepay(G, p) {
  if (!p.debt) return 0;
  const keep = RULES.debtKeep[p.persona] ?? RULES.debtKeep.spector;
  const urgent = RULES.debtUrgent[p.persona] ?? RULES.debtUrgent.spector;
  const spare = Math.max(0, p.cash - keep);
  // Spending only what is already on hand never catches a marker that compounds
  // every turn — it grows faster than the loose change does. Raise for it, the
  // same way an unaffordable rent is raised for. Nothing is being given up that
  // earns more than this marker costs.
  //
  // The reserve applies to money it ALREADY HAD. What it raises for the marker
  // goes to the marker: withholding the reserve out of that means selling down
  // and then declining to spend the proceeds, which is the worst of both and
  // was measured repaying exactly nothing.
  if (p.debt >= urgent && spare < p.debt) {
    const had = p.cash;
    liquidate(G, p, keep + p.debt);
    return repayDebt(G, p, spare + (p.cash - had));
  }
  return repayDebt(G, p, spare);
}

// Asking another player for money instead of only ever offering it.
//
// seekContract has always returned direction 1. An opponent could offer to buy
// a square; it had no way to sell one, so it could never turn a holding another
// player needed into the cash it was short of. Measured at 13.7% of opponent
// turns: short of money, holding exactly the square somebody else needed to
// close a set, and nothing to say.
//
// Priced against what the square is worth to the BUYER, because that is the
// only valuation that matters when you are the one selling. Each of them wants
// a different multiple of it, and needs a different amount of pressure to ask
// at all — see RULES.sellNeed and RULES.sellPremium.
export function seekSale(G, p) {
  if (p.debt) return null;                       // cannot contract at all
  const need = RULES.sellNeed[p.persona] ?? RULES.sellNeed.spector;
  if (p.cash >= need) return null;
  // Varan will not sell to be helpful, only to repair his own books. Being
  // short of cash is not enough — he keeps a thin purse by design and would
  // otherwise be the most willing seller at the table, which is backwards. He
  // needs something actually broken: a square of his own sitting pledged.
  if (p.persona === 'varan' && !p.holdings.some(h => h.mortgaged)) return null;

  // Whoever is one square short of a set, where the square is ours. This is the
  // only holding anyone reliably overpays for, and the only one worth pushing.
  const offers = [];
  for (const q of G.players) {
    if (q.i === p.i || q.debt) continue;
    for (const t of setCompletingTargets(G, q)) {
      if (t.owner.i !== p.i) continue;
      if (!tradable(G, p, t.sq)) continue;
      if (refusalBlocks(G, p.i, q.i, t.sq)) continue;
      // Varan will not sell a PLEDGED square that closes somebody's set. A
      // pledged one still counts for the set, so it hands over the doubled rent
      // and the right to build at a discount — the cheap version of exactly the
      // thing he refuses to do. He will still sell them the live one at his own
      // price; he will not make a monopoly a bargain.
      if (p.persona === 'varan' && holding(p, t.sq).mortgaged) continue;
      offers.push({ them: q, sq: t.sq });
    }
  }
  if (!offers.length) return null;

  // A human has no persona to value with, so price against a neutral lens
  // rather than reading a field that is not there.
  const lensFor = q => q.persona ? q : { ...q, persona: 'spector' };
  const worth = o => netValue(G, lensFor(o.them), o.sq);
  offers.sort((a, b) => worth(b) - worth(a));
  const best = offers[0];

  const premium = RULES.sellPremium[p.persona] ?? RULES.sellPremium.spector;
  const floor = Math.floor(BOARD[best.sq].pr * RULES.sellFloorFraction);
  const ask = Math.max(floor, Math.round(worth(best) * premium));
  // Naming a figure they cannot cover is not a negotiation, and contractIsLegal
  // would reject it anyway. Leave them something to play with afterwards.
  const ceiling = best.them.cash - 200;
  if (ceiling < floor) return null;

  let cash = ask;
  if (ask > ceiling) {
    // They cannot cover it. Simply dropping to what they can afford is what an
    // earlier version did, and it quietly deleted the premium — every ask
    // became "whatever you happen to be holding" and the three of them sold
    // identically. How far each will come down is the character.
    const floorOfAsk = ask * (RULES.sellDiscount[p.persona] ?? RULES.sellDiscount.spector);
    if (ceiling < floorOfAsk) return null;
    cash = Math.floor(ceiling);
  }

  return { from: p.i, to: best.them.i, get: null, give: best.sq, cash, direction: 2 };
}

// Settling with the Overseer rather than sitting there.
//
// payFacilityFee had one call site: the human's button. An opponent served all
// three attempts unless it rolled doubles or held a favour, and in 371 of 924
// detained turns it was holding the fee several times over.
//
// Whether the fee is worth paying is not a fixed answer. Early, a lap of the
// board buys squares and the cell is dead time. Late, a lap is a tour of
// everyone else's citadels and the cell is the cheapest address in the sector.
// So the test is how much of the board is still there to be bought.
export function openBoardFraction(G) {
  let total = 0, free = 0;
  for (let i = 0; i < BOARD.length; i++) {
    if (!BOARD[i].pr) continue;
    total++;
    if (!ownerOf(G, i)) free++;
  }
  return total ? free / total : 0;
}

export function aiPayFacilityFee(G, p) {
  if (!p || !p.inFacility || p.pardons > 0) return false;
  // Paying it into a settlement is not walking out, it is a second problem.
  if (p.cash < RULES.facilityFee + RULES.facilityFeeReserve) return false;
  const until = RULES.facilityPayUntil[p.persona] ?? RULES.facilityPayUntil.spector;
  if (openBoardFraction(G) < until) return false;
  return payFacilityFee(G);
}

// What it costs this player to be standing on a square. Used to decide whether
// nudging one square along is worth the fee — so it is a comparison between two
// squares, and anything unknowable to both (a card) is worth nothing to either.
export function landingCost(G, p, sq) {
  const at = previewAt(G, p, sq);
  switch (at.kind) {
    case 'rent': return at.amount;
    case 'tax': return at.amount;
    case 'detention': return RULES.amendDetentionCost;
    case 'unowned':
      // A square it wants is a reason to move ONTO one, so it counts as a
      // negative cost — but only the part it is actually getting for free.
      return p.kind === 'ai' && aiWantsToBuy(G, p, sq)
        ? -Math.max(0, aiValue(G, p, sq) - BOARD[sq].pr)
        : 0;
    default: return 0;            // own, pledged, a card, a corner
  }
}

// Amending the manifest — the nudge of one square, human-only until now.
//
// At ₡500 rising to ₡900, three a game, this is not a routine dodge: it is
// worth it in front of a citadel and almost nowhere else. Measured before this,
// 10.5% of landings had a cheaper square one step along, but that counted every
// saving including ones far smaller than the fee.
//
// Returns the walked path so the interface can animate it, exactly as the
// human's own button does, or null if it did not move.
export function aiAmend(G, p) {
  if (G.phase !== 'landed' || p.kind !== 'ai') return null;
  const margin = RULES.amendMargin[p.persona] ?? RULES.amendMargin.spector;
  const path = [];
  let guard = 0;
  while (p.amends > 0 && guard++ < RULES.amendsPerGame) {
    const fee = amendCost(p);
    if (p.cash < fee + RULES.amendReserve) break;
    const here = landingCost(G, p, p.pos);
    const next = landingCost(G, p, (p.pos + 1) % BOARD.length);
    if (here - next < fee * margin) break;
    const r = amendManifest(G);
    if (!r) break;
    path.push(...r.path);
  }
  return path.length ? { path } : null;
}

// What each of them takes from the people sworn to them.
//
// This was one line — a 30% chance a turn of picking from a shared table — so
// all three set the same rate. Measured over 60 games they landed at 30.3%,
// 33.0% and 30.7%, which is the same number three times.
//
// The rate is not about income. A tithe returns ₡0.3 a turn against ₡108 of
// upkeep, so holding a vassal is a loss either way; what it buys is the
// conquest victory and the share of their holdings that counts toward your
// total. So the rate decides what they are worth to you at the end, and — since
// strength now accrues at the rate every turn — how long you keep them at all.
export function aiTithe(G, p) {
  if (p.kind !== 'ai' || !p.vassals.length) return false;
  const fixed = RULES.tithePolicy[p.persona];
  if (fixed != null) return setTithe(G, p, fixed);

  // Spector solves it. Strength accrues at `tithe` a turn and breaks the
  // arrangement at the threshold, so a rate under threshold/turns-remaining
  // never gets there — and the highest such rate is worth the most at the end.
  // As the swarm closes, turns-remaining falls and the answer rises: by the
  // last circuits he can take everything, because nothing has time to happen.
  //
  // Note what he does NOT read: the vassal's accumulated strength. The tithe
  // sheet promises a human that their overlord cannot see how close they are,
  // and an opponent that peeked would be playing a different game from the one
  // the interface describes. Circuits remaining and a vassal's declarations are
  // both public; that is all this uses, which makes him a little cautious late
  // rather than a little omniscient.
  const left = Math.max(1, G.circuits - G.circuit + 1);
  const threshold = Math.min(...p.vassals.map(vi => revoltThreshold(G.players[vi])));
  const cap = threshold / left;
  const safe = RULES.titheRates.filter(r => r < cap);
  return setTithe(G, p, safe.length ? safe[safe.length - 1] : RULES.titheRates[0]);
}

// An overlord that cannot pay for the arrangement ends it, cheapest vassal
// first, and stops the moment the bill is affordable again. Runs after aiRepay
// and aiRedeem so it is the last resort rather than the first: by the time it
// is reached the opponent has already spent what it could on the marker and
// raised what it could against it.
//
// Cheapest first because the expensive vassal is the one worth the upkeep --
// its holdings are the share that counts toward net worth and the conquest
// ending. Letting the poorest go is the smallest concession that reduces the
// bill, and vassalUpkeep is charged by COUNT, so any one of them cuts it by
// the same step.
export function aiRelease(G, p) {
  if (!p.vassals.length) return 0;
  const k = RULES.vassalLetGo[p.persona] ?? RULES.vassalLetGo.spector;
  let freed = 0, guard = 0;
  while (p.vassals.length && guard++ <= G.players.length) {
    // A marker outstanding, not merely a thin turn. Being short of the upkeep
    // for one turn is ordinary and an opponent that bailed out on it shed the
    // vassals it needed for the conquest ending: measured at 63% of games down
    // to 46% before this line was added.
    if (!p.debt) break;
    if (p.cash >= upkeep(p) * k) break;
    const cheapest = [...p.vassals]
      .sort((a, b) => holdingsValue(G.players[a]) - holdingsValue(G.players[b]))[0];
    if (!releaseVassal(G, p, cheapest)) break;
    freed++;
    if (G.over) break;
  }
  return freed;
}

export function aiDevelop(G, p) {
  aiRepay(G, p);
  aiRedeem(G, p);
  aiRelease(G, p);
  if (G.over) return;
  let guard = 0;
  while (guard++ < 12) {
    const reserve = p.persona === 'varan' ? 200 : 450;
    const options = p.holdings.filter(h => canBuild(G, p, h.sq)
      && p.cash >= SETS[BOARD[h.sq].s].gc + reserve);
    if (!options.length) break;
    options.sort((a, b) =>
      paybackTurns(BOARD[a.sq].s, TRAFFIC) - paybackTurns(BOARD[b.sq].s, TRAFFIC)
      || a.garrisons - b.garrisons);
    build(G, p, options[0].sq);
  }
  // Spector deliberately holds at three garrisons and refuses citadels.
  if (p.persona !== 'spector') {
    const c = p.holdings.find(h => canRaiseCitadel(G, p, h.sq)
      && p.cash >= SETS[BOARD[h.sq].s].gc + 600);
    if (c) raiseCitadel(G, p, c.sq);
  }
  if (p.lord !== null && p.strength >= revoltThreshold(p)
      && p.cash >= RULES.revoltCost) {
    declareIndependence(G, p);
    if (p.kind === 'ai') persona(G, p, 'fell');
  }
  aiTithe(G, p);

  // One contract attempt per turn, and not every turn — an opponent that
  // proposes constantly is noise. Against another opponent this settles
  // immediately; against a human it parks the game in the 'contract' phase for
  // an answer, so callers must check the phase before ending the turn.
  if (!G.over && random(G) < 0.5) {
    // One attempt, either direction. Short of cash it tries to sell first —
    // that is the whole point of being able to — and falls back to buying if
    // nobody wants anything it holds.
    const c = seekSale(G, p) || seekContract(G, p);
    // Backstop, independent of any one opponent's memory: a proposal to a human
    // parks the game in the 'contract' phase waiting for an answer, so with
    // three opponents each rolling this independently the interruptions scale
    // with the seat count. They share one a circuit between them.
    if (c) {
      const them = G.players[c.to];
      if (them.kind !== 'human') proposeContract(G, c);
      else if ((G.humanAsked ?? -1) !== G.circuit) {
        G.humanAsked = G.circuit;
        proposeContract(G, c);
      }
    }
  }
}

/* ============================================================ save / resume */
// The whole game is plain data, so this is honest round-tripping rather than a
// partial snapshot. A phone call, a locked screen or a browser tab reaped in
// the background must not cost a game in progress.
export const SAVE_VERSION = 1;

export function serialize(G) {
  return JSON.stringify({ v: SAVE_VERSION, board: BOARD.length, G });
}

export function deserialize(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!parsed || parsed.v !== SAVE_VERSION) return null;
  // A save from a different board is not resumable — square indices would mean
  // different places. Better to lose the game than to resume a corrupted one.
  if (parsed.board !== BOARD.length) return null;
  const G = parsed.G;
  if (!G || !Array.isArray(G.players) || !G.players.length) return null;
  if (typeof G.rngState !== 'number') return null;
  return G;
}

/* ============================================================ standings */
export function standings(G) {
  return G.players
    .map(p => ({
      player: p,
      worth: netWorth(G, p),
      status: p.lord !== null ? `vassal · ${displayName(G.players[p.lord])}`
        : p.vassals.length ? `overlord ×${p.vassals.length}` : 'free'
    }))
    .sort((a, b) => b.worth - a.worth);
}
