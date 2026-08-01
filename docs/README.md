# Grandiose — The Ledger

A Monopoly-shaped game set in *Grandiose: The Rise to Power* (S. T. Chalk, 2026). Built to
be played on an iPhone, hot-seat, by two people and up to two opponents.

Nobody is eliminated. When you cannot settle a column you are **absorbed** — you keep your
flag and lose the arithmetic behind it, and you start keeping a second ledger your overlord
cannot see. That is the book's thesis, and it is the game's win condition.

## Why this folder is called `docs`

Because GitHub Pages will only publish from a repository's root or from `/docs`,
and root would publish `upliftledger.html` — a private tool that has no business
on the web — alongside the game. Serving from `/docs` puts exactly this folder
online and nothing else in the repository.

## State

Playable. Engine, interface, offline support and save/resume are all in.

```
data.js      board, decks, opponents, economy constants — data only
engine.js    the rules. No DOM, no timers, no Math.random
test/        100 passing
```

## Running the tests

```
node --test docs/test/*.test.mjs
```

There is no build step and no dependency — `node:test` and ES modules only.

Two probes are not tests and are run by hand when a number needs explaining:

```
node docs/test/balance.mjs [games]     # sweeps the economy levers
node docs/test/diagnose.mjs [games]    # why games end the way they do
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

## The game reaching its own ending — and how

At first, absorption decided **0 of 120** four-seat games. Every one ran out the circuit
limit and ended on totals, which is the fallback branch, not the design.

The obvious suspect was the money supply — ₡200 a lap on a 28-square board is a lap every
four rolls. That was wrong. Sweeping the lap payment from ₡200 down to ₡100 and tripling
upkeep moved the four-seat absorption rate **not at all**, flat 0% across the whole sweep.

The real cause, measured with `diagnose.mjs`: rents never left bare-square level, because
colour sets almost never completed. Sets complete through *trading*, and nothing traded —
neither the harness nor the opponents. The original file's AI only ever proposed contracts
to humans, so opponents never closed a set with each other in the whole game.

Adding trading on both sides fixed it, with **no economy constant touched**:

| | before trading | after |
|---|---|---|
| colour sets completed per game (of 6) | 1.1 | 3.8 |
| median rent standing on the board | ₡26 | ₡50 |
| cash alone covers a player's worst exposure | 93% | 74% |
| two-seat games decided by absorption | 15/120 | **56/120** |
| four-seat games where vassalage appeared | 31/120 | **96/120** |

All three balance targets are now enforced tests rather than aspirations.

Absorption endings by table: two humans **56/120**, plus one opponent **27/120**, plus two
opponents **5/120**, one human against three **8/120**. The rate falls with seat count
because absorbing three rivals inside 24 circuits is a tall order — a four-seat game usually
ends on totals *with an overlord and vassals already in place*, which is the Compact rather
than outright conquest, and reads as a legitimate ending rather than a failure to reach one.

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

## Playing it

Open the Pages URL in Safari, then Share → **Add to Home Screen**. It runs full
screen with no browser chrome and works with no signal.

The service worker is network-first, so a pushed change arrives the next time the
app is opened with a connection. If a change seems not to have landed, close the
app fully (swipe it away) and reopen it.
