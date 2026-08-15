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
test/        325 passing (plus a browser probe across five viewports)
```

## Running the tests

```
node --test docs/test/*.test.mjs
```

There is no build step and no dependency — `node:test` and ES modules only.

These are not tests. They are measuring instruments, run by hand when a number
needs explaining:

```
node docs/test/sweep.mjs [games]       # how often a game reaches its ending, by table
node docs/test/balance.mjs [games]     # sweeps the economy levers
node docs/test/diagnose.mjs [games]    # why games end the way they do
node docs/test/auctions.mjs [games]    # how much of a game is auctions
node docs/test/denial.mjs [games]      # how often Varan buys to block rather than to own
node docs/test/ties.mjs                # how often a sealed bid ends level
node docs/test/vassals.mjs [games]     # what holding a vassal costs, and how often it cannot be paid
node docs/test/varan.mjs [games]       # what an opponent demands for one square, as a multiple of list
node docs/test/money.mjs [games]       # the money supply across a game
```

**Read the table name on any figure from `sweep.mjs`.** Three of its four tables
seat two humans; the game as it is actually played is one human against three
opponents, and that table is the last one. An effect can point one way on a
two-human table and the other way on his — the vassal upkeep does exactly that —
so a conquest figure without its table beside it means nothing.

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
- **The decks against themselves.** A card's text and its effect are written side by side
  and can still disagree. Three Contingency cards did: `go` indices left over from the
  28-square board meant "You are commanded to Cradle" put you on Oranthe, "Advance to
  Horizon" on Varan's Audit House, and the *Orion* on Oasis Fortress. Nothing failed. The
  card lied and the game carried on. Now asserted: **a movement card must name the square
  it sends you to**, a card that prints a figure must charge that figure, each card carries
  exactly one effect the engine knows, and every card in both decks is drawn and its
  promised effect compared against what the engine actually does.

  Note that changing a destination changes `TRAFFIC` — cards are movement, and the table is
  derived from movement. `test/traffic.test.mjs` catches it; `test/derive-traffic.mjs`
  regenerates it. Fixing those three moved Horizon from 2.60% to **3.27%**, the second
  busiest square on the board.

## The board is somebody's novel

Every square carries a line, shown under its name. **Thirty of the forty are the
author's**, lifted from the book and trimmed only at the ends; the other ten were written
for the game. `qv: 1` in `data.js` marks the author's, and the interface renders those in
italic against a gold rule and the written ones plain — so which is which is visible at
the table, not only in the source. A test fails if fewer than 28 squares quote the book.

Surveying the novel for this turned up four things the data had wrong and nothing could
have caught:

- **Re-dok sat in the Enigma set.** It is Basileian — *"ten centuries of Basileian history
  flowing along beside the escalators"* — and it is the station Samuel walks a disassembled
  rifle through on his way to shoot Adran Vale. It is now in the Basileia set, beside the
  plaza where he uses it.
- **Five squares were invented qualifiers on real worlds** — Farmlands, Drydocks, Tribute
  Yards, an Imperial Court, Far Marches. The book supplies better: *The Eden Archive*,
  *Venenum War-Stock* (from "the yards, the foundries, the war-stock of a sector"), *The
  Tribute Ships*, *Re-dok Station*, *The Rezar Marches*. **Arvanis** — "refused integration
  three times, its mineral output is required" — took the freed Enigma slot.
- **A comment in `SETS` was confidently wrong**, claiming the novel names no Basileian
  world and that Vale's Plaza was an invention. It names several, and the plaza is where
  Vale is assassinated. Corrected in place, because a wrong comment is worse than none.
- **The selection ring was a player colour.** The square you last tapped drew
  `outline: 2px solid var(--tx)`, and `--tx` is `#5ECFC8` — which is exactly Spector's pip.
  Ownership draws a 2px inset ring in the owner's colour, so a square you had merely
  looked at was pixel-identical to a square Spector held. Reported from play as "what is
  happening on PLAZ?". It is now dashed and `--bright`, and a test compares the selection
  colour against the whole pip palette and every persona.
- **Codes that differ by one character.** `VESA`/`VASA` were both real places one letter
  apart. Writing the test to catch that pair immediately caught `COL`/`CON` — **the two
  decks**, the worst possible pair to confuse — plus `ORAN`/`ORIN`, `ANCH`/`ANTH`/`ARCH`.
  All resolved. The rule is now enforced: two codes of the same length may not differ by
  a single character.

## The swarm is the clock

The circuit limit was an administrative number that ran out. It is now the thing the
novel is about. The centre panel counts `SWARM 62 OUT` **from the first turn** — it used
to switch over only inside the last twelve circuits, which meant that in any game not
played to the end the whole idea was invisible. The setup screen names the choice as what
it is: how long you have before it arrives.

The deep array reports at four fractions of the game, in `SWARM_STAGES` — filed, resolved,
agreed, and finally not worth reporting because everyone can see it. Only the highest
stage passed is spoken, so a short game cannot deliver two paragraphs of doom in one
circuit. Playing on resets them, because a longer run means the array has more to say. The
end screen closes on the book's last line.

The Neurex are deliberately **not** a square you can buy, a jail you can be held in, or a
faction you can trade with. They do not hold prisoners and they do not take payment —
*"You will be integrated, or you will be consumed. Which of the two is not a decision you
are equipped to influence."* They appear three times: as the clock, as the voice on the
Absorbed corner, and as one Contingency card that costs you money for looking at them.

## You could never ask them to pay

`tradeSet` handled the counterparty and then assumed every other key was a list, so tapping
the credits direction ran `list.indexOf` on the number `1` and threw. The tap did nothing
at all, `direction` never left its default — and since the default is "You pay", **a human
could not draw a contract where the other side pays them.** The engine had always supported
it; only the interface could not ask.

The probe built bundles both ways and settled them, and never once touched that toggle,
which is exactly how it shipped. It now flips the direction both ways and checks that what
you receive rises by **exactly** the credits on the table.

That last assertion took three attempts, all of them my fault rather than the code's. "You
receive" appears three times on the sheet — a bundle header, a bare label, and the totals
row — and the first two selectors picked the wrong element. Then the check compared against
a literal `100` on a line reading `₡420`, because whatever squares are in the bundle when
the probe runs contribute to the same total. It compares the **difference** between the two
directions now, which is the thing that actually has to be true.

## A whole column showed nothing it had built

The colour bar sits on the **inward** side of each cell, as on a real board — which on a
left-edge cell is the right-hand side. That is exactly where the development mark was
placed, and the bar carries `z-index: 1` against the mark's `auto`. Measured: **83% covered
on every one of indices 11-19**, so a ninth of the board showed no citadels, no garrisons
and no pledges at all.

Nothing failed. No figure was wrong, nothing crashed, and the state was simply invisible on
nine squares — reported from play as *"I have a citadel on Ortox Transit and can't see
it"*. The mark now clears the bar on that edge and sits above it everywhere, and the probe
checks **every buyable square** rather than a sample, because the defect was edge-specific
and a sample would have missed it.

### The Holdings sheet is in board order, which is not a fault

Ortox Transit is square 11, The Deep Array is 12, Varan's Audit House is 13, The Tribute
Ships 14 — so a utility genuinely sits between those three on the board, and the sheet
lists them in the order you walk them. The **player sheet** reached from a chip groups by
colour set instead; `showManage` does not. That inconsistency is real, but the ordering
itself is correct.

## Two things a fixed colour and a fixed viewport got wrong

**The moving piece was ringed in the first seat's colour.** `.cell.here` was
`var(--gold)`, which is `#D9A441`, which is byte-identical to `PIPS[0]`. So whoever was
moving — and the highlight steps through every square a piece passes, on purpose, so you
can follow it — the ring was Sam's. All four pips **are** the four theme accents, so any
fixed colour here belongs to somebody. It now takes the moving player's own colour, which
makes it right by construction rather than by finding a shade nobody is using.

This is the second time. The README already records the selection ring being `var(--tx)`,
which is Spector's pip. The probe now checks the ring against **every** seat's pip, because
a single-seat check passes on the bug.

**A sheet could open on top of a raised keyboard.** `.scrim` is `position: fixed`, which on
iOS is laid out against the *layout* viewport — and that does not shrink when the software
keyboard appears. The sealed-bid sheet auto-focuses its number input, so anything that
replaced it was positioned against a viewport that no longer matched the screen, and its
buttons stopped taking taps where they appeared to be. Reported from play as the Continue
button on the revealed-bids sheet doing nothing until the background had been touched —
touching it is what resynchronises iOS's fixed layer.

Replacing `innerHTML` destroys the focused input but does not reliably dismiss the
keyboard. `sheet()` now blurs first, every sheet action blurs before it runs, and a
`visualViewport` listener resets the scroll when the viewport changes with a sheet open.

**Not verified here.** Headless Chromium has no software keyboard, so none of that can be
reproduced in the probe — it removes the precondition rather than being proven against the
symptom. What the probe does assert is that nothing is left focused when a sheet opens.

## Being told no

An opponent used to be refused and carry on as though it had not happened.
`seekContract` re-derives its best target every turn — the square that closes its set,
which has not changed — so it asked for that square again, identically, forever. Measured
over 30 full games against a seat that always refuses:

| | before | after |
|---|---|---|
| proposals the human must answer | **71 per game** | 6.0 |
| per circuit | 1.02 | **0.09** |
| identical repeats | **95%** | 29% |
| worst single ask | **96 times in one game** | 3 (the cap) |

Nothing about this failed. No figure was wrong and nothing crashed — the game was simply
exhausting to play, and every one of those parks it in the `contract` phase waiting for an
answer.

What is remembered is **(proposer, holder, square)**, because that is the ask. It is
dropped for good after `refusalCap` refusals, held for `refusalCooldown` circuits in
between, and **may only return with an offer `refusalRaise` better** — an opponent that
comes back with the same figure has repeated itself, not negotiated. In the same 30 games,
repeat asks came back **higher 65 times, identical 0, lower once**, median raise ₡163.

The memory lapses when the board moves under it: `refusalSig` records the holdings on both
sides of the relevant set, so picking up another square in it genuinely reopens the deal.
Keyed on a timer alone the opponent would be stubborn rather than principled.

There is also a backstop independent of any one opponent: they share **one interruption of
a human per circuit** between them. Each rolls for a proposal separately, so without it the
interruptions scale with the seat count.

Note that against a human an opponent offers its **whole ceiling at once**, so in a fixed
position it correctly never returns — it has already bid its maximum. It comes back only
when its valuation or its purse has genuinely risen. Two test fixtures were written before
that was understood and had to be rebuilt around it.

## What another player holds

Tapping a chip in the top bar opens that player: cash, worth, debt, holdings grouped by
colour set with set completion, garrisons and citadels, vassal and overlord relations with
the tithe rate — and **the rent each square would charge you**, which is the figure that
actually decides a trade.

This reveals nothing. Ownership is already public — the board draws the owner's ring and
the development marks on every square — so the sheet aggregates what you could get by
squinting at forty cells. Checked before building it: there is no hidden per-player state
to leak, `strength` and `tithe` being the only extras and neither secret.

The chips were inert panels for the whole life of the game, so the affordance matters as
much as the sheet — a tap target nobody knows about is not one. Each chip carries its
holdings count and a chevron: a number worth having anyway, which happens to say there is
more here.

**It goes on the cash line, not the name line**, and that was a correction. The badge began
in the top-right corner with 22px reserved on the name row to clear it, which took the name
from 51.8px of room to 29.8px and truncated **"Varan"** — a name that had always fitted.
Reported from play, and correctly: the names are identity and the count is decoration.

The cash line has room it will never use. Measured over 25 full games and 31,536 readings,
the largest balance seen was **₡6,085** and not one reading reached five figures, against a
cash line 68px wide holding a 49px figure. The cash does not shrink, so if a balance ever
did get that large the badge is what gets clipped rather than the money.

Two pixels came back from the chip's side padding (8 → 6) and one from the gap beside the
pip (5 → 4), because *"Spector"* is 50.6px at 12px in this monospace and missed by 0.3px on
a 375pt screen. All four names now fit whole at 375, 393 and 440 — including on the iPhone
SE, where "Spector" had been truncated since long before any of this. The probe asserts no
opponent's name is cut off, and that the badge is on the cash row.

## The swarm arrives in the sky as well

The galaxy already took the Neurex mood inside ten circuits, but it read **green** — and
89.7% of disc stars are the arm and hot tints, both of which are green in that mood.
Measured from the distribution: `t = √random`, so 10.3% land in the core tint, 50.6% in
the arm and 39.1% in the hot. Green in the book is their **shields**, *"layered, organic,
shimmering like membranes"* — what answers your fire once they are already here. The
approach is red, three times over: *"the red tide"*, *"a deep red stain spread across a
full quadrant of the display"*, and *"watched the red blips arrive. One. Then ten. Then a
hundred, in a line that did not end."*

Four things now run off `approachFor()`'s `grip` — 0 at fifteen circuits out and 1 at one,
the same number the score's duck and drift are read from, so the sky and the music share
one clock and cannot drift apart:

- **The blips**, up to 46, arriving at the rim and creeping inward. They are *unhurried*,
  the book's own word, and are returned to the rim on reaching the disc so they never pile
  up over the panel's text.
- **The tide**, one radial gradient anchored in the lower right — the quadrant the book
  puts it in — which cannot invalidate the pre-rendered background field the way tinting
  its stars would have.
- **Hexagons** past halfway, drifting slower than anything else out there and breathing on
  the same idea as the score's pulse: *"vast hexagonal masses, less built than grown, their
  surfaces pocked with irregular openings that breathed."*
- **The arms turning red**, so the disc tips toward the tide at the end instead of staying
  nine-tenths green.

### The last row was a state nobody was ever in

`APPROACH` used to end at `at: 0`. `swarmDistance` is `circuits - circuit + 1` and the game
ends at `circuit > circuits`, which is the exact moment it reaches zero — so the bottom row
was unreachable during play. Measured over 20 full games: **235 readings at a distance of
one, and none at all at zero.** The endgame had been topping out at the interpolated value
for one — music at 0.382 against the 0.34 the table claimed, about a decibel short of its
own design. It ends at `at: 1` now, so the last circuit delivers the extreme rather than
80% of it. Spotted by the author, who asked whether the last row was reachable at all.

The last row is also returned **whole** rather than interpolated to: landing on it through
the mix gave `rain` as `0.44999999999999996` against the `0.45` written down — the same
float artefact the README records for `180 * 0.7`, at the one distance every game ends on.

### Measuring this needed care

A naive red count scores the **ordinary** sky at 74% red, because gold is `#D9A441` and
that is red-dominant. The probe uses a discriminant that also requires green to be low,
which separates the swarm's `#E84A3E` from gold's green of 164.

Two thresholds also overlap and confound a straight sweep: the **mood** flips at ten
circuits and turns the disc green, dropping red *below* its ordinary baseline, while the
**grip** starts at fifteen and reddens it. Across both, red goes 18.7% → 9.1% → 29.9% and
looks broken. Measured inside a constant mood it is clean: **1.2% at ten circuits, 23.4% at
five, 29.2% at one** — a twenty-four-fold rise, and the probe asserts that ordering.

## The universe the galaxy is in

Outside the disc the centre panel was a black rectangle, and it is the largest single area
on the screen. It now carries a faint field of ~230 background stars and five distant
galaxies, with sixteen of the stars twinkling on long individual periods so that one or two
are brightening at any moment rather than the whole sky shimmering.

**It is pre-rendered.** The field never rotates and never drifts — it is at infinity, and
the disc spins in place, so parallax would read as the board moving rather than as depth.
Being static, it is drawn once into an offscreen canvas at each resize and blitted every
frame. Measured at the real panel size with a forced GPU flush: 250 stars drawn live cost
0.45ms a frame against 0.30ms for the disc alone — 2.7% of a 60fps frame, affordable
either way. Pre-rendering is not about the frame. It is about not paying for it 216,000
times in the hour this file's budget is written around.

**It thins toward the centre**, on the same ellipse the core glow uses. The glow washes out
anything near the middle regardless, and the panel carries the turn name, the dice, the
square name and the circuit line — stars behind text would cost legibility for nothing.
The corners get the most, which is where the dead space was.

**It is never tinted with the mood.** Practically, tinting means rebuilding the offscreen
on every mood change, which is a cache to keep in step — this codebase's entire failure
history. Thematically the universe is indifferent to the game, and a neutral field makes
the disc's mood shifts read harder against it, the Neurex red-green most of all.

Two things measurement caught that reading would not have:

- **The twinklers were mostly invisible.** They were the first sixteen background stars,
  placed uniformly, so several landed inside the disc where the fade takes them to a few
  percent alpha. A sixteen-star budget was delivering about ten, and on the smallest phone
  almost none reached the corners. They are now drawn from stars beyond 0.40 of the panel
  from centre — `clearOfDisc` begins fading at roughly 0.29 across and 0.23 down, so 0.30
  had put them exactly on the edge of the fade.
- **A probe assertion that reported a different answer every run.** "Most of the sky holds
  still" was written as a share of lit corner pixels and measured between 9.5% and 70.2%
  across five viewports on one build — the denominator was whatever happened to be bright
  at the sampling instant. It moved with twinkle phase and nothing else. Replaced with a
  count in `galaxy.test.mjs` against the star totals themselves, which cannot drift.

## Sound

`score.js` is a generative score — lydian and whole-tone harmony, quartal voicings, a
half-second delay and a convolution reverb, no drums, never repeating. It carries five
moods and `moodFor()` picks one from the board: `auction` while a bid is open, `facility`
while you are detained, `vassal` once you have an overlord, `ascend` once you hold
somebody else's oath, `ledger` otherwise. **This was undocumented until now, which is how
a later session came to build a second AudioContext beside it before noticing.**

The Neurex are two cues on top, in `audio.js`, and they own no context of their own —
they route into `Score.lp`, the node the pads and plucks already use, so they arrive with
the same delay and reverb and sound like part of the piece rather than a notification over
it. That also puts them behind `Score.master`, so one switch silences everything and the
two cannot drift apart.

- **Absorption**, on two triggers: a player entering vassalage, and a piece landing on the
  Absorbed corner. The second was missing at first and is the one you actually see —
  Absorbed is the go-to square, so the piece is moved straight on to Detention and is only
  on square 30 for the single render between the walk finishing and the landing resolving.
  That render is the edge to catch. Low and wrong rather than startling: absorption is the
  book's thesis and the game's win condition, and a jump-scare would cheapen it.
- **The deep array's four reports**, on the existing `SWARM_STAGES` beats at 25/50/75/95%.
  Tied to those rather than a second clock, so the sound escalates exactly where the text
  does. Escalation is asserted monotonic in every dimension that carries weight.
- **A presence that is always there** once the array has spoken, thickening at every stage:
  a thin detuned drone and an occasional clack, at four levels. Four stings of three
  seconds across seventy-two circuits is not a change in tone, and two full games were
  played reporting exactly that. `SWARM_STAGES` says the intent out loud — the tone should
  change while the table is still arguing about colour sets. A sting cannot do that.

### The last fifteen circuits

Keyed to `swarmDistance(G)` — circuits remaining — which is **absolute, not fractional**.
At 48 circuits this is the last third of the game; at 120, the last eighth. That is
deliberate: the swarm is a fixed distance away and does not care how long the game was set
to run, so it really is closer, relative to everything else, in a short game. If 48-circuit
games start to feel oppressive, this is the number to look at first.

Values interpolate between the rows of `APPROACH`, so the swarm arrives continuously rather
than in three steps a player could count.

| circuits left | what happens |
|---|---|
| **15 → 10** | The swarm enters. Rain starts. The score's tuning begins to drift flat. |
| **10 → 5** | The breathing pulse arrives, the mode is replaced, the music starts ducking. |
| **5 → 0** | Music at 34% and wholly converted. Doubled voice, dense rain, breathing. |

**Conversion, not replacement.** The book is specific — *"It was not destruction;
destruction he had a decade of grammar for. This was conversion."* — so `neurex` is not a
different piece playing over the score. It is the score's own progressions, voicings and
bar structure with the scale underneath them replaced: two chromatic clusters a tritone
apart, where quartal voicing lands root / tritone / minor sixth / major ninth. The same
music, resolving exactly where the progression says it should, into somewhere nobody would
have chosen to go. `Score.R` is pulled 38 cents flat across the same stretch, so the score
goes out of tune as it is digested rather than simply being buried.

Three other details are the author's rather than invented:

- **The doubled voice** — *"the translator's flat doubled voice"*. The detuned unison was
  already there by accident; it is now canon.
- **The rain** — *"resolving out of the intergalactic night like rain beginning on a
  window"*. Sparse, then everywhere, never on a beat you could count.
- **The breathing** — *"vast hexagonal masses, less built than grown, their surfaces pocked
  with irregular openings that breathed"*. The score has **no drums** by design, so a pulse
  is a violation of its own language. That is the point of it.

The galaxy takes the same mood: red tide and the green their shields answer with. The sky
staying gold while the score was being converted would have read as a fault.

`Score.music` exists only for this — a gain node carrying the score and nothing else, so
the endgame can duck the music without ducking the cues, which arrive downstream of it at
`Score.master`. Ducking `master` would have taken the swarm down with the score.

**The music does not go away.** An earlier version took it to 7% and brought a drone up
over the top, which is the destruction reading rather than the conversion one — and it had
a second cost that only showed up on measurement. The `neurex` mood had been made busier
and more varied at exactly the point it was being ducked to seven percent, so none of that
variety could be heard, and the last circuits were carried by a drone and some clacks. The
report was "it repeats the same sound over and over", and it was correct.

The score now settles at **34%** — about nine decibels down — and stays there, wholly
digested. What makes it a takeover is that everything audible has become theirs, not that
the volume went down. `APPROACH` asserts the bed never outweighs the music at any row: the
swarm is the thing on top of the score, not the thing instead of it.

Measured on a 78-second render of the whole stretch: overall level swells **2×** from
fifteen circuits out to one, with the band below 1kHz growing fastest.

### Why the takeover was repetitive

The first `neurex` mood read "alien" as "motionless" — `arp` 16%, `shim` 18%, `div` 1,
three progressions. Counting expected moving elements per bar, that made it **1.54** against
the ledger's **5.73**: the least varied mood in the game, below even `facility`, and it
plays over the longest unbroken stretch of a game. It also came round every **41 seconds**
against the ledger's 55, so the takeover repeated *faster* than the music it took over from.

The book says the opposite of static — *"a single thing wearing billions of bodies"*, *"no
formation the eye could parse"*. Unparseable, not simple. Now:

- `arp` 72%, `shim` 55%, `div` 2 — **6.86** moving parts a bar, above the ledger's 5.73.
  Counted by instrumenting the scheduler over 4,000 bars: **8.7× the arpeggio notes** and
  **73% more notes per second** than before.
- **Five progressions**, so it repeats after 69 seconds rather than 41 — longer than the
  ledger, and beating against the 16-bar hush for a combined period of eighty bars.
- **Eight-note arpeggio figures** in `SHAPES.neurex`, which do not repeat inside a bar. The
  default four-note figures play four times per bar at `div` 2, which is a loop when it is
  the only thing moving.
- **The bed drifts.** Two saws at a fixed pitch is a constant, and by the last five circuits
  the bed is the loudest thing in the game. Each voice now wanders on its own slow LFO at
  rates sharing no common multiple, with a third period on the filter.
- **Three sizes of mandible** — a tap, a heavier shell-knock, a dry tick — because one
  recipe is a tick track however much its centre frequency is jittered.
- **The rain is panned.** The score is mono throughout, so a swarm spread across the stereo
  field cannot be mistaken for part of it. Mostly a headphone gain; the iPhone's speakers
  are close enough that it reads as texture rather than position.

Tests fail if `neurex` is ever again less active than the ledger, or the most static mood in
the game, or loops sooner than what it replaces.

### Pitched for a phone speaker

The first version sat at 34–58Hz behind a filter sweeping 320 down to 120Hz. That is
correct for headphones and inaudible on the device the game is played on. Rendered offline
through a 500Hz highpass approximating an iPhone speaker, **22% of the cue's energy
survived** — four fifths of it could not physically reach the player, and the remainder was
under a full generative score. Two entire games were played without either cue being heard.

Fundamentals now sit between 82 and 186Hz on a sawtooth, whose harmonics a small speaker
does reproduce, and each cue's filter opens far enough to pass them. The same measurement
now gives 51% at stage one and 37% at stage four — in absolute terms **1.7× and 3.7× the
old cue** through the same speaker. `audio.test.mjs` fails anything below 80Hz or any
filter set below four times its own fundamental.

Cues also route dry into `Score.master` rather than `Score.lp`. Going through `lp` put them
*inside* the music: at the facility mood that filter is at 2400Hz, so the clacks came back
attenuated and mixed level with the pads. A send into `Score.verb` keeps them in the room.

The switch is on the setup screen as well as in the menu, and is now remembered between
launches. It is on the setup screen because in a Home Screen PWA the iPhone's ringer
switch does **not** reliably silence a web page, so the choice needs making before a game
starts rather than after the first sound.

**What is not verified: what any of it sounds like.** The probe installs a recording
AudioContext and asserts that a cue fires, fires once rather than on every render, is
fuller at stage 4 than at stage 1, and schedules nothing at all when sound is off. It
cannot tell you whether the result is frightening or annoying. That judgement is the
author's, and the plans are plain numbers at the top of `audio.js` so acting on it is a
one-line change.

## The two decks

Sixteen cards each, mirroring Monopoly's Chance/Community Chest split. **Contingency** is
the movement deck — four `go` destinations, the nearest fleet, the nearest utility, three
squares back, and detention. **The Column** is the money deck, eleven of its sixteen being
a figure that changes.

Three kinds of card are worth knowing about because they are not simply you and the bank:

- **`each`** — one per deck, and the only cards that move money *around the table*. Their
  size scales with how many are playing, so `Pay ₡60 to every other overlord` costs ₡60
  two-handed and ₡180 four-handed. They are also the only card that can bankrupt somebody
  who did not draw it, so they are paid one player at a time and the loop stops if a
  contest opens.
- **`pardon`** — an Overseer's favour, one per deck. Kept rather than spent, and spent
  later from the action row when you are detained. It is applied automatically at the
  third failed attempt, because charging the ₡150 fee to somebody holding a free way out
  is a trap rather than a decision. Opponents spend theirs on sight.
- **`perGarrison` / `perCitadel`** — the only cards whose amount the player cannot work
  out from the text, which is why the interface computes it for them.

Both decks can be read in full in-game, from the menu or from the ledger sheet.

Cards are net **+₡510** (Contingency) and **+₡500** (Column) toward the bank, which reads
as generous and is not: a player draws about **8 cards a game**, worth roughly **+₡240**,
against **₡14,400** from lap payments over 72 circuits. The decks are texture, not economy.
Measured before changing anything, and worth re-measuring rather than assuming if the
deck composition changes much.

## Tied bids

A tie for first was settled by `random(G) - 0.5` and nobody was told. `test/ties.mjs`
measures how often that fired: **19.1%** of auctions when two players both reach for the
same round number, and 0% when bids are spread — so the real rate is whatever your table
does, and two people both typing "200" for a ₡200 square is the likeliest thing at a
sealed-bid table.

The tied bidders now go again, and only they. Nobody may bid below what they already
committed, so the square cannot become cheaper by tying. An opponent re-prices rather than
simply raising — `aiBid` carries its own jitter, so a second identical figure is close to
impossible — and it never bids under its first figure. **If it is still level after the
runoff it falls to turn order from the current player, and the ledger says so.** That
termination rule is the point: a runoff with no floor is two stubborn people bidding for
ever, and a coin flip nobody sees is the defect being fixed, not the method.

## Contracts carry up to three squares each way

`RULES.tradeMax` is 3 — enough for two lesser worlds plus cash for the one that closes a
set, and few enough that the sheet stays readable on a phone. `get` and `give` are arrays;
`sqList()` normalises a bare index or a null, so older saves and older call sites still
work.

**The valuation is the reason this is not simply "make it an array."** A contract used to
be priced as a sum of parts:

    value = cash + aiValue(each gained) − aiValue(each given) − threat

Sum the parts and three squares that complete nothing beat the one square that completes a
set — the first thing anyone tries, and it would have made all three opponents farmable
exactly when trading finally matters. `contractValue()` now builds the board the contract
would produce and prices **that**: the difference between two whole positions. A square
that closes a set lifts the value of the ones already held; a square that closes nothing
lifts nothing. Measured on the same position, three unrelated squares are worth **₡171** to
Spector against **₡679** for the one that finishes Eden.

Two things that only showed up once it was measured:

- **`aiValue`'s `mine` counted the square itself.** It was written to price a square you do
  *not* hold, so `mine` means "the rest of the set I already have". On a post-trade board
  every square counted itself, and a lone worthless world collected the foothold bonus
  meant for a second one. It now takes an `ignore` argument, and `positionValue` passes it.
- **`threatPenalty` returned a float.** `180 * 0.7` is `125.99999999999999`, and that
  reached counter-offers and displayed prices — the same shape as the ₡221 redemption bug.
  Rounded.

Threat is charged **once per set** on the resulting board. Per square, a two-square gift to
one set was counted twice and the fact that the two *together* complete it was missed.

## Money, and what happens when you run out

Nobody can go below ₡0 and nobody leaves the table. When you owe more than you
hold, `liquidate()` runs first, and it gives up the least it can: it pledges
unbuilt holdings cheapest first, then sells garrisons from the slowest-paying
set, and breaks a citadel only when there is nothing else left. (It once ran in
exactly the opposite order, breaking citadels first — the worst possible thing
to sell — which is a reminder that this paragraph is documentation, not a
guarantee. `test/engine.test.mjs` is the guarantee.) Only if that is still not enough
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
  holding "Basileia Prime" and Cradle — but **Basileia is an empire, not a world**: *"the
  largest empire in the galaxy by territory. The oldest fleet. The richest core worlds."*
  Naming a two-square colour set after the whole empire put a polity where a planet goes,
  and "Basileia Prime" appears **nowhere in the book** — that one was invented. Cradle is
  the capital on Agora, the Union's and then the Federation's.

  An earlier version of this paragraph said the book "names no Basileian world at all".
  That is false and worth recording as false: **Re-dok is one** — *"the Basileians came in
  after them"* — and it is where Adran Vale is assassinated. The rename was right; the
  reason given for it was not.
- **Vale's Plaza** is the game's name for a real place the book never names. The plaza is
  on Re-dok, it is where Vale is shot, and `PLAZ`'s quoted line is verbatim from the scene
  — so its `qv: 1` is correct. But `qv` marks the *line*, not the *name*, and this file's
  own rule is that a square departing from the book carries a comment saying so. That
  comment was missing; it is now in `data.js`.
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
