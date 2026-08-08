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

Twenty materials in the tray and six more the simulation makes for itself: fire,
smoke, steam, embers, ash and molten wax. Every material is one row of the `M` table
and nothing else in the file knows any of them by name.

The tray is in drawers — **Fuel, Wet, Solid, Hot, Scene, Tools** — one row at a time, so
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
| `cool` `sets` | ...and what a hot liquid turns back into as it loses its heat |
| `meets` | contact rather than temperature: this touching that makes those |
| `dens` | what sinks through what |
| `tough` | how many bites acid needs to get through it |
| `peak` | as hot as burning alone can drive it, where that differs |

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
  lid, and then reach in with a match.
- **Getting water wrong.** Set magnesium alight and pour water on it. Measured: 2213°C
  dry, 2600°C wet.
- **An acid tank.** Acid eats through most things and wears out doing it — a dozen
  cells per drop. Glass and obsidian are the two it cannot touch.

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

One slot, in the **Tools** drawer. Save asks before replacing an existing save and not
before the first one — a confirm on a harmless action is what teaches people to tap
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
node test/matchbox-sim.mjs     # 39 checks — the simulation
node test/matchbox-ui.mjs      # 24 checks — the hand
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
