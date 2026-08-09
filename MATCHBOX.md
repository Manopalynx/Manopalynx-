# Matchbox

A single-file falling-sand box with a heat model under it. Draw materials in the dark,
strike a match on the strip, and touch what you have built.

`matchbox.html` is the whole thing. No build, no server, no install — open it and it
runs. Refreshing loses the scene, which is the point of a matchbox; there is one save
slot for the times it is not.

## Running it

Open `matchbox.html` in a browser.

It fetches one webfont from Google Fonts. Offline it falls back to whatever monospace
the machine has and everything else works.

### On a phone

**https://manopalynx.github.io/Manopalynx-/matchbox.html** — open it, then Share → Add
to Home Screen. It opens in its own window with its own icon.

> **iOS caches the icon and the display mode at the moment the bookmark is made.** An
> icon added before that was set up keeps the old behaviour forever, however many
> times the page is updated. Delete it from the Home Screen and add it again.

Three files travel together: the page, `matchbox-icon-180.png` and
`matchbox.webmanifest`. Both companions are optional — the page runs on its own from
anywhere, and without them it loses the Home Screen appearance and nothing else. They
exist because **iOS will not take a Home Screen icon from an SVG, and will not read
one out of a `data:` URI.** The favicon is both, so iOS ignored it and drew its own
fallback tile: a white M on a dark square. And without
`apple-mobile-web-app-capable`, a Home Screen bookmark opens inside Safari with the
chrome still on it.

GitHub Pages serves `/docs` from `claude/grandiose-monopoly-game-y93uw8`, so that is
the only place in this repository a file can be given a URL. What is published there
is a copy; the files are developed at the root of `claude/matchbox-improvement-z6pfx3`,
and **`test/published.mjs` asserts all three are byte-identical**, because a copy
nothing compares is a copy that goes stale — and a page published without its icon
lands right back on the fallback tile. It prints the commands to republish when it
fails.

There is no service worker of its own. The game's is network-first, so the page is
fetched fresh whenever there is a signal — no stale-build trap, and nothing to bump.

## What is in the box

Twenty-nine chips in the tray — twenty-four materials, four living things and the vent — and
six more the simulation makes and never lets you place: fire, smoke, steam, ash, molten wax
and molten rubber. Every one of them is one row of the `M` table and nothing else in the
file knows any of them by name.

(That count was stale before the grub was added to it, and the first attempt at fixing it
said four rather than six, because the probe I counted with deduplicated by display name and
both molten forms share theirs with the solid they came from — `WAX` and `MELT` are both
"Wax". The same collision once made a saved scene load molten wax as solid, which is why
saves key on `SAVE_KEY` and not on the name.)

The tray is in drawers — **Fuel, Wet, Solid, Hot, Life, Scene, Tools** — one row at a time, so
the tray has a fixed height however much goes into it. A flat tray does not scale: every
material added used to cost a slice of the stage, which is the part of the page worth
having.

**A drawer never wraps, and every chip in a row is the same width.** Both halves are
load-bearing rather than tidy. The tray sits above the stage, so a row that wraps makes
the tray taller and moves the scene — and a chip sized to its own text moves the row
whenever that text changes.

Both ways of breaking it were reported from the phone rather than found here:

- The Fuel drawer pushed Rubber onto a line of its own and stretched it the full width
  of the screen.
- Clear grew into "Clear — sure?" while asking, which reflowed the row, wrapped Load onto
  a second line and lifted the whole box by ~86px — **between the tap that asks and the
  tap that confirms**. The second tap lands somewhere the first one was not.

A third way in, reported after the first two were fixed and diagnosed correctly from the
screenshots: **material chips carry a 6px colour swatch and the gap under it, and the
Scene and Tools chips had none**, so those two drawers were 32px against everyone else's
36. Changing drawer changed the tray height, and the box slid down on the way into Tools
and back up on the way out. Writing the check turned up a second offender in the same
line — the label fitting below shrinks the type so eight chips fit, which took Fuel to
35px, so the box moved a pixel on the way into Fuel too.

Chips are now a **fixed** 36px rather than a minimum, so neither the contents nor the
type size can change the height, and tool chips carry an empty transparent swatch so
their labels sit on the same line as everything else's. Not a colour swatch: a coloured
strip on Erase would be claiming Erase is a material.

So `#mats` and `.tabs` are `flex-wrap:nowrap`, chips are `flex:1 1 0` at a fixed height,
and the labels that change while asking got shorter — Clear becomes "Sure?", Save becomes
"Replace?", with the sentence moved to the readout, which has room for it and moves
nothing by changing.

`test/matchbox-ui.mjs` asserts one row per drawer, equal widths within a row, that every
drawer sits at exactly the same height as every other, and that arming either button
leaves the stage, tray and strip where they were. The drawer check compares the drawers
against each other rather than against a number, because the claim is that they agree,
not that they are any particular size.

### Why the check that existed did not catch it

There *was* a one-row check, written the day before, and it passed on the build that was
wrapping in Sam's hand. **The suite blocks the network to stay offline, so it lays the
tray out in whatever monospace the machine has — and the phone gets Space Mono, which is
wider.** Every claim the suite made about text fitting was a claim about the wrong font.

The fix is not a better measurement, it is a layout that does not depend on the
measurement. Nothing about the tray's geometry now follows from how wide a word is, so
"nothing moves" is true in any font. What *is* font-dependent — whether a label is
readable or clipped — the page now settles for itself at runtime: `fitLabels()` steps the
chip type down from 9.5px until the longest label in the open drawer fits, and re-runs
when the webfont lands, because the webfont is wider than the fallback it replaces.

Measured with the real Space Mono served locally, at 375, 393 and 430px: one row
everywhere, nothing clipped, nothing moves. A first attempt at this clipped five labels
at 375×667 with the fitting doing nothing at all — `@media (max-height:700px)` set
`.chip{font-size:9px}`, which beat `font-size:var(--chipfs)` on specificity and switched
the whole mechanism off on exactly the short screens that need it most.

A material is described by a handful of numbers. The ones that matter:

