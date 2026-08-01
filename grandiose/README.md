# Grandiose — The Ledger

A Monopoly-shaped game set in *Grandiose: The Rise to Power* (S. T. Chalk, 2026). Built to
be played on an iPhone, hot-seat, by two people and up to two opponents.

Nobody is eliminated. When you cannot settle a column you are **absorbed** — you keep your
flag and lose the arithmetic behind it, and you start keeping a second ledger your overlord
cannot see. That is the book's thesis, and it is the game's win condition.

## State

The rules engine is done and tested. The interface is not built yet.

```
data.js      board, decks, opponents, economy constants — data only
engine.js    the rules. No DOM, no timers, no Math.random
test/        84 passing, 3 recorded balance targets
```

## Running the tests

```
node --test grandiose/test/*.test.mjs
```

There is no build step and no dependency — `node:test` and ES modules only.

Two probes are not tests and are run by hand when a number needs explaining:

```
node grandiose/test/balance.mjs [games]     # sweeps the economy levers
node grandiose/test/diagnose.mjs [games]    # why games end the way they do
```

## Why the engine is separate from the page

Every defect this codebase family has had has been **silent**. A wrong rent does not crash,
does not warn, and reads perfectly well in the source — it just misreports for a whole game.
The engine is a pure function of its seed and the actions applied to it, which is the only
reason those figures can be asserted at all. Every number the game shows a player is
hand-computed in `test/engine.test.mjs` and checked against.

One example of the class, caught on the first run: redeeming Cradle charged ₡221 instead of
₡220, because `400 * 0.55` is `220.00000000000003` and the ceiling rounded it up. Nothing
would ever have flagged that.

## Verified

- **The traffic table.** `TRAFFIC` in `data.js` is shown to players as strategy information
  and `paybackTurns()` divides by it. `test/traffic.test.mjs` re-derives it from the engine's
  own movement over 400,000 rolls and fails if any square drifts more than 0.5pp. Current
  worst deviation: **+0.07pp**.
- **Invariants over whole games.** 120 games at each of four seat configurations, checked
  after every turn: garrison and citadel pools conserved, no negative cash, no overlord
  cycles, no square held twice, no player ever removed from the table, every game reaches
  an ending.

## Not solved: the game rarely reaches its own ending

Recorded as three `todo` tests in `test/game.test.mjs` rather than quietly ignored.

Measured, at four seats: absorption decides **0 of 120** games. Every one ends on totals at
the circuit limit, which is the fallback branch, not the design.

The cause is measured, not guessed:

| | 2 seats | 3 seats | 4 seats |
|---|---|---|---|
| median rent standing on the board | ₡28 | ₡28 | ₡26 |
| player's cash alone covers their worst exposure | 94% | 91% | 93% |
| colour sets completed per game (of 6) | 1.4 | 1.8 | 1.1 |

Rents stay at bare-square level because sets almost never complete, so nobody is ever
squeezed hard enough to fall. It is **not** the money supply: sweeping the lap payment from
₡200 down to ₡100 and tripling upkeep moves the four-seat absorption rate not at all.

**Before tuning any number**, note the confound: sets complete through *trading*, and neither
the test harness nor the opponents trade. The original file's AI only ever proposed contracts
to humans, so opponents never completed sets with each other. Add trading to both, re-measure,
and only then decide whether the board itself needs changing.

## Canon

Names come from the book. Three squares were changed and each is commented in `data.js`:

- **Cradle** and **The Palace** now form the top set, called **Agora**. It was "Basileia",
  holding "Basileia Prime" and Cradle — but Cradle is the capital on Agora, the Union's and
  then the Federation's, and the book names no Basileian world at all.
- **The Deep Array** replaces the utility named "Spector", which collided with the opponent
  of the same name.
- **The Neurex Holding Facility** can no longer be bought out of. You leave on doubles, or
  when the assessment concludes. The Neurex is the one thing in the book with no price —
  *"no official to blind, no tithe to pay, no arrangement"* — and it was the only square you
  could pay to escape.
