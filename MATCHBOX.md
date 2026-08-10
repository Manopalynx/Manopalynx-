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

Thirty-four chips in the tray — twenty-five materials, eight living things and the vent — and
nine more the simulation makes and never lets you place: fire, smoke, steam, ash, the pupa, the
stem and the flower, molten wax and molten rubber. Every one of them is one row of the `M` table
and nothing else in the file knows any of them by name.

(This count has been wrong twice. It was stale before the grub was added to it, and the
first attempt at fixing it undercounted the made-only list, because the probe I counted with
deduplicated by display name and both molten forms share theirs with the solid they came
from — `WAX` and `MELT` are both "Wax". The same collision once made a saved scene load
molten wax as solid, which is why saves key on `SAVE_KEY` and not on the name.)

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
  (Clear asks in the drawer row now — see *Clear, which is a question rather than a
  button* — but the rule it broke is the one everything above is built on.)

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
and the label that still changes while asking got shorter — Save becomes "Replace?", with
the sentence moved to the readout, which has room for it and moves nothing by changing.
Clear no longer relabels at all: it asks by borrowing the drawer row, which is a bigger
change to the tray than a word and therefore the likelier of the two to move something,
and is measured not to.

`test/matchbox-ui.mjs` asserts one row per drawer, equal widths within a row, that every
drawer sits at exactly the same height as every other, and that neither button asking its
question moves the stage, tray or strip. The drawer check compares the drawers
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
| `MELT_THRU` `BURN_THRU` | how far over a melting or an ignition point a liquid must be to sink through |
| `span` `leak` | how a gas stops being there: a clock, or only by escaping |
| `sparse` | how thinly the brush lays it down |
| `n` | what the tray calls it, which is deliberately not what a save calls it |
| `alive` | this is a creature — keeps it off a grub's menu, whether or not a brush made it |
| `chew` `pupa` | ticks a grub takes per cell, and how many cells before it seals up |
| `graze` | ticks an ash bug takes per mouthful of what fire left behind |
| `carries` | this one picks loose grains up and heaps them somewhere else |
| `spread` `damp` | ticks between growing a cell, and how far water may be for it to try |
| `wither` | dies at this temperature, instead of ever reaching an ignition point |
| `tills` `soil` | ticks a worm takes to compost one cell of a burn, and what it makes |
| `roots` | the brush may only put this where it could actually live |
| `hatch` `becomes` | how long a life stage lasts, and what it turns into |
| `drown` `air` | how many ticks a living thing lasts in the wrong one of the two |
| `chokes` | a gas you cannot breathe: runs a creature's breath clock the way water does |
| `GAS_DRIFT` | how readily a gas that cannot rise spreads sideways instead |
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

**One number does all of it.** `chew:67` is ticks per bite, spent as a dice roll rather than
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
| one grub, 10s | 9 cells | a **3×8** gallery |
| one grub, 30s | 26 cells | **3×21** — reaching 4× further than a blob of that area |
| four grubs, 60s | 221 cells (**18%**) | across the whole log |
| twelve grubs, 60s | 654 cells (**53%**) | lace |

Four is about what one tap gives you, `sparse` being 0.13.

#### `chew` was 40 and is 67, which was reported rather than calculated

"They seem to go through the materials very quickly" — from the phone, and asked for 40%
slower. The rate is `1/chew`, so 40 ÷ 0.6 = 67, and the arithmetic is the easy half. What it
is actually worth measuring is that **the slowdown you get is not the slowdown you asked
for, and how far off depends on how many of them there are:**

| | at `chew:40` | at `chew:67` | slower |
|---|---|---|---|
| one grub, 30s | 45 | 26 | **42%** |
| four grubs, 60s | 355 | 221 | **38%** |
| twelve grubs, 60s | 883 | 654 | **26%** |

Repeated 8, 5 and 4 times respectively, because one run of a random walk is noise. A lone
grub gets the full 40% because there is always something to bite. Twelve get 26%, because at
that density the bite rate has stopped being what limits them — they spend their time
crossing tunnels that other grubs have already eaten, and looking for fresh food is the
bottleneck. The dial is honest at the density you actually play at and increasingly
optimistic above it.

**The check measures the shape, not the count.** A grub that ate a neat sphere out of the
middle of a log satisfies "it eats wood" completely, and is not the thing. A compact blob of
area *A* spans about √*A*; a gallery spans far more, and that ratio is the only way to say
"tunnel" in a number.

Everything else about it is inherited and none of it is new code: fire kills it (8 of 8 in a
burning log), it drowns at `drown:120`, acid eats it, it saves and loads, and eating earns
its own line in the finds list because `chew` is in the table.

#### And then it pupates

**The grub and the moth are the same animal at two ages.** Thirty cells eaten and it stops,
seals itself into the gallery it cut, and five seconds later a moth comes out and goes
looking for a flame. So a scene can now run from a log to a candle without you touching it:
grubs in the wood, a wick at the far end, and wait.

Measured, one grub in a 49×40 log: **pupates at tick 1616** (27 seconds) and **hatches
exactly 300 ticks later**, which is `hatch:300` doing what it says.

**One grub in, one moth out, and the check counts the sum rather than any one form.** That
was the condition for adding this at all — the box has no way to make a creature, and
pupation must not become one. Six grubs in a log for two minutes: six moths, and the sum of
grubs + pupae + moths never left six at any point.

| | field | |
|---|---|---|
| `pupa:30` | on the grub | cells eaten before it seals up |
| `hatch:300` | on the pupa | ticks before it opens |
| `becomes:` | on both | what each one turns into |

`becomes` is one derivation and it produces both entries in the finds list — *Grub turns into
Pupa*, *Pupa turns into Moth* — so a fifth creature with a life stage brings its own.

**Two counters and no new array.** Meals and the hatch clock both live in `vel`, which is
free because a creature is a static solid and the falling pass only ever touches the
velocity of a liquid or a powder — and `put` and `become` already zero it, which is exactly
the reset wanted when a cell stops being a grub. It is not in the save file, so a scene
reloaded mid-meal counts again from nothing; five seconds of a hatch clock is not worth a
format version.

**A pupa is *made, never placed*.** It is not in the tray and has no `sparse` — and that is
what turned up a fault in the grub written the day before. `edible` read `!M[t].sparse`,
which had been the right answer for the wrong reason: every creature had a `sparse` because
every creature came out of a brush. A pupa does not, so **grubs would have eaten their own
chrysalises**. There is an `alive:1` on all five rows now, and `edible` asks that instead —
a field that says the thing it means rather than one that happened to correlate.