| | |
|---|---|
| `ig` | the temperature it will catch at |
| `char` | how long it has to stay over that before it does |
| `fuel` | how long it burns for |
| `out` | how fiercely |
| `cond` `cap` | how it carries heat, and how much it takes to warm it |
| `melt` `boil` | what it turns into, and at what |
| `cool` `sets` | ...and what a liquid turns back into as it loses its heat |
| `meets` | contact rather than temperature: this touching that makes those |
| `dens` | what sinks through what |
| `tough` | how many bites acid needs to get through it |
| `peak` | as hot as burning alone can drive it, where that differs |
| `span` `leak` | how a gas stops being there: a clock, or only by escaping |
| `sparse` | how thinly the brush lays it down, and the table's mark of something alive |
| `chew` | ticks a grub takes to get through one cell of whatever it is in |
| `drown` `air` | how many ticks a living thing lasts in the wrong one of the two |
| `feed` `way` `breath` (per cell) | what a vent pours, which way a bug is walking, and how long it has been somewhere it cannot survive |

`ig` and `char` together are what make the tray more than fourteen colours. The match
is at 780°C, which is hotter than every ignition point in the table, so on temperature
alone it lights everything the instant it touches it. What separates paper from coal is
how long it has to be held there.

Measured, on a bar of each with the match held at one end:

| | catches from |
|---|---|
| Powder, straw, paper, oil | a touch |
| Fuse, embers | a moment |
| Wood, magnesium, rubber | a moment — see the honest note below |
| Coal, green wood | the match held on it for seconds |
| Thermite | not from a match at all — 950°C against the match's 780. Use magnesium |
| Wax | nothing. It needs a wick |
| Stone, steel, sand, ash, glass, obsidian, acid | nothing at all |

## The room

Tap **Room** in Tools and the six settings appear in the same row — Freezing, Cold,
Normal, Warm, Oven, Furnace — with the one you are on ticked. Pick any of them in one
tap and the row hands itself back. It sets `AMBIENT`, which was already the number the whole box
relaxes toward — gas sheds heat to it every tick, and all four walls do too — so almost
no new code, and the ignition table turns into a dial:

| | |
|---|---|
| −30 Freezing | water freezes |
| 0 Cold | ice keeps, and water becomes it |
| 20 Normal | nothing happens on its own |
| 90 Warm | wax runs, water is nearly boiling |
| 230 Oven | powder, straw, oil, fuse and paper catch on their own |
| 480 Furnace | everything but coal and thermite goes by itself |

Measured, 40 seconds with a paper block and a pool of water in the box: Freezing turns
all 55 water cells to ice and burns nothing; Oven burns all 216 paper cells with nothing
touching them and boils the water away; Normal does neither.

Named rather than numbered because 170°C is a fact and "straw and paper catch on their
own" is the reason to turn it there.

It stepped to the next setting on each tap to begin with, and that was reported as
clunky, correctly: the settings are invisible until you have been through them all, and
Furnace back to Normal is five taps one way and none the other. A picker costs nothing
here because six chips is one row, which is the size of every drawer — it borrows the
row the tray already keeps clear, so opening it moves nothing. Measured at 375, 393 and
430px with the real Space Mono: one row, no clipping, and the stage, tray and strip stay
exactly where they were.

Turning it only moves the air — everything solid
comes along by conduction at whatever its own `cond` and `cap` say, which is why a block
of ice can hold out in an oven for a while.

**Water freezing is new, and it exists because the setting claimed it.** `cool:0,
sets:ICE` on water, which is the same rule lava already used to become stone rather than
anything added for it. The coldest setting was labelled "water freezes" and did not
freeze water — a worse fault than not having the setting.

## Two ways for a gas to stop being there

Fire, smoke and steam are **events**. Something happens and they are the sign of it, so
they fade on a clock — 24 ticks, 110, 70 — and that is right for them.

A gas you painted is a **material**, and it inherited the same clock at 900 ticks spread
0.6–1.4×. So a sealed room full of gas emptied itself in nine to twenty-one seconds with
nowhere for the gas to have gone. Reported from the phone as not being able to do anything
with gas, which was fair: a bomb with a fuse you cannot beat is not a bomb. Worse, the Gas
preset's label had been written to *describe* it — "and it does not wait" — which is
decorating a fault rather than fixing it.

A material gas now leaves the only way it should be able to: `leak`, a chance per tick of
escaping while it is against the top of the box, and no clock at all. The walls of this box
are already open to the room — that is what `EDGE_LOSS` is — so a venting ceiling is the
same idea.

Measured: **a sealed room holds 396 cells at nought seconds and 396 at sixty.** An open box
drains in about twenty as it rises out of the top. Smoke and steam are gone inside ten,
unchanged.

That change broke the explosion check, and the failure was worth reading rather than
silencing. Its chamber was forty cells deep with four rows of gas in it, which was a
sensible cloud back when half of it evaporated on the way up; with nothing fading it became
160 cells spread through 2,300 — a 7% mixture, and 105 of them would not burn. A lean
mixture failing to go off all at once is behaviour worth having. It was just no longer a
test of "goes off all at once", so the chamber was retuned to the proportions the Gas
preset uses, which are measured to work.

## The vent

A block that pours whatever you tell it to. **Tap Vent and a panel opens with every
material on it**, with the one it is currently holding ticked. Pick one and it closes.
Cancel, the dark around it, or tapping Vent again all back out without changing anything.

The panel is over the *stage*, not in the tray, and that is what makes it possible: a row
cannot hold twenty-four materials, and the tray is not allowed to change height. An
absolutely positioned panel inside `.stage` costs no layout at all — measured at 320, 375,
393 and 430px, opening and closing it leaves the stage, tray, strip and drawer row exactly
where they were.

The list is built from `GROUPS`, so a material added to a drawer is ventable the same day
and nobody has to remember this file exists. The drawers stay live underneath, so
answering from the tray works too. The chip wears the colour of what it is holding, and
what it pours is stored per cell — two vents in one scene can pour different things, and
a save carries it.

