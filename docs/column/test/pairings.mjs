// THE FIXTURE, in one place, because two instruments now measure against it.
//
// `settled.mjs` explains why 59% of mixed compositions are decided; `terrain.mjs`
// asks what cover does to that number. If each kept its own copy of the pairing
// generator they would drift, and the second copy is always the one in the check
// -- the citadel price was written six times in this repository's sibling and
// wrong in all six, and the probe that should have caught it was a seventh copy.
//
// Every constant here is match.mjs's, deliberately: an explanation of a number
// has to be an explanation of THAT number, so the size, the seed arithmetic and
// the 95/5 line are copied from the thing being explained rather than re-chosen.
//
// THE DRAW ORDER IS PART OF THE FIXTURE. match.mjs takes one card for A and then
// one for B, alternating off a single stream. Drawing all of A and then all of B
// is the same distribution and a different sample, and it landed 1.5pt off the
// figure -- close enough to look like agreement and not close enough to be it.

import { BY_ID } from '../data.js';
import { resolve, rng, offer } from '../engine.js';

export const SEEDS = 8;   // battles per pairing, as match.mjs
export const SIZE = 9;    // cards a side, as match.mjs

export const bodies = id => BY_ID[id].count || 1;
export const bodyCount = army => army.reduce((t, id) => t + bodies(id), 0);

// `offer` can return an upgrade token for a card already held. The generator in
// match.mjs keeps them and so does this -- but every feature that reads a bare id
// would index BY_ID as undefined and take the arithmetic to NaN in silence, so
// they are stripped at the door and counted rather than assumed to be zero.
export let stripped = 0;
const bare = army => army.filter(t => {
  const ok = !t.includes(':');
  if (!ok) stripped++;
  return ok;
});

export function samplePairs(n, seed = 99) {
  const rand = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = [], b = [];
    for (let k = 0; k < SIZE; k++) {
      a.push(offer(rand, 1)[0]);
      b.push(offer(rand, 1)[0]);
    }
    const A = bare(a), B = bare(b);
    if (A.length && B.length) out.push({ a: A, b: B });
  }
  return out;
}

// A DRAW IS HALF A WIN, and counted, for the reason match.mjs gives: a battle
// that never finishes reads as a close one, and 28% of them once did.
//
// `kept` is how much of itself the winner had left, from the resolver's own
// survivor count, so it cannot report a margin the battle did not produce. It is
// what tells a formality apart from a close fight that is merely repeatable.
export function fight(a, b, start, terrain = null) {
  let wins = 0, drawn = 0, keptT = 0, keptN = 0;
  for (let s = 0; s < SEEDS; s++) {
    const r = resolve(a, b, s * 37 + 3, false, null, terrain);
    if (r.winner === 0) wins++;
    else if (r.winner === null) { wins += 0.5; drawn++; }
    if (r.winner !== null && start) { keptT += r.left[r.winner] / start[r.winner]; keptN++; }
  }
  const p = wins / SEEDS;
  return { p, drawn, decisive: p <= 0.05 || p >= 0.95, kept: keptN ? keptT / keptN : null };
}

// A pairing is a FORMALITY when it is decided AND the winner walked away with
// most of its army. Decided alone is repeatability; this is one-sidedness.
export const FORMALITY = 0.60;

export function measure(pairs, terrain = null) {
  let decisive = 0, drawn = 0, fought = 0, formality = 0;
  const results = [];
  for (const p of pairs) {
    const r = fight(p.a, p.b, [bodyCount(p.a), bodyCount(p.b)], terrain);
    results.push(r);
    if (r.decisive) { decisive++; if (r.kept !== null && r.kept > FORMALITY) formality++; }
    drawn += r.drawn;
    fought += SEEDS;
  }
  const kept = results.filter(r => r.decisive && r.kept !== null).map(r => r.kept).sort((x, y) => x - y);
  return {
    n: pairs.length, decisive, formality, results,
    rate: decisive / pairs.length,
    formalityRate: formality / pairs.length,
    draws: drawn / fought,
    medianKept: kept.length ? kept[Math.floor(kept.length / 2)] : NaN,
  };
}