**And it broke a check by being right.** The grub check counted `GRUB` and asserted the
number held, which was correct for exactly one day: eight grubs in a log for fifty seconds
now grow up, so it reported *"8 of 8 grubs ate each other"* about eight grubs that had simply
pupated. Every count in that check is `grubs + pupae + moths` now. Worth recording because
the failure message was confident, specific and completely wrong about the cause — the check
was measuring a proxy for "alive" that had quietly stopped meaning it.

Everything else it inherits: fire kills all six of six sealed in a burning log, water drowns
all six, and it saves and loads like anything else. It does not fall, and a chrysalis hanging
in the gallery its grub cut is what one looks like.

**It still has no appetite limit**, which is a decision rather than an oversight: a grub that
never finds thirty cells never pupates, and grubs that do keep eating until they do. Six
grubs on a bare floor stayed six grubs through a minute of it — pupation is a reward for the
tunnelling, not a timer, and the check states that separately because a timer would look
identical for the first half-minute.

### The ash bug, which is interested in what has already happened

Pupation cost the box something, and it was spotted from the phone rather than here: with
the grub growing up and flying off, **nothing lives in solid material any more.** The
measurement is worse than the observation. A log, a pond, a floor, one tap of each creature,
left running for three minutes:

| seconds | grub | pupa | moth | bug | fish | wood |
|---|---|---|---|---|---|---|
| 0 | 6 | 0 | 0 | 6 | 4 | 1464 |
| 30 | 4 | 2 | 0 | 6 | 4 | 1314 |
| 60 | 0 | 0 | 6 | 5 | 4 | 1284 |
| 180 | 0 | 0 | 6 | 2 | 4 | **1284** |

Bugs are still walking at three minutes and fish still swimming; the wood is frozen from one
minute on. And the same is true of every fire ever lit in this box — the ash and the embers
sit there for as long as the tab is open, and nothing has ever touched them.

An **Ash bug** eats them. It walks like a worm and grazes what it passes, and what counts as
food is derived rather than listed:

```js
for (let t=0; t<M.length; t++){
  const m = M[t]; if (!m || m.ash === undefined || m.ash === E) continue;
  const a = M[m.ash];
  if (a && a.ph !== 0 && a.ph !== 1) s.add(m.ash);          // ash and embers, today
}
```

Anything some material burns down to. The filter is the half worth reading: three `ash`
targets are not things to be eaten — `E`, which is nothing at all; `SMOKE`, which is a gas
and already gone; and `MOLTEN`, because thermite burns down to molten steel and an ash bug
grazing on that is not the picture. Gas and liquid are the test, so the next fuel that burns
down to a liquid is excluded without anybody remembering to.

**Grazing deliberately does not stop it walking**, which is the one place it differs from
the grub. A grub at a face of food stays put and tunnels. An ash bug doing the same would
sit in an ash field clearing a circle around itself, which is not foraging. It eats what it
is passing and keeps going. Measured, four of them — about one tap — take a 306-cell ash
field to 3 in a minute; one takes it to 148.

#### Its one constraint is inherited, which is why it is the right one

**An ember is hot.** An ash bug that walks into a fresh burn heats up, panics and leaves on
exactly the machinery the bug already has, and burns if it stays. So it can only clear a
fire once the fire has gone out — and not one line of that is written for it.

Eight ash bugs released into the same burnt log at different times:

| released | box still at | survivors | debris after another minute |
|---|---|---|---|
| 30s after lighting | 1296°C, 30 fires burning | **0 of 8** | 821 → **969**, their own ash |
| 60s | 1128°C | 5 of 8 | 984 → 634 |
| 120s | 538°C | 8 of 8 | 984 → 227 |
| 200s | 185°C | 8 of 8 | 984 → **0** |

The first row is the good one: send them in too early and you have made the mess worse.

**This replaced a damp requirement, and the reason is worth keeping.** The first design had
it dry out away from water — the exact inverse of the fish, a real new constraint, and it
would have made the pond matter for something other than putting fires out. It is also
wrong, and obviously so once stated: **fire dries everything**, so a creature that needs
water could not live in the one place it exists to clean up. The constraint would have
fought the creature. The heat one costs nothing and says the same thing better.

#### It did not look for the ash, it walked into it

Reported the next morning: *"they don't seem to seek the ash, or look like they do at
least."* They did not. **Eating debris and *looking* for debris are two different verbs, and
only one of them had been written** — the rest was a worm's random walk with a mouth on it.

An ash bug walks a floor, so the question is only ever left or right, which makes this one
number per column rather than a beacon per block. One pass fills the tally and every ash bug
in the box reads it — the same bargain the moths get, one grid scan a tick however many
there are, and none at all when there are none.

**The first attempt measured as working and was not.** It counted debris within reach of the
creature itself, which cost the same per creature and told you almost nothing: at a reach of
16 on a box 131 cells wide, an ash bug released across the room from a pile could not smell
it. Eight of them, with the ash on the *left*, drifted **+10 to the right**. It only looked
right when the pile happened to be on the side the walk drifted toward, which is why the
check now runs both sides.

| ash on the | before | after |
|---|---|---|
| left | **+10**, away from it | **−46** |
| right | +33 | +33 |

Range was the whole fault; the count was never the point. It is 60 columns now — the same
number as the moth's sight, and for the same reason: far enough to read as purpose, short
enough that it still has to find the pile rather than being issued with its position.

**The check averages the two sides**, and that is not tidiness. A random walk drifts, and one
run of a worm drifted 35 cells — enough to beat the ash bug's 31 on that side and fail a
comparison of magnitudes. Signed toward-the-pile and averaged over both sides, the drift
cancels and only the seeking survives: **39 cells for an ash bug against 2 for a worm.**

And it dawdles where the food is: `ASHBUG_FEED` 22 ticks between steps with something under
its nose, against a worm's 7. A grub at a face of food stops entirely and tunnels; an ash bug
slows down and keeps going, which is the difference between mining and foraging.

### Two renames, and why the save keys did not follow

The tray called this creature a **Woodlouse** for an afternoon. It was the wrong name and
wrong in the more confusing direction: **it does not eat wood — the grub does.** A woodlouse
that never touches wood, standing next to a grub that eats nothing else, is the pair the
wrong way round. It is an **Ash bug** now, which says what it does without needing the
zoology. And the original creature — `BUG` in the source since it was the only one — is a
**Worm** on the tray.

