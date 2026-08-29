# Grandiose — The Column

A tactical drafting autobattler set in *Grandiose: The Rise to Power* (S. T. Chalk, 2026).
Two commanders draft armies from what the war makes available, surrender control, and
watch the consequences. Portrait, phone, one hand.

**It is built, published and playable** at
[`/Manopalynx-/column/`](https://manopalynx.github.io/Manopalynx-/column/), on a phone,
offline, from the Home Screen.

## How to read this document

**The first section is the design as proposed. Everything after it is a build log**, in
the order it was built, and each entry is what was true when it was written. That format
is deliberate — it keeps the wrong turns and the measurements that corrected them — but it
has one cost worth stating at the top: **a heading that says "Still open" was still open
*then*.** Later sections supersede earlier ones without going back to strike them, so the
last mention of anything is the true one.

So this section, and only this section, is the present tense. **Where it and the log
disagree, this wins; where this and the code disagree, the code wins** — every figure below
is printed by a suite named beside it, and none of them is typed here from memory.

Sam owns every decision here. Where a choice is still open it says so rather than guessing.

## Where it stands

`BUILD` is `column-v14` in `data.js`; the service worker that carries it is
`grandiose-v88` in `docs/sw.js`, and those two move together or the phone gets a stale
build.

**A match.** Five lives. Three picks a round, each a blind simultaneous commitment
revealed before the next; three cards offered a pick. A round ends when one army is wiped
out, the loser drops a life and opens the next round with **one extra pick**, and the
field resets. Deployment is by role — artillery at the back, then ranged, then the line,
least durable first inside a band.

**A market, every third round.** Both sides earn a purse of ₡10 at a round's end and the
winner also takes **one credit a surviving body**, which is the only rule in the game that
pays for winning *cleanly*. The market sells what the draft cannot: a named card (₡21), a
level on a card you choose (₡18), a life (₡44), a wider offer next round (₡14), a piece of
kit that lasts the run (₡30), sabotage on a card the opponent holds (₡26), a one-shot
order for next round (₡11–₡20), and **one of three special units** (₡70–₡90, one of each a
side, never dealt by the draft).

**A run.** Match after match against `vex → hale → harlow → leader → varan`, the army
redrafted every time and the **credits and the lives carried**. The opponent starts each
match with ₡18 a match already survived and gains an extra pick a round every third match.
After each match survived you take **one booster of three offered**; the opponent takes one
at random. The pool is three, so the whole of it is on screen and the decision is the order
you take them in.

**The roster is fifteen cards** — twelve the draft deals, three the market sells. Every
line on every card is the author's; one unit, the Deflector, was invented for the game and
says so on its own card.

| what | measured | by |
|---|---|---|
| single-type pairings settled 95/5 | 86% — counters are decisive, as intended | `test/matchup.mjs` |
| mixed nine-card armies settled 95/5 | **59%** — open, and his call | `test/match.mjs` |
| alternation, worst persona table | 49–59%, neither snowball nor oscillator | `test/match.mjs` |
| bodies a side at the end | 34–38, legible on a portrait phone | `test/match.mjs` |
| battles unresolved at the tick ceiling | 0% | `test/match.mjs` |
| a floor player against each persona | Vex 88%, Hale 82%, Harlow 55%, Leader 71%, Varan 30% | `test/match.mjs` |
| throwing the opening round | **+4.3pt** over 15,000 paired matches, worst +10.9pt vs Harlow | `test/match.mjs` |
| boosters worth more than taking none | **all three**, isolated | `test/match.mjs` |

**One of those is red, and it is a decision rather than a tuning miss.** 59% of mixed
compositions are settled 95/5; his answer is battlefield variety rather than softer
counters, and the mechanism is unspecified and deliberately not guessed at.

**Boosters.** Three, after eight were measured. A fourth pick, Veterans, The Vanguard —
isolated against a run that takes none, +0.44 (9.2σ), +0.85 (15.8σ) and +0.20 (4.2σ). Five
others measured between +0.05 and +0.09, inside noise, and were cut. See *The pool is three
because a run is 1.4 matches* below: the finding is not about which boosters, it is that a
run is too short for one to compound.

**Also open:** **merging** — design point 4, specified and never built — and whether the
opponent gets back the strength its shopper rewrite cost it. Throwing the opening round
still pays +4.3pt and is still legitimate, by his ruling, until he has played the game.
Nothing else in this document is open, whatever an older heading says.

## Why "The Column"

A column is a column of figures and a column of troops, and the novel uses both meanings
on purpose — *"the column I show no one"*, and Chapter 37, **Both Columns**, where the
Union fires into two enemy fleets at once and Samuel thinks *"we fired into both columns,
and the sum came out ours."*

The companion game is *Grandiose — The Ledger*. Same world, same idea about power, a
different shape: the Ledger is that idea as accounting, the Column is it as a battlefield.

## The frame: why you draft instead of choosing

An autobattler has one honest design problem — why can't the commander simply pick the
units they want? If the fiction has no answer, the randomness reads as an arbitrary rule.

The novel answers it in Chapter 1, and the answer is the Union's founding method:

> Every conquest would be entered twice: once in their ledger, as territory pacified in
> the Dominion's name, and once in ours.

**You are not a general. You are the Union.** You fight somebody else's war under
somebody else's flag and take payment in hulls, yards and veterans. What arrives each
round is what the forge stamped out, what the Compact worlds sent, and what the last
battle left you standing. You do not choose your army. You choose **which of three
available things to enter in your own column**, and you find out at resolution whether
the trade was sound.

That frame does the work for all three of the mechanics:

| mechanic | what the fiction says |
|---|---|
| three cards, not free choice | this is what the war made available this round |
| control surrendered at the bell | you are the ledger, not the hand. You priced it; now it resolves |
| the losing player drafts again | **the Leader's own doctrine** — see below |

## Losing buys something

This is the novel's thesis and it is already Sam's mechanic, arrived at independently.
The Leader spends the Vanguard — eleven thousand crew — to take the Dominion's undefended
core, and tells the council:

> The Vanguard's sacrifice was not in vain. It purchased the war.

So the comeback draft is not a pity mechanic. **A round you lose pays for the round after
it**, and the interface should say so in those terms. Losing badly should buy more than
losing narrowly, which makes conceding a round a real decision rather than a failure.

## What the player is actually buying

The book's ending is that winning bought nothing — *"the moral expenditure had bought a
stay of execution"*, and the Main Mind is coming anyway. **Sam has confirmed this is the
theme of the game as it is of the novel and of the first Grandiose.**

So the meta-layer is not "get strong enough to win". It is **how long can you hold, and
what do you carry forward**. A run ends; the swarm does not. What persists between runs is
the collection, and the collection is the purchase.

This is a deliberate choice and it has a cost: a game that never lets you win can read as
punishing rather than tragic. The mitigation is that a *run* has a clean win condition —
you beat the opponent in front of you — and only the frame around runs is unwinnable. If
that stops being true in play, it is the first thing to revisit.

## The roster: shape, not contents

**Twelve cards, confirmed by Sam, in three weight classes — heavy 1 body, medium 2,
light 3.** Room to add more later if twelve stops feeling like enough. Enough for a counter-graph
with real cycles; small enough that every pairing can be swept exhaustively (12 × 12 = 144)
and that the first playable build is one session's work rather than five. Say a number and
this changes.

Every unit comes from the novel. Nothing is invented, because nothing needs to be — the
book already supplies a complete set of interlocking answers, earned over 86,000 words
rather than balanced on a spreadsheet:

| role | from the book | what answers it |
|---|---|---|
| **Walker** | four storeys, main cannon, Dominion | the knee joint; terrain — Horizon's terrace cut |
| **Ultra Armor** | massed fire *"skidded off the black plate like rain off glass"* | ship-grade weapons, or a crack in the shoulder |
| **Karkinos** | **four** vast legs, climbs sheer walls, breaches by going over | fire under its arc while it is committed to the climb |
| **Amabie** | walking siege gun, indirect, huge reach | anything that closes |
| **Crawler swarm** | dog-sized, moves on walls and ceilings | area effects — **and it converges on mass, so it can be baited** |
| **Brute** | four arms, absorbs massed fire | concentrated single-target |
| **Neurite** | upright, disciplined, *"whatever is behind their eyes was aiming"* | disruption before it settles |
| **Acid** | slow, clings, **keeps eating after the hit** | killing the carrier before it lands |
| **Volt / arc** | Basileian; **does not need to hit**; ignites ground and water | dispersal |

### The two signature cards

Both are the book's, and neither exists in any other game in the genre because neither
came out of a design document.

**The shield that stops fast things and not slow ones.** The Kraken's shields drink the
firepower of two fleets and let drifting debris settle on its back, and Samuel reads the
sensor logs and finds it:

> Its shields are tuned for weapons fire. Pods fall through.

A defence that beats every projectile in the game and loses to anything that arrives
slowly. Counter-intuitive, learnable, and unforgettable once a player has been caught by it.

**The unit whose job is to be attacked.** Samuel's order at Enigma — every fourth ship
emptied of crew, flown into the swarm's centre, reactors rigged:

> The swarm did its doctrine — converged, engulfed, clung to the hulls in joyous feeding
> thousands — and Samuel stood on the Orion's bridge with his hands behind his back,
> counting escape pods.

A card you draft in order to lose it, at a moment you choose. It pairs with the crawler
swarm's convergence rule, so the two together are a small system rather than two effects.

## The condition that decides whether this is a game

**This is the go/no-go, and it is written to be failed.** `test/matchup.mjs` runs every
unit against every other over many seeds and prints the win matrix. Three claims:

1. ~~**No dominant unit, no dead unit.** Across the whole pool, no unit's overall win rate
   exceeds **65%** and none falls below **35%**.~~ **Deleted — see the findings.** It
   measured single-card-type armies, which is the case Sam's direction says is allowed to
   be lopsided, and its band was finer than the model can resolve. Replaced by *local
   counters are decisive*, and by the composition claims in `test/match.mjs`.
2. **Real cycles.** The matrix contains at least one three-cycle — A beats B beats C beats
   A — with every edge at **60/40 or wider**, and **every unit appears in at least one
   such cycle**.
3. **Every unit is somebody's answer.** For each unit U there is some V for which U has the
   best record of anything in the pool.

If the matrix comes back flat, **the roster changes while there is no interface to change**.
One session spent instead of five.

### What the sweep must not do

`sweep.mjs` in the Ledger seated two humans at three of its four tables for its entire
life, while Sam plays one human against three opponents — so every conquest figure in that
repository described a game he does not play, and it reported an effect backwards to him
twice. That is the most expensive mistake in this record and it is cheap to avoid here:

- **The sweep seats one human policy against one named persona**, at the real number of
  lives, with the real draft rules. Not two AIs, and not a shortcut resolver.
- **Every figure prints its table composition beside it.** Composition is the invisible
  part; abbreviating it to a number is how it stayed invisible for months.
- Pairwise figures describe *units*, not the game. A separate instrument sweeps **whole
  drafts**, because a lever measured alone tells you about the lever.

## The opponents, as drafting policies

Sam asked for AI types that play to their personalities. In the Ledger a persona is voice
lines plus two constants; here **the personality is the strategy**, and each is the book's:

| persona | drafts |
|---|---|
| **Varan** | to deny. Takes what *you* need, not what he needs — the auditor who *"was not reading for what was there. He was reading for the shape of what wasn't."* |
| **The Leader** | to spend. Concedes early rounds deliberately to buy the late one |
| **Harlow** | to keep. Durable, refuses trades, nothing dies that did not have to |
| **Hale** | to schedule. Front-loads, presses tempo, closes early |
| **Vex** | to profit. Takes the biggest number every time — **and can defect**, as he did at Eden |
| **The Neurex** | does not draft. **Converts what it kills into its own force** |

The last is the asymmetric endgame opponent and it is Chapter 57 as a mechanic.

**What the AI knows** (Sam's decision, taken): both sides see the board after round one,
and neither sees the other's picks within the current round. Symmetric, and it makes the
step Sam's brief calls having "additional information about the opponent" true for both
of you rather than for one.

**And the sweep runs in both directions.** The Ledger had five things an opponent could
never do, then a sixth, then one thing a *player* could do that no opponent ever had —
which is why a money pump survived three hundred-game sweeps. Here the two sides draft
from one pool, so the symmetry test is nearly free: assert every card is reachable by
both, every round.

## Architecture

The Ledger's shape, for the reason the Ledger's document gives — *"the engine is a pure
function of its seed and the actions applied to it, which is the only reason those figures
can be asserted at all"*.

```
docs/column/data.js     units, cards, personas, prices — data only, no logic
docs/column/engine.js   the rules. No DOM, no timers, no Math.random
docs/column/render.js   the battlefield, in FIELD UNITS. Knows no pixels either
docs/column/glyphs.js   fifteen unit marks as SVG paths, each drawn from a line
docs/column/ui.js       the screen. Reads the log; never computes an outcome
docs/column/test/       tests, and the instruments that explain a number
```

Five modules, and **all five are in `docs/sw.js`**. `glyphs.js` once was not: online the
page loaded it and looked perfect, offline it painted nothing, and no test noticed until
`test/offline.mjs` learned to walk the import graph from each published page rather than
trusting a hand-written list.

**One addition, and it is the most important decision in the build: the resolver emits a
replay log, and the renderer only ever reads that log.** Every tick, every move, every
target, every hit.

- The screen **cannot** disagree with the outcome. The class of defect that put three
  Contingency cards on the wrong square for months becomes structurally impossible.
- "Inspect what worked" — the third step of **Sam's** loop, from his brief rather than
  from the novel — becomes readable from data rather than inferred from watching. The
  whole cycle hangs on that step.
- Tests assert on the log, not on pixels.

### Publishing

It lives at `docs/column/`, which Pages serves at `/Manopalynx-/column/`, so it reaches
the phone.

> **This paragraph used to say it gets its own service worker and its own cache prefix. It
> does not, and the truth is the opposite.** A worker's scope is the folder its script sits
> in, so `docs/sw.js` is in charge of everything under `docs/` — the column folder
> included. There is one worker, **one cache** (`grandiose-v88`), and **one `addAll`, which
> is atomic**: a single bad path in `docs/sw.js` takes down the precache for all three apps
> at once, which has happened. Shipping the Column means bumping that shared `CACHE`, and
> a row in `APPS` in `docs/sw.js` and in `test/offline.mjs`. See `docs/README.md`.

That is what makes it work on a train and stops shipping it deleting Grandiose's saved
files — and none of it is optional.

## Canon

**The setting belongs to the author.** Same rule as the Ledger, enforced the same way:
every line lifted from the novel is marked in the data and rendered differently on screen,
so Sam can strike anything written for the game without opening a file. A test fails if
the proportion of the author's words drops.

Nothing in this document invents canon. Where it proposes something — the frame, the
counter-graph thresholds, twelve units — it is a proposal and says so.

**That was not true of the first draft, and the correction is worth recording.** It gave
Varan the line *"I did not want it. You wanted it more."* and attributed it to the novel.
The phrase appears in the manuscript **zero times**: it is a persona line written for the
Ledger, living in `data.js` beside the ones that are quoted, and it read exactly like the
book because it was written to. Checking every attributed passage against the manuscript
caught it; nothing else would have. Three earlier sessions made the same class of mistake
about this novel — an invented plaza, a faction built out of a fragment, a name reported
absent because the grep used a straight apostrophe against a curly one.

So the rule for this project, and it is mechanical rather than remembered: **every passage
presented as the author's is checked against the manuscript before it ships.** The
manuscript is not in this repository and must not be — the repository is public, and it is
his book.

## Open, in the order it needs answering

1. **Roster size.** Twelve is an assumption, not a decision.
2. **The numbers in the go/no-go.** 65/35, 60/40, one three-cycle. They are first guesses
   chosen to be checkable, not measured. The first sweep will say whether they have any
   room in them — and if a tolerance change flips everything at once, the metric is wrong
   rather than the threshold.
3. **Round structure.** How many lives, how many draft picks a round, whether the board
   persists between rounds or resets.
4. **Whether a run can be won.** Settled in principle — a run yes, the war no — but the
   shape of an ending has not been designed.


---

# What the sweeps found

Measured, not proposed. `test/matchup.mjs` is the unit graph; `test/match.mjs` is the
round structure. Both reproducible from a seed. Sam's design direction of 28 August is
implemented: three weight classes, decisive counters, no combat randomness.

## The unit graph passes

| claim | result |
|---|---|
| local counters are decisive | **holds** — 79% of single-type pairings settle 95/5 |
| real cycles, every unit inside one | **holds** — 129 three-cycles at 60/40 or wider |
| every unit is the best answer to something | **holds** |

The old first claim — nothing above 65% or below 35% — was **deleted, because it measured
the wrong thing.** Sam's principle is *decisive local counters, but rarely a single
decisive counter to an entire composition*, so a one-card-type army beating another
outright is the target. It was also finer than the model can resolve: at 79% decisive, an
overall win rate moves in steps of 1/11.

**Weight classes bounded the crowd by construction**: heavy 1 body, medium 2, light 3, with
`count` derived from the class so a card cannot disagree with itself. Twenty-six cards used
to be able to put 260 bodies on the field; the ceiling is now 78.

## Losing on purpose does not pay — which Sam asked to be tested rather than guarded

`thrower` deliberately loses its opening round to bank the extra pick, then plays to
counter. `counter` plays straight. Same opponent, same 300 seeds:

| | match win rate |
|---|---|
| playing straight from pick one | **51.0%** |
| throwing the opening round | **34.3%** |

**Throwing costs you seventeen points.** The extra pick compensates for a lost round; it
does not overpay for one. No anti-exploit system is needed, which is the answer Sam wanted
before anyone built one.

## The one real problem, and it is structural rather than a tuning miss

Three claims fail and they are all the same finding: **raw card count dominates
composition**, which is precisely what design point 6 refuses.

| | |
|---|---|
| one extra card against an otherwise identical army | wins **80%** |
| two extra cards | 88% |
| three extra cards | 89% |
| mixed nine-card armies settled 95/5 | **72%** |
| alternation (winner of a round wins the next) | 50–69% |

It saturates after the first card, which is the signature of **Lanchester's square law**: in
a fight to annihilation, N bodies have N times the health *and* N times the output, so an
edge of one compounds into a near-certain win. That is arithmetic, not balance — no amount
of stat tuning will move it, and it is why the alternation figure also refuses to come down.

**One real bug was found and fixed on the way**: a card's bodies deployed 14.3 field units
apart, spread across the whole rank, while splash radii are 8–16. A three-body light squad
was therefore wider than any blast could reach, so AOE hit exactly one body and the
"AOE punishes numbers, durability absorbs AOE" mechanism could not fire at all. Bodies of
one card now stand together. It improved the unit graph and did **not** fix the square law,
which is how we know the two are separate problems.

### What would actually fix it — Sam's decision

1. **Frontage.** Cap how many bodies can engage at once, so extra cards add depth and
   reserve rather than multiplied firepower. This is the standard answer to the square law
   and it is diegetic — a battle line has a width. It would also help legibility.
2. **Make AOE scale hard with density**, so more bodies is self-punishing and the extra
   card buys less the more you already have.
3. **Accept it and change the comeback rule** — if an extra card is worth 80%, the loser's
   bonus is not a nudge, and the design would be honest to say so.

I would take (1). It is the only one that attacks the mechanism rather than its symptoms.

## Still open

- **The field is 108 bodies on screen at the end**, about 45pt each on a 393pt portrait
  field. Better than 171 but not yet legible; frontage would help here too.
- **Upgrade cards and merging** (design points 3 and 4) are specified and unbuilt. They
  need the square-law question settled first, because both change how numbers convert into
  strength.
- A round runs up to about 80 seconds at its longest.


---

# Movement: line and seek

Sam approved this and the manuscript decided it. Combat now has two movement modes, set
per card in the data rather than as one rule in the resolver:

- **`line`** (nine cards) — advances with the army at one **`COLUMN_PACE`**, holds
  formation, fights whatever comes within reach.
- **`seek`** (three cards) — leaves the line and crosses the field for whatever `tgt`
  names.

**The three seekers are seekers because the book says so.** The Karkinos *"hauled itself
over the wall's crown"*; the crawlers move *"up the walls and along the ceiling, moving in
all planes at once"*; the fireship's entire purpose is to reach the enemy's centre. None of
that was a design choice — it was research.

## This is what fixed the square law

> **CORRECTED, one session later. This heading is wrong and the table under it is
> substantially an artefact.** The movement rule described here marched both armies
> straight *through* each other and out of the far wall, and **28% of battles never
> finished** — they hit the 3000-tick ceiling with both sides alive. Every figure in this
> file counts a draw as half a win, so a third of the battles were quietly voting for
> "contested" without ever being fought. With the movement defect fixed and battles
> actually resolving, one extra card wins **82%**, not 59%. See *Marching through each
> other* below. The rest of this section — the two movement modes, the four wrong turns —
> still holds; only the balance claim does not.

The frontage rule proposed earlier is **not needed**. Correct formation does the same job,
because a line that holds means extra bodies queue behind it instead of all engaging at
once — which is what frontage was for.

| | before | after |
|---|---|---|
| one extra card against an identical army | 80% | **59%** |
| mixed nine-card armies settled 95/5 | 72% | **29%** |
| local counters decisive | 79% | 73% |
| three-cycles, every unit inside one | 129 | 66 |
| losing on purpose | doesn't pay | doesn't pay |

**Design point 6 now holds**: card count is an advantage rather than a result, and
compositions are contested rather than settled at the draft. The unit graph still passes
3 of 3 and the match claims went from 1 of 5 to 3 of 5.

## Four wrong turns on the way, all cheap because the render caught them

1. **One global movement rule** deleted three cards. Karkinos, Volt and Crawler Swarm fell
   out of every cycle and the graph went 3 of 3 to 0 of 3, because their identity is
   *where they walk*. Reverted, then done per-card.
2. **"The column marches at the pace of its slowest"** is a good sentence and a bad
   implementation: the slowest is the artillery at 0.28 against a crawler's 2.1, so the
   whole line crawled for forty seconds while ranged cards shot it. `COLUMN_PACE` is one
   fixed number now, and **`spd` means nothing for a card that marches in formation** — it
   is a seeker's stat.
3. **Line cards with nothing in reach fell through to `continue`** and never advanced at
   all. Every line card stood on its start line for the whole battle while the seekers
   fought alone. The render showed it in one frame: two untouched rows and a scuffle in
   the middle.
4. **Karkinos has four legs, not six.** Corrected above; it was invented.

## Still open

- **Alternation sits at 65%**, right on the boundary. The loser's bonus is still very
  slightly light.
- **107 bodies on screen at the end.** Untouched by any of this — it is the upgrade-card
  problem, and upgrades are next.

---

# Upgrade cards, and a defect that had been flattering every figure

Two things landed together. The second is the one that matters.

## Upgrade cards — Sam's design point 3

A draft is now a flat list of **pick tokens**. A plain unit id is a reinforcement; `up:walker`
is an upgrade of a card already fielded. `armyFrom()` derives the army from the list, so the
resolver, the policies, the tests and eventually the screen all read the same rule instead of
each keeping a copy of it — and a draft containing no upgrades is byte-for-byte the array of
ids it was before, which is why every earlier test still measures what it measured.

- **+35% health and every damage channel per level**, to three levels. Direct, splash, the
  burn, the aura and the detonation all scale; **`count`, armour, range and speed do not**, so
  an upgrade makes a card more of itself and cannot turn it into a different card.
- **Only offered for a unit type you already field.** An upgrade to nothing is a wasted pick,
  and a player cannot be asked to guess whether it applies.
- Every drafting policy scores it through one function, `gain()`. A reinforcement is worth
  what it puts on the field; an upgrade is worth what it adds to the copies already there —
  which is why upgrading gets better the more of a card you hold, and why no persona needed
  its own opinion about upgrades.

**They do the job they were added for.** The crowd was the open problem: 107 bodies on a
393pt screen at the end of a match.

| | before | after |
|---|---|---|
| bodies a side at match end | 53 | **35** |
| bodies on screen | 107 | **70** |
| share of picks spent on upgrades | — | **28%** |
| round-to-round alternation, worst table | 65% | **54%** |

Alternation moving off the 65% boundary is the open item from last session closing, but
**both changes landed in the same session and I have not separated them** — the movement fix
below could account for some of it.

## Marching through each other

**The Volt Battery has range 0.** It never acquires a target, because `reach` filters foes by
range before targeting. A card with no target advanced by a **fixed downfield sign** — so it
advanced, and kept advancing, past the enemy and into the far wall. Two batteries finished a
battle pinned to opposite edges of the field at full health, three thousand ticks, a draw,
with the aura — the entire card — having touched nothing.

**28% of battles ended that way.** And a draw is scored as half a win everywhere in
`match.mjs`, so a third of the sample was voting "contested" without ever being fought. That
is what the previous session's headline finding was made of.

The fix is two lines and a constant: a marching card advances **toward the nearest enemy and
never past it**, and may only close **sideways** once it is already at the line of contact
(`CONTACT`). Marching straight is what holds a line; without any sideways component at all,
two lines a few units offset stand level with each other and never touch — that variant draws
17%.

| | before (as reported) | with battles that finish |
|---|---|---|
| battles ending in a draw at the ceiling | **28%** | **0%** |
| one extra card against an identical army | 59% | **82%** |
| mixed nine-card armies settled 95/5 | 29% | **65%** |
| local counters decisive | 73% | **86%** |
| three-cycles, every unit inside one | 66 | **126** |

The unit graph got *better* — 3 of 3, 86% of pairings decisive, 126 cycles. The balance
figures got worse, because they had been measuring unfinished battles.

**The guard is in the suite, not in this file.** `match.mjs` now asserts that fewer than 5% of
battles reach the tick ceiling, and prints the rate beside every contested figure it reports.
A test naming the Volt Battery would have caught the Volt Battery.

## Design point 6, measured as what Sam actually asked for

The old check asserted "one extra card wins ≤70%". That threshold was invented here, not by
him, and it is the wrong question: he asked for numerical advantage to be **non-linear**. So
measure the same advantage at every army size a match reaches.

| army size | one extra card wins | a quarter more army wins |
|---|---|---|
| 2 | 94% | 96% |
| 4 | 92% | 91% |
| 8 | 89% | 94% |
| 12 | 75% | 96% |
| 16 | 75% | 96% |

**The comeback pick is self-limiting** — the same extra card is worth 94% to a small army and
75% to a large one, so the loser's bonus cannot compound into a runaway. That is design point
6 holding.

**A proportional edge is not.** A quarter more army wins ~96% at every size. Force advantage
in proportion is decisive, full stop, and no geometry fixes it: frontage was swept at 3, 4, 5
and 6 cards a rank and narrower ranks were *worse*, not better.

## Still open — and the first one is Sam's decision, not a tuning miss

- **65% of mixed nine-card armies are settled 95/5.** Combat has no randomness and runs to
  annihilation, both by design, so two fixed armies have a fixed answer; the closeness has to
  live in composition and at 65% it mostly does not. The levers are his: stronger AOE and
  durability non-linearity (his point 6, applied harder), an engagement cap, or accepting that
  the draft is the game and the battle is the reveal. Nothing here should be tuned until he
  picks one.
- **Merging** — design point 4 — is specified and unbuilt.
- **`docs/column/test/look.mjs`** draws the same real tick three ways at 393×852 to answer
  Sam's question about a tactical map. Nothing is chosen yet.

---

# It is playable

`docs/column/index.html` is the game on a phone. Portrait, one page, four ES modules, no
build step; it registers the site's service worker so it opens on a train.

**Sam chose treatment C from `test/look.mjs`: one counter per card.** Bodies still live and
die one at a time in the engine — the renderer aggregates them, and that halves the marks on
screen for the same battle. Shape is the weight class (**square** heavy, **diamond** medium,
**circle** light), the letter is the card, and colour is the side. Twelve hues are not
tellable apart on a phone; twelve letters are.

**Cosmetics are later. Readability is not** — design point 7 is a rule about whether the
counters are learnable at all, so it was settled with the renderer rather than after it.
Every counter carries a strength bar, a survivor count if the card deploys more than one
body, and a chevron per upgrade level. Tapping one names the unit, its traits and its line
from the book — **and whether that line is the author's or was written for the game**, so
Sam can strike mine without opening a file.

## What the interface is not allowed to do

**Every rule lives in `engine.js` and `data.js`.** The page draws, listens and animates. It
never decides who won, never scores a card, never lays a body out: the deployment shown
between picks is `deployment()`, the battle played back is the resolver's own tick sampler,
and the loser of a round is the resolver's answer. There is nothing for the screen to
disagree with, which is the only defence against the Ledger's oldest defect — a sentence
that was numerically correct and false.

The card faces are derived too. `traits()` reads the same numbers the resolver reads, so
changing a range in `data.js` changes what the card says about itself.

## `test/play.mjs` — nine claims against the real page

It serves `docs/`, opens the real URL and plays a whole match through, tapping. Three of the
nine matter:

- **Counters drawn equal cards drafted, every round, both sides.** Mutation-tested: grouping
  by unit type instead of by card draws 22 counters for 38 and the check goes red.
- **The arithmetic closes** — hearts left on screen against rounds played. The first version
  compared the round count on screen with the round count the harness had just counted
  itself, and **stayed green through a mutation that spent a life on every other round**.
  It now reads the hearts, which is what the player reads.
- **Nothing threw, start to finish.** A module that fails to load paints an empty screen and
  says nothing, which on a phone is indistinguishable from a slow page.

Two defects it found on the first run, neither visible in the source: bodies killed during a
tick are still in that tick's frame with negative health, so the strength bar was drawing at
width −2.1 and erroring every frame; and the playback ran at a fixed speed, so a long round
took twenty seconds. The speed is now chosen per battle to land near four seconds.

`test/offline.mjs` gained The Column's row and immediately caught a third: `addAll` is
atomic, so the bare `./column/` directory entry — which the test server 404s — took the whole
precache down with it, and **every app lost its offline files**, not just this one.

## Running it

```
node docs/column/test/matchup.mjs                       # the unit graph
node docs/column/test/match.mjs [matches]               # the match structure
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node docs/column/test/play.mjs    # the page
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node docs/column/test/look.mjs    # the three looks
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/offline.mjs             # all three apps offline
```

Never two Chromium suites at once, and never into one log: both give false reds and
interleaved output that reads as a pass.

## Throwing the opening round pays, and stays legal

Sam asked for this to be tested rather than guarded, and the answer has **flipped** now that
upgrades exist: an extra pick banked early buys an upgrade, and upgrades compound with how
many copies of a card you hold.

| opponent | play straight | throw round one | |
|---|---|---|---|
| Varan | 48.6% | 51.7% | +3.1pt |
| Harlow | 60.7% | 69.5% | +8.9pt |
| Hale | 91.7% | 93.1% | +1.3pt |
| The Leader | 81.7% | 85.6% | +3.9pt |
| **all** | **70.7%** | **75.0%** | **+4.3pt** |

6,000 paired matches, same seeds both sides. **His decision: leave it legitimate until he has
played the game.** So `match.mjs` no longer asserts that it does not pay — it asserts the
edge stays under 15 points, which is the difference between a line a good player can take and
the only way to play.

## The way out of a match

Tapping the header — *Round 4 · Varan ☰* — pauses. Roster, abandon and start again, or back
to the round. Without it the roster was reachable only before the first pick and the
opponent could not be changed without spending five lives or clearing browser storage:
technically present, unreachable, which reads correctly as not shipped.

`play.mjs` exercises it mid-match and backs out again. **The first version of that check was
worthless**: with the close button broken, every part of it still passed — the cards are
still in the DOM under the overlay — and the suite only failed thirty seconds later on a
click that landed on the sheet. It asserts the sheet is *gone* now, and bails rather than
playing on, so a broken pause reports as a finding instead of a crash.

# Sam's first three notes, all built

He played it and sent three. All three were interface, all three were clear, and one of them
had a trap in it.

**1 and 2 — projectiles, area damage, and a flinch.** The resolver has emitted a full replay
log since the engine was written — every hit with attacker, target and damage, every death,
every detonation — and **nothing had ever read it**. A battle was a crowd of markers thinning
out for no visible reason. `keepLog` is on now and `render.js` draws it:

- a **tracer** from attacker to target when the attacker's range is what the resolver calls
  ranged; a spark at the point of impact when it is not
- a **splash ring** at the target using the attacker's own `splash` radius, and a detonation
  ring using its own `boom.r` — so a ring that looks wrong means a number is wrong in
  `data.js`, and it is wrong in the fight too
- a **white rim and a half-unit shake** on any counter that took a hit
- **aura circles** as standing ground rather than as events, because an aura needs no attack
  and never appears in the log

Nothing here invents a rule. Every radius, every range test, comes from the same data the
resolver read.

**3 — you at the bottom, them at the top.** His reasoning: the cards are at the bottom, so
after every pick your eye had to travel to the top of the screen to see what you bought.

**The trap: the mirror is in the renderer and nowhere else.** Flipping the engine would
change the deployment jitter, and with it every seeded battle, every figure in this folder's
tests, and every saved match. It is one function, `flipY`, in the only layer allowed to have
an opinion about screens. Your hearts moved down beside your cards; theirs stayed in the top
bar with their half of the field.

`play.mjs` grew two claims, and the second is a **differential** — zero effects on a drawn-up
field, more than zero mid-battle. An absolute count would pass on a renderer that draws a
ring whether or not anything fired. It caught its own first version immediately: aura circles
carried the same class as event effects, so a still field reported four "shots".

# Notes four to six — the deck was moving the battlefield

**4 and 5 are the same fault seen from two sides, and 4 was never about the cards.**

The deck is a **flex sibling of the field**. Every pixel it gains or loses comes out of the
battlefield, so the whole board slides. Four separate things were changing its height:

| what | how much |
|---|---|
| the card row emptying when a pick was committed | the whole row |
| cards with a four-line hint next to cards with two | ~20px |
| *"Your extra pick — you lost the round"* wrapping to two lines | 22px |
| **an empty button being shorter than one with a word in it** | 22px |

The last one is the one worth remembering. `visibility: hidden` keeps a button's *box* and
not its *content*, so the deck still resized between a pick and the fight. Everything down
there has a fixed height now — the card row, the status line, the prompt row, and the button
— and **the container decides, not the content**: `min-height` was not enough, because a
taller card still grows the row.

Tapping a marker answers in a panel **over the field** rather than in the status line, for
the same reason: four lines of answer in a fixed-height line either clips or resizes the deck.

**5 — the reveal stopped asking permission.** A Continue button after every selection is a
tap that carries no decision, three times a round, nine rounds a match. The reveal is still
the point — you have to see what you both took — so it stays, at 750ms, with the committed
counters **landing** on the field: a ring that scales in on the card just added, or on *every
copy* of the card an upgrade improved, which is the honest picture of what that pick did.

A saved match reloaded mid-reveal has no timer waiting for it, so resuming makes the same
call the timer would have made, off the same seeded stream — the offer is the one it would
have given.

**6 — the result sits in the middle of the screen**, opaque rather than a wash over the
board, and it says what the match was: cards, picks spent on upgrades, bodies at the end,
lives left.

`play.mjs` is at fifteen claims. Three are new and all three are measurements of his notes
rather than of my intentions:

- **the field's own height never changes during a draft** — a set of every height seen at
  every draft phase, and it must have one member. It reported six at first, then two, then
  one, and the last one was the empty button.
- **no reveal shows a button.** Mutated by putting Continue back: 144 of 144 reveals showed
  one, red.
- **the result headline sits between 22% and 62% down the screen.**

# The units, drawn

Sam asked whether a unit could be more than a shape with a letter in it. The answer was
bounded by measurement rather than taste, so it was measured first.

| | |
|---|---|
| 1 field unit | 3.92pt on a 393×852 phone |
| counter across | **29pt** heavy, 25pt medium, 23pt light |
| nearest neighbour, end-of-match deployment | median **35pt**, smallest 31pt |
| counters overlapping at deployment | **0 of 4,054** |

So the overlaps he saw are mid-battle convergence, not the layout — and **a counter cannot
get bigger**: a 29pt heavy inside a 35pt gap has three points of clearance either side. Any
detail has to fit the 23–29pt already there, which leaves a mark of about 14pt.

**Twelve silhouettes at 14pt are not reliably tellable apart. Four are.** The counter's outer
shape already carries the weight class, so a glyph only has to be distinct from the three
others in its own class — and the roster is exactly four heavy, four medium, four light.
That is the whole reason this works, and it is why `test/glyphs.mjs` lays the sheet out by
class: any other comparison is a comparison the player never has to make.

`test/glyphs.mjs` draws every unit at **both real sizes** with nothing magnified — inside its
real class shape at 3.92pt/unit, and at 72pt on a card face with the detail strokes on. Four
of the twelve failed it on the first pass and were redrawn: the Walker read as a table until
its legs got knees, the Brute as a beetle until its arms bent downward, the Neurite as a head
on a lens until the pupil stopped being as tall as the eye, and the Crawler as a squiggle
until its back closed into a shell.

**Every glyph is from the book**, with the phrase it is drawn from named in `glyphs.js`
beside it: the Brute's *four arms*, the Neurite's *lid-to-lid black eyes*, the crawlers
*dog-sized* and *mid-leap*, the Amabie that *opened the wall at dawn*.

## Provenance, corrected in both directions

Checking the manuscript for drawing references meant checking the lines too, word by word.

**All twelve lines are the author's. Seven were marked "written for the game" and were not.**
Four were verbatim and had simply never been checked; three were his words stitched together
and have been restored to the sentences they came from. So the game had been telling him that
five of his own sentences were mine.

That is the same failure as inventing a quotation, running the other way — and it was *caused*
by the correction to one. An early draft gave Varan a line that reads exactly like the book
and appears in it zero times; the session that caught that over-corrected into marking
anything unverified as invented, and nobody went back with the manuscript open.

The **Karkinos has six legs**, not four. The manuscript says both — *"waiting on its four vast
legs"* of one machine, Samuel's, and *"crab-bodied urban mechs … on six legs apiece, railguns
folded along their backs"* of the squads. A previous session read the first, declared six an
invention, and wrote that down. The card is the type.

`data.js` now carries two separate marks, because they are two separate questions: **`qv`**
says the line is his, **`nv`** says the unit was invented for the game. The Deflector is the
only `nv` in the roster — his line, my unit — and the interface says exactly that, so he can
strike it without opening a file.

## And the module that was not in the service worker

`glyphs.js` is a new file in the page's module graph and was not in `docs/sw.js`. Online it
loads; **offline the page paints nothing and says nothing** — the worst shape a fault can
have. `test/offline.mjs` gained a thirteenth check that follows the import graph from each
published page and asserts every module it reaches is named in the worker's list. Its own
first version followed three files and stopped at the page, because a page enters its module
graph through a `<script src>` and not an import statement; it would have passed with every
module in the game missing.

# Notes eight and nine

**8 — the fight plays 35% slower**, his number. It multiplies the pace rather than stretching
the frame budget, because the budget only governs long battles: a short one already plays a
tick a frame and could not slow at all without a fractional pace repeating frames.

Removing the `Math.ceil` around the speed also fixed a rounding defect nobody had noticed.
The old speed moved in integer steps, so a 246-tick battle was rounded to 2 ticks a frame and
played at nearly **double** the intended rate while a 230-tick one played at the right one.
Playback length was inconsistent for reasons that had nothing to do with the battle.

**9 — formation by role.** Rank 0 sits furthest from the enemy and later ranks are nearer, so
a newly drafted card landed at the **front** whatever it was: an artillery piece arriving in
the front rank because it happened to be the ninth pick.

The bands are **derived from the numbers the resolver already reads**, so a card cannot stand
in a rank that disagrees with what it is, and adding a card never means typing a role onto it:

| band | | |
|---|---|---|
| 0 | `rng > 35` | artillery, at the very back |
| 1 | `rng 7–35` | ranged, behind the line |
| 2 | `rng ≤ 6` | the line itself |

Within a band the least durable deploy first, so the toughest end up nearest the enemy —
armour in front, infantry behind it.

**Measured before shipping, against the previous draft-order deployment:**

| | before | after |
|---|---|---|
| mixed nine-card armies settled 95/5 | 64% | **59%** |
| one extra card against an identical army | 82% | **78%** |
| round-to-round alternation | 56% | 55% |
| draws at the tick ceiling | 0% | 0% |
| unit graph | 3 of 3, 86%, 126 cycles | **unchanged** |

Better on both figures that matter, worse on none. The unit graph is untouched because a
single-type army has nothing to sort.

**Deploying seekers in front of everything was tried** on the reasoning that they charge
anyway, and it is worse — one extra card goes back up to 83% — so they are banded by range
like anything else.

## The ring on the wrong unit

Sam picked an Acid Thrower and the ring landed on his Brute. **A defect introduced by note 9
in the same session that shipped it.**

A counter's key is *where the card deploys*. Formation-by-role made that different from where
it was drafted — and `popKeys` still computed the key from draft order, so the ring landed on
whatever the sort had put in that slot, which is reliably whatever stands at the front.

`formation()` now returns **indices into the draft** rather than a re-sorted list of ids, and
is exported. Returning ids loses which copy is which, and the interface needs exactly that:
with two Acid Throwers there is no way back from an id to the one just added. Both the field
and the ring ask the same function now.

`play.mjs` gained a sixteenth claim — **every ring must sit on a counter whose card id matches
what that side just committed** — and reverting `popKeys` to draft order reproduces his
symptom exactly: *"0:line rung, but side 0 committed acid"*.

**This is the catalogue's own entry and it still got past me**: when you make a structural
move, grep for what assumed the old world.

# The market — stage one of the survival loop

Sam's idea, built inside the match that already exists rather than as a new mode. Two rules
and one screen.

**A side earns 1 for every body it still has standing when a round ends, and the winner also
takes a purse of 10.** The survivor money is the point and it is his: **a win with one
survivor and a win with twenty were identical**, everywhere, in every version of this game.
Nothing else rewards winning cleanly.

Money for **kills was proposed and cut**. A side is already paid for winning, and paying per
kill pays you for losing rounds in which you did damage — the extra-pick comeback a second
time. Two sources, not three, so income is predictable enough to plan against and to tune.

**Every third round a market opens and both sides spend.** The economy is in the engine, not
the interface: a shop only the screen knew about could not be swept, and the first question it
has to answer is whether paying the winner turns the match into a snowball.

It sells what the draft cannot promise:

| | |
|---|---|
| a card of your choosing | 12 |
| an upgrade on a card you name | 10 |
| a wider offer, four cards not three, next round | 8 |
| a life | 25 |

One upgrade row rather than one a card — nine rows at round three and twelve by round nine is
a wall, not a market — and both the card and the upgrade open the same chooser, with every
unit drawn as it will stand on the field.

## What it did, measured

| | before | after |
|---|---|---|
| alternation, worst table | 55% | **62%** |
| final bodies a side | 39 | 38 |
| upgrades as a share of picks | 28% | 34% |
| mixed compositions settled 95/5 | 59% | 59% |
| paid out across a match, both sides | — | ~125 |

**The snowball risk was real and it is close.** Paying the winner pushed alternation from 55%
to 62% against a ceiling of 65%. It holds, but there is not much room, and the fix if it goes
over is already known: **move the flat purse to the loser** and leave the survivor money with
the winner.

**Money amplifies the draft.** The harness's human is a deliberate floor — it always takes the
first card offered — and its win rate fell about ten points once both sides could shop.
Nothing is asymmetric; the better drafter simply earns more and compounds it. That is probably
right, and it is worth knowing before the numbers are tuned.

# Stage two — the run, and Sam's rebalance

**Both sides now take the purse at a round's end; only the winner is paid for survivors.**
His call, and it is the fix I had named in advance for the snowball: paying the purse to the
winner alone meant winning bought the money that bought the next win.

| alternation, worst table | |
|---|---|
| purse to the winner only | 62% |
| purse to both, survivors to the winner | **58.7% ±1.0** |

**And a lesson about the first of those numbers.** At 60 matches a table this read 62%; at 400
it reads 58.7% ±1.0 — the same build. The small sample was noise that looked like a balance
problem worth acting on, and `match.mjs` now prints the error bar and the round count beside
the figure so it cannot happen again.

**Prices were re-set, not guessed.** Paying both sides took total payout across a match from
~125 to ~218, so the same prices were suddenly half price — army sizes went from 38 to 44
bodies a side and the field got denser, which is the one thing the counters cannot afford.
Prices were multiplied by the change in income: card 21, upgrade 18, wider offer 14, life 44.
Bodies came back to 35–40.

**The currency is credits, ₡ — the same coin as Grandiose**, because it is the same universe
and two names for one currency across two games in one book is two things to learn for
nothing.

## The run

Match after match until you lose one. **The army is redrafted every time** — the draft is the
game, and a carried army makes match two a formality — and **the credits carry**, because
saving for something is a decision.

The opponent ramps with every match survived: **₡18 of head start per match**, and an extra
pick a round every third match. Both are **stated on the screen before the match**, because a
ramp you cannot see is a difficulty setting nobody chose. When their picks outnumber yours
they take the extras alone and in the open, so you watch it happen.

`playRun()` is in the engine, so a run is sweepable — which is the only way to answer whether
it is a run or a treadmill:

| drafting policy | mean matches survived | best |
|---|---|---|
| `house` — takes the first card offered, the floor | 2.2 | 5 |
| `harlow` — most health per pick | 2.7 | 4 |
| `counter` / `varan` — read the board | **3.2** | **7** |

A floor player gets two, a good drafter gets three and can reach seven. The ramp bites, and it
bites later for someone who drafts well, which is what a run is supposed to do.

`play.mjs` is at twenty claims: a run's first match must end into the run rather than into a
menu, and the ramp must be both stated and applied — match two's opponent starts on ₡18.

## The suite stopped counting itself wrong

`play.mjs` printed a hardcoded total. Some of its claims are conditional — a run whose first
match is lost never reaches the ramp check — so it could print **"20 of 20" while nineteen
ran**, which is a vacuous pass wearing a green tick. It had also drifted: 21 claims were
firing against a total of 20. Claims are counted as they fire now, so the number cannot be
wrong and never needs editing again.

# Stage three — boosters, and lives that do not come back

**Lives carry between matches and only the market sells one.** Sam's rule, and it is what
turns credits into a decision: every purse is a choice between a stronger column now and being
alive to draft another one. **The opponent resets to full every match**, because they are a
new opponent — you are the one running the gauntlet, and a wounded opponent carried forward
would make every match after the first a formality.

It costs about a quarter of a run, measured:

| drafting policy | lives reset each match | **lives carry** |
|---|---|---|
| `house` — the floor | 2.2 | **1.8** |
| `harlow` | 2.9 | **2.3** |
| `counter` — reads the board | 3.3 | **2.4** |

A life is ₡44 against roughly ₡100 of income a match, so buying one costs about two rounds'
worth of column. That is the trade he asked for and it is now the sharpest decision in the
game.

**Boosters.** After each match survived you take one of three; the opponent takes one at
random. Same count — **the asymmetry is the choice**. Each can be taken once, and every one of
them changes how a side *drafts* or what a round *pays*, because a booster that multiplied
damage would move a number and nothing else:

| | |
|---|---|
| **Wider muster** | four cards offered each round instead of three |
| **A fourth pick** | four picks a round instead of three |
| **Salvage rights** | two credits a surviving body instead of one |
| **War chest** | begin every match with ₡30 |
| **Standing order** | your market opens every second round, not every third |

Both sides' boosters are **named on the screen** — yours and theirs, at the run screen and in
the pause — because a booster you cannot see is a rule change you did not agree to.

## The finding that undercuts my own argument

I argued that choice compounds where randomness does not. **Measured, it does not yet.** Taking
the first, second or third of the three offered gives 2.37, 2.46 and 2.39 matches over 300 runs
— indistinguishable.

That measurement is not quite the right one: a fixed index is not a *choice*, it is a sample
of the pool. So `playRun({ prefer })` was added — take a named booster whenever it is offered —
which asks what each is worth on its own. 200 runs each, standard error about ±0.11:

| always taking, when offered | matches survived | against taking whatever came first |
|---|---|---|
| **A fourth pick** | **2.81** | **+0.46** |
| Salvage rights | 2.35 | +0.00 |
| Standing order | 2.33 | −0.02 |
| War chest | 2.25 | −0.10 |
| Wider muster | 2.21 | −0.15 |

**One prize and four fillers.** Only the fourth pick is outside the noise, at about four
standard errors; the rest are indistinguishable from taking whatever came first, and two are
slightly *worse* than it.

And the shape of that result is the same finding this project keeps producing: **the one
booster that matters is the one that changes the draft.** The four that move the economy do
not move the run, because income is not what the ramp is beating you with.

So the pool needs re-cutting, and that is design rather than tuning — which of the five exist
is Sam's, not a number to nudge. The direction the measurement points is draft-shaped
boosters: an offer that never repeats a maxed card, a unit type you name always being offered,
upgrades arriving a level higher. Nothing has been changed on the strength of this yet.

# The specials

Three cards the draft never offers — one a weight class, one of each a side, bought at the
market. They answer two problems at once.

**The economy had no sink.** Income is ~₡102 a match with nothing over ₡44 to spend it on, so
credits piled up. A special costs more than one market visit (~₡50), which makes **saving
across visits a decision for the first time**.

**The roster had no growth path that did not cost the counter graph.** Adding cards to the
*draft* pool would re-derive all of it — 86% of pairings decisive, 126 cycles, every unit the
best answer to something. Shop-only cards touch none of it, because a single-type pairing
never sees one. `matchup.mjs` now measures the **draft pool** rather than the roster, for
exactly that reason, and gives the specials their own claim.

All three are the author's, checked by name *and* by description. **Lancer was checked too and
is a person**, not a machine.

| | | |
|---|---|---|
| **Kraken** · heavy · ₡90 | *"The volleys broke against its shields and armor like weather."* | One body, 2400 health, and a shield that refuses ranged fire — the Deflector's rule on the thing the Deflector was copied from. |
| **Purifier** · medium · ₡75 | *"Their doctrine held that the life itself was the contamination."* | Reach 48, a 20-wide blast, and ground that keeps burning. Slow and thin. |
| **Adarnas** · light · ₡70 | *"The Adarnas dropped through smoke the whole way down."* | A platoon of six, landed **at the line of contact** rather than marched to it. |

## The numbers are measured, and the first guess was a trap

The question a special has to pass is the one a player faces at the market: **this, or the
ordinary cards the same credits would buy, added to the column I already have?**

At the first guess all three **lost** that comparison — 19–28% — while still beating the
column without them (81–94%). That is the worst possible shape: worth having, and strictly
worse value. A trap, not a prize.

| | first guess | shipped |
|---|---|---|
| Kraken vs the 4 cards ₡90 buys | 28% | **48%** |
| Purifier vs the 4 cards ₡75 buys | 25% | **51%** |
| Adarnas vs the 3 cards ₡70 buys | 19% | **51%** |

The Kraken and the Purifier needed half again. **The Adarnas needed three times, and more
bodies could not do it** — scaling the platoon to twenty-four still lost, because six light
bodies against three cards is the square law and the answer was to make each body worth more,
not to add more of them.

**And the designed answers are the measured answers**, which is the part worth keeping:

- **Kraken** → Brute, Deflector, Line Infantry, Crawler Swarm. Melee and numbers, because its
  shield refuses *ranged* fire and nothing else.
- **Purifier** → almost everything that crosses the field. It is artillery; it is fragile.
- **Adarnas** → Amabie, Acid Thrower, Fireship. Splash and burn: six bodies standing together
  is exactly what area damage is for.

## The opponent's shopper, rewritten

It had to be. The first version reached three of the shop's five items and spammed one of
them — with ₡200 it took **eleven upgrades and zero cards**, because an upgrade is cheaper than
a card and nearly always available. It never bought a wider offer at all.

It now buys a special it does not hold before anything else, takes **at most two upgrades a
visit**, then buys the card it holds *fewest* of so it spreads rather than stacks, and spends
the remainder on a wider offer. With ₡260 it takes all three specials and an upgrade; with ₡140,
a Kraken, two upgrades and a wider offer.

## What it did to the match

| | before | after |
|---|---|---|
| alternation, worst table | 58.7% | 59% |
| final bodies a side | 35–40 | 35–38 |
| mixed compositions settled 95/5 | 59% | 59% |
| unit graph | 3 of 3 | **4 of 4**, the new claim being that every special has an answer |

Unchanged, which is what shop-only was for.

`match.mjs` and `matchup.mjs` now count their claims as they fire, like `play.mjs` — a total
typed at the bottom is a number written twice, and it had already gone wrong once.

# Kit, sabotage and orders

Three more things the market sells, and they are three different *shapes* of decision rather
than three more ways to be stronger.

**Kit** is permanent and army-wide, and it attaches to a **role** rather than a card — every
target derived from stats the resolver already reads, so a card added later is covered by what
it *is* rather than by being remembered.

| | | |
|---|---|---|
| **Ablative plate** | ₡30 | every heavy of yours takes 10 less from each hit |
| **Range-finders** | ₡30 | everything that shoots past 6 reaches 8 further |
| **Field drill** | ₡30 | every light body carries 70 more health |

**Sabotage** — ₡26 — is the only thing you can buy that makes **them** weaker: one card of
theirs deploys on 40% health next round, every copy of it. Its value sits on the other side of
the board, which makes it the one purchase that requires you to look there — and you can,
because every counter is named and drawn. The chooser shows **their** counters in **their**
colour.

**Orders** last one round. **Forced march** (₡11) doubles your column's pace and makes your
seekers run harder; **Sustained fire** (₡20) makes everything that shoots past 6 fire a
quarter faster.

**An order is what a spell would have been.** Sam asked about spells; the answer was no,
because a cast during a battle is either a timed input — which ends the battle being a pure
function of two armies and a seed, and with it every figure in this project — or it is
pre-committed, in which case it is this.

## One function learned four token kinds

A draft is now a list of four things: a bare id is a card, `up:` a level, `eq:` a piece of
kit, `ord:` an order for the coming round, and `sab:` a card of theirs somebody paid to get
at. **Sabotage travels in the target's list**, because that is where it takes effect.

`armyFrom` reads all four so nothing downstream parses a prefix — and the one place that had
restated the rule went wrong immediately. `play.mjs` counted cards as "tokens not starting with
`up:`", so the first new token kind was counted as a card and the counter check went red. It
reads *a card is a bare id* now.

## The prices are measured, and one asymmetry had been missed

Every item was tested the same way as the specials: **this, or the ordinary cards the same
credits buy, added to the column I already have?** At the first guess all six lost — 25% to
44% — so all six were traps, and the effects were scaled until they sat near an even choice.

And a structural thing surfaced while pricing them: **kit carries between matches and cards do
not**, because the army is redrafted every match. A single-match measurement is therefore a
**floor** for a piece of kit and **exact** for an order, which lasts a round. Forced march
measured at 34% of a card and is priced at ₡11 rather than inflated to hit a round number.

## The opponent got worse, on purpose

Its shopper reached three of five items before the specials and would have reached four of
eight after. It now has **caps per visit** — one special, one piece of kit, two upgrades, one
sabotage, one wider offer, one order — and with ₡300 it takes a Kraken, plate, two upgrades, a
sabotage, five cards and an order, instead of eleven upgrades.

**And it is measurably weaker for it**: the harness's floor human went from 27.5% to 41.7%
against it. The old behaviour was crude *and* strong. The rewrite was for **reachability** — a
shop with items nobody can buy is not a shop — not for strength, and it costs strength. That
is a trade worth stating rather than burying, and the opponent's difficulty now has an obvious
lever if it needs one.

## What it did to the match

| | before | after |
|---|---|---|
| alternation, worst table | 59% | 56% |
| final bodies a side | 35–38 | 34–38 |
| mixed compositions settled 95/5 | 59% | 59% |
| unit graph | 4 of 4 | 4 of 4 |
| page suite | 24 of 24 | 24 of 24 |

# The booster re-cut, and the control I kept forgetting

The old pool was **one prize and four fillers** — only *A fourth pick* moved a run, and the
four that moved the economy moved nothing. That was re-run after the specials, the kit and the
rewritten shopper had made the economy three times richer, and it came out the same: **+0.39
for the fourth pick, −0.04 to −0.19 for the rest.** Three passes at the same sentence: *the
draft is the game.*

So the pool is draft-shaped now, with one economy booster kept deliberately so that conclusion
stays falsifiable rather than becoming an assumption.

| | |
|---|---|
| **A fourth pick** | four picks a round instead of three |
| **Wider muster** | five cards offered each round instead of three |
| **Veterans** | every card you draft arrives already upgraded once |
| **Standing muster** | one unit you name is always among the cards you are offered |
| **Requisition** | the market opens every second round and everything costs a fifth less |

## The measurement that nearly threw three good boosters away

The first run of the new pool looked like this, against *taking whatever came first*:

| | |
|---|---|
| Veterans | +0.62 |
| A fourth pick | +0.23 |
| Wider muster | **−0.38** |
| Standing muster | **−0.33** |
| Requisition | **−0.32** |

Three negatives, and I was one edit from cutting them. **The negatives were an artefact of the
comparison**: preferring a mediocre booster means *not taking Veterans*, so anything that is
not the best in the pool reads as a loss. That is a ranking, not a value.

`playRun({ take: -1 })` takes nothing at all, which is the control that had been missing:

| | matches | against taking nothing |
|---|---|---|
| **taking nothing** | **1.67** | — |
| Veterans | 3.30 | **+1.63** |
| A fourth pick | 2.91 | +1.24 |
| Requisition | 2.36 | +0.69 |
| Standing muster | 2.35 | +0.69 |
| Wider muster | 2.30 | +0.63 |

**Every one of the five is worth between two-thirds of a match and a match and a half**, with a
full match of spread between best and worst. That is a live pool with no dead options — the
opposite of what the first table said, from the same runs.

**A difference between two options is not a value. It needs a control that is neither**, and
this is the second time in one session — the other was a mirror match whose baseline was 23%
rather than the 50% I had assumed, which made a buff look like a penalty.

## Two things the re-cut needed underneath

**A booster can carry an argument.** *Standing muster* names a unit, stored as `named:walker`,
so boosters are compared by prefix rather than by equality — and `nameIt` gives the opponent's
one a target the same way, the card it holds most of.

**And it opened a hole immediately.** A side that had bought a Kraken and then named it would
have been dealt Krakens for nothing, free, every round. The guard is in **two** places: the
naming only chooses from the draft pool, and `offer()` refuses to force a card the draft cannot
deal — because that function is the one that promises an offer contains no special.

## Next, and it is his

**Battlefield variety.** His answer to 59% of compositions settling 95/5 is not to soften the
counters but to stop every battle being fought on the same empty rectangle — the same two
armies currently have one fixed answer because they always meet on identical ground. The
mechanism is unspecified and deliberately not guessed at here.


---

# The audit — four checks that were measuring the wrong thing

Sam asked for a pass over everything built and written here. Nothing in the game's rules
changed; what changed is what the instruments look at, and four of them were pointed
somewhere other than where their name said.

## The booster figures measured the wrong thing

The table above under *the control I kept forgetting* is the third version of this
measurement and it is **still not what its caption says**. It was found by breaking the new
check on purpose: a booster id the engine does not implement at all — a pure no-op — scored
**+0.58 matches at 2.9 standard errors**, and the check passed it.

The reason is one line in `playRun`. The arm was `prefer: X, take: 0`: take X when it is
offered, **and take something else when it is not**. Over a run that is mostly *other
boosters*, so every arm beat the do-nothing control simply by taking boosters at all. The
figure was real; it was the value of *a preference within the pool*, not of the booster.

`prefer: X, take: -1` now means take X when offered and **nothing** when it is not, which
is the only arm where X is the sole difference from the control. Isolated, over 300 runs an
arm from a `counter` seat:

| | matches survived | against taking nothing | |
|---|---|---|---|
| taking nothing | 1.61 ±0.04 | — | the control |
| **Veterans** | 2.53 ±0.07 | **+0.92** | 11.5σ |
| **A fourth pick** | 2.05 ±0.05 | **+0.44** | 6.6σ |
| Standing muster | 1.70 ±0.04 | +0.09 | 1.6σ |
| Requisition | 1.70 ±0.04 | +0.09 | 1.6σ |
| Wider muster | 1.66 ±0.04 | +0.05 | 0.9σ |

**Two boosters, not five.** And the shape of the answer is the one this project keeps
producing: the two that survive are the two that change *what a pick is worth* and *how
many you get*. Wider muster shows five cards instead of three and is worth a twentieth of a
match, which says the third card was never the binding constraint.

Which of the three to cut, to buff, or to keep as texture is Sam's. Nothing has been changed
on the strength of this.

**Three goes at one control.** Ranked against each other → three read negative. Against a
do-nothing run → all five read positive, for the wrong reason. Isolated → two. Each stage
looked finished, and the only thing that exposed the middle one was breaking it deliberately
and watching it not go red.

## Throwing the opening round: the check was aimed at the one opponent it does not beat

`match.mjs` measured this against `varan` alone for its whole life. Varan is the single
persona throwing does **not** beat. Over 15,000 paired matches on the current build:

| | straight | thrown | |
|---|---|---|---|
| vs Varan | 48.5% | 47.9% | −0.5pt |
| vs Vex | 95.4% | 98.1% | +2.7pt |
| vs Hale | 90.4% | 94.1% | +3.7pt |
| vs Leader | 86.9% | 91.8% | +4.9pt |
| **vs Harlow** | 48.6% | 59.5% | **+10.9pt** |
| **overall** | 74.0% | 78.3% | **+4.3pt** |

So the figure has not moved at all since it was first taken — the market, the specials, the
kit and the booster re-cut left it exactly where it was — and the green tick beside it was
green because of the fixture, not the game. The check now sweeps all five and **claims on
the worst opponent rather than the average**, because an edge that averages +4pt and is
+11pt against one persona is a dominant line in every match against that persona.

Sam's ruling stands: legitimate until he has played it.

## Two fixtures that were quietly smaller than they looked

**The persona table had a duplicate row and a missing persona.** It read
`['counter','varan','harlow','hale','leader']`, and `counter` is a one-line alias of `varan`
in `POLICIES` — two of the five rows were the same policy printing identical figures to the
digit, 200 matches an run spent re-measuring a row already on screen, while **`vex`, the
run's first opponent, was never measured at all.** It is derived from `RUN.order` now, so the
table cannot drift from the sequence a run actually plays. Vex turns out to be the weakest
opponent in the game — a floor player beats it 88% of the time.

**And the run's difficulty order has one inversion.** Against the floor player the five read
Vex 88%, Hale 82%, Harlow 55%, Leader 71%, Varan 30% — so `RUN.order` climbs, dips at
Leader, then climbs again. Whether that matters is a design question, not a defect.

## The page suite crashed on one booster in three, and nobody knew

`test/play.mjs` plays a real match through the real interface. **The page seeds every match
from `Date.now() ^ Math.random()`** — right for the game, and it means the suite takes a
different path every run. Two things fell out of that, and the second is worse.

**Its coverage moves and its output does not say so.** Two runs an hour apart printed
`24 of 24 claims hold` and `21 of 21 claims hold`. The second lost its opening match, so the
four checks past that point — the ramp, lives carrying, boosters carrying, the opponent's
booster being named — never ran. Both look like a clean green. Counting claims as they fire
fixed the wrong number and left the right one invisible; the suite now **prints what did not
run and why**.

**And it crashed outright on the naming screen.** Taking *Standing muster* asks you to name
a unit, which is a second sheet — so the run screen's `#on` button is not there yet. The
suite clicked the first booster offered and then waited thirty seconds for a button on a
screen it was not on, and died with a Playwright timeout and no FAIL line. It needed the
harness to survive its opening match *and* be offered `named` first, so it fired on roughly
one run in three of the ones that got that far, in a suite that had been green all session.
It arrived with the booster re-cut and had been in the repository ever since.

The branch is handled now rather than avoided, so the naming screen is **covered** instead
of being a hazard — and the claim on it asserts the guard that matters: the naming screen
offers only cards the draft can deal, because a named Kraken would be dealt free every round.
Mutation-tested by making the screen offer all fifteen; it names `kraken, purifier, adarnas`
and goes red.

That claim's own first version was vacuous — it read the list of offered cards *after*
clicking one away, got an empty array, and `[].every()` is `true`, so it printed
`0 offered` and passed. It reads the screen before clicking it now.

## Three things nothing was guarding

| new check | the defect it makes impossible | where |
|---|---|---|
| every unit has a mark, every mark has a unit | `glyph()` returns an empty string for an id it does not know, so a new unit deploys as a **blank counter** and nothing throws | `test/matchup.mjs` |
| the opponent reaches every shelf and no others | the shop grew an item the opponent could not buy **twice**; the reverse — an action only one side has — is the Ledger's money pump | `test/match.mjs` |
| `docs/data.js` BUILD and `docs/sw.js` CACHE agree | bump one without the other and the phone serves the old build **under the new build's name** — the one failure where the screen lies about its own version | `test/offline.mjs` |
| Standing muster names only cards the draft can deal | a named special would be **dealt free every round**, undoing the whole of what shop-only protects | `test/play.mjs` |

All four were mutation-tested: each was broken on purpose and watched go red before it was
kept. That is also how the booster flaw above was found — the mutation *passed*, which is
the only reason anyone looked at the arm.

## Housekeeping in the same pass

- **The header of this document said there was no interface.** It had said so since before
  the game was playable, and it was the first thing anyone read. The root `README.md` said
  `docs/column/` was *"design only, nothing built yet"*.
- **The publishing section said the Column gets its own service worker and cache prefix.**
  It gets neither, and the truth is the opposite: one worker, one cache, one atomic
  `addAll` shared with Grandiose and Matchbox. Corrected in place, because that one is not
  stale — it is wrong in the direction that costs all three apps their files.
- **`SABOTAGE.half` held `0.4`.** The interface derives the figure it prints, so nothing was
  wrong on screen; a constant whose name disagrees with its value is a trap for whoever
  tunes it next. It is `SABOTAGE.left` now — the fraction the target keeps.
- **`docs/README.md` listed two published apps and looked forward to a third.** The third
  has been live for a day.
- **`earn()` still branched on a `salvage` booster** removed in the re-cut, three lines under
  a comment claiming `has()` was the only place a booster id is compared.
- Six unused imports; a `TICK` the engine imports and never reads.
- **`package.json` had no `"type": "module"`**, so every suite run printed a reparse warning.
  Warning noise in a test log is how a real red goes unread.
- `match.mjs` now takes `THROW=` and `RUNS=` so its two expensive sweeps can be cut down for
  a smoke run — which is what makes mutation-testing its claims affordable, and a check
  nobody can afford to break on purpose is a check nobody has proved goes red.

**The suite costs what it measures.** `test/match.mjs` takes about nine minutes: five
persona tables at 200 matches each, 600 paired throw matches across the five opponents, 360
runs of booster arms, and a 400-pair composition sweep. It is not a check to run on every
save, and `THROW=` and `RUNS=` exist so it does not have to be.


---

# The pool is three, because a run is 1.4 matches

Sam handed me the three dead boosters. Fixing them took two more rounds of the same
measurement, cost three more boosters, and ended somewhere other than a better five.

**Round one — replace them on the axes that worked.** The two survivors changed how many
picks you get and what a pick is worth, so the three replacements went there: *The Vanguard*
(a round you lose buys two picks, the Leader's own doctrine doubled), *Reserves* (two picks
to open a match) and *Field surgeons* (the first life you lose each match, given back —
lives carry, so they are what a run is really spending).

Measured isolated, 300 runs an arm: The Vanguard **+0.14 (2.6σ)**, Reserves **+0.06 (1.2σ)**,
Field surgeons **+0.06 (1.2σ)**. Two of my three died by the test that had just killed three
of his.

**Round two — build one that scales.** Lining the numbers up gave a model. Run length moves
with the *total* extra picks in a run, at roughly **+0.05 matches a pick**:

| | what it adds | measured |
|---|---|---|
| A fourth pick | +1 a round, ~+7 a match | +0.42 |
| The Vanguard | +1 a round *lost*, ~+3.5 | +0.13 |
| Reserves | +2, once | +0.06 |

So a booster that adds a fixed handful cannot buy much, and one that *multiplies* — Veterans,
which upgrades every card the whole draft produces — is worth double the best of them. The
rule that fell out was: **scale with the run, don't add to it.** *Attrition* was built to that
rule and to nothing else — every opponent after this one begins with half their credits, so it
is worth twice as much at match four as at match two, the only booster in any of these pools
that grows.

**Attrition measured +0.06, at 1.1σ.** Identical to the fillers it was designed to beat.

## What that actually says

A run from a competent seat survives **1.44 matches**, and the first booster only arrives
*after* match one. A booster therefore gets one or two matches to matter. **Anything that
scales with run length is worth nothing because there is no run length** — which is exactly
why Attrition, built for that and only that, landed on the same number as *Wider muster*.

Eight boosters, three designs, one table:

| | | isolated |
|---|---|---|
| **Veterans** | every card, from the moment you take it | **+0.85** (15.8σ) |
| **A fourth pick** | +1 pick a round | **+0.44** (9.2σ) |
| **The Vanguard** | +1 pick a round lost | **+0.20** (4.2σ) |
| Standing muster · Requisition · Wider muster | offer-shaped, economy-shaped | +0.09, +0.09, +0.05 |
| Reserves · Field surgeons · Attrition | a fixed few, lives, a scaling ramp | +0.06, +0.06, +0.06 |

**So the pool is three, and not a fourth invented to round the number up** — that is the
thing this whole re-cut was about. Three offered after each match means the whole pool is on
screen and the decision is the *order*: Veterans first compounds hardest, the fourth pick pays
sooner. That is a smaller decision than intended, and an honest one.

**The question that is left is not which boosters — it is how long a run is**, and that is
Sam's. A pool this thin is a symptom of a run ending before anything can compound.

## Cutting the weak ones made the opponent harder

Worth stating because it is a real balance move made by a change that looks like tidying: the
opponent takes a booster at random every match, so removing the fillers **raised the average
strength of what it draws**. A do-nothing control went from surviving 1.61 matches to **1.30**
— nineteen per cent shorter runs, from cutting things that measured as worth nothing.

## And what went with them

*Standing muster* was the only booster carrying an argument, so its removal took `nameIt`,
`boostArg`, the naming screen, `offer()`'s `force` parameter and the `named:walker` prefix
handling with it — along with `priceFor` and `marketEvery`, which existed for *Requisition*
and had become functions returning their own argument.

**One guard was rescued rather than deleted.** The naming screen's claim protected a real
promise — *a named Kraken would be dealt free every round* — and that promise outlives the
booster, because `offer()` deals from `DRAFT` and never from `UNITS`. It is a sweep in
`test/matchup.mjs` now: four hundred deals against armies that already hold a bought special,
asserting none is ever dealt back. Mutation-tested by pointing `offer()` at `UNITS`, where it
names `kraken, purifier, adarnas` and goes red.

## A promise the engine was not keeping

Found while checking what carries between matches. Three kit items said **"for the rest of the
run"** — in `data.js`, on the shop button, and on the chooser. Kit is a token in the army list
(`eq:plate`), and a run **redrafts the army from nothing every match**: it carries credits,
lives and boosters, and the run screen says so in those words. So the button was promising
something the engine does not do, on a ₡30 purchase, before the player could find out.

The copy now says *"for the rest of this match"*. The price is unaffected — it was measured
over a single match, which makes it exact here rather than the floor the pricing note called
it. **Whether kit should carry is a live design question and Sam's; that it must not say it
carries while it does not is neither.**
