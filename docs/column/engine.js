// The rules of GRANDIOSE — THE COLUMN.
//
// NO DOM, NO TIMERS, NO Math.random. The engine is a pure function of its seed
// and the picks applied to it, which is the only reason any figure the game
// shows a player can be asserted. The Ledger's document explains the cost of
// getting this wrong: every defect that codebase has had was silent, and a
// wrong number does not crash — it misreports for a whole match.
//
// THE RESOLVER EMITS A LOG AND THE RENDERER MAY ONLY READ IT. The screen cannot
// then disagree with the outcome, and "inspect what worked" — the step Sam's
// loop hangs on — becomes readable from data rather than inferred from watching.
//
// SIMULTANEITY. Every tick gathers the intent of every unit from the state at
// the START of the tick, then applies all of it. Resolving units in array order
// would give whichever side was iterated first a systematic opening strike, and
// nothing about the game would look wrong.

import { UNITS, BY_ID, FIELD, TICK, MAX_TICKS, RULES } from './data.js';

/* ------------------------------------------------------------------------ rng */
// mulberry32. Small, fast, and — the only property that matters here — the same
// sequence on every machine for a given seed.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ deployment */
// Ranks of six, centred, facing. Both armies are laid out by the same function
// from the same list order, so any asymmetry in a result is the units and not
// the geometry. A small seeded jitter keeps a mirror match from being decided by
// floating-point luck alone — without it, identical armies produce a stalemate
// that is an artefact rather than a finding.
const PER_RANK = 6;

// A CARD'S BODIES STAND TOGETHER. This is not cosmetic and it was wrong first
// time: the original laid every body out across the rank at FIELD.w / 7 = 14.3
// apart, while splash radii are 8 to 16. A three-body light squad was therefore
// spread wider than any blast could reach, so AOE hit exactly one of them and
// the whole "AOE punishes numbers, durability absorbs AOE" mechanism -- the
// thing that is meant to stop card count being the whole game -- could not fire.
// One extra card was winning 82% of otherwise identical armies because of it.
const SQUAD_SPREAD = 3.2;    // how far apart bodies of one card stand

// A COLUMN MARCHES AT ONE PACE, and it is this number rather than each card's
// own speed. Taking the slowest card in the column instead was tried and it
// does not work: the slowest is the artillery at 0.28 against a crawler's 2.1,
// a 7.5x spread, so the whole line crawled for forty seconds while ranged cards
// shot it, range decided every battle, and seven of twelve cards fell out of
// the counter graph.
//
// So `spd` means nothing for a card that marches in formation -- it is a
// property of SEEKERS only, where crossing the field quickly is the whole
// point. That is also what the screenshots show: a line advances together.
const COLUMN_PACE = 0.8;

function deploy(cards, side, rand) {
  const out = [];
  cards.forEach((id, ci) => {
    const u = BY_ID[id];
    const n = u.count || 1;
    const rank = Math.floor(ci / PER_RANK);
    const col = ci % PER_RANK;
    const wide = Math.min(cards.length - rank * PER_RANK, PER_RANK);
    // Where this CARD stands in the line.
    const cx = FIELD.w / 2 + (col - (wide - 1) / 2) * (FIELD.w / (PER_RANK + 1));
    const cy = 10 + rank * 9;
    for (let k = 0; k < n; k++) {
      out.push({
        id, side, i: out.length,
        // Where this BODY stands within its own squad.
        x: cx + (k - (n - 1) / 2) * SQUAD_SPREAD + (rand() - 0.5) * 1.2,
        y: (side === 0 ? cy : FIELD.d - cy) + (rand() - 0.5) * 1.2,
        hp: u.hp, max: u.hp,
        cd: 0,               // ticks until this unit may attack again
        dot: 0, dotT: 0,     // damage-over-time in progress
        alive: true
      });
    }
  });
  return out;
}