**It took two goes to get this right, and both failures were the same failure.** First it
took the payload from whatever had been selected *before* it — "Lava, then Vent" — which
is the same two taps backwards, with nothing on screen to say the first one counted. Then
it put the tray into a waiting state and said so in the readout, which is small grey text
in the corner of the scene: reported back as exactly what it was, an invisible mode with a
caption on it. A control that changes what the next tap means has to show you that it has.

On a small screen the options do not all fit and the panel scrolls, which is where the way
out can vanish. At 320×568 with the real font, 24 options are 415px of content in a 348px
panel, and Cancel at the end of the list sat below the fold — with no backdrop left showing
to tap either, so the only way out was the Escape key on a device that has none. The header
is pinned, and a check goes and finds a 320px screen to prove it.

One general block rather than a lava vent, because the general one cost the same to write
and the spring and the gas leak came free.

**It pushes rather than fills, and that is the whole design.** The first version put its
output into an empty neighbour and nothing else, and made exactly three cells before
stopping forever. It had collided with a rule that is deliberately there: *a one-deep film
of liquid does not creep*, so that a poured oil trail stays a trail. The vent's lone
output cells had no more of themselves above or below, so they never moved, sat against
the vent, cooled, and capped it.

So it walks up the column of its own output and puts the new cell at the top. That is
where the pressure is in the real thing, and it fixes the film problem as a side effect —
the second cell gives the first one something to be a pool with, and the pair can flow.

Measured: a lone lava vent on a floor makes 127 cells of lava and 53 of stone in 30
seconds. A vent under a hollow stone cone fills the shaft, overflows, and leaves **139
new cells of stone** in 50 seconds — the cone is the point, and lava that never set could
not have built it. A vent sealed in stone makes nothing at all, which is a plug and is
allowed.

A vent holds itself at whatever it pours, because a conduit is connected to something and
a vent at room temperature is a cold spot in the one cell where that is fatal. It is
`proof` against acid and has no melting point: a source you can destroy with what it
pours is not a source.

## The first thing that is alive

A **Bug**, in the Life drawer. It falls, walks along whatever solid it lands on — and sinks
through anything it is heavier than, so a pond is not a floor — climbs a single step, turns
round at a wall, changes its mind now and then, and sometimes just stops.
Above 55°C it does none of that: it goes whichever way is cooler, three times faster, and
does not dawdle.

**It is a cell, like everything else, and that is the whole design decision.** As a cell it
inherits the box for nothing: it has a temperature, so fire kills it through the same
ignition rule that burns straw; acid eats it because acid eats cells; it saves and loads
with no new format; and the one thing it cannot do — swim — is a single number in its row
of the table, `drown`, which also gets it an entry in the finds list without a line of code
written for it.

As an object in a separate list none of that would come free, and all of it would be new
code of the kind this file keeps shipping: rules that read perfectly and never fire.

Measured, sixteen bugs on a floor with a straw fire lit at one end: **most get away**,
running from the heat while it burns and wandering back once it is out. On the same floor
with no fire, all sixteen live. That difference is the entire point of them.

How many die is genuinely noisy — across five runs of the identical scene it ranged from
one to five — so the check states the survivors rather than the deaths, and tests the
certain half separately: a bug walled in with a match held on it burns every time. Giving
them a proper wander made them *better* at not dying, which is how the death count ended
up on the noise floor in the first place.

### The moth, which is the bug's opposite

Everything else in this box treats heat as a hazard. One thing that treats it as a
destination turns a candle into a lure and a fire into a funeral. A **Moth** flies rather
than walks, does not fall, and steers towards warmth — with the lowest ignition point in
the table, because a moth that reached a flame and survived it would be missing the point.

Measured, a lit candle at one end of the box and twelve moths released at the other: they
are at the wick within **three seconds**, and then go one at a time — twelve, nine, six,
two, one — with the last circling it. Unlit, none of them die.

**It does not dive, it circles.** Within a few cells of a flame it stops closing in and
goes round it instead, cutting in only now and then by accident — which is the whole of a
moth. Without that, all twelve went straight in and were gone inside thirteen seconds.

**And it can only see about sixty cells.** That number decides whether a crowd is a swarm
or a queue, and getting it wrong produced the worst-looking fault of the session.

#### The column, and why five fixes did not fix it

Reported from the phone with pictures: two hundred moths over a lit candle collapsed into a
solid vertical line above the wick, then burned upward like a fuse.

Five things were changed chasing it, and each one helped slightly, which is the signature of
tuning rather than diagnosing. Arriving by distance instead of by temperature (a candle's
heat rises in a narrow plume, so "stop when warm" meant "stop in a thin column"). Fluttering
instead of freezing when blocked. Beacons only on things that give off light, rather than on
anything hot — which had included every burning moth. Dropping the moth's burn output to
0.1, the lowest in the table, so a swarm is not a fuse. Wobbling the aim point, because the
approach is greedy and diagonal, so a moth closes the gap sideways first and then runs out
of sideways to go, and from that moment the only move left is straight down the light's own
column.

All five were real faults. **None of them was the cause.** The cause was the premise: with
no limit on sight, every moth in the box steers at the one candle in it, and two hundred
solid bodies converging on a single cell is a traffic jam — which, seen from above, is a
column. A real moth is drawn to a light near it and the rest carry on with their evening.

Swept, on the reported scene, worst shape at any moment against how many of a dozen released
nearby still die:

| sight | worst shape | stacked on another | survivors of ~200 | nearby killed |
|---|---|---|---|---|
| unlimited | 14 wide × 110 tall | 39% | 0 | 12 of 12 |
| **60** | fills the box | **1%** | 148 | **12 of 12** |
| 40 | fills the box | 0% | 178 | 10 of 12 |
| 25 | fills the box | 1% | 199 | 7 of 12 |

Nothing had been watching the **shape** of them — only how many were alive and roughly
where — so every check passed on the build that did it. There is one now, and it reports
"12 wide by 108 tall, 9.0 times taller than wide, 52% stacked — that is a queue" the moment
the sight limit comes off.

#### Seeing across a room, once for all of them

