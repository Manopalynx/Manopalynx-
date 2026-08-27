# Grandiose — The Column

A tactical drafting autobattler set in *Grandiose: The Rise to Power* (S. T. Chalk, 2026).
Two commanders draft armies from what the war makes available, surrender control, and
watch the consequences. Portrait, phone, one hand.

**The engine and both instruments are built. There is no interface yet, deliberately.**
Everything down to *What the first sweeps found* is the design as proposed; that last
section is what measuring it actually returned, and the two disagree in places. Sam owns
every decision here; where a choice is still open it says so rather than guessing.

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

**Working assumption, to be corrected: twelve units at launch.** Enough for a counter-graph
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
| **Karkinos** | six-legged, climbs sheer walls | fire under its arc while it is committed to the climb |
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

1. **No dominant unit, no dead unit.** Across the whole pool, no unit's overall win rate
   exceeds **65%** and none falls below **35%**.
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

# What the first sweeps found

**The engine and both instruments are built and the numbers are in.** This section is
measured, not proposed. `docs/column/test/matchup.mjs` is the counter-graph;
`docs/column/test/match.mjs` is Sam's round structure. Everything below is reproducible
from a seed.

## The counter-graph is real

| claim | result |
|---|---|
| real cycles, every unit inside one | **holds** — 171 three-cycles at 60/40 or wider |
| every unit is the best answer to something | **holds** |
| nothing above 65% or below 35% | **fails** — and the reason matters more than the failure |

Five tuning passes each flipped a unit from dead to dominant on a small change. That is
the catalogue's tell, so I stopped tuning and measured the room instead:

> **Of 132 pairings, 100 — 76% — are decided 95/5 or harder.**

The resolver is near-binary. A unit's "overall win rate" is therefore not a rate but a
**count of pairings won**, in steps of 1/11 ≈ 9 points. The 35–65% band admits only four
possible values, so any unit that wins one more or one fewer matchup jumps outside it.
**The threshold is finer than the model's resolution**, which is why every pass flipped
something. Two dials made it worse and both are super-linear: `count` is quadratic (Line
Infantry went 25.8% → 87.8% on one extra body) and an aura scales with enemies *and* with
the square of its radius (Volt went 27.8% → 86.6%). `hp`, `dmg` and `rate` are the safe
dials; `count`, `auraR` and `splash` are not.

Mixed armies of nine cards soften it but not much: **60% still decided 95/5.**

**Sam's decision.** Either accept that counters are decisive — which is legible and
arguably right for a drafting game, and means restating the claim at the model's real
resolution ("each card wins between four and seven of its eleven matchups") — or introduce
variance so a matchup can genuinely be close. I lean to the first: you want "this beats
that" to be learnable, and the uncertainty to live in composition rather than in dice.

## Your extra pick is too weak, not too strong

The risk was an oscillator — losing a round being how you win the next. Measured across
five tables, 100 matches each:

| table | human wins | rounds | alternation | bodies by the end | longest round |
|---|---|---|---|---|---|
| vs Varan | 45.0% | 7.7 | **50%** | 69 | 77s |
| vs Harlow | 94.0% | 6.5 | 64% | 77 | 81s |
| vs Hale | 100.0% | 6.2 | **67%** | 79 | 54s |
| vs Vex | 98.0% | 6.3 | 66% | 81 | 82s |
| vs The Leader | 79.0% | 7.6 | 55% | 85 | 49s |

Alternation is how often the winner of a round also wins the next. **It runs 50–67% — the
winner keeps winning slightly more often than not, so the rubber band is marginally too
light rather than too heavy.** Your instinct was sound and the correction is small: a
second bonus pick, or a wider offer for the loser.

## Three of the five personas are worse than picking blind

`house` — the harness policy that always takes the first card offered, with no thought at
all — beats **Harlow 94%, Hale 100% and Vex 98%.** Only Varan is competitive at 45%.

The three that lose are the three that draft by a single stat. Varan is the one that reads
the board and answers it. **In a game decided by counters, drafting by stat is not a
personality, it is a handicap.** The personas need to be variations on *how* they counter —
what they are willing to trade, how far ahead they read — not stat-maximisers wearing
different names. That is a rewrite of `POLICIES`, not a tuning pass.

## The real constraint is legibility

A match ends with **about 85 bodies a side — 171 on screen — at roughly 36pt of space
each** on a 393pt portrait field. Performance is not the problem; Matchbox runs 26,390
cells at 2.5ms a frame. Telling them apart is.

The first version of this check counted *cards* and would have reported a comfortable
field at a third of the real crowd. A card deploys up to ten bodies.

**Options, all Sam's:** cap the field and bench the rest, retire early cards as later ones
arrive, merge duplicate cards into one stronger body, or shrink the squad counts. This is
the first thing to settle, because *observation* is the step the whole loop hangs on and
it is the step that breaks first.

## Open, in the order it now needs answering

1. **Decisive counters, or add variance?** Everything else follows from it.
2. **The field is too crowded by round six.** Which of the four options above.
3. **The personas need rewriting** as counter-policies rather than stat-policies.
4. Strengthen the loser's bonus slightly — 50–67% wants to be 50%.
5. A round runs 49–82 seconds at its longest. Is that too long to watch on a phone?