**The save keys did not change, and that is the whole reason they exist.**

```js
SAVE_KEY[ASHBUG]='woodlouse';
```

A scene saved before either rename still loads, because the key was never the label. Changing
it here to match would have broken exactly the saves this table exists to protect. The check
now writes one cell of every material, round-trips it through `JSON`, and compares **types
rather than names** — so a future rename is free, and a key that quietly follows a label is
caught.

The code still says `BUG` where the tray says Worm. That is deliberate rather than pending:
the creature walks on top of things and climbs, which is more insect than worm, so the
rename belongs with whatever behaviour change makes it a worm — not with a diff that touches
fifty comments explaining a walk that has not changed.

### The ant, which moves the box around

The sixth, and the first that neither adds to the box nor takes from it. An **Ant** picks a
loose grain up, carries it, and puts it down somewhere else.

**The rule is two lines and the behaviour is in neither of them.** It lifts a grain more
readily the fewer of its kind are around it, and puts one down more readily the more there
are:

```js
if (Math.random() < ANT_TAKE / (1 + n*n))                    // n = same kind, of eight
if (Math.random() < ANT_KEEP + ANT_DROP * (n*n) / (1 + n*n))
```

Nothing says where a heap should be, or that heaps are wanted at all. Scattered sand gathers
into heaps anyway, and sand and ash gather into *separate* heaps, because a grain is only
ever counted against its own kind. This is the one piece of borrowed cleverness in the file —
it is the classic ant-sorting rule — and it earns its place because it is the only way a
creature this simple produces something worth looking at.

Measured on the same fixed scatter across a floor, clumping being the mean number of
same-kind neighbours per grain:

| | before | after |
|---|---|---|
| no ants, two minutes, ×3 | 1.14 | **1.14** every time |
| ten ants, two minutes, ×5 | 1.14 | **1.80 – 2.41** |
| mixed sand and ash, fourteen ants, five minutes, ×3 | sand 0.41, ash 0.50 | sand **1.33 – 2.23**, ash **1.93 – 3.00** |

The first row is the control and it is not decoration: sand piles under gravity on its own,
so "it ended up clumped" measures gravity unless you have run the same scene empty. It gains
exactly 0.00, three times out of three, which is what makes it worth having.

**Sorting two kinds is much slower than heaping one**, and the check learned that the
expensive way. At eight ants and ninety seconds the sand's gain ranged 0.15 to 0.95 across
five runs and the arm failed about one time in three — not flakiness in the box but a
threshold set from a single lucky measurement. Every grain an ant passes is now only half as
likely to be the kind it is carrying, so it takes fourteen ants and five minutes before the
worst run is comfortably clear of the bar.

**What it can lift is read off the grain** — a powder, and not alive — so a powder added
tomorrow is portable with nothing written for it, and stone, wood, glass, steel and water all
stayed put through three thousand ticks of six ants standing on them.

**The load lives in `feed`**, the array a vent keeps its payload in. An ant is not a vent, so
the field is free, and it is already saved and already swapped — an ant put down mid-carry is
still carrying when the scene comes back. A laden ant draws as half its own colour and half
its cargo's, so you can see what is being moved and where; a vent shows its payload outright,
but an ant drawn that way would look like a grain walking and the animal would disappear.

#### Two faults, and one of them wore a good number

*The drop sweep re-rolled its random offset inside the loop*, so it revisited directions and
skipped others. An ant with exactly one place to put something down would often fail to find
it. Fixing that alone took the heaping from 0.88 to 2.4.

*And then the good number was the bug.* At `ANT_TAKE .55 / ANT_DROP .40` the heaps measured
**better** than what shipped — and most of the ants were permanently laden, with grains held
rather than heaped. A clumping measurement cannot see that; it looks like success. It ships
at `.30/.60`, which measures slightly worse and puts 71 grains of 72 on the floor. The check
asserts both, because the first number alone was satisfied by hoarding.

##### The measurement of the second one was wrong for months, and turned up as a flake

It counted the ants holding something **at the final tick**. Ten ants sampled once is ten
coin flips, and across eight runs it came out `2 3 3 3 4 4 4 5` against a bar of four — so the
suite failed about one run in eight on a build that was working perfectly. That is how it was
found: a full run went red on a change that could not possibly have touched ants, and the two
builds measured identically when compared side by side.

Worse than flaky, it did not separate the thing it was looking for. An ant that **never**
drops comes out at `3 6 6 6 6 7 7 8` on the same measurement — straight through the middle of
the working range.

**The fraction of its time an ant spends laden**, sampled every fifty ticks, does both jobs:

| | measured | runs |
|---|---|---|
| working | **0.25 – 0.32** | 16, across two builds |
| never dropping (`ANT_DROP 0`) | **0.64 – 0.72** | 8 |

The bar sits at 0.45, in the gap, and the mutation is caught at 65%. Never dropping does not
reach 1.0 because `ANT_KEEP` is a floor under the drop chance — an ant that cannot find a spot
eventually gives up and puts the thing down, which is why the box never deadlocks.

A panicking ant drops what it is holding, which is both what one would do and the only place
a grain can leave the box for good: an ant that burns while laden takes its load with it.

### The colours, which were measured after they were reported

Reported from the phone: the moth and the grub were near enough the same colour that a new
player would wonder why a grub had started flying. **Measuring it found worse.** In CIE76 —
Lab rather than RGB, because the eye is far more sensitive to lightness than to blue and an
RGB number says the opposite:

| pair | dE |
|---|---|
| **Paper / Moth** | **2.3** |
| **Wax / Moth** | **3.1** |
| Stone / Ash | 3.4 |
| Powder / Smoke | 4.2 |
| Grub / Wax | 10.7 |
| Ash bug / Steel | 12.8 |

The moth was the same colour as paper. The reported pair was not even the worst one.

Rather than nudge two entries, the living things were solved as a set: hue bands so each one
still reads as itself, a floor on separation from every material, a **higher** floor between
creatures, and among everything that clears both, the candidate closest to what it already
was. Two earlier objectives were wrong and worth recording — maximising separation gave an
electric-purple moth at dE 86, and minimising saturation drove the whole set into pastel and
put the moth and the grub back into two pale pinks.