A moth orients on a light it can see from the other side of a room, so it has to be able to
see across the room. The first version gave each one a seven-cell look around itself, and
air conducts badly on purpose, so it could not find a candle it was not already touching.

The check that caught it is the **control**, not the claim: unlit, twelve fluttering things
still drift to a mean x of 39-62 all on their own, which overlaps a candle at 18 closely
enough to look like success. The version that could not see anything reached x=37 lit and
x=44 unlit, and reading the first number alone would have shipped a moth attracted to
nothing at all. So the check counts **deaths**, because drift does not kill.

Looking across the whole grid per moth is affordable for twelve and not for two hundred, so
it is done once a tick and shared: the box is diced into blocks and the hottest cell in each
block that clears the threshold becomes a beacon, which also means several fires each get
one instead of the single hottest winning the box. Each moth then picks by brightness
against distance — so a bonfire across the room beats the warm patch of floor beside it, and
a candle it is standing next to beats a furnace at the far end.

Cost with a fire lit: **0.17ms a tick for two hundred moths.**

### Wandering is not travelling

Reported from the phone after the first version: they do not move around unless there is a
flame. They were moving the whole time — 163 cells in twenty seconds — but a bug kept
whatever heading it started with until something got in the way, so it **turned exactly
once** in those twenty seconds. Off to the wall, back again. A thing that only ever slides
one way does not look alive, and beside a panicking one it looks like heat is the only
thing that moves them.

The fix is a chance of changing its mind (9% a step, so a stretch averages eleven cells)
and a chance of stopping for a moment (6%). Same energy, completely different creature:
**169 cells walked, 22 turns, and 44 distinct cells instead of 99.** It meanders a patch
rather than commuting across the box. The check counts changes of mind rather than
distance, because distance was never the problem — remove the turn and it reports "it
changed direction 1 times in twenty seconds — that is a patrol, not a wander".

### The fish, which lives inside something

The first two live *on* the world. A **Fish** lives *in* it: it swims by swapping with the
water rather than moving into a gap in it, because a tank is full and there is nothing to
move into. Water stops being a way to put fires out and becomes a place.

Measured: twelve fish started in a line across a 58×24 tank spread over the whole of it
inside fifteen seconds, all twelve still there after a minute, and not one of them ever
ended up with no water touching it. On dry stone a fish flops and is gone in **3.4
seconds**.

**Almost none of it is written for it.** The only clock it has — how long it has been out of
water — is the same `breath` counter a bug uses for the opposite problem, read from the same
row of the table: `air:200` where a bug has `drown:150`. (It was briefly kept in `life`,
which was wrong for a reason worth writing down: `react()` decays `life` by 6% a tick below
the ignition point, so a counter kept there saturates near 16 and never reaches a threshold
of 150. That was caught by arithmetic before it shipped, which is not how most of the faults
in this file have been caught.) Boil the tank and the water leaves; freeze it
and the water becomes ice; either way there is nothing left to be in, and the same clock
runs out. A 20×10 tank freezes solid and the fish are gone by 60 seconds, a 60×24 by 140 —
big tanks take longer, which is the model rather than a rule.

The one figure that *is* written for it is a heat tolerance: water at 40°C kills, well
before it boils at 100. Without it the Warm setting on the room dial means nothing to a
fish, and nothing between Normal and boiling does either.

### The grub, which takes things out of the box

The first three react to the world. A **Grub** rearranges it — the first thing alive that
*removes* material. Put grubs in a log and come back to a log with galleries cut through it,
then hold a match to what is left.

**One number does all of it.** `chew:40` is ticks per bite, spent as a dice roll rather than
a counter, so it needs no state of its own — the same reason the bug's pace is a roll: a
moving cell has no identity to keep a counter in, and its index changes every time it
shifts. The bite and the move into what was just eaten are one action, which is what makes
a tunnel rather than a hole: the cell it came from is left empty behind it.

**What counts as food is read off the food's own row, not listed here:**

```js
const edible = (t) => t !== E && M[t].fuel > 0 && M[t].ph !== 0 && M[t].ph !== 1 && !M[t].sparse;
```

Solid enough to tunnel through, made of something that would burn. That is eleven materials
today — wood, paper, straw, powder, fuse, coal, green, ember, thermite, magnesium, rubber —
and a fuel added tomorrow is on the menu with nothing written for it. `sparse` is already
the table's mark of something alive, so it keeps the other creatures off the menu: a grub
that ate bugs would be a population rule, and the population is meant to be whatever you put
in the box.

Out of the wood it falls and walks exactly like a bug, only slower (`GRUB_STEP` 14 against
7), so none of that is written twice. Panicking is the same speed whatever you are — a grub
in a burning log is not slow about leaving, it just has further to come.

Measured on a 41×30 log of 1230 cells:

| | eats | what the hole looks like |
|---|---|---|
| one grub, 10s | 10 cells | a **3×9** gallery |
| one grub, 30s | 46 cells | **8×20** — reaching 2.9× further than a blob of that area |
| four grubs, 60s | 352 cells (**29%**) | across the whole log |
| twelve grubs, 60s | 894 cells (**73%**) | lace |

Four is about what one tap gives you, `sparse` being 0.13.

**The check measures the shape, not the count.** A grub that ate a neat sphere out of the
middle of a log satisfies "it eats wood" completely, and is not the thing. A compact blob of
area *A* spans about √*A*; a gallery spans far more, and that ratio is the only way to say
"tunnel" in a number.

Everything else about it is inherited and none of it is new code: fire kills it (8 of 8 in a
burning log), it drowns at `drown:120`, acid eats it, it saves and loads, and eating earns
its own line in the finds list because `chew` is in the table.

**It has no appetite limit**, which is a decision rather than an oversight: left alone long
enough, grubs will reduce every fuel in the box to tunnels and then to nothing. The number
of them is the control, and it is in your hand.

### Dying takes a moment, which is most of what you see

Reported from the phone: a bug that touched water was simply *gone*, and a fish on dry
stone lay perfectly still for three and a half seconds and then vanished. Both were
correct — the creature dies in the right place at the right time — and both looked like a
bug in the program, because the whole of the event happened between two frames.

