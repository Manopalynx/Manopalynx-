// Drives complete games with no UI, so the integration suites can play
// thousands of them. The auto-player is deliberately unsophisticated — it is
// here to exercise every code path to the end of a game, not to play well.

import { SETS, BOARD, RULES } from '../data.js';
import {
  createGame, current, ownerOf, roll, resolveLanding, applyCard, endTurn,
  buy, openAuction, submitBid, closeAuction, submitClaim, closeContest,
  aiWantsToBuy, aiDevelop, aiAmend, amendManifest, amendCost, landingCost,
  garrisonsOf, citadelsOf,
  seekContract, proposeContract, respondToContract, autoSettle, settleNow
} from '../engine.js';

// Plays one game to its end. Returns the finished state.
// `onTurn` is called after every completed turn so a caller can sample.
// startingCash and anchoragePot are passed through rather than defaulted here,
// so an instrument can measure a setup option without a second harness.
export function playGame({ seats, seed = 1, circuits = 24, onTurn = null, maxSteps = 200000,
                           startingCash, anchoragePot } = {}) {
  const G = createGame({ seats, seed, circuits,
    ...(startingCash === undefined ? {} : { startingCash }),
    ...(anchoragePot === undefined ? {} : { anchoragePot }) });
  let steps = 0;
  while (!G.over && steps++ < maxSteps) {
    const p = current(G);
    switch (G.phase) {
      case 'roll':
        roll(G);
        break;
      case 'landed':
        // AMENDING WAS MISSING FROM EVERY MEASUREMENT THIS FILE HAS EVER MADE.
        // The mechanic fires in a real game -- aiAmend is called from ui.js --
        // and no harness game had ever nudged a single square, so every balance
        // figure in this repository described a board where nobody dodges. The
        // same shape as sweep.mjs seating two humans: a real number about a
        // game nobody plays.
        if (p.kind === 'ai') aiAmend(G, p);
        else humanAmend(G, p);
        resolveLanding(G);
        break;
      case 'card':
        applyCard(G);
        break;
      case 'offer': {
        const wants = p.kind === 'ai' ? aiWantsToBuy(G, p, p.pos) : p.cash > BOARD[p.pos].pr + 200;
        if (wants && buy(G, p)) break;
        if (!openAuction(G, p.pos)) break;
        break;
      }
      case 'auction': {
        if (G.auction.resolved) { closeAuction(G); break; }
        const who = G.auction.queue[G.auction.at];
        // A plain human policy: bid a shade over list, capped at a third of cash.
        const bidder = G.players[who];
        submitBid(G, who, Math.min(Math.floor(bidder.cash / 3), Math.floor(BOARD[G.auction.sq].pr * 1.1)));
        break;
      }
      case 'contest': {
        if (G.contest.resolved) { closeContest(G); break; }
        const who = G.contest.queue[G.contest.at];
        submitClaim(G, who, Math.floor(G.players[who].cash * 0.3));
        break;
      }
      case 'end': {
        if (p.kind === 'ai') aiDevelop(G, p);
        else { humanDevelop(G, p); humanTrade(G, p); }
        // Either party may have parked a proposal awaiting a human answer.
        if (G.phase === 'contract') respondToContract(G, harnessAccepts(G, G.contract));
        if (G.over) break;
        endTurn(G);
        if (onTurn) onTurn(G);
        break;
      }
      case 'contract':
        respondToContract(G, harnessAccepts(G, G.contract));
        break;
      case 'settle':
        // The harness always takes the automatic route; the manual sheet is
        // exercised by the browser probe instead.
        autoSettle(G);
        settleNow(G);
        break;
      default:
        return G;
    }
  }
  G.steps = steps;
  return G;
}

// Humans in the harness build whenever they comfortably can, so the build layer
// is exercised rather than left dormant the way an over-cautious AI leaves it.
function humanDevelop(G, p) {
  let guard = 0;
  while (guard++ < 12) {
    const options = p.holdings.filter(h => {
      const b = BOARD[h.sq];
      if (!b.s || h.mortgaged || h.citadel || p.debt) return false;
      if (!SETS[b.s].sq.every(i => { const o = ownerOf(G, i); return o && o.i === p.i; })) return false;
      return h.garrisons < 3 && G.garrisonPool > 0 && p.cash >= SETS[b.s].gc + 500;
    });
    if (!options.length) break;
    options.sort((a, b) => a.garrisons - b.garrisons);
    const h = options[0];
    p.cash -= SETS[BOARD[h.sq].s].gc;
    h.garrisons++;
    G.garrisonPool--;
  }
}