| | was | is | nearest now |
|---|---|---|---|
| Moth | `[214,198,166]` | `[236,196,232]` | Magnesium 22.1 |
| Grub | `[228,198,186]` | `[220,248,196]` | Wax 22.0 |
| Fish | `[104,168,176]` | `[84,160,168]` | Steel 22.4 |
| Pupa | `[186,124,70]` | `[188,116,68]` | Straw 22.3 |
| Ash bug | `[120,134,160]` | `[124,136,184]` | Water 22.2 |
| Ant | — | `[136,44,44]` | Ember 23.0 |

Moth to grub is **52.7** now, against roughly ten before.

**The check holds three different bars and the lowest one is an admission.** Two creatures:
30. A creature and a material: 20. Two materials: 3, which only catches a literal duplicate —
because the material palette does not meet a higher bar and never has. Twenty-six material
pairs sit under 12. They are told apart by where they are and what they do; ash is on the
floor after a fire and stone is the wall you built. Nobody has reported confusing them, and a
check asserting a standard the box has never met would be a failing test about a problem
nobody has. Creatures cannot lean on context — they move, and they mix.

### Then somebody reported confusing them

Reported from the phone: dirt and ash look the same, so you cannot see what the worm is
doing. The check above passed that pair at **17.6** and called it comfortable. It was wrong
twice over, and both faults are worth keeping written down.

**It measured the table, and the table is not what gets drawn.** Every cell carries a fixed
tint, added to all three channels at once — which is very nearly pure lightness. So the
lightness difference between two materials is the one thing the grain can hide, and it hid
this one whole:

| | table dE76 | L\* | mean lightness gap **as drawn** |
|---|---|---|---|
| Dirt / Ash | 17.6 | 38 vs 39 | **3.6** |
| Dirt / Wood | 15.0 | 38 vs 38 | 3.4 |
| Moss / Green *(reads fine)* | 20.1 | 58 vs 41 | 17.0 |

One material's own tint spreads it **10.8** in lightness. Dirt and Ash were 3.6 apart. The
variation inside a field of dirt was three times the difference between dirt and ash.

**And CIE76 overrates chroma.** The whole 17.6 was yellowness at low chroma, which the eye
discounts and that formula does not. The metric is CIEDE2000 now, with the lightness
difference first shrunk by what the tint can hide — `survives()` in the suite. On that
measure the reported pair is 11.7 and **the worst pair in the box is 1.1: Stone and Ash**,
which the old check waved through at a bar of 3 while being the check for exactly this.

Then the pixels, which settled it. Single cells of one material scattered through a field of
another, counting the ones the field already contained a match for:

| | single cells hidden, before | after |
|---|---|---|
| Ash on Stone | **100%** | 0% |
| Stone on Ash | **100%** | 0% |
| every other pair that shares a floor | 0% | 0% |

#### Why the fix is not new hex codes

Sorted by lightness, thirty-seven materials span L\* 13 to 94 — an average gap of two. Water,
Wood and Dirt are all at 38; Green, Stone and Gas at 41 to 43. **The palette is full**, and
moving a colour only moves the collision. So colour stopped carrying all of it:

| | grain | fleck | what it reads as |
|---|---|---|---|
| **Ash** | 5 | — | fine, even dust |
| **Stone** | default 13 | `[82,79,74]` | rough speckled rock |
| **Dirt** | 16 | `[70,58,34]` | coarse soil, grains of two browns |

`grain` is how far that material's tint reaches. `fleck` is a second colour for about a
quarter of its cells, chosen off the tint that cell already has, so the speckle is fixed in
place and does not shimmer as things move. Measured spread of drawn brightness across a full
field: **Ash 2.7, a plain material 7.0, Dirt 15.2**, and 31% of a flecked material's cells
come out nearer the fleck than the base.

Both are one field in the table, and **the draw loop got faster** — 0.42ms to 0.39ms over
five runs of two hundred draws — because reading colours out of a plain array beats reading
them off the material object by more than the fleck and the grain cost.

#### What moved, and what did not

Only ash. Searching the whole Lab space for the place that makes the fewest new collisions
returned one empty lane — **pale warm grey**, which is what ash actually looks like — and
only one material could have it. Ash took it, because Ash/Stone at 1.1 was the worse fault
and because pale is the truer colour: `[96,92,88]` → `[174,160,150]`, worst pair 1.1 → 9.9.

**Dirt did not move at all.** Once ash was out of the way, dirt's problem was gone; it kept
its colour and gained a surface. Worth noting because the instinct was to change the thing
that was reported, and the thing that was reported was the victim.

A browner soil looked better and was rejected on measurement: `[104,78,48]` collides with
Wood at 4.6, which is worse than the fault being fixed.

#### The limit, stated plainly

**Grain and fleck cannot help a single cell.** A lone cell has no texture — two fields of the
same lightness can be told apart by one being smooth and the other coarse, but one cell of
either is just a colour. That is why ash had to move as well, and it is why the second check
measures one cell at a time rather than a field.

The table check now uses `survives`, with bars taken from measurement rather than taste — 15
between two creatures (measured minimum 19.7), 8 between a creature and a material (9.2), 6
between two materials — and **the fourteen material pairs under that bar are listed by name
in the check rather than legislated away with a lower number.** Coal and rubber and powder
and smoke are all "burnt"; paper, wax, steam, magnesium and sand are all "pale"; fire and
lava are the same orange because they are the same temperature. A list is a thing you can
read and argue with. Anything not on it has to clear the bar, and the check also fails if a
listed pair has since moved apart — a stale excuse is worse than none, because the next
collision hides behind it.

### The moss, which is the exception

The seventh, and **the one that breaks the rule the other six were built to keep.** Every
creature so far conserves its own number — what you put in the box is what is in the box, and
pupation was allowed only because one grub goes in and one moth comes out. Moss multiplies.
That is the whole of what it adds and it is worth exactly one exception, because a box where
nothing can ever increase has no way to show you growth.

Three things keep the exception from eating the file:

- **It only spreads onto a surface**, so it creeps over what you built rather than filling
  the air.
- **It only spreads where there is water within `damp` cells**, so a scene decides how much
  of it there can be.
- **It dies of heat** well below anything catching light, so a fire clears it.

Measured: one cell on a wall standing in water becomes **38 in three minutes** and climbs
**17 rows**. The same wall dry stays **one cell** for as long as you watch it — and the
readout now says why, which it did not at first.

#### The clause that is the whole rule, got wrong in both directions

What counts as a surface to grow on is the entire creature, and the first two answers were
both wrong.

**Counting other moss** means that after the first cell it never needs a real surface again.
Measured on a pillar: **1219 cells, of which 1175 were touching nothing but each other.** A
fog with a stone in it.