So the two deaths a creature has of its own are clocks rather than contacts, kept in a
`breath` counter and read from the material table:

| | field | ticks | what you see |
|---|---|---|---|
| Bug under water | `drown:150` | **150** (2.5s) | struggles, and can climb out |
| Moth under water | `drown:90` | **90** (1.5s) | the flimsier one goes first |
| Fish out of water | `air:200` | **~201** (3.4s) | **42–67 flops** across 11–19 cells |

The fish figure was already 3.4 seconds before any of this. What changed is that it now
spends them throwing itself about instead of lying there, which is the same death and a
completely different thing to watch.

#### Four mistakes in it, and only the third was one you could see

Not one of them was visible by reading the source. The first two were found only because the
third was reported from a phone with pictures, and the fourth was reported the moment the
third was fixed — each one had been hiding behind the one in front of it.

*Any neighbour counting as water.* Being *beside* a puddle is not drowning, and counting
all four neighbours killed **7 of 10** bugs walking along a dry floor with water alongside
them. What stops you breathing is being under the surface, so the test is the cell directly
above — one lookup instead of four.

*Instant recovery.* Zeroing the clock the moment a cell touched air made anything that
could reach air immortal — one tick of it and the whole 150 started again. It recovers 4 a
tick against 1 lost now, so getting your head up genuinely pays but only while you keep
doing it. This is what lets a bug walk out of a shallow puddle and live: **7 to 9 of 10**
survive thirty seconds of wandering beside one, which is neither all nor none, and it is
noisy on purpose.

*A liquid counting as ground.* And this was the one on the screen. `footing` accepted
anything that was not a gas, so **water was something a bug could stand on** — and a bug
standing on water never has water above it, so the clock never started. Eighty-four bugs
tipped into a tank sat in a neat pink raft on the surface and stayed there indefinitely.
Both halves read perfectly well: the drowning rule was right, the walking rule was right,
and together they made a bug that walks on water.

A liquid is not footing now, and a creature sinks through anything it is denser than —
`dens:1.1` against water's 1.0, by the same rule that sinks everything else in this box.
Measured on the reported scene: **84 of 84 gone within twenty seconds**, in a steady stream
of about fourteen per 150 ticks as each layer reaches the water and starts its clock. A
one-cell film on the floor is still a puddle to wade rather than a drowning — **10 of 10**
walk through it — because the bug ends up standing on the stone with air above it.

The check for it tips the reported eighty-four in, and asserts the film case beside it:
without that second half, "bugs sink" is satisfied by making water lethal on contact again,
which is where this started.

*And then a fourth: they sank at exactly the speed they fell.* Which reads as a hole in the
water rather than as water, and was reported from the phone the moment the raft went away.
A bug goes down **one cell a tick** in the open and **one every 4.1** through a liquid,
which is about 36 cells in the 150 it has before it drowns — most of the way down a tank.
The ratio is taken from the falling pass rather than invented: it already slows a grain by
about six at the surface of a pool, and a creature that sank past sand at a visibly
different rate would look wrong next to it. It comes out at 4.1 rather than 6 because water
flowing round the bug opens the odd gap underneath it, and a gap is air.

The check asserts the *ratio* and not the absolute — the absolute is a tuning number, and
what has to hold is that a pool slows a creature the way it slows a grain.

### Nothing could arrive inside a liquid

Two reports, a day apart, that turned out to be one fault written twice.

`paintCell` wrote into empty cells and gas and nothing else, so you could build *above* a
tank and never in one: a fish had to be dropped in from the top, and a weight could not be
placed on the bottom of a pool. And `ventPush` wrote into empty cells and nothing else, so a
vent buried in a liquid was plugged — reported from the phone as *"the vent only works for
lava, molten and water while under any liquid"*.

**Those three were not exceptions to the rule, which is the part worth writing down.** A
water vent under water works because a vent shoves its own output up a column of itself, and
its own material is not something it has to displace. A lava vent under water works because
lava quenches into obsidian and steam on contact, and steam leaves gaps behind it — so it
was pushing into holes it had made by accident. The rule was broken for all of them; three
happened to have a way round it, and that is exactly the shape of thing that makes a
measurement disagree with a hand.

There is one function now, asked by both:

```js
const yields = (t) => t === E || M[t].ph === 0 || M[t].ph === 1;
```

`denser` is the other question and a different one — it is about a cell already in the box
moving under gravity, so it weighs the two against each other. Nothing is falling here, so
there is nothing to weigh.

Measured, a vent buried in a pool, counting everything it made in 400 ticks that was neither
the pool nor the floor:

| pouring | in water, before | after | in oil, before | after |
|---|---|---|---|---|
| Sand | **0** | 40 | **0** | 40 |
| Wood | **0** | 40 | **0** | 40 |
| Gas | **0** | 27 | **0** | 25 |
| Acid | **0** | 40 | **0** | 40 |
| Lava | 8 | 5 | 20 | 62 |

Lava is the one that already had a number, and that is the accident above rather than a
working vent. Counting the *payload* would have reported all of this wrongly in the other
direction: lava under water is obsidian within a tick and molten sets to steel, so a working
vent reads as a dead one unless you count everything that was not there before.

**Both halves are checked.** Solids and powders still refuse, for the brush and the vent
alike: without that, the brush quietly becomes an eraser and every wall is one stray thumb
from a hole in it, and a vent sealed in stone eats its way out instead of stopping. A vent
that can be plugged is a design decision — bury one under enough of its own output and it
stops — and "a vent pours into anything" is otherwise satisfied by a vent that eats walls.

It *replaces* the liquid rather than pushing it aside, so filling a sealed tank with sand
leaves you less water than you started with. Displacing properly means finding somewhere for
it to go, and in a sealed tank there is nowhere.

### The one that got past everything

Reported from the phone with two screenshots thirty seconds apart and nothing changed:
tapped bugs sat where they landed and did not move at all. The hunch that came with it —
that a tap makes a pile and they catch on each other — pointed straight at the real fault,
which was worse.

