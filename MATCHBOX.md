# Matchbox

A single-file falling-sand box with a heat model under it. Draw materials in the dark,
strike a match on the strip, and touch what you have built.

`matchbox.html` is the whole thing. No build, no server, no install, no storage — open
it and it runs. Refreshing loses the scene, which is the point of a matchbox.

## Running it

Open `matchbox.html` in a browser.

It fetches one webfont from Google Fonts. Offline it falls back to whatever monospace
the machine has and everything else works.

## What is in the box

Fourteen materials in the tray, and five more the simulation makes for itself: fire,
smoke, steam, embers and ash. Every material is one row of the `M` table and nothing
else in the file knows any of them by name.

A material is described by a handful of numbers. The ones that matter:

| | |
|---|---|
| `ig` | the temperature it will catch at |
| `char` | how long it has to stay over that before it does |
| `fuel` | how long it burns for |
| `out` | how fiercely |
| `cond` `cap` | how it carries heat, and how much it takes to warm it |
| `melt` `boil` | what it turns into, and at what |

`ig` and `char` together are what make the tray more than fourteen colours. The match
is at 780°C, which is hotter than every ignition point in the table, so on temperature
alone it lights everything the instant it touches it. What separates paper from coal is
how long it has to be held there.

Measured, on a bar of each with the match held at one end:

| | catches from |
|---|---|
| Powder, straw, paper, oil | a touch |
| Fuse, embers | a moment |
| Wood | a moment — see the honest note below |
| Coal, green wood | the match held on it for seconds |
| Wax | nothing. It needs a wick |
| Stone, steel, sand, ash | nothing at all |

## Things worth building

All four of these are checked by `test/matchbox-sim.mjs`, and all four were measured
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
node test/matchbox-sim.mjs     # 18 checks — the simulation
node test/matchbox-ui.mjs      # 10 checks — the hand
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

## Performance

1.6 ms a frame including the draw, on a 107×156 grid of 16,692 cells in a busy scene,
on a desktop CPU. A phone is several times slower and this is a tenth of a frame at
60Hz, so there is a lot of room. The suite asserts under 4 ms.

## If you change something

Run both suites first, then again after. This file has a history of faults that read
perfectly well in the source — a fuse that could not travel, a material that could not
be lit, a wick with nothing to draw, a splash of water that fed the fire it landed on.
Not one of them threw, warned, or looked wrong in a screenshot.

The most valuable single habit: when a fix changes nothing, suspect the measurement
before the code. Four of the wrong turns behind this file were in the harness rather
than the page, and every one of them would otherwise have shipped a confident wrong
answer.