/* -------------------------------------------------------------------- targeting */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function choose(unit, enemies) {
  const spec = BY_ID[unit.id];
  let best = null, bestScore = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    let score;
    // 'big' is the swarm's doctrine, stated in the book as convergence on mass.
    // It is what makes the Fireship work, so the two are one system rather than
    // two effects: bait the convergence, then detonate inside it.
    if (spec.tgt === 'big') score = -e.hp;
    else if (spec.tgt === 'back') score = -e.y * (unit.side === 0 ? 1 : -1);
    else score = dist(unit, e);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

/* ---------------------------------------------------------------------- combat */
/**
 * Fight two armies to the end. Pure: same inputs, same result, every time.
 *
 * @param {string[]} a       unit ids for side 0
 * @param {string[]} b       unit ids for side 1
 * @param {number}   seed
 * @param {boolean}  keepLog  build the replay log. Off for sweeps, where the log
 *                            is the largest cost and nothing reads it.
 * @returns {{winner:number|null, ticks:number, left:number[], log:object[]}}
 *          winner 0, 1, or null for a draw at MAX_TICKS.
 */
export function resolve(a, b, seed, keepLog = false, onTick = null) {
  const rand = rng(seed);
  const units = [...deploy(a, 0, rand), ...deploy(b, 1, rand)];
  const log = [];
  let t = 0;

  for (; t < MAX_TICKS; t++) {
    const live = units.filter(u => u.alive);
    const sides = [live.filter(u => u.side === 0), live.filter(u => u.side === 1)];
    if (!sides[0].length || !sides[1].length) break;

    // ---- gather, from the state at the start of the tick ----
    const damage = new Map();          // unit -> total damage this tick
    const add = (u, d) => damage.set(u, (damage.get(u) || 0) + d);
    const moves = [];
    const events = [];

    for (const u of live) {
      const spec = BY_ID[u.id];
      const foes = sides[1 - u.side];

      // Damage over time keeps working whatever else the unit is doing.
      if (u.dotT > 0) { add(u, u.dot); }

      // An aura needs no attack and no target: it is simply expensive to stand
      // near. This is the volt round that does not have to hit.
      if (spec.aura) {
        for (const e of foes) if (dist(u, e) <= spec.auraR) add(e, spec.aura);
      }

      // A SEEK card crosses the field for whatever `tgt` names — over the wall,
      // along the ceiling, into the centre. A LINE card fights what has come
      // within reach and otherwise advances with its army.
      const seeks = spec.move === 'seek';
      const reach = seeks ? foes : foes.filter(e => e.alive && dist(u, e) <= spec.rng);
      const tgt = choose(u, reach);

      // A line card with nothing in reach ADVANCES. The first version fell
      // through to `continue` here, so every line card stood on its start line
      // for the whole battle and only the seekers ever fought. The render
      // showed it immediately — two untouched rows and a scuffle in the middle
      // — and the counter graph had collapsed to 36% because nine of twelve
      // cards were never closing with anything.
      if (!tgt) {
        if (!seeks) {
          moves.push([u, 0, (u.side === 0 ? 1 : -1) * COLUMN_PACE]);
          if (u.cd > 0) u.cd--;
        }
        continue;
      }
      const d = dist(u, tgt);

      if (!seeks && d > spec.rng) {
        // THE COLUMN MARCHES AT THE PACE OF ITS SLOWEST. Advancing at each
        // unit's own speed made the army arrive in speed order — a crawler
        // crossing the field in six seconds and an artillery piece in forty —
        // so the fast cards arrived alone and died before the rest were there
        // and two lines never existed at the same moment to meet.
        moves.push([u, 0, (u.side === 0 ? 1 : -1) * COLUMN_PACE]);
        if (u.cd > 0) u.cd--;
        continue;
      }

      if (d <= spec.rng && u.cd <= 0) {
        const dealt = [];
        hurtInto(tgt, spec.dmg, u, add, dealt);
        if (spec.splash) {
          for (const e of foes) {
            if (e !== tgt && dist(e, tgt) <= spec.splash) hurtInto(e, spec.dmg / 2, u, add, dealt);
          }
        }
        if (spec.dot) { tgt.dot = spec.dot; tgt.dotT = spec.dotT; }
        u.cd = spec.rate;
        if (keepLog) events.push({ e: 'hit', a: u.i * 2 + u.side, b: tgt.i * 2 + tgt.side, d: dealt[0] | 0 });
      } else if (d > spec.rng) {
        const k = spec.spd / (d || 1);
        moves.push([u, (tgt.x - u.x) * k, (tgt.y - u.y) * k]);
      }
      if (u.cd > 0) u.cd--;
    }

    // ---- apply ----
    for (const [u, dx, dy] of moves) {
      u.x = Math.max(2, Math.min(FIELD.w - 2, u.x + dx));
      u.y = Math.max(2, Math.min(FIELD.d - 2, u.y + dy));
    }
    for (const [u, d] of damage) u.hp -= d;
    for (const u of live) if (u.dotT > 0) u.dotT--;

    // Deaths, and what they set off. A detonation is gathered and applied in the
    // same pass so that two fireships dying together cannot chain unfairly.
    const boomed = [];
    for (const u of live) {
      if (u.hp <= 0 && u.alive) {
        u.alive = false;
        if (keepLog) events.push({ e: 'die', a: u.i * 2 + u.side });
        const spec = BY_ID[u.id];
        if (spec.boom) boomed.push(u);
      }
    }
    for (const u of boomed) {
      const spec = BY_ID[u.id];
      for (const e of units) {
        if (e.alive && e.side !== u.side && dist(u, e) <= spec.boom.r) {
          e.hp -= Math.max(1, spec.boom.d - (BY_ID[e.id].arm || 0));
          if (e.hp <= 0) e.alive = false;
        }
      }
      if (keepLog) events.push({ e: 'boom', a: u.i * 2 + u.side });
    }

    if (keepLog && events.length) log.push({ t, ev: events });

    // Position sampler, for anything that needs to SEE the battle rather than
    // its outcome — the preview renderer, and eventually the screen. Handed a
    // copy, never the live array, because a caller that keeps a live reference
    // reads a state that later ticks have already changed. That exact mistake
    // is in the Ledger's record twice.
    if (onTick) onTick(t, live.map(u => ({ id: u.id, side: u.side, x: u.x, y: u.y, hp: u.hp, max: u.max })));
  }

  const left = [0, 1].map(s => units.filter(u => u.alive && u.side === s).length);
  const winner = left[0] && !left[1] ? 0 : left[1] && !left[0] ? 1 : null;
  return { winner, ticks: t, left, log };
}

// Split out so splash and primary damage go through one place. Derived, never
// restated: the deflection and armour rules live here and nowhere else.
function hurtInto(target, amount, from, add, dealt) {
  const spec = BY_ID[target.id];
  let d = amount;
  if (spec.defl && BY_ID[from.id].rng > 4) d *= (1 - spec.defl);
  d = Math.max(1, d - (spec.arm || 0));
  add(target, d);
  dealt.push(d);
}

/* --------------------------------------------------------------------- drafting */
// Three cards offered, drawn without replacement from the twelve.
export function offer(rand, n = RULES.offer) {
  const pool = UNITS.map(u => u.id);
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

// The personality IS the policy. Each returns an index into `cards`.
// `mine` and `theirs` are the armies as they stand, so a persona may answer the
// board — which is what makes Sam's reveal-after-every-pick structure matter.
// One place for "how strong does this card look on paper". N bodies have N times
// the health and N times the output, so raw strength goes as count squared. Every
// policy that reads a number reads this one, so none of them can drift from it.
export const power = id => {
  const u = BY_ID[id];
  const n = u.count || 1;
  return n * n * u.hp * (u.dmg * 10 / u.rate);
};

// Picks the best card by `score`, first index winning a tie so a policy is
// deterministic and a sweep is reproducible.
const best = (cards, score) =>
  cards.reduce((b, id, i) => score(id) > score(cards[b]) ? i : b, 0);

export const POLICIES = {
  // Takes the biggest number on the card. The pirate.
  vex: cards => best(cards, power),

  // Never trades. Most health on the field per pick.
  harlow: cards => best(cards, id => (BY_ID[id].count || 1) * BY_ID[id].hp),

  // Tempo. Whatever closes fastest and hits hardest when it arrives.
  hale: cards => best(cards, id => (BY_ID[id].count || 1) * BY_ID[id].spd * BY_ID[id].dmg),

  // Denial. Picks whatever scores best AGAINST what the opponent has actually
  // fielded, which is only possible because the reveal happens between picks.
  varan: (cards, mine, theirs) => {
    if (!theirs.length) return 0;
    let best = 0, bestScore = -Infinity;
    cards.forEach((id, i) => {
      const s = counterScore(id, theirs);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
  },

  // Spends. Concedes early rounds to buy the late one: cheap bodies while the
  // armies are small, the expensive answers once they are not.
  leader: (cards, mine) =>
    mine.length >= 9 ? best(cards, power) : best(cards, id => -power(id)),

  // Counters what is actually on the other side of the field. The only policy
  // that reads the board, and on the first sweep the only one that beat picking
  // blind -- in a game decided by counters, drafting by a stat is a handicap.
  counter: (cards, mine, theirs) => POLICIES.varan(cards, mine, theirs),

  // NOT A PERSONA. This exists only to answer Sam's question: is deliberately
  // losing a round worth more than winning it, because of the extra pick? It
  // throws its opening round by taking the weakest card offered, then plays to
  // counter for the rest of the match. If it outperforms the same policy playing
  // straight, losing on purpose pays and the rule needs a guard.
  thrower: (cards, mine, theirs) =>
    mine.length < 3 ? best(cards, id => -power(id)) : POLICIES.varan(cards, mine, theirs),

  // The human seat in a sweep, and deliberately unsophisticated: it exists to
  // exercise every path, not to play well. Every "the player wins X%" figure
  // from this policy is a FLOOR, exactly as the Ledger's harness human is.
  house: cards => 0
};

// How well one card answers an army, measured rather than asserted: fight it.
// Cheap because the pool is twelve and the log is off.
function counterScore(id, theirs) {
  const r = resolve([id, id, id], theirs.slice(0, 3), 12345, false);
  return (r.winner === 0 ? 1000 : 0) - r.left[1] * 10;
}

/* ----------------------------------------------------------------- a whole match */
/**
 * Sam's structure, played out.
 *
 * Five lives. Three picks a round, each one a blind simultaneous commitment
 * revealed to both sides before the next. The round ends when one army is wiped
 * out; the loser drops a life, the field resets, and the loser opens the next
 * round with one extra pick.
 *
 * @returns {{winner:number, rounds:object[], lives:number[]}}
 */
export function playMatch({ a = 'house', b = 'varan', seed = 1 } = {}) {
  const rand = rng(seed);
  const policy = [POLICIES[a], POLICIES[b]];
  const army = [[], []];
  const lives = [RULES.lives, RULES.lives];
  const rounds = [];
  let loser = null;                      // who opens with the bonus pick

  for (let r = 0; r < RULES.maxRounds && lives[0] > 0 && lives[1] > 0; r++) {
    // The loser's extra pick, taken alone and in the open. It is the Leader's
    // doctrine as a rule: a round you lose pays for the round after it.
    if (loser !== null) {
      for (let k = 0; k < RULES.loserBonusPicks; k++) {
        const cards = offer(rand);
        army[loser].push(cards[policy[loser](cards, army[loser], army[1 - loser])]);
      }
    }

    // Three picks, each committed blind by both sides and then revealed. Both
    // policies read the board as it stood BEFORE this pick, which is what makes
    // the commitment simultaneous rather than sequential.
    for (let p = 0; p < RULES.picksPerRound; p++) {
      const seen = [army[0].slice(), army[1].slice()];
      const cA = offer(rand), cB = offer(rand);
      const iA = policy[0](cA, seen[0], seen[1]);
      const iB = policy[1](cB, seen[1], seen[0]);
      army[0].push(cA[iA]);
      army[1].push(cB[iB]);
    }

    const out = resolve(army[0], army[1], (seed * 7919 + r) >>> 0, false);
    // A draw costs the side with fewer survivors, so a stalled field still moves
    // the match on rather than burning a round to no effect.
    const lost = out.winner === null
      ? (out.left[0] <= out.left[1] ? 0 : 1)
      : 1 - out.winner;
    lives[lost]--;
    loser = lost;
    rounds.push({ r, size: [army[0].length, army[1].length], ticks: out.ticks, lost, lives: [...lives] });
  }

  return { winner: lives[0] > 0 ? 0 : 1, rounds, lives, army };
}
