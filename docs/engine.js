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
  SETS, BOARD, N, GO, JAIL, GOTO, FLEETS, UTILS, FLEET_RENT, TRAFFIC,
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

export function setTithe(G, p, rate) {
  p.tithe = rate;
  note(G, `${p.name} sets the tithe at ${rate}%.`);
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
export function roll(G, d1, d2) {
  if (G.phase !== 'roll' || G.over) return null;
  const p = current(G);
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
        p.inFacility = false; p.attempts = 0;
        pay(G, p, null, RULES.facilityFee);
        note(G, `${p.name} pays ${money(RULES.facilityFee)} and is released.`);
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
      leaderSays(G, 'The circuit limit is reached. Totals, then, and no more argument.');
      return;
    }
  }
  G.phase = 'roll';
  G.dice = [0, 0];
}

export function extendGame(G, extra = 12) {
  G.circuits += extra;
  G.over = false;
  G.winner = null;
  G.endReason = null;
  G.phase = 'roll';
  G.dice = [0, 0];
  leaderSays(G, `Nobody has settled, and the column stays open. ${extra} more circuits, then.`);
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
  G.auction = { sq: index, bids: {}, queue: [], at: 0, resolved: false };
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
  a.bids[playerIndex] = clampBid(G.players[playerIndex], amount);
  a.at++;
  if (a.at >= a.queue.length) resolveAuction(G);
  return true;
}