**The bottom of the box did not count as something to stand on.** A step needs footing
ahead-and-below; for a bug on the last row of the grid that cell is off the grid, `inb`
says no, and so it could never take one. Not slowly, not sometimes — never.

Every scene in both suites stood its bugs on a stone floor six rows up, where there is
always a real cell underneath. Clear the box and tap, which is what anybody does first, and
you are in the one case nothing had covered. Reverting the fix reproduces the screenshots
exactly: a span of 84 cells, unchanged after thirty seconds. Both suites now put bugs on
the bare floor of the box and watch them spread.

The pile half of the hunch was right too, and is fixed separately: a material can ask to be
painted sparsely, and a bug asks for 16%. Thirty bugs in a heap is not thirty bugs, it is
one lump of which only the edge can move — and a scatter is what a handful of insects looks
like anyway. `Box` and `Line` still lay down every cell, because a deliberate rectangle of
bugs should be a rectangle of bugs.

### The two traps, both of which were hit

**A creature that walks sideways gets processed twice in a tick.** `react()` walks x
ascending, so anything stepping right lands on a cell the loop has not reached and gets
another go. The falling pass has the same problem and solves it by walking bottom-up, which
works only because things fall one way. So `moveLife()` takes the list of who is alive
*before* anybody moves, and each is processed once wherever it ends up.

**The step throttle keyed on the cell index, and a bug's index moves with it.** That is how
the vents stagger, and vents do not go anywhere. Measured: one bug crossed **seventy-one
cells in a hundred ticks** against the fourteen it was supposed to manage, and it simply
read as a quick bug. It is a dice roll now — no identity to lose, the right average, and
they do not march in step. `test/matchbox-sim.mjs` holds it to a speed limit, which fails
at 216 cells against a pace of 86 if the old throttle comes back.

### One tick, defined once

Adding a fifth pass is what made this matter: the suites used to spell the passes out
themselves, so a new one would have meant every check silently measuring a box where
creatures do not move — with neither the page nor the harness saying a word. There is a
`simTick()` now and the harness calls it.

Cost: **2.31ms a frame with no bugs and 2.34ms with five hundred.** The pass itself is
0.067ms empty and 0.09ms with five hundred in the box.

## Undo

One step, in **Tools**, disabled until there is something to go back to. It covers a
stroke, a Clear, a preset, a Load and a Rain — every action that changes the box in one go.

The only way back from a stray drag across a finished build used to be Clear, which throws
away the whole box: the recovery for a small mistake was a bigger one.

It copies the whole field, which is the honest way — a stroke can lay material down, erase,
displace what was underneath and apply heat all at once, so there is no small record of
"what changed" that is not just as big. The copy goes into a buffer allocated once and
written over. `.slice()` was the first version and measured **2.6ms a snapshot** with 470kB
of new arrays handed to the collector every stroke; `.set()` into a kept buffer is the same
copy for **0.02ms**.

Deliberately one level and no redo. Two things happen a moment apart in this box and the
simulation keeps running underneath, so a deep stack would be a list of scenes that never
existed at the moment you went back to them. It also refuses rather than guesses across a
resize: the arrays are a different shape, and putting the old one back bottom-aligned would
be a guess dressed up as an undo.

## The finds

`FOUND 3/35` in the corner used to be the whole of it. Thirty-two things existed that the
box would never name, mention again or hint at — a progress bar for a task nobody had been
told. **Finds** in Tools opens the list: found ones read as what they are (`Lava + Water →
Obsidian`) and the rest read `Acid — ?`, carrying the material's colour and name and nothing
else. Eight rows mentioning Acid tell you to go and play with acid without telling you what
happens when you do. Found ones sort to the top, so it is a record before it is a to-do list.

The thirty-five are derived from the material table — every melt, boil, set, ash, contact
reaction, explosion, drowning and suffocation in it — so a material added tomorrow brings
its discoveries with it. The three creatures added five between them and no new derivation
code: a `drown` or an `air` field is enough.

**That list and the words for each find used to be two separate derivations** with nothing
comparing them: this table, and the label written out again at each `found()` call site. The
count is the denominator of a progress bar, so a drift between them would have had the box
promising discoveries that did not exist, or hiding ones that did, with a number as the only
symptom. They are one table now, and the suite plays four scenes and asserts every key they
raise is in it.

## Things worth building

Every one of these is checked by `test/matchbox-sim.mjs`. The first four were measured
failing before the rework — see *What changed* below.

- **A fuse to a charge.** Fuse along the floor, a block of powder at the end of it,
  match to the far end. The front takes about 30 seconds to cross 44 cells and then the
  charge goes off.
- **A candle.** A block of wax with a column of fuse standing in it. Light the top. It
  burns for about 35 seconds: the wick draws melted wax rather than burning itself, and
  is re-wetted while it can still reach some. It goes out when the pool has receded
  further than the wick can reach — the wick then burns away like the cord it is.
- **An oil trail.** Oil is a liquid, so it lies in a sheet one cell deep and does not
  run away from where you poured it. A lit trail travels at about 1.6 cells a second
  and will light a wood pile at the end of it.
- **Putting a fire out.** Water on flames kills them on contact. It is boiling that
  does the real work: vaporising takes its energy out of whatever the water is
  touching, which is the fire. Rain does the same thing from above, for longer.
- **Glass, from sand and lava.** Drop sand into a pool of lava. A thin pour of lava
  over sand on a cold floor will not do it — the floor drinks the heat.
- **Obsidian.** Pour water on lava. Left alone it crusts over into stone instead.
- **Cutting steel.** Thermite sitting directly on a plate, lit with a magnesium
  ribbon, because nothing else in the box gets near 1400°C. It cuts a hole through a
  plate a few cells thick and is stopped by a thick one — see the honest notes.
- **A gas explosion.** Fill a sealed space with gas, wait for it to gather under the
  lid, and then reach in with a match. **Shut in, it keeps** — there is no hurry.
- **Getting water wrong.** Set magnesium alight and pour water on it. Measured: 2213°C
  dry, 2600°C wet.
- **An acid tank.** Acid eats through most things and wears out doing it — a dozen
  cells per drop. Glass and obsidian are the two it cannot touch.
