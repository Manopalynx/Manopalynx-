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
test/        108 passing
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

## Balance: what has been found to matter

Absorption is the designed ending. Getting games to actually reach it took two
findings, and ruled out two plausible suspects.

**Trading matters most.** Before opponents traded with each other, colour sets
almost never completed, rents stayed at bare-square level, and absorption decided
15 of 120 two-seat games. Nothing about the board was wrong — the original file's
AI only ever proposed contracts to humans, so two opponents never closed a set
between them. Adding it moved everything with no economy constant touched.

**Game length matters next.** A lap on 40 squares takes ~5.7 rolls instead of
~4, so the old 24-circuit limit was not enough turns to acquire, trade and build.
Swept at two seats:

| circuits | 24 | 36 | 48 | 60 |
|---|---|---|---|---|
| games decided by absorption | 7% | 23% | 53% | 67% |

The default is 48, which is roughly 80 turns at two seats.

**Ruled out: the money supply.** Sweeping the lap payment from ₡200 down to ₡100
and tripling upkeep moved the four-seat rate not at all.

**Ruled out: the auto-liquidation safety net.** Only 4–9% of players ever need it
against their largest exposure, so it is not what catches them.

Current, 120 games each: two humans **57/120**, plus one opponent **45/120**,
plus two **20/120**, one human against three **50/120**. Vassalage appears
somewhere in **103 of 120** four-seat games. All enforced as tests.


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
