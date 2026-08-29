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

import { UNITS, DRAFT, SPECIALS, BY_ID, FIELD, MAX_TICKS, RULES, UPGRADE, SHOP, RUN,
         BOOSTS, KIT, ORDERS, SABOTAGE, BY_KIT, BY_ORDER } from './data.js';

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
export const EQ_TAG = 'eq:';
export const SAB_TAG = 'sab:';
export const ORD_TAG = 'ord:';
export const isUp = tok => tok.startsWith(UP_TAG);
export const tokId = tok => (isUp(tok) ? tok.slice(UP_TAG.length) : tok);

/**
 * A draft, read. Four kinds of token and one function that knows all four, so
 * nothing downstream has to parse a prefix: a bare id is a card, `up:` a level,
 * `eq:` a piece of kit, `ord:` an order for the coming round, and `sab:` a card
 * of THEIRS that this side has had got at -- sabotage travels in the target's
 * list, because that is where it takes effect.
 */
export function armyFrom(picks) {
  const cards = [], up = {}, eq = new Set(), ord = new Set(), sab = new Set();
  for (const p of picks) {
    if (p.startsWith(UP_TAG)) { const id = p.slice(UP_TAG.length); up[id] = Math.min(UPGRADE.max, (up[id] || 0) + 1); }
    else if (p.startsWith(EQ_TAG)) eq.add(p.slice(EQ_TAG.length));
    else if (p.startsWith(ORD_TAG)) ord.add(p.slice(ORD_TAG.length));
    else if (p.startsWith(SAB_TAG)) sab.add(p.slice(SAB_TAG.length));
    else cards.push(p);
  }
  return { cards, up, eq, ord, sab };
}

// The effective stats of a card at a level, and the ONLY place the upgrade rule
// exists. Health and every damage channel scale -- direct, splash, the burn, the
// aura, the detonation -- while count, armour, range and speed do not.
// THE SIZE OF EACH EFFECT, in one place and measured rather than chosen. Every
// one of them was under-valued at its price on the first guess -- an item that
// loses to the cards it costs is a trap, which is the same fault the specials
// had, found the same way.
const KIT_N = { plate: 10, sights: 8, drill: 70 };
const ORD_N = { march: 2, marchSeek: 1.4, volley: 0.75 };

