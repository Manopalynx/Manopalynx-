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
test/        132 passing (plus a browser probe across five viewports)
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

## Money, and what happens when you run out

Nobody can go below ₡0 and nobody leaves the table. When you owe more than you
hold, `liquidate()` runs first: it breaks citadels, sells garrisons largest stack
first, then mortgages your cheapest holdings. Only if that is still not enough
does anything else happen, and it depends who you owe — **the bank** gives you a
debt marker at 10% a turn, **another player** takes what is left and your oath.

That last step is rare. Liquidation covers it most of the time, which is why it
must say so: it used to strip a board in complete silence, and a player could
watch their position collapse and reasonably conclude the game had done nothing.

**A human is asked rather than stripped.** A rent, tax or upkeep bill you cannot
cover parks the game in a `settle` phase and offers a sheet: pledge a holding,
sell a garrison, break a citadel, or press **Auto** for the same order the
opponents use. Only when you say so does the payment go through — and if what
you raised still is not enough, the usual consequence follows.

*Pledge*, not mortgage: "rent" already means what an opponent pays you, so using
it for raising money against your own holdings would point one word in two
directions. The stored field is still `mortgaged` so older saves still load.

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

| circuits | 48 | 72 | 96 | 120 |
|---|---|---|---|---|
| 2 seats | 8% | 20% | 44% | 56% |
| 3 seats | 16% | 56% | 68% | 76% |
| 4 seats | 12% | 28% | 36% | 48% |

The default is 72. Past that a two-seat game runs beyond 170 turns, which is
authentic Monopoly and too long for a phone. A game that runs out of circuits
ends on totals and offers to play on.

An earlier version of this table read 53% at 48 circuits. That was wrong, and
worth recording why: `pay()` handed `liquidate()` the **shortfall** rather than
the total, so it stopped one gap short and bankrupted players who still had
assets to sell. Every absorption figure measured before that fix was inflated.

**Ruled out: the money supply.** Sweeping the lap payment from ₡200 down to ₡100
and tripling upkeep moved the four-seat rate not at all.

**Ruled out: the auto-liquidation safety net.** Only 4–9% of players ever need it
against their largest exposure, so it is not what catches them.

Current, 120 games each: two humans **57/120**, plus one opponent **45/120**,
plus two **20/120**, one human against three **50/120**. Vassalage appears
somewhere in **103 of 120** four-seat games. All enforced as tests.


## How the three of them trade

They are not the same opponent with different lines. Each reads the board its
own way, and the differences are visible at the table.

**Pricing a threat.** Handing over a square that helps a rival costs them
something in their own reckoning — more when it completes a set, less when it
merely brings someone within one. What an opponent charges for the last Eden
square, by how much of Eden you already hold:

| you hold | Spector | Varan | Vale |
|---|---|---|---|
| none | ₡430 | ₡800 | ₡180 |
| one of three | ₡570 | ₡1,230 | ₡200 |
| two of three | ₡810 | ₡1,530 | ₡340 |

Vale sells Eden below its ₡200 list when you hold none of it — he rates it 0.75
on prestige and genuinely does not want it.

**What they chase when no set is one square away.** Spector goes where the board
pays back fastest. Vale goes for the address. Varan goes for whatever stops
somebody else — he will buy the square *you* need from a third party, gaining
nothing but your set.

**Refusing.** A refusal names a price. Spector states the true figure and will
not move off it; Varan asks over the odds and sometimes declines to answer at
all; Vale shades his own price down because he would rather deal than not.

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

There is a **☰** in the top bar for the menu: the score, the traffic table, and
a way out of a game in progress. Anything destructive arms before it fires — one
tap turns the button into a warning that names the consequence, a second commits.

Both orientations work. Turning the phone sideways does not make the board any
bigger — it is square, so it is bound by the short edge either way — but it moves
the chips, buttons and ledger into a column beside it instead of leaving ~250pt
of slack under it with nothing to do.

The service worker is network-first, so a pushed change arrives the next time the
app is opened with a connection. If a change seems not to have landed, close the
app fully (swipe it away) and reopen it.
