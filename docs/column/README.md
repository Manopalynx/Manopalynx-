# Grandiose — The Column

A tactical drafting autobattler set in *Grandiose: The Rise to Power* (S. T. Chalk, 2026).
Two commanders draft armies from what the war makes available, surrender control, and
watch the consequences. Portrait, phone, one hand.

**The engine and both instruments are built. There is no interface yet, deliberately.**
Everything down to *What the sweeps found* is the design as proposed; that last section is
what measuring it actually returned, and **where the two disagree the measurement wins** —
read the proposal for intent and the findings for what is true. Sam owns every decision
here; where a choice is still open it says so rather than guessing.

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
docs/column/data.js     units, cards, personas — data only
docs/column/engine.js   the rules. No DOM, no timers, no Math.random
docs/column/ui.js       the screen. Reads the log; never computes an outcome
docs/column/test/       tests, and the instruments that explain a number
```

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
the phone. That path is one directory deeper than `docs/sw.js`, so **it gets its own
service worker and its own cache prefix** — and a row in `APPS` in `docs/sw.js` and in
`test/offline.mjs`, which is what makes it work on a train and stops shipping it deleting
Grandiose's saved files. See `docs/README.md` for why that is not optional.

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