- **A fish tank, and then the room dial.** Glass walls, water, fish. Then turn the room to
  Oven or Freezing and watch what happens to something that can only live in the middle.

Six of them are built for you in the **Scene** drawer — Candle, Fuse, Cut, Lava, Acid,
Gas. None arrives lit, because the match is the whole interaction and a scene that turns
up already burning has spent it.

They are the scenarios above rather than six pretty ones on purpose, and
`test/matchbox-sim.mjs` lights each preset and asserts it pays off: the candle stays lit,
the fuse takes its time, the plate ends up open, the acid eats the steel and not its own
tank, the pour is still liquid, the gas bangs. **A preset is a promise on a button.**
Geometry a few cells out builds a perfect-looking scene that cannot do the thing its own
label says — measured, lifting the wick eight cells clear of the wax drops the candle
from 1854 ticks to 202, and nothing about it looks wrong.

## Saving

One slot, in the **Scene** drawer with the presets — a save is a scene, which is the more
honest grouping and is what made room for Finds in Tools without either row reaching nine
chips. Save asks before replacing an existing save and not before the first one — a confirm on a harmless action is what teaches people to tap
through the one that is not.

**A save stores what you built, not what the fire was doing.** Every cell comes back
through `put()`, at its own starting temperature with its fuel full, exactly as though
you had just drawn it. A scene saved halfway through burning comes back unburnt. That
buys three things: a save is a couple of hundred bytes rather than most of a megabyte,
because the material layout run-length encodes to almost nothing while a temperature
field mid-fire has a different number in every cell; it is the same scene every time it
loads; and it cannot come back subtly wrong, which a rounded temperature field can — four
degrees of quantisation on the wrong side of an ignition point is a scene that used to
light and now does not. The whole Cut preset is **220 bytes**.

**Saves are keyed by name, not by position** — materials will be added, and the numbers
in the `M` table are positions in a list, so inserting one in the middle would turn every
save ever written into a different scene.

The name it stores is deliberately not the name in the tray, and that is not fussiness.
**Two pairs of materials share a display name**: `WAX` and `MELT` are both "Wax", `RUBBER`
and `MRUBBER` are both "Rubber". The obvious reading of "store names, not indices" is
`M[t].n`, and it would have loaded every puddle of molten wax back as a solid block of
it — no throw, no warning, just a scene slightly different from the one you saved. So
`SAVE_KEY` is its own table, the suite asserts it is complete and collision-free, and the
tray stays free to rename anything it likes.

A save written by a later build can name a material this one has never heard of. Those
cells are dropped and the count is reported, because losing some of a scene while saying
so beats refusing all of it, and both beat dropping them silently. A save from a bigger
screen is clipped bottom-aligned, the same rule a resize already uses: it loses its
ceiling, never its floor.

## How the heat works

Four passes a frame: things fall, gases rise, heat moves, materials react.

**Conduction is a trade between neighbouring pairs.** Every cell trades with the one to
its right and the one below, which covers every pair on the grid exactly once, and the
energy that leaves one is the energy that arrives in the other. Two conductances in
contact add in series, so steel carries heat along a bar and still hands it over slowly
to the wood at the end of it.

**Air is a poor conductor and carries heat by rising.** This is the single most
load-bearing number in the file. Air conducts at .06, worse than wood; convection moves
heat through it instead, and only through gas.

**Burning cells radiate to the four cells around them**, weighted upward but not
exclusively. This is what makes fire spread rather than merely rise.

**Melting and boiling cost energy**, taken out of whatever the cell is touching. A
block of ice holds what it is packed against near freezing for as long as it lasts, and
a splash of water pulls the heat out of a fire as it goes to steam.

**Nothing gets hotter than `MAX_T`.**

Two ways for a cell to change, and telling them apart is worth understanding before
touching anything:

- `put()` introduces new material — your finger, the rain, the opening scene — and it
  arrives at **its own** temperature. Ice arrives at −14°C.
- `become()` converts what is already there — wax melting, wood spending its last fuel,
  a flame going out — and **keeps the heat that was in the cell**.

## What changed, and what it was before

The file was reviewed by measuring it rather than reading it. Four things a person
would sit down and build did not work, and they had one cause between them.

| | before | now |
|---|---|---|
| Fuse along the floor to a charge | burned 6 cells, stopped, charge untouched 27s later | crosses 44 cells in 30s and fires the charge |
| Candle | wick out 115 frames after the match left, 128 of 158 wax cells never melted | burns ~35s on drawn wax |
| Burning oil against a log | the log reached **96°C** against an ignition point of 300 | lights it |
| Green wood | 300 cells, flame held on it, **0 consumed, ever** | catches, but only if you hold the match there |
| Ice | 600 cells placed, **0 left one tick later** | arrives at −14°C, melts over a minute or so |
| Water thrown on a fire | arrived at 539–652°C, flashed to steam, burning cells **45 → 51** | flames to zero, and half again as much wood left standing |
| Rain over a fire | burning cells **45 → 81** through 600 ticks of it | drowns it |

The cause: heat only ever went upward. Conduction was the only sideways path, and the
table had air at .55 conductivity — better than everything except steel, and five times
wood. Every burning cell dumped its heat into the air beside it faster than it could
push it into the log it was touching. Measured on the old figures, **a lit wood cell
settled at 320°C against its own ignition point of 300, and held its neighbour at
200** — permanently 100° short, in every scene, for every material.

Two other faults ran through everything. Conduction was not conservative: a cell gave
heat away at a rate set by itself and its neighbour took it at a rate set by *itself*,
so every boundary between two different materials quietly made or destroyed energy,
worst at exactly the interesting places. And one function did the jobs of both `put`
and `become`, getting each of them backwards.

Six interface faults, all silent, are listed in the commit that fixed them. The worst:
**a match burning out mid-drag switched the tool to Wood**, so a finger that was
applying flame started laying logs — measured at 245 cells, without the finger leaving
the glass.

## Tests