**Counting no moss at all** makes it a film exactly one cell thick — correct, bounded, and
almost invisible. On a wooden block the brush had already filled every cell that qualified,
so it grew by 22 and stopped. Reported from the phone as moss that does not move.

It counts moss that is *itself* against something real, which gives a cushion **two deep and
no deeper**: layer two anchors on layer one, and layer three has nothing to anchor to.

The check states that as a distance — no cell further than two from a real surface, and not
more than 60% of them in the second layer — rather than by asking the page's own `rooted()`,
which would only assert that the code agrees with itself. The shape is the claim, and the
shape is what was wrong twice.

#### Two screenshots thirty seconds apart, for the second time

The first pair, months of work ago, was worms that would not walk and turned out to be the
floor of the box not counting as ground. This pair was moss brushed round a wooden block,
with no water anywhere in the scene. **The rule was working exactly
as written and the box said nothing at all about it** — which is the fault the vent had before
it grew a picker. A rule nobody can see is indistinguishable from a broken one, and this file
has shipped enough of the second kind to owe the doubt to the first.

Three things came out of it, and two were real defects:

**The brush ignored the surface rule.** A thumb round that block put down 114 cells of which
**100 were hanging in mid-air**, where nothing could ever happen to them. `roots:1` on the row
makes the brush ask the same question the spreading does, so what you paint is what can grow —
19 cells, all of them live.

**Nothing said why.** Painting something with a `damp` field where there is no water now puts
`Moss needs water within reach — it will not spread here` in the readout. Non-forced, so a
discovery still takes the line — and when there *is* water the line you get instead is
`Found 1/47 — Moss spreads`, which answers the question better than the hint does.

**And the reach was too tight to notice.** `damp` 20 → 40 on a box 131 wide, which is near
enough to "is there water in this scene at all". Measured on a log beside a pond, sixteen
brushed cells become 61 at a reach of 20 and **102 at 40** — the difference between a coating
and something you can watch appear.

#### It withers rather than burns, and a fire was making matter out of nothing

Reported from the phone: *"when a fire occurs and ash is produced the moss expands with the
ash and contains it."* The guess that came with it — that moss should not grow on ash — was
pointing at a real loop, and measuring it found a bigger one underneath.

**Moss burned down to ash. Moss grows on ash. That moss burned.** On a mossy build with one
arm lit: **480 cells of wood burnt, and 1714 cells of ash on the floor afterwards.** Three
and a half times as much ash as there was fuel. The scene was manufacturing matter, and
nothing in the suite would ever have said so.

Three candidates, same scene, same fire, same 480 cells of wood consumed:

| | ash left | moss after |
|---|---|---|
| as it was | **1714** | 872 |
| will not root on ash or embers | 973 | 845 |
| **withers at 70°C** | **480** | 900 |

The reported fix — don't grow on ash — halves it and no more, because the loop has another
turn in it: moss also colonises what the fire *exposes*. Withering cuts it at the source. At
480 the ceiling is exactly one ash per cell of wood, which is what every other material in
the box has always done.

So `ig`, `fuel`, `out`, `char` and `ash` came **off** the moss row rather than being left
there unreachable. The life pass runs before `react()`, so a moss cell crossing 70°C is dead
before anything looks at its ignition point — and a field that can never fire is the single
thing this file has shipped most often by accident.

**A quiet scene is unchanged:** 966 cells before the change, 955 after, and a brushed log
beside a pond still goes 16 → 102. Withering costs nothing until something is hot.

The check is the general form rather than a moss one: **a fire cannot leave more ash than it
had fuel.** That is true of every material in the table and was quietly false of one.

#### What it still does not do

It **does not carry fire** — a match in a slab travels about three cells past where it was
held, against a straw film's twelve. And it **does not shield what is under it**: a moss cover
over a wooden block burned 610 of 610 cells, exactly as the bare block did. I measured that
hoping for a fire-break and there is not one, so there is no claim of one.

And **the shell does not simply give way.** Moss round a fire settles at 66–76°C, right on the
wither point: it dies back from 875 cells to 811 and then grows again to about 948. That is an
equilibrium rather than a runaway, and it is why a burning mossy shell still reads as
containing what is inside it. Moss is a static solid, so a film of it does hold back a pile of
ash — which is inherent to it being something you can build with, not a separate bug.

#### The damp scan, and why it is cheap

`damp()` sweeps a square around a cell, which would be the most expensive thing in the file if
every moss cell did it every tick. The spread roll comes **first**, so at `spread` 40 only
about one cell in forty ever pays for a scan. Order of operations is the whole optimisation.

### A seed, and the two things it becomes

The chain is three rows of the table and no code that knows any of them by name: a **Seed**
you sprinkle, a **Stem** that climbs, a **Flower** on the top of it.

Only the seed is in the tray. Stem and Flower are made, never placed — like the pupa, and for
the same reason: a flower you can paint is a colour, a flower you grew is a thing that
happened.

| | rule | what it means |
|---|---|---|
| Seed | `sprout` 150, `soil` Dirt, `damp` 30 | soil under it and water within reach, or it is a grain that sits there |
| Stem | `climb` 26, `tall` 9, `damp` 30 | hands its remaining height up a cell at a time |
| Flower | — | what a stem opens into, at the top or against anything in the way |
| both | `thirst` 240 | take the water away and they die where they stand |

**The clock is `feed`, and that is not the obvious choice.** `vel` is free on a pupa, so a
pupa's hatch clock lives there — but a seed is a powder, so the falling pass writes its
velocity every tick and a counter kept there would be reset by its own fall. `feed` is the
byte a vent keeps its payload in and an ant its cargo, and a seed is neither.

**`tall` is carried, not counted.** The growing tip holds what is left of its height in
`feed` and hands it up a cell at a time, so exactly one cell of a stalk is ever growing and
nothing has to scan down a stem to ask how high it already is.

**The wait only runs where it could happen.** Off soil, or out of reach of water, the clock
goes back to nought rather than pausing — a seed carried onto a rock by an ant has not been
getting on with it in the meantime.

#### They burn, which is the opposite of what moss does

Moss withers in the heat and leaves nothing, because moss grows on what a fire leaves behind
and grew back on its own ash — 480 cells of wood once became 1714 of ash. A plant grows from
a seed you placed, so there is no loop, and a meadow going up is worth having.