export function specFor(id, lvl, eq, ord, sab) {
  const u = BY_ID[id];
  const kit = eq && eq.size, orders = ord && ord.size, hit = sab && sab.has(id);
  if (!lvl && !kit && !orders && !hit) return u;
  const k = 1 + UPGRADE.step * Math.min(lvl || 0, UPGRADE.max);
  const s = { ...u, lvl: lvl || 0, hp: u.hp * k, dmg: u.dmg * k };
  if (u.dot) s.dot = u.dot * k;
  if (u.aura) s.aura = u.aura * k;
  if (u.boom) s.boom = { r: u.boom.r, d: u.boom.d * k };

  // EVERY TARGET IS DERIVED. Kit attaches to a role -- what a card weighs, how
  // far it shoots -- rather than to a name, so a card added later is covered by
  // whatever it is rather than by being remembered.
  if (kit) {
    if (eq.has('plate') && s.w === 'heavy') s.arm = (s.arm || 0) + KIT_N.plate;
    if (eq.has('sights') && s.rng > 6) s.rng = s.rng + KIT_N.sights;
    if (eq.has('drill') && s.w === 'light') s.hp = s.hp + KIT_N.drill;
  }
  if (orders) {
    if (ord.has('march')) { s.pace = COLUMN_PACE * ORD_N.march; s.spd = s.spd * ORD_N.marchSeek; }
    if (ord.has('volley') && s.rng > 6) s.rate = Math.max(1, Math.round(s.rate * ORD_N.volley));
  }
  // Sabotage lands on the deployment, not on the card: half the health it would
  // have had, this round, with everything else intact.
  if (hit) s.hp = s.hp * SABOTAGE.left;
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
  // A column marches at one pace, and an order can double it for a round.
  const pace = u.s.pace || COLUMN_PACE;
  return [
    near ? Math.sign(dx) * Math.min(pace * DRIFT, Math.abs(dx)) : 0,
    Math.sign(dy) * Math.min(pace, Math.abs(dy))
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
  const { cards: drafted, up, eq, ord, sab } = armyFrom(picks);
  const cards = formation(drafted).map(i => drafted[i]);
  // A DROP LANDS AT THE LINE OF CONTACT rather than marching to it. The Adarnas
  // "dropped through smoke the whole way down"; the rest of the column walks.
  const CONTACT_ROW = FIELD.d / 2 - 12;
  // One spec object per unit type, not per body: an upgraded card's stats are
  // computed once and every body of it holds the same reference, so no body can
  // end up at a different level from its squadmate.
  const spec = {};
  const out = [];
  cards.forEach((id, ci) => {
    const u = spec[id] || (spec[id] = specFor(id, up[id] || 0, eq, ord, sab));
    const n = u.count || 1;
    const rank = Math.floor(ci / PER_RANK);
    const col = ci % PER_RANK;
    const wide = Math.min(cards.length - rank * PER_RANK, PER_RANK);
    // Where this CARD stands in the line.
    const cx = FIELD.w / 2 + (col - (wide - 1) / 2) * (FIELD.w / (PER_RANK + 1));
    const cy = 10 + rank * 9;
    for (let k = 0; k < n; k++) {
      const dropped = u.drop;
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
        y: (dropped
              ? (side === 0 ? CONTACT_ROW : FIELD.d - CONTACT_ROW)
              : (side === 0 ? cy : FIELD.d - cy)) + (rand() - 0.5) * 1.2,
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
  // DRAFT, not UNITS. A special is bought or it is not had -- dealing one as a
  // free pick would put the roster's three biggest cards into a hand that was
  // never paid for, and into the counter graph with them.
  const pool = DRAFT.map(u => u.id);
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

/* --------------------------------------------------------------------- the market */
// WHAT A ROUND PAYS. A purse to both sides, and one a body still standing to the
// winner. The survivor count is the resolver's own `left`, so the game cannot
// pay out a number the battle did not produce.
export const earn = (left, winner) =>
  [0, 1].map(s => SHOP.purse + (s === winner ? left[s] : 0));

// What a booster changes, each read where it is used rather than baked into a
// copy of the rule. `has` is the only place an id is compared. It still matches
// on a PREFIX -- no booster carries an argument now that Standing muster is gone,
// and `named:walker` was the one that did, but the cost is a `startsWith` and the
// alternative is the next one that needs an argument silently not working.
const has = (boosts, id) => boosts.some(b => b === id || b.startsWith(id + ':'));
// `wide` here is the BOUGHT wider offer, which is a shop item and still exists.
// No booster widens the offer any more: being shown five cards instead of three
// measured at +0.05 matches, which is the offer axis saying it is not the
// constraint.
export const offerSize = (boosts, wide) => RULES.offer + wide;
export const picksFor = (boosts, extra) => RULES.picksPerRound + extra + (has(boosts, 'extra') ? 1 : 0);
// A round you lose buys two picks instead of one. The loser's bonus is already
// the Leader's doctrine as a rule; this is the same argument, doubled.
export const bonusPicks = boosts => RULES.loserBonusPicks + (has(boosts, 'vanguard') ? 1 : 0);

// A card drafted by a side with Veterans arrives already upgraded once, so the
// pick is two tokens rather than one. One function, because the interface and
// the sweep both take picks and neither may have its own idea of what a pick is.
export const pickTokens = (boosts, tok) =>
  (has(boosts, 'veteran') && !tok.includes(':') ? [tok, UP_TAG + tok] : [tok]);

// What the market has in it for a given side, and what it costs. Derived from
// the army rather than listed, so an upgrade that cannot apply is never offered
// and a maxed card never appears twice.
// The specials a side may still buy, with what each costs. One of each class a
// side, so what you already hold is what decides the row.
// The kit a side has not yet bought, with what each costs.
export function kitFor(money, picks, boosts = []) {
  const { eq } = armyFrom(picks);
  return KIT.filter(x => !eq.has(x.id))
    .map(x => ({ id: x.id, cost: x.cost, afford: money >= x.cost }));
}
export const ordersFor = (money, boosts = []) => ORDERS
  .map(x => ({ id: x.id, cost: x.cost, afford: money >= x.cost }));

export function specialsFor(money, picks, boosts = []) {
  const held = new Set(armyFrom(picks).cards);
  return SPECIALS.filter(u => !held.has(u.id))
    .map(u => ({ id: u.id, cost: u.cost, afford: money >= u.cost }));
}

export function stock(money, picks, lives, theirs, boosts = []) {
  const out = [];
  // THE SPECIALS FIRST, because they are what the credits are for. The row only
  // appears when there is one you can both afford and do not already hold.
  const buyable = specialsFor(money, picks, boosts).filter(x => x.afford);
  if (buyable.length) out.push({ k: 'special', cost: Math.min(...buyable.map(x => x.cost)) });
  if (money >= SHOP.card) out.push({ k: 'card', cost: SHOP.card });
  // ONE upgrade row, not one a card. Nine rows at round three and twelve by
  // round nine is a wall rather than a market, and the choice of WHICH card
  // belongs on the screen that shows the cards.
  if (money >= SHOP.upgrade && upgradeable(picks).length)
    out.push({ k: 'upgrade', cost: SHOP.upgrade });
  // KIT is permanent and each piece is bought once; an ORDER lasts a round and
  // may be bought again; SABOTAGE needs something of theirs to aim at.
  const { eq } = armyFrom(picks);
  const kit = KIT.filter(x => !eq.has(x.id) && money >= x.cost);
  if (kit.length) out.push({ k: 'kit', cost: Math.min(...kit.map(x => x.cost)) });
  const ords = ORDERS.filter(x => money >= x.cost);
  if (ords.length) out.push({ k: 'order', cost: Math.min(...ords.map(x => x.cost)) });
  if (money >= SABOTAGE.cost && theirs && armyFrom(theirs).cards.length)
    out.push({ k: 'sabotage', cost: SABOTAGE.cost });
  if (money >= SHOP.offer) out.push({ k: 'offer', cost: SHOP.offer });
  if (money >= SHOP.life && lives < RULES.lives) out.push({ k: 'life', cost: SHOP.life });
  return out;
}

// Which cards an upgrade could apply to, with the level it would reach. Derived,
// so a maxed card is never offered and a card you do not hold never appears.
export function upgradeable(picks) {
  const { cards, up } = armyFrom(picks);
  return [...new Set(cards)]
    .filter(id => (up[id] || 0) < UPGRADE.max)
    .map(id => ({ id, lvl: (up[id] || 0) + 1, held: cards.filter(x => x === id).length }));
}

// The opponent's spending. It exists so the market can be SWEPT -- a shop only
// the interface knew about could not be -- and it is rewritten here because the
// first version reached three of the shop's five items and spammed one of them.
export function spend(money, picks, lives, theirs = [], boosts = []) {
  const buys = [];
  let m = money, army = picks.slice(), got = lives;
  // CAPS PER VISIT, because without them it spends the whole purse on whatever
  // is cheapest and always available. The first version bought eleven upgrades
  // and zero cards with 200 credits; the second reached the specials and then
  // could not afford anything else, which is the same fault one shelf along.
  let ups = 0, specials = 0, kits = 0, wide = false, sabbed = false, ordered = false;

  for (let guard = 0; guard < 14; guard++) {
    // A life, and only on the last one: the opponent is trying to win this
    // match, not to survive a run.
    if (got === 1 && m >= SHOP.life) { buys.push({ k: 'life' }); m -= SHOP.life; got++; continue; }

    // One special a visit. The biggest single step on the shelf, and taking all
    // three at once leaves nothing for anything else.
    if (specials < 1) {
      const can = specialsFor(m, army, boosts).filter(x => x.afford);
      if (can.length) {
        const pick = can.sort((a, b) => b.cost - a.cost)[0];
        buys.push({ k: 'special', id: pick.id }); m -= pick.cost; army.push(pick.id); specials++; continue;
      }
    }

    // One piece of kit a visit, and early in the match, because a piece of kit
    // improves every body of its class for every round that follows -- a card
    // arrives once. (It does NOT survive into the next match of a run: the army
    // is redrafted from nothing and kit is a token in that army.)
    if (kits < 1) {
      const can = kitFor(m, army, boosts).filter(x => x.afford);
      if (can.length) {
        const pick = can.sort((a, b) => b.cost - a.cost)[0];
        buys.push({ k: 'kit', id: pick.id }); m -= pick.cost; army.push(EQ_TAG + pick.id); kits++; continue;
      }
    }

    // Two upgrades a visit, on whatever it holds most of, because an upgrade
    // compounds with copies and a card does not.
    const { cards, up } = armyFrom(army);
    const count = {};
    for (const id of cards) count[id] = (count[id] || 0) + 1;
    const best = Object.keys(count)
      .filter(id => (up[id] || 0) < UPGRADE.max)
      .sort((x, y) => count[y] - count[x] || power(y) - power(x))[0];
    if (ups < 2 && best && m >= SHOP.upgrade) {
      buys.push({ k: 'upgrade', id: best }); m -= SHOP.upgrade; army.push(UP_TAG + best); ups++; continue;
    }

    // SABOTAGE, aimed at the biggest thing they field. The only purchase whose
    // value sits on the other side of the board, and so the only one that has to
    // look at it.
    const enemy = armyFrom(theirs).cards;
    if (!sabbed && enemy.length && m >= SABOTAGE.cost) {
      const target = enemy.slice()
        .sort((x, y) => BY_ID[y].hp * BY_ID[y].count - BY_ID[x].hp * BY_ID[x].count)[0];
      buys.push({ k: 'sabotage', id: target }); m -= SABOTAGE.cost; sabbed = true; continue;
    }

    if (m >= SHOP.card) {
      // The card that best answers what it is up against would be better, and
      // the opponent does not know the enemy army here. Strongest on paper, of
      // the ones it holds fewest of, so it spreads rather than stacks.
      const id = DRAFT.map(u => u.id)
        .sort((x, y) => (count[x] || 0) - (count[y] || 0) || power(y) - power(x))[0];
      buys.push({ k: 'card', id }); m -= SHOP.card; army.push(id); continue;
    }

    // Then the small things, with whatever is left.
    if (!wide && m >= SHOP.offer) { buys.push({ k: 'offer' }); m -= SHOP.offer; wide = true; continue; }
    const ord = ordersFor(m, boosts).filter(x => x.afford).sort((a, b) => b.cost - a.cost)[0];
    if (!ordered && ord) { buys.push({ k: 'order', id: ord.id }); m -= ord.cost; ordered = true; continue; }
    break;
  }
  return buys;
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
export function playMatch({ a = 'house', b = 'varan', seed = 1,
                            money: purse = [0, 0], picks = [0, 0],
                            lives: start = [RULES.lives, RULES.lives],
                            boosts = [[], []] } = {}) {
  const rand = rng(seed);
  const policy = [POLICIES[a], POLICIES[b]];
  const army = [[], []];
  const lives = [start[0], start[1]];
  // Credits carried in from earlier matches, and any extra picks a side has
  // earned by being the thing you are running from.
  const money = [purse[0], purse[1]];
  // Bought for the coming round and spent by fighting it: orders a side gave
  // itself, and sabotage the other side paid to put on it.
  const pending = [[], []];
  const perRound = [0, 1].map(s => picksFor(boosts[s], picks[s]));
  const wide = [0, 0];                   // a wider offer, bought, for one round
  const rounds = [];
  let loser = null;                      // who opens with the bonus pick

  for (let r = 0; r < RULES.maxRounds && lives[0] > 0 && lives[1] > 0; r++) {
    // The loser's extra pick, taken alone and in the open. It is the Leader's
    // doctrine as a rule: a round you lose pays for the round after it.
    if (loser !== null) {
      for (let k = 0; k < bonusPicks(boosts[loser]); k++) {
        const cards = offer(rand, offerSize(boosts[loser], wide[loser]), army[loser]);
        army[loser].push(...pickTokens(boosts[loser],
                          cards[policy[loser](cards, army[loser], army[1 - loser])]));
      }
    }

    // Three picks, each committed blind by both sides and then revealed. Both
    // policies read the board as it stood BEFORE this pick, which is what makes
    // the commitment simultaneous rather than sequential.
    for (let p = 0; p < Math.max(perRound[0], perRound[1]); p++) {
      const seen = [army[0].slice(), army[1].slice()];
      // A side that has run out of picks takes none, and draws nothing off the
      // stream -- so a seeded run replays whatever the pick counts are.
      if (p < perRound[0]) {
        const c = offer(rand, offerSize(boosts[0], wide[0]), seen[0]);
        army[0].push(...pickTokens(boosts[0], c[policy[0](c, seen[0], seen[1])]));
      }
      if (p < perRound[1]) {
        const c = offer(rand, offerSize(boosts[1], wide[1]), seen[1]);
        army[1].push(...pickTokens(boosts[1], c[policy[1](c, seen[1], seen[0])]));
      }
    }

    const out = resolve([...army[0], ...pending[0]], [...army[1], ...pending[1]],
                        (seed * 7919 + r) >>> 0, false);
    pending[0] = []; pending[1] = [];
    // A draw costs the side with fewer survivors, so a stalled field still moves
    // the match on rather than burning a round to no effect.
    const lost = out.winner === null
      ? (out.left[0] <= out.left[1] ? 0 : 1)
      : 1 - out.winner;
    lives[lost]--;
    loser = lost;
    // A wider offer is bought for ONE round and is spent by getting here.
    wide[0] = wide[1] = 0;

    const paid = earn(out.left, 1 - lost);
    money[0] += paid[0]; money[1] += paid[1];

    // Every third round the market opens for both sides.
    if (lives[0] > 0 && lives[1] > 0) {
      for (const s of [0, 1]) {
        if ((r + 1) % SHOP.every !== 0) continue;
        for (const buy of spend(money[s], army[s], lives[s], army[1 - s], boosts[s])) {
          if (buy.k === 'life') { lives[s]++; money[s] -= SHOP.life; }
          else if (buy.k === 'upgrade') { army[s].push(UP_TAG + buy.id); money[s] -= SHOP.upgrade; }
          else if (buy.k === 'card') { army[s].push(buy.id); money[s] -= SHOP.card; }
          else if (buy.k === 'special') { army[s].push(buy.id); money[s] -= BY_ID[buy.id].cost; }
          else if (buy.k === 'kit') { army[s].push(EQ_TAG + buy.id); money[s] -= BY_KIT[buy.id].cost; }
          else if (buy.k === 'order') { pending[s].push(ORD_TAG + buy.id); money[s] -= BY_ORDER[buy.id].cost; }
          else if (buy.k === 'sabotage') { pending[1 - s].push(SAB_TAG + buy.id); money[s] -= SABOTAGE.cost; }
          else if (buy.k === 'offer') { wide[s] = 1; money[s] -= SHOP.offer; }
        }
      }
    }

    rounds.push({ r, size: [army[0].length, army[1].length], ticks: out.ticks, lost,
                  lives: [...lives], money: [...money], paid });
  }

  return { winner: lives[0] > 0 ? 0 : 1, rounds, lives, army, money };
}

/**
 * A RUN. Match after match until you lose one. The army is redrafted every time
 * and the credits carry; the opponent takes a head start that grows with every
 * match you have survived, and an extra pick a round every few matches.
 *
 * Sweepable, which is the point of putting it here: "how far does the floor
 * get" is the only number that says whether a run is a run or a treadmill.
 */
export function playRun({ a = 'house', seed = 1, max = 40, take = 0, prefer = null } = {}) {
  const rand = rng((seed * 7717 + 3) >>> 0);
  const matches = [];
  const boosts = [[], []];
  let money = 0, lives = RULES.lives;
  for (let n = 0; n < max; n++) {
    const opp = RUN.order[n % RUN.order.length];
    const r = playMatch({
      a, b: opp, seed: (seed * 131 + n) >>> 0,
      money: [money, n * RUN.ramp],
      picks: [0, Math.floor(n / RUN.pickEvery)],
      // LIVES CARRY FOR YOU AND NOT FOR THEM. Only the market restores one.
      lives: [RUN.carryLives ? lives : RULES.lives, RULES.lives],
      boosts: [boosts[0].slice(), boosts[1].slice()]
    });
    const won = r.winner === 0;
    matches.push({ n, opp, won, rounds: r.rounds.length, cards: r.army[0].length,
                   livesIn: RUN.carryLives ? lives : RULES.lives, livesOut: r.lives[0] });
    if (!won) break;
    money = r.money[0];
    lives = r.lives[0];
    // A booster each, and the asymmetry is the choice: three offered to you, one
    // at random to them. THREE ARMS, and the difference between the last two is
    // the whole reason a dead booster can hide:
    //
    //   take >= 0, no prefer   take the offer at that index — what the pool averages
    //   take >= 0, prefer X    take X when offered, ANYTHING ELSE when it is not
    //                          — a PREFERENCE, and it still collects other boosters
    //   take < 0,  prefer X    take X when offered and NOTHING when it is not
    //                          — X ISOLATED, which is the only arm the control
    //                            (take < 0, no prefer: nothing, ever) can be
    //                            subtracted from
    //
    // The middle arm was read as the value of X for a whole session. It is not:
    // an id the engine does not implement at all measures +0.58 there, at three
    // standard errors, because the arm is still taking real boosters on every
    // match its dead one is not offered. A check built on it passes the defect it
    // exists to catch, which is how this was found -- by breaking it on purpose.
    const mine = (take < 0 && !prefer) ? [] : boosterOffer(rand, boosts[0]);
    const at = prefer ? mine.indexOf(prefer) : Math.min(take, mine.length - 1);
    if (mine.length && at >= 0) boosts[0].push(mine[at]);
    const theirs = boosterOffer(rand, boosts[1]);
    if (theirs.length) boosts[1].push(theirs[0]);
  }
  return { survived: matches.filter(m => m.won).length, matches, money, boosts, lives };
}

export function boosterOffer(rand, held, n = RUN.offered) {
  // `named:walker` is `named` already taken, so held-ness is a prefix test too.
  const pool = BOOSTS.map(b => b.id)
    .filter(id => !held.some(h => h === id || h.startsWith(id + ':')));
  const out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