```
npm i playwright
node test/matchbox-sim.mjs     # 65 checks — the simulation
node test/matchbox-ui.mjs      # 38 checks — the hand
node test/published.mjs        #  3 checks — the copies with the URL still match
```

Chromium only. Neither needs a server; the page is loaded over `file://`.

The simulation suite freezes the animation loop before the page boots and steps the
model itself, so a scene cannot advance by an unknown number of frames while Playwright
is talking to the page. Both suites pin their viewport, because the grid is derived from
the element's pixel size and every distance in a check is quoted in cells.

Checks come in two kinds and **both are load-bearing**. The *can* checks are the four
scenarios above plus water, ice and the match. The *cannot* checks are what stops the
first set being satisfied by making everything catch fire instantly: stone, steel and
sand never burn, a scene never lights itself, a fire never runs away, an empty box stays
at room temperature, no temperature goes NaN or past the ceiling, and conduction
conserves energy over 300 ticks of a lumpy field.

Three things learned the hard way while writing them, all of which cost a wrong answer
first:

- **Count what is alight, not what is hot.** A cell over its ignition point has not
  necessarily caught. Counting the two as the same made a lid of ice read as *feeding*
  the fire under it.
- **"The fire went out" and "the fire finished" are the same number** at any single
  moment — a pile left to burn also ends up with nothing alight on it. The water and
  ice checks compare against the same scene with no water in it.
- **A harness that reimplements the page will agree with itself** long after it has
  stopped agreeing with the page. `__flame` calls the page's own `paintAt`. It still
  silently stopped lighting anything the moment a guard was added to `paintAt`, and
  only re-running the whole suite caught it.

## Honest notes

**A quick dab of the match lights a wood pile 20 times out of 20.** A real match held to
a log for a fifth of a second would not. Wood's `char` is 30 ticks and the match leaves
the cell hot enough to keep charring after you have moved on. Raising it to 40 makes the
dab a genuine gamble and also breaks the handover from a burning oil trail into a log,
which matters more. The gradient between *materials* is real; the gradient between a dab
and a hold, for wood specifically, is not.

**A splash of water does not save a burning pile, it delays it.** Water sits on top —
it cannot get inside a solid — so the rows underneath keep going and relight the rest
once it has boiled off. Measured: 35 wood cells left against 24 for the same scene left
alone. Sustained rain does put a fire out. This is defensible and it is also not what
some people will expect.

**The candle ends by losing its wick**, not by running out of wax: 35 of 158 cells used.
The pool recedes below what the wick can reach, the wick goes dry and burns away.

**Ice never falls.** It is a static solid, like stone and wood, so a block of it hangs
where you put it.

**Thermite has a reach, and thick steel defeats it.** Measured with a six-deep charge:
three and four deep always open up (7-9 of 12 columns), six and eight deep never do
across five runs each, and **five deep is genuinely bimodal** — 0, 9, 0, 0, 11 on
repeats of the identical scene. A plate exactly at the limit either gets opened or holds
it, which is worth knowing before reading anything into a single attempt. That is the
melt-through rule doing what it should — a hot liquid sinks into a solid it is hot
enough to melt and stops the moment it has given away enough heat to fall below that
melting point. Use more thermite, or a thinner plate.

**Molten steel had to be given time to be liquid before any of that worked.** Reported
from the phone as setting too fast, and correctly guessed to be the same fault lava had.
Traced: one cell in open air fell 1500→1268 in five ticks and had set by tick nine; half
a 150-cell pool was solid in thirteen. Lava, after its fix, takes 1274 — molten steel was
the faster of the two by a hundred times, and it is the one that is supposed to run.

Two figures were wrong and a third was a red herring:

- **`cap` 1.5 → 5.0.** The real error rather than a tuning choice. `cap` is heat per unit
  volume and steel's is close to water's (3.5 against 4.2), so on a scale that puts water
  at 6.0 steel belongs near 5.0, not a quarter of it.
- **`t0` 1500 → 1650.** Melting through steel needs `melt + MELT_THRU` = 1460, so 1500
  left forty degrees of headroom in a cell shedding forty-six a tick. Counted directly:
  at tick 0, 150 of 150 cells could melt steel; by tick 10, none could. **The
  melt-through rule was live code that never once fired**, and every test of it passed.
- **`cool` 1120 → 860.** 1120 already fixed an absurdity — at 1380 the window was twenty
  degrees wide and a cut froze back into its own hole, leaving the plate thicker than it
  started — but it did not fix the complaint. This is the same licence lava takes.
- **`cond` is nearly inert here, which is not what it looked like.** The first pass
  dropped it .60 → .34 on a theory about the cell touching the plate always being the
  coldest. Swept across .55/.45/.34 with everything else held, a cell lasted 39/40/41
  ticks and half a pool 63/61/47 — no trend worth the name, because with `cap` at 5.0 the
  heat leaves to the room rather than sideways. It is now .55, set for ordering alone:
  under solid steel's .92, above water's .42. At .34 a liquid metal was conducting worse
  than water.

After: a cell lasts 65 ticks, half a pool 162-198, all of it 308-327 (5.3s). A/B on the
identical plate — old figures breached nothing in 23 seconds, new figures holed it at 4s.

## Performance

2.5 ms a frame including the draw, on a 130×203 grid of 26,390 cells in a busy scene.
The suite asserts under 8 ms, which is half a frame at 60Hz.

**A phone is not several times slower.** Every grid estimate here assumed it was, and
the assumption was load-bearing and wrong: the gauge on an iPhone reported 3.0-4.5ms
of work where this machine managed 4.4 on a comparable scene. That is what the frame
timer in the corner is for — the number that decides how big the grid can be has to
come from the device holding it.

## If you change something

Run both suites first, then again after. This file has a history of faults that read
perfectly well in the source — a fuse that could not travel, a material that could not
be lit, a wick with nothing to draw, a splash of water that fed the fire it landed on.
Not one of them threw, warned, or looked wrong in a screenshot.

The most valuable single habit: when a fix changes nothing, suspect the measurement
before the code. Four of the wrong turns behind this file were in the harness rather
than the page, and every one of them would otherwise have shipped a confident wrong
answer.