What a match actually does to a meadow, measured nine times across three spacings: **it takes
27% to 48% of it and then goes out.** The hypothesis going in was that the gaps between
stalks would stop the fire, and the spacing made no difference at all — what stops it is a
thin stalk with ten fuel in it losing heat to the air faster than the next one catches. So
the check claims a patch rather than a field, with the bar under the worst run.

#### What the growing looks like when it is working

Eighteen seeds sprinkled along a bed of soil with a pond at one end: twelve came up. The ones
that did not were out of reach of the water — and the reach was not the flat 30 cells the
field says, because the pond spread sideways along the top of the soil first and carried the
damp with it. Nothing in the rules says that; it falls out of water being water.

On the stone at the far end, and on the dry soil, the seeds are still sitting there. That is
the half a screenshot cannot tell you, and it is what the check is for: a box that grew
flowers on a stone floor would look just as green.

### Dirt, and what the worm turns out to be for

Every fire in this box used to end the same way: a floor of grey that stayed grey. The ash
bug was the first answer to that — it eats the stuff. **Dirt is the second, and it is the
opposite kind of answer: it turns the burn into something instead of removing it.**

Two ways to make it, and the second is the Worm finally getting a verb.

**Rain on a burn.** One row in the ash's table:

```js
meets:[{with:WATER, become:DIRT, they:E, tale:'Ash + Water → Dirt'}]
```

`they:E` is the load-bearing part. The water is **absorbed**, so a cell of ash costs a cell
of water — a trade rather than a tap, and it is what stops one puddle converting a whole
burnt-out box. Measured: 204 cells of ash under 204 of water gives 55 cells of dirt, 55 ash
gone and 55 water gone. It stalls at the interface as the dirt separates the two, which is
what mud does.

**Or a worm composts it.** `tills:55` is ticks per cell of what fire left behind turned into
`soil` — the same derived `LEFTOVER` set the ash bug grazes, so a fuel added tomorrow that
burns down to something new is compostable with nothing written for it. Six worms take a
204-cell ash field to **99 cells of dirt in a minute**, and none at all with no worms in it.

**And it burrows**, by swapping with the soil the way a fish swims rather than the way a grub
tunnels — a gallery cut in something loose would fall in behind it anyway. A worm crossing
714 cells of soil leaves 714 cells of soil.

So the Worm is the Grub's opposite in the way the Moth is the Worm's: **the grub eats
structure and the worm makes ground.** It is the ash bug's opposite too — both clear a burn,
one by deleting it and one by composting it, and a scene with both gets whichever is nearer.

#### The clause that stopped them swimming in their own compost

Burrowing had to become *the thing a worm does when there is nothing to compost*. Without
that clause they bury themselves: measured, six worms took the field to **86 cells of dirt in
a minute and 79 in three** — not progress, six worms swimming about in the soil they had made
while the rest of the ash sat there untouched. With it, 99 in a minute and 104 in three, and
the worm visits 223 cells of soil instead of 84.

**Dirt is a material and has to behave like one.** It piles (a 13-wide column spreads to 25),
it does not burn at all, ants carry it, and moss roots on it. It has a melting point of 1150
into lava — not for realism but because **soil that does not burn and cannot melt would be
indestructible**, which is precisely the fault caught one section up, and a new material is
the easiest place in the world to reintroduce it.

### A creature is not a surface

Reported from the phone with a picture: a heap of worms with moss growing all over them. A
creature is `ph:3`, so it read to `rooted()` as a wall.

**Three rules in this file ask a version of the same question** — what a grub may eat, what
an ant may lift, what moss may grow on — and the first two excluded `alive` from the day
they were written. This one did not, and there is no reason for the difference beyond nobody
having thought about it. It is one shared predicate now:

```js
const ground = (t, self) => t !== E && t !== self && !M[t].alive
                            && M[t].ph !== 0 && M[t].ph !== 1;
```

Measured on a stone shelf with a deep heap of worms standing on it: moss climbed **35 rows**
up the heap, 1217 cells of it, **1093 of them nowhere near anything real** — the worms were
scaffolding. Two rows now, which is its own cushion, and none adrift.

### Not being able to breathe, when it is not water

`breath` was never about water. It counts how long a cell has been somewhere it cannot
breathe, so a gas that pools runs the same clock as a pond and only the wording at the end
differs — `drowns` or `suffocates in Gas`.

**Which gases is the half worth measuring, and the answer was fewer than expected.** Smoke
and steam were tried with the same field and changed nothing anywhere. Four scenes, three
builds:

| | no `chokes` | Gas only | Gas, Smoke and Steam |
|---|---|---|---|
| ten worms sealed in a room of gas | **all 10 live** | gone at tick 495–575 | gone at 391–495 |
| sixteen worms on a floor beside a wood fire | 14–15 live | **16** | 15–16 |
| ten worms in a *sealed room* with a fire in it | 10 live | 10 live | 8–10 live |
| twelve moths up a candle's plume | reach the wick | reach the wick | reach the wick |

Smoke rises off a creature standing on a floor faster than a breath clock runs, so marking it
buys almost nothing and costs the one thing worth protecting — an ordinary fire must not
quietly become a gas chamber. **A rule that fires in none of the scenes anybody builds is the
thing this file has shipped most often**, so it is gas alone: the gas that only leaves at the
top of the box, pools, and fills a room.

The check asserts the cost as well as the effect: worms beside a wood fire, and worms in an
empty box, both have to come through.

#### "It looks like the gas only affects the moths"

Reported from the phone the next morning, and correct. Two faults under it, and the
investigation went wrong twice before finding either.

**A gas has no surface.** Water does — being under it is one lookup, and it has to be one
lookup, because counting all four neighbours once drowned 7 of 10 worms standing *beside* a
puddle. A gas is not like that: you are inside it or you are not. It reads four neighbours
now and asks whether the fumes outnumber the clear air.

**And a gas could only ever move up.** `moveRising` tried the cell above and the two above
that, and stopped. So a creature standing on a floor made its own pocket — the gas above it
rose away, and its own body blocked anything refilling from below — and the pocket was
permanent. Measured on a worm walking a floor in a box 76% full of gas: **empty cells to its
left, its right and above it at every sample across fifteen seconds, and its breath never
left zero.** A moth flies up into the thick of it and is surrounded, which is why moths were
the only thing dying.

A gas that cannot rise now drifts sideways, `GAS_DRIFT` .25, which is the same shape as a
grain sliding off a heap when it cannot fall. Twelve worms on a ledge in a gassed box, eight
runs each way, two minutes:

| | survivors | first death |
|---|---|---|
| before | **12 of 12** | never |
| four-neighbour rule alone | 12 of 12 | never |
| four-neighbour rule **and** the drift | **7–10 of 12** | ticks 645–1047, every run |

The middle row is the one worth keeping. **The reading rule on its own changed nothing at
all** — it was the drift that mattered, and I would have shipped the reading rule alone and
called it fixed if I had not measured them apart.

The bar is "somebody dies" rather than "at least two die", because two is exactly the worst
run with the drift and a threshold sitting on the worst observation is how they get set on a
lucky measurement. It costs a known false pass: the build without the drift loses a worm
about one run in eight, so this check catches that regression seven times in eight rather
than always.

**Two of my own scenes were unreachable before that.** An alcove *under* a shelf with gas
poured above it reported 0% either way — a gas never moves down, so it can never get in. A
sealed room with gas released in one corner reported 0% in the far bottom corner either way —
with headroom the gas always rises, so the drift never fires. Both looked like the drift doing
nothing.

**And one scene was deleting what it measured.** `__slab` uses `put`, which replaces whatever
is in a cell, so gassing across a scene removes every creature in it: everything died at tick
1 with no discovery raised, which is indistinguishable from suffocation working perfectly.
The doc already records the same mistake with water and moths, four months of work apart.

**A creature on an open floor still survives**, and that is not a leftover — a buoyant gas
rises off the floor and leaves it breathable. Measured, the bottom fifth of a filled box goes
from 100% gas to 35% within forty seconds while the top stays at 100. Gas is a ceiling
hazard, and sealing a room is what makes it a chamber: ten worms sealed in with it are gone
in **180 ticks**.

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

### Two materials nothing could destroy

Reported from the phone: *"the thermite doesn't burn through obsidian, glass, green, wood as
far as I can tell but worth doing a sweep."* Half right, and the half that was right was
worse than the report.

**Glass and Obsidian could not be destroyed by anything, at any temperature, ever.** No
ignition point, no melting point, and `proof` against acid — three reasonable-looking entries
that together left no way out. Measured with a lit charge at 2600°C: **0 of 102 cells removed
for each.**

| | before | after |
|---|---|---|
| Obsidian | 0 of 102 | **95 of 102** |
| Glass | 0 of 102 | **91 of 102** |
| Green | 102 of 102 | unchanged |
| Wood | 102 of 102 | unchanged |

Green and wood were never the problem. **The thermite simply was not lit** — it catches at
950°C and a match is 780, which is deliberate and checked, and you light it with a magnesium
ribbon. Holding a flame on a charge and watching nothing happen looks exactly like thermite
being broken, so it now says `Thermite needs more than a match — 950°C, and a match is 780`,
read off the table rather than naming thermite.

`proof` stays: it is against **acid**, and it is what makes a tank worth building. What it
should never have been is proof against heat as well.

Obsidian melts at **1250 into lava**, which is the round trip rather than an invention —
lava quenched in water is where obsidian comes from in the first place. Glass melts at
**1450**, chosen so a lava pour at 1180 still sits in a glass tank and thermite does not. Both
melt into lava rather than into a molten glass of their own, so **a window you melt and let
set comes back as stone**: the box has one silicate melt, not three, and that is the price of
it. Sand → glass → lava → stone is at least a coherent family.

(Stone appears to survive the same charge — 2 cells of 102 — and that is a measurement
artefact worth naming: stone melts to lava and lava sets back to stone, so the count is a
round trip. Obsidian and glass melt one way.)

#### And then the other half: it could melt through, but not burn through

Reported next, with pictures of the same charge on steel and on wood: through the steel in
a clean plume, and on the wood just sitting there setting light to it and waiting for the
fire to do the work.

**A liquid could sink into anything it could *melt* and nothing it could *burn*.** Wood has
no melting point, so it was outside the melt-through rule entirely — and molten iron at
2500°C does not wait for a wooden floor. Depth of the hole in a plate sixteen cells thick,
timed from the moment the ribbon is lit:

| plate | 5s | 10s | 20s | 40s |
|---|---|---|---|---|
| Wood, before | 0 | 0 | 8 | 16 |
| **Wood, after** | **16** | 16 | 16 | 16 |
| Green, before | 0 | 0 | 2 | **7 — never through** |
| **Green, after** | **16** | 16 | 16 | 16 |
| Steel | 0 | 2 | 1 | 0 — unchanged |
| Stone | 0 | 16 | 16 | 16 — unchanged |

Green also ends with **more** of its plate left than before — 505 cells against 471 — which
is the point: a narrow hole rather than the whole slab smouldering away.

`BURN_THRU` is 700, and it is large on purpose. At the melt rule's margin of 60, molten wax
at 600°C would cut through a wooden table and burning oil would cut through the log it was
running over. At 700 it takes lava at 1180 or molten metal to do it — something glowing,
rather than something merely alight.

**Thick steel still defeats a charge**, and the check asserts that alongside: the cut is
self-limiting because the liquid cools as it works, and a rule that went through everything
would have taken that away.

#### The check is a table read, and that is the point

There was already a check that every melting point is *reachable*. Its complement was
missing: whether everything has a way out **at all**.

```
burns || melts || boils || eaten by acid || reacts away
```

The Vent is the one exemption and it is written down rather than assumed — a source you can
destroy with what it pours is not a source. Everything else in the tray must satisfy one of
those five.

Firing thermite, lava, molten steel, acid, a match and a furnace at all twenty-four materials
is four hundred thousand ticks and several minutes, and I started there before noticing the
property is decidable from the row. The behavioural check that pairs with it is one scene, not
twenty-four: a lit charge on glass and on obsidian, plus the deliberate half — a match alone
still will not do it.

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

## Clear, which is a question rather than a button

Three things can be taken out of the box, and for a long time only one of them could:

| | takes | leaves |
|---|---|---|
| **Fire** | flame, smoke and steam, and all the heat | the build, the creatures, the water |
| **Life** | every cell whose row says `alive` | everything else, fire included |
| **Everything** | the box | nothing |
| **Back** | nothing at all | — |

Clear used to arm on one tap and wipe on the next, inside a three-second window. That was
safe enough — the second tap landed on a chip that had gone red and changed its word, so it
was a different target rather than the same one twice — but it spent two taps to say one
thing, and both of them landed in the same place.

**The tray already had the better answer in Room:** a chip that borrows the drawer row and
shows what it could do. Clear borrows it too. The first tap opens the question, the second
lands on a different chip with a different word on it, and the confirmation comes free with
the answer. It costs no chip in the tray and no height anywhere, for the same reason Room's
picker does not: the row it borrows is one the tray already keeps.