// The human's amend policy: nudge when the square ahead is cheaper than this one
// by more than the fee. Deliberately the plainest version of the test aiAmend
// makes -- no persona margin, no reserve kept back -- so the two are comparable
// and the SHARED path gets exercised from both sides. It loops, because a human
// may now amend as many times as they hold amends, which is what v82 fixed.
function humanAmend(G, p) {
  let guard = 0;
  while (p.amends > 0 && guard++ < 4) {
    const fee = amendCost(p);
    if (p.cash < fee) break;
    const here = landingCost(G, p, p.pos);
    const next = landingCost(G, p, (p.pos + 1) % BOARD.length);
    if (here - next <= fee) break;
    if (!amendManifest(G)) break;
  }
}

// Humans in the harness chase set completion the same way an opponent does.
// Without this nobody trades, no set ever closes, and every rent on the board
// stays at bare-square level — which is exactly the state the balance probe
// was measuring before trading existed.
function humanTrade(G, p) {
  const c = seekContract(G, p, 'spector');
  if (c) proposeContract(G, c);
}

// A plain counterparty policy: take the deal if what arrives is worth a
// noticeable premium over what leaves, valued at list price.
function harnessAccepts(G, c) {
  if (!c) return false;
  const has = i => (i !== null && i !== undefined ? BOARD[i].pr : 0);
  const gains = has(c.give) + (c.direction === 1 ? c.cash : 0);
  const loses = has(c.get) + (c.direction === -1 ? c.cash : 0);
  return gains >= loses * 1.15;
}

/* ------------------------------------------------------------- invariants */
// Every one of these must hold at every point in every game. They are cheap,
// and each corresponds to a way the board could silently corrupt itself.
export function checkInvariants(G, where = '') {
  const fail = m => { throw new Error(`${m}${where ? ` (${where})` : ''}`); };

  for (const p of G.players) {
    // Finite BEFORE sign. NaN < 0 is false, so a NaN balance sailed straight
    // through the old check and every other money guard in the codebase.
    if (!Number.isFinite(p.cash)) fail(`${p.name} holds a cash balance of ${p.cash}`);
    if (!Number.isFinite(p.debt)) fail(`${p.name} holds a debt of ${p.debt}`);
    if (p.cash < 0) fail(`${p.name} holds negative cash (${p.cash})`);
    if (p.debt < 0) fail(`${p.name} holds negative debt (${p.debt})`);
    if (p.lord === p.i) fail(`${p.name} is their own overlord`);
    if (p.lord !== null && !G.players[p.lord].vassals.includes(p.i)) {
      fail(`${p.name} names an overlord that does not claim them`);
    }
    for (const v of p.vassals) {
      if (G.players[v].lord !== p.i) fail(`${p.name} claims a vassal sworn elsewhere`);
    }
    for (const h of p.holdings) {
      if (h.citadel && h.garrisons > 0) fail(`${BOARD[h.sq].n} holds a citadel and garrisons at once`);
      if (h.garrisons < 0 || h.garrisons > 3) fail(`${BOARD[h.sq].n} has ${h.garrisons} garrisons`);
      if (h.mortgaged && (h.garrisons || h.citadel)) fail(`${BOARD[h.sq].n} is mortgaged and built`);
      if (!BOARD[h.sq].pr) fail(`${BOARD[h.sq].n} is not a buyable square`);
    }
  }

  // No overlord cycles: following lords must always terminate.
  for (const p of G.players) {
    const seen = new Set();
    let at = p.lord;
    while (at !== null) {
      if (seen.has(at)) fail(`overlord cycle reached from ${p.name}`);
      seen.add(at);
      at = G.players[at].lord;
    }
  }

  // A square belongs to at most one player.
  const claimed = G.players.flatMap(p => p.holdings.map(h => h.sq));
  if (new Set(claimed).size !== claimed.length) fail('a square is held by two players');

  // Pools are finite and conserved. A citadel holds no garrisons of its own.
  if (G.garrisonPool < 0) fail(`garrison pool is negative (${G.garrisonPool})`);
  if (G.citadelPool < 0) fail(`citadel pool is negative (${G.citadelPool})`);
  const builtG = G.players.reduce((s, p) => s + garrisonsOf(p), 0);
  const builtC = G.players.reduce((s, p) => s + citadelsOf(p), 0);
  if (G.garrisonPool + builtG !== RULES.garrisonPool) {
    fail(`garrisons leaked: pool ${G.garrisonPool} + built ${builtG} != ${RULES.garrisonPool}`);
  }
  if (G.citadelPool + builtC !== RULES.citadelPool) {
    fail(`citadels leaked: pool ${G.citadelPool} + built ${builtC} != ${RULES.citadelPool}`);
  }
  return true;
}
