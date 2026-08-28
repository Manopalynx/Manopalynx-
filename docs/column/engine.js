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

import { UNITS, BY_ID, FIELD, TICK, MAX_TICKS, RULES, UPGRADE } from './data.js';

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

/* ----------------------------------------------------------------- the draft */
// A side's draft is a flat list of PICK TOKENS. A plain unit id is a
// reinforcement; `up:walker` is an upgrade of a card already fielded. One list
// of strings rather than a structure, because everything that reads a draft --
// the resolver, the policies, the tests, eventually the screen -- then derives
// the army through the same function instead of keeping its own copy of the
// rule. A draft that contains no upgrades is exactly the array of ids it was
// before upgrades existed, which is why every earlier test still means what it
// meant.
export const UP_TAG = 'up:';
export const isUp = tok => tok.startsWith(UP_TAG);
export const tokId = tok => (isUp(tok) ? tok.slice(UP_TAG.length) : tok);

export function armyFrom(picks) {
  const cards = [], up = {};
  for (const p of picks) {
    if (isUp(p)) { const id = tokId(p); up[id] = Math.min(UPGRADE.max, (up[id] || 0) + 1); }
    else cards.push(p);
  }
  return { cards, up };
}

// The effective stats of a card at a level, and the ONLY place the upgrade rule
// exists. Health and every damage channel scale -- direct, splash, the burn, the
// aura, the detonation -- while count, armour, range and speed do not.
export function specFor(id, lvl) {
  const u = BY_ID[id];
  if (!lvl) return u;
  const k = 1 + UPGRADE.step * Math.min(lvl, UPGRADE.max);
  const s = { ...u, lvl, hp: u.hp * k, dmg: u.dmg * k };
  if (u.dot) s.dot = u.dot * k;
  if (u.aura) s.aura = u.aura * k;
  if (u.boom) s.boom = { r: u.boom.r, d: u.boom.d * k };
  return s;
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

// How much of that pace a marching card may spend closing SIDEWAYS, and how
// close it must already be before it is allowed to. A march straight down the
// field is what holds a line -- and holding the line is what keeps extra bodies
// queued behind it instead of all engaging at once, which is the whole defence
// against card count deciding the game. But with no sideways component at all,
// two lines a few units offset stand level with each other and never touch:
// 17% of battles ended as draws at 3000 ticks.
//
// So sideways movement is gated on CONTACT. A card marches straight until it is
// at the line of contact, and only then closes on what is in front of it.
const DRIFT = 0.35;
const CONTACT = 8;

// A marching card advances toward a reference enemy and NEVER PAST IT. A fixed
// downfield sign was the first version, and it walked both armies clean through
// each other and out of the far wall: a Volt Battery has range 0, so it never
// acquires a target, and two batteries finished a battle pinned to opposite
// edges at full health with the aura -- the entire card -- having touched
// nothing. Three thousand ticks, a draw, and nothing threw.
function march(u, ref) {
  const dy = ref.y - u.y, dx = ref.x - u.x;
  const near = Math.abs(dy) <= CONTACT;
  return [
    near ? Math.sign(dx) * Math.min(COLUMN_PACE * DRIFT, Math.abs(dx)) : 0,
    Math.sign(dy) * Math.min(COLUMN_PACE, Math.abs(dy))
  ];
}
const nearest = (u, foes) => {
  let best = null, bd = Infinity;
  for (const e of foes) { const d = dist(u, e); if (d < bd) { bd = d; best = e; } }
  return best;
};

// FORMATION BY ROLE, which is Sam's note 9. Rank 0 sits furthest from the enemy
// and later ranks are nearer, so before this a newly drafted card landed at the
// FRONT whatever it was -- an artillery piece arriving in the front rank because
// it happened to be the ninth pick.
//
// The bands and the order inside them are DERIVED from the same numbers the
// resolver reads, so a card cannot end up in a rank that disagrees with what it
// is, and adding a card never means typing a role onto it:
//
//   band 0   rng > 35   artillery, at the very back
//   band 1   rng 7-35   ranged, behind the line
//   band 2   rng <= 6   the line itself
//
// Within a band the least durable deploy first, so the toughest end up nearest
// the enemy: armour in front, infantry behind it. Measured against the previous
// draft-order deployment, this is better on both figures that matter and worse
// on none -- mixed compositions settled 95/5 fell 64% to 59%, and one extra card
// against an identical army fell 82% to 78%. The counter graph is untouched,
// because a single-type army has nothing to sort.
//
// Seekers leave the line whatever rank they start in; this decides where they
// start, not where they go. Deploying them in front of everything was tried on
// that reasoning and is worse -- one extra card goes back up to 83% -- so they
// are banded by range like anything else.
const band = u => (u.rng > 35 ? 0 : u.rng > 6 ? 1 : 2);
const bulk = u => u.hp * (u.count || 1);

/**
 * Deployment order, as INDICES INTO THE DRAFT rather than a re-sorted list of
 * ids. Returning ids loses which copy is which, and the interface needs exactly
 * that: it rings the card you just committed, and with two Acid Throwers in the
 * army there is no way back from an id to the one that was added. The first
 * version returned ids, and the ring landed on whichever unit happened to be at
 * the front of the line -- Sam saw it in one screenshot.
 *
 * @param {string[]} cards  card ids in draft order
 * @returns {number[]} draft indices, rear rank first
 */
export function formation(cards) {
  return cards.map((_, i) => i).sort((a, b) => {
    const A = BY_ID[cards[a]], B = BY_ID[cards[b]];
    // Draft order breaks a tie, so two identical cards deploy in the order they
    // were picked and the same army always lays out the same way.
    return band(A) - band(B) || bulk(A) - bulk(B) || a - b;
  });
}

function deploy(picks, side, rand) {
  const { cards: drafted, up } = armyFrom(picks);
  const cards = formation(drafted).map(i => drafted[i]);
  // One spec object per unit type, not per body: an upgraded card's stats are
  // computed once and every body of it holds the same reference, so no body can
  // end up at a different level from its squadmate.
  const spec = {};
  const out = [];
  cards.forEach((id, ci) => {
    const u = spec[id] || (spec[id] = specFor(id, up[id] || 0));
    const n = u.count || 1;
    const rank = Math.floor(ci / PER_RANK);
    const col = ci % PER_RANK;
    const wide = Math.min(cards.length - rank * PER_RANK, PER_RANK);
    // Where this CARD stands in the line.
    const cx = FIELD.w / 2 + (col - (wide - 1) / 2) * (FIELD.w / (PER_RANK + 1));
    const cy = 10 + rank * 9;
    for (let k = 0; k < n; k++) {
      out.push({
        // `s` is this body's OWN spec, upgrades applied. Everything in the
        // resolver reads it instead of BY_ID, because BY_ID is the card as
        // printed and this is the card as fielded.
        // `c` is WHICH CARD this body came from. The engine does not need it;
        // a renderer that wants to draw one marker per card instead of one per
        // body does, and grouping by position afterwards would be a guess.
        id, s: u, side, i: out.length, c: ci,
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

// BOTH ARMIES OFF ONE `rand`, in this order. The interface shows the deployment
// between picks -- Sam's structure has both sides appear on the field after every
// commitment -- and if it laid them out itself, its jitter would come off a
// different stream and the battle would start from positions the player was not
// shown. One function, so it cannot.
export function deployment(a, b, seed) {
  const rand = rng(seed);
  return [...deploy(a, 0, rand), ...deploy(b, 1, rand)];
}

/* -------------------------------------------------------------------- targeting */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function choose(unit, enemies) {
  const spec = unit.s;
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
 * @param {string[]} a       pick tokens for side 0 (ids, and `up:` upgrades)
 * @param {string[]} b       pick tokens for side 1
 * @param {number}   seed
 * @param {boolean}  keepLog  build the replay log. Off for sweeps, where the log
 *                            is the largest cost and nothing reads it.
 * @returns {{winner:number|null, ticks:number, left:number[], log:object[]}}
 *          winner 0, 1, or null for a draw at MAX_TICKS.
 */
export function resolve(a, b, seed, keepLog = false, onTick = null) {
  const units = deployment(a, b, seed);
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
      const spec = u.s;
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
        // THE COLUMN MARCHES AT ONE PACE, toward the nearest enemy. Advancing
        // at each unit's own speed made the army arrive in speed order — a
        // crawler crossing the field in six seconds and an artillery piece in
        // forty — so the fast cards arrived alone and died before the rest were
        // there, and two lines never existed at the same moment to meet.
        //
        // A line card can only ever reach this branch, because `reach` has
        // already filtered by range: if it has a target at all, the target is
        // in range. So this is the whole of line movement.
        if (!seeks) {
          const ref = nearest(u, foes);
          if (ref) { const [dx, dy] = march(u, ref); moves.push([u, dx, dy]); }
          if (u.cd > 0) u.cd--;
        }
        continue;
      }
      const d = dist(u, tgt);

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
        if (u.s.boom) boomed.push(u);
      }
    }
    for (const u of boomed) {
      const spec = u.s;
      for (const e of units) {
        if (e.alive && e.side !== u.side && dist(u, e) <= spec.boom.r) {
          e.hp -= Math.max(1, spec.boom.d - (e.s.arm || 0));
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
    if (onTick) onTick(t, live.map(u => ({
      // `k` is the SAME key the replay log uses for this body. Without it a
      // renderer has to reconstruct the encoding to find out which marker a
      // logged hit belongs to, and a second copy of an encoding is a second
      // copy of a rule.
      id: u.id, side: u.side, c: u.c, lvl: u.s.lvl || 0, k: u.i * 2 + u.side,
      x: u.x, y: u.y, hp: u.hp, max: u.max
    })));
  }

  const left = [0, 1].map(s => units.filter(u => u.alive && u.side === s).length);
  const winner = left[0] && !left[1] ? 0 : left[1] && !left[0] ? 1 : null;
  return { winner, ticks: t, left, log };
}

// Split out so splash and primary damage go through one place. Derived, never
// restated: the deflection and armour rules live here and nowhere else.
function hurtInto(target, amount, from, add, dealt) {
  const spec = target.s;
  let d = amount;
  if (spec.defl && from.s.rng > 4) d *= (1 - spec.defl);
  d = Math.max(1, d - (spec.arm || 0));
  add(target, d);
  dealt.push(d);
}

/* --------------------------------------------------------------------- drafting */
// Three cards offered, drawn without replacement from the twelve. A card the
// army already fields, and has not already maxed, may arrive as an UPGRADE of it
// instead of another copy -- which is the whole of Sam's design point 3 on the
// draft side. Both draws come off the same `rand`, so a seeded match still
// replays exactly; and with no army passed there are no upgrades at all, which
// is why matchup.mjs and preview.mjs still measure what they measured.
export function offer(rand, n = RULES.offer, picks = []) {
  const { cards, up } = armyFrom(picks);
  const pool = UNITS.map(u => u.id);
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const id = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const eligible = cards.includes(id) && (up[id] || 0) < UPGRADE.max;
    out.push(eligible && rand() < UPGRADE.chance ? UP_TAG + id : id);
  }
  return out;
}

// The personality IS the policy. Each returns an index into `cards`.
// `mine` and `theirs` are the armies as they stand, so a persona may answer the
// board — which is what makes Sam's reveal-after-every-pick structure matter.
// One place for "how strong does this look on paper". N bodies have N times the
// health and N times the output, so raw strength goes as count squared.
const paper = (u, n) => n * n * u.hp * (u.dmg * 10 / u.rate);

// WHAT A PICK IS WORTH, reinforcement or upgrade, through one function. A
// reinforcement is worth what it puts on the field; an upgrade is worth what it
// adds to the copies already there, which is why upgrading gets better the more
// of a card you hold and why it is worth nothing at all on a card you do not
// field. Every policy that reads a number reads this, so none of them can drift
// from it -- and none of them needs its own opinion about upgrades.
export function gain(tok, picks = [], val = paper) {
  if (!isUp(tok)) { const u = BY_ID[tok]; return val(u, u.count || 1); }
  const { cards, up } = armyFrom(picks);
  const id = tokId(tok), lvl = up[id] || 0;
  const c = cards.filter(x => x === id).length;
  if (!c || lvl >= UPGRADE.max) return -Infinity;
  const n = c * (BY_ID[id].count || 1);
  return val(specFor(id, lvl + 1), n) - val(specFor(id, lvl), n);
}

export const power = (tok, picks = []) => gain(tok, picks, paper);

// Negating a score is not the same as reversing a preference: -(-Infinity) is
// Infinity, so a policy that takes the WEAKEST card would otherwise take an
// upgrade it cannot use, every time, in preference to anything real.
const worst = g => (g === -Infinity ? -Infinity : -g);

// Picks the best card by `score`, first index winning a tie so a policy is
// deterministic and a sweep is reproducible.
const best = (cards, score) =>
  cards.reduce((b, id, i) => score(id) > score(cards[b]) ? i : b, 0);

export const POLICIES = {
  // Takes the biggest number on the card. The pirate.
  vex: (cards, mine = []) => best(cards, tok => gain(tok, mine, paper)),

  // Never trades. Most health on the field per pick.
  harlow: (cards, mine = []) => best(cards, tok => gain(tok, mine, (u, n) => n * u.hp)),

  // Tempo. Whatever closes fastest and hits hardest when it arrives.
  hale: (cards, mine = []) => best(cards, tok => gain(tok, mine, (u, n) => n * u.spd * u.dmg)),

  // Denial. Picks whatever scores best AGAINST what the opponent has actually
  // fielded, which is only possible because the reveal happens between picks.
  varan: (cards, mine = [], theirs = []) => {
    if (!theirs.length) return 0;
    let best = 0, bestScore = -Infinity;
    cards.forEach((tok, i) => {
      const s = counterScore(tok, theirs, mine);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
  },

  // Spends. Concedes early rounds to buy the late one: cheap bodies while the
  // armies are small, the expensive answers once they are not.
  leader: (cards, mine = []) =>
    mine.length >= 9 ? best(cards, tok => gain(tok, mine, paper))
                     : best(cards, tok => worst(gain(tok, mine, paper))),

  // Counters what is actually on the other side of the field. The only policy
  // that reads the board, and on the first sweep the only one that beat picking
  // blind -- in a game decided by counters, drafting by a stat is a handicap.
  counter: (cards, mine, theirs) => POLICIES.varan(cards, mine, theirs),

  // NOT A PERSONA. This exists only to answer Sam's question: is deliberately
  // losing a round worth more than winning it, because of the extra pick? It
  // throws its opening round by taking the weakest card offered, then plays to
  // counter for the rest of the match. If it outperforms the same policy playing
  // straight, losing on purpose pays and the rule needs a guard.
  thrower: (cards, mine = [], theirs = []) =>
    mine.length < 3 ? best(cards, tok => worst(gain(tok, mine, paper)))
                    : POLICIES.varan(cards, mine, theirs),

  // The human seat in a sweep, and deliberately unsophisticated: it exists to
  // exercise every path, not to play well. Every "the player wins X%" figure
  // from this policy is a FLOOR, exactly as the Ledger's harness human is.
  house: cards => 0
};

// How well one PICK answers an army, measured rather than asserted: fight it.
// Cheap because the pool is twelve, the trio is small and the log is off.
const trio = (id, lvl) => {
  const t = [id, id, id];
  for (let i = 0; i < lvl; i++) t.push(UP_TAG + id);
  return t;
};
// `theirs` is a draft, so take its CARDS -- three upgrade tokens sliced off the
// front would otherwise fight an empty army and report a free win.
function fight(mine, theirs) {
  const r = resolve(mine, armyFrom(theirs).cards.slice(0, 3), 12345, false);
  return (r.winner === 0 ? 1000 : 0) - r.left[1] * 10;
}
function counterScore(tok, theirs, picks = []) {
  if (!isUp(tok)) return fight(trio(tok, 0), theirs);
  const { cards, up } = armyFrom(picks);
  const id = tokId(tok), lvl = up[id] || 0;
  const c = cards.filter(x => x === id).length;
  if (!c || lvl >= UPGRADE.max) return -Infinity;
  // DIFFERENTIAL: the same trio upgraded and not, against the same enemy, and
  // the difference is the upgrade. An absolute score would be reading the trio
  // rather than the level. The paper marginal breaks a tie, because two fights
  // that end the same way cannot tell a good upgrade from a useless one.
  return (fight(trio(id, lvl + 1), theirs) - fight(trio(id, lvl), theirs)) * c
       + gain(tok, picks) * 1e-9;
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
        const cards = offer(rand, RULES.offer, army[loser]);
        army[loser].push(cards[policy[loser](cards, army[loser], army[1 - loser])]);
      }
    }

    // Three picks, each committed blind by both sides and then revealed. Both
    // policies read the board as it stood BEFORE this pick, which is what makes
    // the commitment simultaneous rather than sequential.
    for (let p = 0; p < RULES.picksPerRound; p++) {
      const seen = [army[0].slice(), army[1].slice()];
      const cA = offer(rand, RULES.offer, seen[0]), cB = offer(rand, RULES.offer, seen[1]);
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