**Back is in the row because the other three all destroy something.** A drawer you cannot
leave without breaking something is a trap, and it is first so the way out is where the
thumb already is — which puts the one chip that cannot be undone at the far end of the row
from it, wearing the red that used to appear only after you had armed it.

**What Fire takes is derived from the tray, not listed.** It removes gases that have a row
and are in no drawer — the ones the box makes rather than the ones you can place — which is
exactly Fire, Smoke and Steam today, and is asserted to be, because the day a placeable gas
falls into that set is the day Fire starts deleting material somebody put there by hand.
Gas itself is in the Hot drawer and survives.

Then every cell goes back to the temperature it would have if you had just placed it —
`t0`, or the room for anything without one. So **lava stays at 1180°C**: lava is a heat
source, not a fire, and Fire is not a way of switching it off. Wood against lava catches
again afterwards, and that is correct. What matters is that it has to do it from cold:
measured at **66 ticks to first light and 71-74 to relight**, against 30 for a build that
cooled nothing. A fire that came back in one or two ticks would look like the button did
nothing.

Resetting the charring alongside is worth about two ticks and no more (71-74 with it,
69-71 without) — what actually keeps a fire out is the cooling, since charring decays on
its own below the ignition point. It is there because `put()` clears the same field and
"back to how it was placed" is the whole rule.

All three go through `snapshot()`, so all three can be undone. None of them spends the undo
slot when there is nothing to do: Fire on a cold box and Life on an empty one say so and
leave the last stroke recoverable.

## The attic, which is the part of the box that is not on the screen

Reported from the phone, with pictures: build a tower, turn the phone on its side, turn it
back, and the top of the tower has been deleted.

Portrait is 131×153 and landscape is 173×51. The rebuild was bottom-anchored and copied
whatever overlapped, so rotating took **a hundred rows off the top**, and rotating back took
**forty columns off the right**. Measured on one test scene: 912 cells of paper and 1112 of
wood gone, with no way to get them back.

So the field stopped being the whole box. The attic holds every cell the box has ever had,
in coordinates measured **from the bottom-left corner** — the corner the rebuild anchors to,
and therefore the one that does not move. A resize writes the visible field up into the
attic and reads the new field back out of it, so whatever goes off the top comes back when
there is room for it again. It only ever grows, and only to the largest the box has actually
been, so it is bounded by the screen rather than by anything you can do.

**The attic and the window are kept disjoint.** After a resize hands the visible rows back,
those cells are blanked upstairs, so at any moment the attic is exactly the part of the box
that is off the screen and nothing else. Without that it holds a stale copy of the visible
rows too, and every question about the whole box — how many living things are in it, is
anything still alight — has to know which half of its answer is a duplicate.

**Nothing simulates up there.** A fire outside the window is paused, and comes back exactly
as it left rather than having burned down while you were not looking. Stepping cells nobody
can see would spend the frame budget on the part of the box that is not on the screen, which
is the whole reason the grid is sized to the screen in the first place.

Anything that replaces the whole box — a wipe, a preset, a load — throws the attic away with
it, or a rotation resurrects what you just got rid of. And the two Clear options that mean
"everything of this kind" sweep it: both are per-cell rules with no neighbours in them, so
they port upstairs unchanged. Anything that needed to look sideways would not, and that is
the line.

Undo is the exception, and deliberately: it restores what you can see, and it already
refuses across a resize rather than guessing.

### Why the check that existed did not catch it

There was a resize check. It passed, because **it had been written to accept the bug** — its
own comment said a bottom-anchored crop "is supposed to lose what is above the new ceiling",
which was true of the code and not true of what anybody wants.

The new one rotates a real scene, with something against each edge the rebuild can clip, and
asserts every count comes back. Three ways of breaking it were tried and all three are
caught: nothing kept across a resize, a Life clear that skips the attic, and a wipe that
leaves it behind.

**One leg of it was vacuous and had to be rewritten.** It wiped the box in portrait and then
rotated, expecting ghosts — but a portrait window covers the whole attic, so there was never
anything above it to forget. It passed against a build with the forgetting removed. The wipe
has to happen while something is actually up there.

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

`FOUND 3/65` in the corner used to be the whole of it. The rest existed as things that the
box would never name, mention again or hint at — a progress bar for a task nobody had been
told. **Finds** in Tools opens the list: found ones read as what they are (`Lava + Water →
Obsidian`) and the rest read `Acid — ?`, carrying the material's colour and name and nothing
else. Eight rows mentioning Acid tell you to go and play with acid without telling you what
happens when you do. Found ones sort to the top, so it is a record before it is a to-do list.

The sixty-five are derived from the material table — every melt, boil, set, ash, contact
reaction, explosion, drowning and suffocation in it — so a material added tomorrow brings
its discoveries with it. The three creatures added five between them and no new derivation
code: a `drown` or an `air` field is enough. Seeds added seven the same way.

**A row that nothing ever raises is worse than no row**, and this list is the easiest place
in the file to add one. The first draft of the seed derived a find from its `sprout` field —
"Seed needs soil under it and water within reach" — which nothing ever calls `found()` for,
so it would have sat in the panel as `Seed — ?` forever and quietly made the denominator a
lie. Every field that derives a find has to have a `found()` at the other end of it.

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
node test/matchbox-sim.mjs     # 82 checks — the simulation
node test/matchbox-ui.mjs      # 40 checks — the hand
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

Four things learned the hard way while writing them, all of which cost a wrong answer
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
- **Ask where a thing has been, not where it is.** Two flaky checks, found in the same week
  and the same mistake twice: the ants counted how many were carrying something at the final
  tick (ten coin flips: `2 3 3 3 4 4 4 5` against a bar of four), and the worms measured how
  far apart they were and asked that it grow (a random walk is entitled to come back — eleven
  worms went from spanning 23 cells to 13 on a build that was working). Both are now
  cumulative: the fraction of its time an ant spends laden, and the count of distinct cells
  the worms have stood in. Neither can go backwards on a working build, and both separate
  cleanly from the fault they are looking for — 0.25-0.32 against 0.64-0.72, and 5.5-9.1
  against exactly 1.0.

  The footprint was wrong the first time too, and in a way worth writing down: it counted the
  cells the worms *fell* through on the way down, so worms pinned in place with `BUG_STEP` at
  nine billion scored twenty cells each and passed. It waits for them to land now.

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