function resolveAuction(G) {
  const a = G.auction;
  const b = BOARD[a.sq];
  const ranked = Object.entries(a.bids)
    .map(([i, v]) => ({ p: G.players[+i], v }))
    .sort((x, y) => y.v - x.v || random(G) - 0.5);
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
export function repayDebt(G, p) {
  const a = Math.min(p.cash, p.debt);
  p.cash -= a; p.debt -= a;
  if (!p.debt) note(G, `${p.name} clears the debt marker and may trade again.`);
  return a;
}

/* ============================================================ contracts */
export function tradable(G, p, sq) {
  const h = holding(p, sq);
  if (!h || h.mortgaged || h.garrisons > 0 || h.citadel) return false;
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

export function settleContract(G, { from, to, give, get, cash, direction }) {
  const a = G.players[from], b = G.players[to];
  if (give !== null && give !== undefined) {
    a.holdings = a.holdings.filter(h => h.sq !== give);
    b.holdings.push({ sq: give, garrisons: 0, citadel: 0, mortgaged: 0 });
  }
  if (get !== null && get !== undefined) {
    b.holdings = b.holdings.filter(h => h.sq !== get);
    a.holdings.push({ sq: get, garrisons: 0, citadel: 0, mortgaged: 0 });
  }
  const amount = Math.max(0, Math.floor(cash || 0));
  if (amount) {
    if (direction === 1) { const v = Math.min(amount, a.cash); a.cash -= v; b.cash += v; }
    else { const v = Math.min(amount, b.cash); b.cash -= v; a.cash += v; }
  }
  const parts = [];
  if (get !== null && get !== undefined) parts.push(`${a.name} takes ${BOARD[get].n}`);
  if (give !== null && give !== undefined) parts.push(`${b.name} takes ${BOARD[give].n}`);
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

// Builds the best contract `p` can offer for a set-completing square, or null.
// `lens` selects whose valuation model to reason with, so a human seat in the
// test harness can use the same search without pretending to be an opponent.
export function seekContract(G, p, lens = p.persona || 'spector') {
  if (p.debt) return null;
  const targets = setCompletingTargets(G, p);
  if (!targets.length) return null;

  const asLens = { ...p, persona: lens };
  targets.sort((a, b) => aiValue(G, asLens, b.sq) - aiValue(G, asLens, a.sq));
  const target = targets[0];
  const them = G.players[target.owner.i];
  if (them.debt) return null;

  const reserve = 300;
  const ceiling = Math.min(Math.round(aiValue(G, asLens, target.sq) * 1.4), p.cash - reserve);
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
    const needed = aiValue(G, them, target.sq)
      - (give !== null ? aiValue(G, them, give) : 0) + bar + 40;
    cash = Math.min(ceiling, Math.max(0, Math.round(needed)));
  }
  return { from: p.i, to: them.i, get: target.sq, give, cash: Math.max(0, cash), direction: 1 };
}

// Validates a proposal against the board before anyone is asked to agree to it.
export function contractIsLegal(G, c) {
  if (!c || c.from === c.to) return false;
  const a = G.players[c.from], b = G.players[c.to];
  if (!a || !b || a.debt || b.debt) return false;
  if (c.get !== null && c.get !== undefined) {
    if (!holding(b, c.get) || !tradable(G, b, c.get)) return false;
  }
  if (c.give !== null && c.give !== undefined) {
    if (!holding(a, c.give) || !tradable(G, a, c.give)) return false;
  }
  if (c.get === null && c.give === null && !c.cash) return false;
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
  if (accepted) settleContract(G, c);
  else note(G, `${them.name} refuses the contract.`);
  return { ok: true, pending: false, accepted };
}

export function respondToContract(G, accept) {
  const c = G.contract;
  if (!c) return false;
  G.contract = null;
  G.phase = c.resumePhase || 'end';
  if (!accept) { note(G, `${G.players[c.to].name} refuses the contract.`); return false; }
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
export function aiValue(G, p, sq) {
  const b = BOARD[sq];
  if (!b.pr) return 0;
  if (!b.s) return Math.round(b.pr * (p.persona === 'spector' ? 1.15 : p.persona === 'varan' ? 1.25 : 0.95));

  const s = SETS[b.s];
  const mine = s.sq.filter(i => { const o = ownerOf(G, i); return o && o.i === p.i; }).length;
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

export function contractValue(G, who, get, give, cashIn) {
  let v = cashIn;
  if (get !== null && get !== undefined) v += aiValue(G, who, get);
  if (give !== null && give !== undefined) {
    v -= aiValue(G, who, give);
    const b = BOARD[give];
    if (b.s) {
      const rest = SETS[b.s].sq.filter(j => j !== give);
      const owners = rest.map(j => ownerOf(G, j)).filter(Boolean);
      if (owners.length === rest.length && new Set(owners.map(o => o.i)).size === 1) {
        v -= b.pr * (who.persona === 'varan' ? 2.6 : who.persona === 'spector' ? 1.9 : 0.8);
      }
    }
  }
  return v;
}

export function aiAcceptsContract(G, them, proposer, { give, get, cash, direction }) {
  const cashToThem = direction === 1 ? cash : -cash;
  const net = contractValue(G, them, give, get, cashToThem);
  const bar = { spector: 60, varan: 240, vale: -40 }[them.persona] ?? 0;
  const leaderNow = [...G.players].sort((a, b) => netWorth(G, b) - netWorth(G, a))[0];
  const spite = them.persona === 'varan' && leaderNow.i === proposer.i ? 260 : 0;
  return net > bar + spite;
}

// Everything an opponent does after resolving its square: build, then consider
// throwing off an overlord, then adjust its tithe.
export function aiDevelop(G, p) {
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
  if (p.lord !== null && p.strength >= revoltThreshold(p) && p.cash >= RULES.revoltCost + 400) {
    declareIndependence(G, p);
    if (p.kind === 'ai') persona(G, p, 'fell');
  }
  if (p.vassals.length && random(G) < 0.3) p.tithe = pick(G, [10, 25, 25, 40, 40, 55]);

  // One contract attempt per turn, and not every turn — an opponent that
  // proposes constantly is noise. Against another opponent this settles
  // immediately; against a human it parks the game in the 'contract' phase for
  // an answer, so callers must check the phase before ending the turn.
  if (!G.over && random(G) < 0.5) {
    const c = seekContract(G, p);
    if (c) proposeContract(G, c);
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
      status: p.lord !== null ? `vassal · ${G.players[p.lord].name.split(' ')[0]}`
        : p.vassals.length ? `overlord ×${p.vassals.length}` : 'free'
    }))
    .sort((a, b) => b.worth - a.worth);
}
