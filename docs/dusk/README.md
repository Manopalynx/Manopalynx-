# A small world at dusk

A 3D space shooter played on a phone in portrait. One HTML file and a copy of three.js
r128 beside it; all sound is synthesised, there are no other assets. Published at
`/Manopalynx-/dusk/`.

It was built in a claude.ai artifact across earlier chats and moved here unchanged at build
`pages-1`: the only two lines that differed from the artifact were the three.js `<script>` tag
(CDN to `./three.min.js`) and the `BUILD` tag. **The artifact is frozen; this folder is the
one copy.**

**Where this document's facts come from.** Everything under "Settled", "Next" and "Queued"
is carried over from the handoff note the previous session wrote, which Sam passed on. It
has not been re-measured here. What *has* been measured here is under "Tests".

## Reading the code cheaply

`index.html` is about 2,600 lines. Do not read it whole. Sections are fenced with
`// ---------- name ----------`; list them and open only the one you need:

```
grep -n '// ---------- ' docs/dusk/index.html
```

## How it plays

Left thumb throttle, right thumb steer, a Fire button. Round N is N capital ships, 5N
drones and 5N ground units (flak and missile sites). Between rounds you pick one of three
upgrade cards, each stacking to three levels. Dying resets to round 1.

Twelve upgrades: rapid fire, heavy bolts, extra cannons, plating, fast repair, salvage,
tracking bolts, seeker missiles, shield, point defence, chain reaction, wingman.

## Settled

**Sam's decisions. Do not undo them.**

- Wingmen hold his heading and fire only within about 15 degrees of dead ahead. No
  swivelling.
- Point defence targets missiles only, with a miss chance: it stops roughly 45 / 61 / 90%
  by level.
- He likes the music. Leave it alone unless asked.

**A previous session's fills, which he has not objected to.** Not his decisions, so they
are open if he raises them.

- Wingmen cannot be shot down.
- Wingman level 3 is a fire-rate bump, not a third ship.

**Sound.** `sfx(name, position)` with a table of effects. A `heat` value from 0 to 1 rises
with combat and drives a layered soundtrack: calm layers always, bass, arpeggio and drums
fading in. The ♪ button cycles everything / effects only / silent.

**The distant dogfight.** Beyond the map edge, five of his ships against five enemy
interceptors (`updateDogfight`, `makeInterceptor`, the `DOG_` constants). Scenery only, for
now.

**The Sam panel.** Cyan button, top right: set any upgrade level, clear the round, play any
sound, pin music intensity, and a diagnostic line that starts with the `BUILD` tag. **Bump
`BUILD` on every change that reaches `main`** so he can tell which version his phone has.
All of it is fenced with `SAM` comments and comes out when building ends.

## Interceptors (build `interceptors-2`)

From round 3 a few leave the distant dogfight and come for him. **Sam's rulings:**

- **How many:** one in rounds 3 and 4, two from round 5, three from round 8, never more.
- **They are not in the round's "to go" count.** The round ends without them and the
  survivors turn for home. An enemy that passes and comes round again is the worst possible
  last target to wait for.
- **Hull:** three hits at base bolt damage.
- **Weapons prefer them:** tracking bolts and seekers take an interceptor inside their cone
  ahead of anything else. Point defence ignores them. A chain reaction can kill one; they do
  not carry the chain on.

**Fills, not his decisions:** their shots do 10, the same as a drone's; the far dogfight
reinforces back to five a side; "Send interceptors" in the Sam panel launches two at once in
any round.

**How they fly: straight lines through him.**

1. **The run.** Straight at him from at least 170 out. Inside 75 it stops steering and holds
   its line, so it cannot curl into an orbit. The moment it stops getting closer, it is past.
2. **After a pass going his way**, it flies straight on out ahead of him, where he can watch
   it turn back in.
3. **After a pass going the other way**, it comes round to a spot out ahead of where he was
   heading. That spot is fixed in the world the moment it is chosen.
4. **The guns fire only while the interceptor is on his screen**, measured against the
   screen's real shape. One coming up from behind overtakes and does not fire.

Each has a red marker: a diamond on it while in view, an arrow at the screen edge when not.

**`interceptors-1` flew in circles, and the harness had passed it.** It steered for a spot
tied to where his nose pointed. Anyone who turned dragged that spot round the sky and they
chased it for good. Sam's first words on it: *"They just seem to fly in circles around me."*
The harness's main stand-in flew straight legs across the map, which is not how a person
with an arrow on the screen flies. **The stand-in that matters turns to face them**, and
rule 3's "fixed in the world" is the lesson: nothing in the flying may depend on his heading
from moment to moment, only the guns.

**Measured** by `test/dusk-intercept.mjs`: round 5, two interceptors, nothing else alive, 180
game-seconds. Against the stand-in who turns to face them:

| | `interceptors-1` | `interceptors-2` |
|---|---|---|
| laps round him per pass (a straight pass is 0.5) | 3.2 | 0.58 |
| time spent close by and off the screen | 81% | 29% |
| time on screen when within 250 | 18% | 40% |
| on screen before each pass | 2.7s | 3.3s |
| shots at him / hits | 6 / 0 | 45 / 11 |

Across every run no shot came from behind him or from off the screen; removing rule 4 turns
both checks red.

**What is not settled:**

- **Against a player flying straight legs, about four passes in ten are never on screen.**
  They fire nothing, but they are a whoosh from nowhere.
- **A player who circles without ever stopping is never shot at**, and never sees them.
- **They die fast.** A stand-in that holds Fire and never aims kills both in 26 to 43
  seconds. Three hull may be too little; Sam's to change.

None of this says how it feels. That is his to judge on the phone.

## The dreadnought (build `dreadnought-4`)

Every fifth round is one fortress, alone: a split spindle, the shield's generator hanging in
the gap, a ring of guns slung below it, a shield round the whole, and a bay at each end.

**Sam's rulings, in his words where quoted:**

- **A boss round is the boss alone.** For later bosses: "a purposely set amount of enemies in
  certain locations", depending on the boss.
- **Harder each time it comes:** more hull, faster guns, turrets that take more hits.
- **It must have its own character.** Of `dreadnought-1`: "it looks like the capital ship
  scaled up which I think it should have its own character".
- **It must never go quiet.** "when you destroy all of the turrets it can't attack so I'm just
  left shooting a defenceless ship as I wait for the large heath pool to reach zero".
- **Turrets rebuild after 10 seconds**, and sit "on multiple sides in strategic and cool
  looking positions".
- **Two bays** "where it shoots our two interceptors ever 30 seconds so you need to keep on
  top of them or be overwhelmed".
- **A shield generator** "that regenerates the boss shield which the player can destroy".
- **The readout shows what you are fighting** instead of "to go"; **the reward is the normal
  pick of three cards**; **dying to it is a normal death**, back to round 1. He wants to
  discuss lives, or an upgrade that gives an extra life. Not yet discussed.

- **The generator shows its health.** He shot the core, "nothing was happening", and moved
  to the structure: "perhaps a health bar or ring is necessary". It wears a five-segment
  ring from the start, and the round banner says to destroy it.
- **Destroying the generator drops the shield.** His screenshot of `dreadnought-3` showed the
  generator gone, the readout on the hull, and the shield standing at full: "the boss retains
  there shield". It used to stop refilling and leave what was in it to be shot away.
- **The ship stays in one piece.** Same screenshot: "the top flys on its own". The upper half
  of the spindle was joined to nothing once the core was gone. An axle runs through the core.
- **The interceptors are fine** as they are (three hull, 10 a shot).

**Mine, on his "go with whatever you think works best".** Open to him at any time:

- **The fortress shape**, picked from three mock-ups (carrier, battleship, fortress) because
  it is tall and his screen is: the two wide ones ran off the edge at fighting distance.
- **One interceptor from each bay per launch**, the first pair six seconds in, **up to six
  flying**. The far dogfight sends none in a boss round. **The bays cannot be destroyed.**
- **The shield protects the hull only**: turrets and the generator can be shot through it.
- **The generator stays destroyed.** It is the one permanent kill and the fight's turning
  point. While it lives the shield refills in three seconds, so in practice the hull cannot
  be reached until it dies.
- **A turret lost costs 4% of the hull**, not 10%: with turrets returning every ten seconds,
  10% was a farm.
- **Its guns reach 230**, so there is room on the map to pull out and let the hull mend.

**How it is built.** An entry in `fleet`, kept last, so weapons, targeting, turret fire and
the sinking already apply. What the capital-ship code hard-coded it now reads off the ship
where the ship supplies one: `inHull`, the bounding `box`, turret hit radius, where a rammer
is shoved. The generator is targeted as a turret is (`hp` and a `pivot`).

**The numbers are mine**, in `bossSpec(tier)`:

| round | hull | shield | generator, hits | turrets | hits to blow one | gap between its shots |
|---|---|---|---|---|---|---|
| 5 | 3000 | 600 | 300 | 4 | 8 | ordinary |
| 10 | 8500 | 1700 | 740 | 6 | 11 | ×0.80 |
| 15 | 15600 | 3120 | 1250 | 8 | 14 | ×0.67 |
| 20 | 24000 | 4800 | 1820 | 10 | 17 | ×0.57 |

An ordinary turret takes 5 hits. The first one carries only the four ring turrets; all
twelve mounts are filled from round 25.

**Measured** by `test/dusk-boss.mjs`, with a stand-in that flies at the generator and then the
hull holding Fire. It never dodges, never shoots a turret or an interceptor, cannot die, and
repair is not modelled:

| | generator down | sunk | hull it lost |
|---|---|---|---|
| round 5, four upgrades in guns and plating | 22s | 67s | 194 of 125: turrets 104, interceptors 30, ramming 60 |
| round 10, nine upgrades | 20s | 52s | 203 of 150: turrets 128, ramming 75 |

**Not settled:**

- **That stand-in would have died both times**, mostly to turrets it never shot at. Shooting
  one buys ten seconds of quiet from it, which the stand-in never does, so this is a ceiling.
  Whether a person survives round 5 is the first thing to learn from his phone.
- **With no upgrades at all the generator alone took 76 seconds.** A player whose cards went
  elsewhere than guns faces a much longer fight. Not measured further.
- All turrets fire whether or not they can see him: a turret on the far side of the ring
  shoots through the ship.
- Interceptors can fly through its hull.

**`dreadnought-2` could not be shot where he aimed.** The ring sat level with the core. From
150 out, of 160 bolts aimed at the core from level, none reached it: the ring took every one
and the shield swallowed them. The suite had 33 checks and none fired a bolt at the generator
and counted what arrived. The ring now hangs 18 below the core:

| coming in | -40° | -22° | -8° | level | +8° | +15° | +30° |
|---|---|---|---|---|---|---|---|
| bolts aimed at the core that reach it | 49% | 0% | 100% | 100% | 100% | 100% | 100% |

So the blind side is from underneath, through the ring. That is deliberate and is the one
approach that does not work.

**Proposed and not agreed:** let sustained fire break the shield (refill only after three
seconds without a hit), and soften the first generator from 300 hits to about 150. With no
upgrades the stand-in still needs 75 seconds to kill the generator.

**Two things the first versions got wrong, both found by measuring or by him:** the generator
at 30 hits was down two seconds into the round; and `dreadnought-1`'s interceptor suite kept
passing on a fixture that named round 5, then went red on a correct game when round 5 stopped
sending interceptors from the far fight.

## The ice wall (build `icewall-2`): the second boss

A wall of ice across the middle of a frozen plain. It stands in four sections, each with a
crack down both faces and guns on its ledges. Destroy a crack and that section of the wall
collapses, taking its guns with it. Bring down all four and the round is won.

**Sam's rulings, in his words where quoted** (three autocorrected words put right and
confirmed with him):

- **Bosses are random** "so each run is slightly different".
- **Armed with every kind of ground unit**: "use them all". Flak and missile sites.
- **They rebuild.**
- "the wall boss had a few weak sections where there are cracks that you destroy and
  destroying units damaged nearby cracks and when a crack is destroyed that section of the
  wall collapses".

- **Guard towers and drones.** Of `icewall-1`: "It looks good but it's rather easy", and he
  asked for guard towers at set places around the ice arena and some drones about.

**Mine, on that request, and open to him:** six towers on a ring out on the plain, always in
the same places, a gun on top of each, flak and missile site by turns. A tower's gun takes 7
hits the first time against a wall gun's 3 or 4. Towers **do not rebuild** and **do not shake
the cracks**. Eight drones the first time, then 12, then 16. Neither towers nor drones are
counted: the wall is still what has to come down.

**Fills he agreed** ("Sounds good go for it"):

- **Which boss:** the first of a run is random, and the same one never comes twice running.
  With two bosses that is alternation from a random start. Difficulty follows the round.
- **Four sections**, at every tier. **Each crack wears a health ring from the start.**
- **Guns rebuild after 10 seconds**, on standing sections only.
- **A crack can be shot directly from the start**, but slower than through the guns beside it.
- **No interceptors.** **Fought on the ice**, which comes and goes with the round.

**How it works.**

- **The ground really moves.** `heightIce` reads `wallDown[k]`, 0 standing to 1 fallen, for
  each section. A falling section sinks in eight steps over 1.6 seconds; each step rebuilds
  only that strip of the terrain mesh (`buildTerrain(x0, x1)`), about 4,000 points of 48,841.
- **The landscape belongs to the round.** `startRound` puts the ice up for a wall round and
  dusk back for anything else. `arenaHold` stops it, for the suites.
- **What is left to do is sections.** In a wall round `remaining()` counts standing sections,
  because the guns rebuild and so are never "what is left".
- **A gun's death shakes the cracks:** 25 off its own section's, 10 off each neighbour's
  (`wallUnitDown`). A direct hit takes 1 at base damage.
- **Cracks are laid on the faces as the faces are.** The faces wander by a few metres, so each
  piece is placed by searching for where the ice actually is at that height.
- **Guns sit on fixed mounts**, two along each ledge on each face of each section: 32.

**The numbers are mine**, in `wallSpec(tier)`:

| round | each crack | guns | a flak gun takes | a missile site takes |
|---|---|---|---|---|
| 5 | 200 | 16 | 3 | 4 |
| 10 | 492 | 24 | 4 | 5 |
| 15 | 834 | 32 | 5 | 6 |

**Measured** by `test/dusk-wall.mjs`. The stand-in goes for the nearest gun on its side of the
wall and for a crack when none is up, holding Fire. It never dodges a missile, cannot die, and
repair is not modelled:

| | wall down in | hull it lost, `icewall-1` | with towers and drones |
|---|---|---|---|
| round 5, no upgrades, guns first | 55s | 180 of 100 | 398: missiles 340, drones 40, flak 18 |
| round 5, four upgrades, guns first | 49s | 92 of 125 | 180, all missiles |
| round 5, four upgrades, **cracks only** | 146s | 402 of 125 | 624 |
| round 10, nine upgrades, guns first | 91s | 464 of 150 | 608 |

The stand-in never shoots a tower or a drone, so the times do not move and the cost is the
worst case: everything he added is left alive to fire for the whole fight.

Bolts aimed at the middle of a crack with a person's scatter, from 150 out on either face,
below, level and above: 95 to 99% land on it, worst single case 88%. That check exists because
the dreadnought shipped with a generator nothing could reach.

**Not settled:**

- **Upgrades barely shorten the guns-first fight** (55s with none, 49s with four): a gun takes
  three or four hits whatever you carry, so the time goes on flying, not shooting.
- **The sections tend to fall together at the end** when the guns are worked evenly, because
  each gun's death also takes 10 off its neighbours' cracks. Working one section brings it
  down early. Whether that reads as a climax or an anticlimax is his to say.
- **Missiles are nearly all the cost**, against a stand-in that never dodges one. A person
  breaks across them.
- **How the collapse runs on a phone is not measured.** Each of its eight steps rebuilds a
  strip of ground and recomputes every normal on the mesh.
- The ordinary capital ships patrol at fixed heights and would fly through the wall. They are
  never on the ice.

**Three things the first versions got wrong:**

- The first render of the wall was a featureless dark slab: straight faces in the dusk world's
  dark haze. The faces now break into facets, steep ground is a deeper blue, ice is lit from
  below, and the haze is pale.
- Drones circled through the wall: a drone's height came from the ground at the middle of its
  circle. It now comes from the highest ground anywhere on the circle, in both landscapes,
  sampled 24 times round: eight could straddle the crest, which is narrower than the gaps.
- The first stand-in ignored the guns and reported a 319-second fight. That measured the wrong
  route, not the wall.

## The walker (build `walker-2`): the third boss

Sam: "would we be able to add a new massive lava zone by the volcano with a massive walking
enemy spider tank looking thing?"; to the design, "Go with your ideas"; to the place and the walk,
"Looking good, go for it". He said **three bosses is enough for now.** Every rule below is
therefore mine, on his say-so, and open to him.

**The lava field** (`heightLava`, arena 2): black rock cut by channels below sea level. **The sea,
recoloured and glowing, is the lava**, so rivers and lakes are wherever the ground dips below
nought, 36% of the field. **The volcano is the one that was always on the horizon**, brought up
to the rim (`VOLC_NEAR`).

**The walker**: six legs, two bones and a knee each, solved from hip and foot; a body the size
of a capital ship riding some 34 up, so it can be flown under; a circuit of radius 105. The two
sets of three legs strictly take turns. How it walks is asserted by `test/dusk-lava.mjs`.

**The fight:**

- **Its plate cannot be hurt.** You bring it down **by its knees**, each with a health ring once
  hit. It slows for each leg lost.
- **Three knees gone and it falls**: belly on the rock, stopped. **The fall alone costs it 15%.**
- **Its core opens on its back** for 10 seconds (9, then 8). **The core is a weak spot**: a bolt
  does three times what it would to a hull.
- **Then it gets up**, every leg mended, and walks on with the damage it took.
- **Turrets that rebuild** after 10 seconds, four on its back, two more under it from round 10.
- **The volcano is the third player**: each eruption throws bombs (4, 6, 8 by tier) that land on
  marks on the ground, centred on where you will be. 25 if you are over a mark within 70 of the
  ground when it lands.
- **The lava burns**: 12, twice a second, skimming it within 3.4 of its surface.
- **Which boss**: any of the three first in a run, then any but the last. 60 runs: dreadnought
  20, ice wall 17, walker 23 first; all six pairings seen.

**Guard towers and interceptors (`walker-2`).** Sam, of `walker-1`: "rather easy", and asked for
"some ground units properly on watch towers similar to the ice wall and also two interceptors".
**His rulings:** the towers **rebuild**; **two interceptors, each back 20 seconds after it is shot
down**, so never more than two. **Mine, open to him:** six towers, flak and missile site by turns,
their guns taking 7 and 8 hits the first time as the wall's tower guns do; back **10 seconds** after
they fall, like every other gun that rebuilds; the first two interceptors **6 seconds** in, out of
the far fight; **neither is counted**, the walker is what has to die; once it is destroyed the towers
stand down and no more interceptors come.

The towers stand on rock **at least 160 out**. Its feet reach 150, and over two laps none comes
nearer a tower's middle than about 10. **The ring's east-south-east quarter is all lava channel**,
150 to 185 out, so the towers follow the rock rather than the clock: at 0°, 58°, 98°, 170°, 219°
and 264°, leaving the lava side open.

| round | core | each knee | turrets | seconds open | bombs an eruption |
|---|---|---|---|---|---|
| 5 | 1800 | 30 | 4 | 10 | 4 |
| 10 | 5100 | 74 | 6 | 9 | 6 |
| 15 | 9400 | 125 | 6 | 8 | 8 |

**Measured** by `test/dusk-walker.mjs`, with a stand-in that flies at the nearest knee, and at the
core when open, holding Fire. It never dodges, never aims at an interceptor, cannot die, and repair
is not modelled. Each hit is put down to its source by its size, which differs for every source here.

| | destroyed in | hull lost, `walker-1` | `walker-2` | of which towers | interceptors |
|---|---|---|---|---|---|
| round 5, no upgrades | 257 to 473s | 699 to 1025 of 100 | about 1700 to 2600 | about half | 40 to 90 |
| round 5, four upgrades, three runs | 44s every time | 64 to 112 of 125 | **238 to 276** | 106 to 130 | 10 to 30 |
| round 5, four upgrades, **each tower once first** | 101s every time | – | 335 to 397 | 160 to 204 | 0 to 10 |
| round 10, nine upgrades | 42s | 128 of 150 | 222 | 78 | 0 |

**Runs differ.** The guns' timing is random, and in the long fight that decides how many falls it
takes: five no-upgrade runs of `walker-1` gave 257, 300, 300, 393 and 393 seconds. This document
quoted the first as the figure. The short fights now run three times and are quoted as a range.

**What that says, read plainly:**

- **It is no longer easy, by this measure.** With four upgrades it now costs about twice the hull you
  have; the dreadnought's figure on the same terms is 194 of 125. The stand-in would be dead about
  halfway through. A person dodges, mends and carries other cards, so this is a ceiling, as before.
- **Shooting the towers does not pay.** They are back in ten seconds, so the stand-in that takes
  each one down first spends a minute more under the walker's turrets and loses more, not less. The
  best play is to ignore them and take what they send. On the ice the towers stayed down, so there
  clearing them paid. If he wants clearing a side to buy a breather, a longer rebuild is the lever.
- **The interceptors barely fire at this stand-in**: 3 to 12 shots a fight, though two are up 80 to
  100% of the time. It circles under the walker, and they fire only while on your screen: the case
  the interceptors section already notes is barely shot at. A person who flies straight at the
  walker will meet them head-on far more.
- **The fight is no shorter or longer.** Nothing added touches the knees or the core: 44s with four
  upgrades, as before. What changed is only what it costs.

Bolts aimed at a knee with a clear line reach it 87% of the time level, 93 to 100% from above;
at the open core, 79% from a shallow 5° and 100% from 20° up.

**How it got here, measured not guessed:**

- The first gait starved one set of legs: 118 steps against 22, a foot left 290 behind.
- The first walker was a shadow with legs against black rock in red haze.
- With no upgrades the first fight could not be won in seven minutes: four falls had it 42%
  done. The weak-spot core and the cost of a fall are the fix.
- Then, with four upgrades, it was over in 44s for 32 hull. More core and four turrets from the
  start brought that to 88.
- Two of the suite's own checks were wrong first time: one counted bolts that had rock between
  gun and knee as misses, and one started its stopwatch after the core had opened.
- `walker-2`'s checks, four wrong first time and found by breaking the game on purpose: a "towers
  first" stand-in that never finished, because towers that rebuild are never all down; an
  expectation that interceptors fire in every fight, which this stand-in does not give them; the
  knee check turning flaky because a tower gun stood in some of its lines of fire; and a "towers
  stand down" check whose two-second window was too short for a gun to fire either way, so
  deleting the code passed it. It now holds you off a flak tower and needs shots before and none
  after.

**Not settled:** a player with no upgrades, as the Sam panel's boss buttons give, faces a
four- to eight-minute fight, and with the towers it is not survivable by any measure here. Whether a person stands under a bomb mark is not something a stand-in that
never dodges can say. The footfall and eruption sounds are unheard by anyone but him.

## The time of day (build `time-1`)

**Sam's rulings:** time of day is **a cycle**; **keep night**; boss rounds "go for whatever look
best". Weather is random, changes the game, has background sound, and is clear about half the
time: that is the next change, not this one.

**Mine, from mock-ups he saw:**

- **Four steps, one a round: dusk, night, dawn, morning.** Round 1 is dusk, so the game opens as it
  always did. Bosses come every fifth round, so over a long run each meets every time of day.
- **The sun stays low throughout**: no noon. Flat shading under a sun overhead reads as plastic.
- **Night is moonlight**, bright enough to fly by the ground.
- **The change is a cut as the round starts**, not a fade.
- **The ice keeps a clear cold dawn and the lava keeps night**, whatever the round. The dreadnought
  is fought in the dusk world and takes whatever the cycle gives it.
- **The Sam panel's "Time" button** steps to the next time at once, so each can be seen without
  playing four rounds.

**How it works.** `TIMES` holds each look; `ARENAS[0]` now holds only the dusk world's ground
colours, because its light comes from the time. `applyLook()` sets the haze, the sun's direction,
colour and strength, the hemisphere light, the water, the stars, the giant and its ring, repaints
the sky (`paintSky`), and re-tints the far ridges and the volcano. Each ridge keeps, channel by
channel, the ratio it always had to the dusk haze, so at dusk they are their old colours to within
one step in 255. Shooting stars stop when the stars are faint.

**Found on the way: the sky had been dusk everywhere.** It was painted once at load from the dusk
colours, so the ice and the lava were fought under a dusk sky above their own haze. Each landscape
has its own sky now.

**Measured** by `test/dusk-time.mjs`. Dusk is unchanged: every light and colour exactly, the sky to
within 0.2 of 255. Two things are measured at each time against dusk, which is what he plays, on
nine views of one round (three capital ships, three ground units, three drones). The screen is
modelled under office light: 4% of white added as reflected room light, then perceived lightness.
**That 4% is an assumption, not a measurement.**

- **Whether the enemies stand out**: each view drawn with the enemies as white silhouettes, then
  shown and hidden; the difference in perceived lightness over the silhouettes.
- **Whether the ground can be read**: the spread of perceived lightness across the ground, its
  light and shade, which is what you fly low by.

| against dusk | night | dawn | morning | fails below |
|---|---|---|---|---|
| enemies stand out | 90 to 97% | 104 to 123% | 130 to 181% | 75% |
| the ground's light and shade | 170% | 142% | 232% | 60% |

(Those were three runs of nine views each. Since `chapters-2` the suite uses fifteen views with a
fixed seed and clock, one sample the same every run: night 136%, dawn 157%, morning 253% for the
enemies; 155%, 122%, 216% for the ground. Different enemies in view, so different figures, all well
clear of the bars.)

The two answer different questions, and the second exists because the first could not see what
was wrong with a dark night. **Enemies carry their own lights and outline, so they stand out
against any dark world**: a near-black night still scored 75 to 76% on the first. What a night
that is too dark takes away is the ground: that near-black night keeps 31% of dusk's light and
shade, and the mock-up's dark night 53%, so both fail. The moonlit night keeps more than dusk,
because the moon is higher than the dusk sun.

**The measure was wrong four times before it was right**, each found by feeding it a night that
should fail:

- Averaging only over pixels that changed let anything that melted into the dark drop out of the
  average: the mock-up's dark night scored 119% of dusk.
- Raw pixel values treat a dark difference like a bright one, which is not true on a phone under
  office light; hence the glare.
- One view of each kind swung the night from 80% to 89% between runs; nine views hold it steadier.
- Then a near-black night passed, because the enemies were never what a dark night hides.

**I told him the ship "almost disappears" in the mock-up's dark night.** It does not, by the first
measure. What disappears is the ground, by the second, which is the right half of what my eye said
for the wrong reason.

## The weather (build `weather-1`)

**Sam's rulings:** random, drawn afresh each round; **clear about half the time**; it **changes the
game**, not only the look; it has **background sound** (the next change, not this one); wind pushes
**only the player** "unless it's designed in a way that the lighter enemies don't get messed up too
bad and if so then it effects them also". Boss rounds "go for whatever look best".

**Mine, open to him:**

| | how often | the look | what it does to play |
|---|---|---|---|
| clear | 50% | as ever | nothing |
| fog | 20% | haze a third thicker, far skyline veiled | **enemy lights fade too**: you lose a drone at about 130 |
| rain | 15% | rain streaks, light dimmed by a quarter | mood, and its sound when that lands |
| storm | 15% | heavier rain, light dimmed by 40%, lightning every 5 to 12 seconds | **gusts push you** |

- **Named for where it falls:** on the ice rain is snow and a storm a blizzard, with no lightning;
  on the lava rain is ash, a storm an ash storm, fog is smoke.
- **The round's banner names it** ("Round 6 · Storm"). The **Sam panel's "Weather" button** steps
  to the next kind at once, in the middle of a round.
- **Gusts**: a wind that wanders in direction, a gust every 4 to 9 seconds, rising, holding and
  falling over 2.5 to 4.5 seconds. It never pushes you further out past the map's edge.
- **Who else the wind pushes**, by his rule and by measurement: **drones yes, interceptors no.** A
  drone's circle drifts up to 30 and springs back home, keeping its height over whatever ground it
  drifts across: in a storm drones come no nearer the ground than in still air. Interceptors,
  pushed, went into the ground in every one of four three-minute storms, as deep as 13.6 (still
  air: none of four, at the time); that is "messed up", so they are left alone. Capital ships,
  ground units and bosses are too heavy.

**How it works.** `WX` holds the kinds; `wxStart` draws one at each round's start, after the
landscape is settled, and re-applies the whole look with the weather on top (`wxApply`, which
`applyLook` calls last), so nothing stacks from round to round. **A veil**, a sphere round the
camera just beyond the map in the haze colour, fades the far ridges, the far fight, the giant and
the stars together, all of which are drawn without haze so the skyline shows. What falls is one
batch of streaks or flakes in a box that travels with the camera. `wxHold` pins the weather for
the suites, which are about other things; each holds it clear.

**Measured** by `test/dusk-weather.mjs`:

| | |
|---|---|
| the draw, 20,000 times | clear 50%, fog 20%, rain 15%, storm 15%, each within 2 points |
| a drone straight ahead, still standing out a quarter as much as at 30 in clear | **clear: across the whole map (48% at 450); fog: to about 130** |
| push on a ship holding nothing | peak about 12.5 a second (full strafe is 15), pushing hard a quarter to a third of the time |
| lightning in a storm | 15 or 16 flashes in two minutes; none in rain or a blizzard |
| nearest a drone comes to the ground, still against storm | 11 to 21 against 11 to 18 |

**Three things the first versions got wrong, all found by measuring:**

- **Fog hid nothing.** Enemies' lights (engines, lamps, a drone's core) are drawn without haze so
  they glow, so a drone 250 away still stood out 43% as much as one 30 away in clear. In fog, the
  lights of ordinary enemies take the haze now. Health rings and bars, enemy fire and bosses never do.
- **"Halve how far you can see" had nothing to halve.** In clear air those lights carry across the
  whole map. What fog does is set a distance: about 130 at the thickness chosen, under a third of the
  map's width, and visibly thicker than clear. The haze was first doubled, which cut it to 75.
- **Interceptors went into the ground in still air too.** Their floor only steered, and steering
  can be late: in two of three three-minute runs one went a few metres into a hill. They now have a
  hard floor, 3 over the ground, and a check that flies one straight down at a hill.

Four of the suite's own checks were wrong first: a camera at 40 that the hills blinded beyond 100 in
both weathers; a lightning counter that looked for a flash above 0.9 when a flash has faded below
that within its first tick; a wind measure that kept only the sideways part of the push, so a wind
of 10.9 read as 6.8; and a fog check that asked for a half of a distance its own list had capped.

**Sam, on the phone:** "Fog is looking good." Fog at 130 stands.

**Not settled:** how a storm's push feels on the phone; frame time with 1,400 drops on his phone,
which nothing here can measure.

### The weather's sound (build `weather-2`)

**His ruling:** weather has sound, "but background sound". **Mine:** three beds that loop while
the weather lasts and fade with it: a hiss for rain, softer and duller for snow; wind that swells
with each gust; a dry crackle for falling ash. Thunder comes low and far off, 0.8 to 2.2 seconds
after each flash, and rolls: about two seconds within a tenth of its peak, fading out over five.
(As first built it was over in about one and a half, against the "about three" said here; found
when its check went red one run in a few, because each clap's loudness varies and the check used a
fixed floor. Both are fixed.) **Fog is silent**: the quiet is the point. The beds
go out with the effects, so "effects only" keeps them and "silent" stops them, thunder included.

**Measured** by `test/dusk-wxsound.mjs`, with the browser's tap-to-start rule on, as on a phone.
Nothing is built before the first tap. Loudness out of the weather's own bus, against the music in
calm, where it is quietest (about -33 dB):

| clear, fog | rain | storm | snow | blizzard | ash | thunder at its peak |
|---|---|---|---|---|---|---|
| silent | -41 dB | -40 dB | -49 dB | -48 dB | -53 dB | -37 dB |

**First set, rain was as loud as the music and a storm louder** (-31 dB against -34). They are now
7 dB or more under it. The music's own level wanders by 4 dB with the bar it is in, so the check
compares against its typical level, not the moment's.

**None of this says how it sounds.** It is measured as a signal, never heard here.

## Chapters and bigger arenas: the design, proposed and not built

**Sam's idea:** "every 5 rounds it moves to a new and larger arena because the enemy numbers keep
getting larger", the maps themed on the bosses or original; and "an opportunity to try and add
some variety rather than copy and paste an open empty landscape like the first one mostly is".
He left the four open questions to me ("go with what you think works best"). **Everything below
is mine on that say-so, for him to check before any of it is built.**

### The shape

- **A chapter is five rounds: four ordinary, then its boss, in one arena.** The boss is fought on
  ground you have spent four rounds learning. The move comes after the boss, behind the upgrade
  cards, and the next round's banner names the place ("Chapter 2 · The Ice Field").
- **Each arena is its boss's landscape**: the dusk hills (the dreadnought), the ice field (the
  wall), the lava field (the walker). In the ice chapter the wall stands quiet in the middle for
  four rounds and wakes at the fifth.
- **The order: the dusk hills first, then the ice and the lava in random order**, then round again,
  the dusk hills then the other two in random order. This bends his earlier "bosses are random" for
  the first boss only, which is now always the dreadnought: the game is called *at dusk*, and a run
  should open there. From the second boss on, the order differs from run to run.
- **The arenas grow so the spacing stays what round 4 has now**, and stop growing at chapter 4:

| chapter | enemies by its last ordinary round | width you can fly | crossing at full speed | ground points |
|---|---|---|---|---|
| 1 | 44 | 444 (today) | 9 s | 49,000 |
| 2 | 99 | about 650 | 14 s | about 86,000 |
| 3 | 154 | about 770 | 16 s | about 118,000 |
| 4 and on | 209 and more | about 880 | 19 s | about 155,000 |

  From chapter 5 on, the arenas are full size and only the fights grow. Rebuilding the ground took
  55 to 80 ms here at today's size, so about a fifth of a second at full size, once a chapter,
  behind the cards.
- **The ordinary rounds take a little of their place's danger.** In the lava chapter the volcano
  erupts in the ordinary rounds too, with half the bombs. On the ice, nothing extra: the wall is
  enough. The time of day and the weather carry on as now.

### Variety: places, not a bigger empty plain

**Every feature is built into the ground itself**, because the ground is what stops fire: enemy
shots and missiles end where they meet it, and so do your bolts (`strike`). A canyon is cover from
a missile site; a pillar is cover from a drone. Arches and overhangs could not be: the ground is a
height at each point, so nothing can be above open air. **Each arena is made of regions, each asking
for a different way to fly**, and enemies are placed by region, which is where the queued "ground
units grouped into bases" lands.

- **The ice field.** The wall across the middle. **Crevasses**: canyons cut down into the plain,
  deep enough to fly in below the surface, out of the missile sites' sight. **A frozen lake**: flat,
  glassy and open, nowhere to hide, where the drones gather. **A field of ice spires** to weave
  through. **An outpost**: a walled compound with its guns grouped inside, to be dived on.
- **The lava field.** The volcano at the rim and the rivers there now. **A forest of basalt
  columns**, hexagonal and of different heights, for weaving and for cover. **A lava lake with
  islands**, a battery on each. **A rift valley**: one long, deep cut across the field.
- **The dusk hills, when the order comes round again at full size.** The landing pad becomes a
  base. **A river canyon** winding across, **mesas** with flat tops for gun sites, and the hills
  between. Chapter 1 stays as it is now: the open introduction, so the second chapter lands.

### What has to change underneath

About forty distances in the code assume today's map: the edge at 222, the spawn rings at 205, the
far ridges at 430 to 670 (which would sit inside a full-size map), the fog veil at 260, the towers,
the far fight. **Each will follow the arena's size**, with a suite that builds every arena at every
size and checks nothing spawns in rock, over the edge, or inside a feature. **The ice wall's
collapse** recomputes the shading across the whole map at each of its eight steps; on a map three
times the size that is a hitch, so it will recompute only the strip that fell.

### Step 1, built (`chapters-1`): the move, at today's size

**Sam: "Sounds good, go for it."** Every five rounds a new arena: the dusk hills, then the ice and
the lava in random order, round again. The ice's ordinary rounds have the wall standing quiet in
the middle, whole again whatever fell last time; the lava's have the volcano throwing half the
walker round's bombs. A chapter's first round names the place in its banner. The Sam panel's boss
buttons still work: the chapter they jump to becomes that boss's arena. `chapterHold` pins every
chapter to one arena for the suites, which are about other things; each holds the dusk hills.

**Every arena gets every time of day** (`chapters-2`). Sam: "Every arena gets all times of day, that
way it stays dynamic but the boss battles still keep whatever looks best." In the ice and lava
chapters' ordinary rounds the look is the place's own blended with the hour's light (`blendLook`):
40% the hour on the ice, 50% on the lava. The lava itself, the sea, the ground's colours and what
is steep never blend. The ice wall's and the walker's rounds keep their own look exactly; the
dreadnought takes the hour, as before. The ice was first blended half and half too, and at dusk and
dawn its enemies stood out only 72 to 73% as far as in its boss look, under the 75% the suite asks.

Measured against each place's boss look, over the same enemies (`test/dusk-time.mjs`):

| | dusk | night | dawn | morning |
|---|---|---|---|---|
| ice: enemies stand out | 80% | 79% | **76%** | 100% |
| ice: the ground's light and shade | 103% | 135% | 99% | 117% |
| lava: enemies stand out | 99% | 83% | 97% | 108% |
| lava: the ground's light and shade | 99% | 104% | 91% | 109% |

**Ice at dawn is the near thing**, one point over the bar. These figures are now the same every run:
the suite fixes its random seed and the game clock, because with them free the lava's night swung
from 87% to 69% between two runs with nothing changed, and drones circling by the clock moved with
however long the test took to start.

**Capital ships used to patrol only the dusk hills.** They are now lifted, where they need it, to keep
every hull 10 clear of the ground on its whole circle: on the ice, three of nine, by up to 69, over
the wall.

**Found on the way: a capital ship has always flown through a hill.** In the dusk hills, as the game
always was, the fifth ship (from round 6) flies 44 up on a circle that passes 18.5 into a hill once
every five minutes. The first measurement flew a minute and saw a fifth of each circle; the check
now walks every ship's whole circle. The lift puts it 9.9 over the hill; the one other dusk ship
that needs it rises by 1.4, and the rest fly exactly as they did.

**Measured** by `test/dusk-chapter.mjs`: 300 runs open in the dusk hills every time, the second
chapter is the ice or the lava about half each (164 and 136), every three chapters visit all three,
none twice running.

### Step 2, built (`chapters-3`): the arenas grow

Each chapter's arena is scaled to keep the room each enemy has in round 4, by the chapter's last
ordinary round, and stops growing at chapter 4. Round n has 11n enemies, so the width goes with
the root of (5c + 4) / 4: **1, 1.5, 1.87, 2.18**. Scaled with it: the ground (same detail, more
points), its edge, where things are put, the capital ships' circles, the crags at the ice's and the
lava's rims, the far ridges (further out and broader, not taller, because the far fight flies over
them), the volcano (about the map's centre, keeping its shape), the far fight and the weather's veil.
Not scaled: the bosses and everything tuned round them, which stand in the middle. `scaleHold` pins
the size for the suites, which hold today's.

**Measured** by `test/dusk-size.mjs`:

| chapter | width you can fly | ground points | a round's start, here |
|---|---|---|---|
| 1 | 444 | 48,841 | 18 ms |
| 2 | 666 | 109,561 | 207 ms |
| 3 | 831 | 170,569 | 266 ms |
| 4 and on | 968 | 230,400 | 348 ms |

**The plan's figures were low.** It said about 650, 770 and 880 across and 155,000 points at full
size: it had grown the spawning ring where it should have grown the edge. The measured cost is half
as much again in points, a third of a second at a chapter's start here, behind the upgrade cards.
His phone is the measure that matters, and nothing here can take it.

**The ice wall's collapse** rebuilds only the patch where the ground moves: the section's width by
the wall's depth, found by its place in the grid. Each of its eight steps used to recompute the whole
mesh's normals (19 ms at full size here, for steepness the flat-shaded ground used for nothing else)
and to rebuild a strip the full depth of the map (23 ms). Now steepness comes from the heights either
side, and **a step takes 3.1 ms at full size**, against a whole rebuild's 360. The ground it leaves
is exactly, to the last bit, what a whole rebuild makes. Two of the suite's checks were wrong on the
way: one asked a step for only a quarter of a whole rebuild and passed with the normals still
recomputed; one timed a rebuild through a wrapper that dropped the patch's depth.

Every landscape at three sizes: every ground unit on rock and inside the edge, every drone's circle
clear of the ground, every capital ship's hull 8 clear on its whole circle, enemies spread out to the
edge of where things are put, the far ridges and the far fight beyond the edge. A new run comes back
to today's map exactly, not one coordinate different.

### Step 3, built twice (`ice-2`): the ice field's territories

**The first version (`ice-1`)** put four places in the plain round the wall: a shelf of crevasses, a
frozen lake, a field of spires and a walled outpost, each a neat shape. **Sam: "It's alright but it
also looks like little demo areas around the map on the snow one."** From above it was four stamped
shapes on a plain that was still plain everywhere else. He confirmed the reading (territories filling
the whole map, borders that blend) and, for the bases, "can have a large one or a few but mostly
smaller scattered around".

**Now the land round the wall is four territories**, each about a quarter of it, their borders
wandering with noise and blending over a wide band, coming in to about 55 from the wall's faces and
ends so the wall keeps only a moat (a first try began them 150 from the middle all the way round, and
from above they were a ring round a plain). Each fades out into the crags at the rim, and each of the
wall's six towers keeps a patch of plain to stand on.

- **Crevasse country** (towards 225°): a shelf 34 high whose edge breaks up as the territory thins,
  cut by a network of winding canyons 22 wide, on two crossing sets of lines 70 apart.
- **The lake basin** (315°): flat ice at 1.2, a shore band, a few low islands. A third of the drones,
  up to twelve, circle over it.
- **The spire forest** (135°): columns 26 apart, dense and up to 60 high in its heart, thinning and
  shorter towards its edges. Worked out once per size and stored, not searched for point by point.
- **Pressure ridges** (45°): long parallel ridges 22 high, valleys between to fly along.
- **Bases**: one large off the wall's end, eight guns, walls 16 high; and small camps, three at
  chapter 2's size and five at full size, each walled 11 high with a gate facing the middle and three
  guns. They sit on the ground as the territories leave it: a camp can stand on the lake.

**Measured** by `test/dusk-ice.mjs`:

| | chapter 2 | full size |
|---|---|---|
| empty plain left in the band round the wall | 2% | 3% |
| crevasses / lake / spires / ridges, share of it | 24 / 24 / 26 / 26% | 25 / 20 / 29 / 25% |
| a shelf gun's line to a ship in a canyon, blocked; lifted over the shelf | 81%; 5% | 93%; 19% |
| canyon width, narrowest tenth | 21 | 20.5 |
| spires; narrowest gap; places taken in the heart / at the edge | 34; 10.9; 100 / 12% | 141; 9.4; 100 / 47% |

**On the way, measured rather than looked at:** the first borders blended only 8% of the land; and the
suite's first "plain" counted a canyon floor or the ground between spires as plain, because they sit at
its height. It now counts empty plain: nothing within 20 rising 6 over it. **And one wrong diagnosis:**
the lake's check found ground 23 high in the lake basin at full size, and I put it down to islands and
capped them. A deliberate break showed the cap did nothing, because the islands never pass 7: the 23
was a base's walls, standing on the lake. The check now leaves the bases out, and the cap is gone.
A camp that lands on the lake stands on a platform of ice 3 high, so its guns, like every ground
unit, are 2.5 or more clear of the water line: the size suite found three at 1.2.

**Found by the size suite, older than any of this:** now and then a drone at today's size circled with
the bottom of its bob inside the ice wall's crest. A drone settles its height from the ground at 24
points round its circle, and the crest, narrow and jagged, could fall between them. It checks 48 now.
That fault was rare and random, so one clean run does not prove the fix; it is right in principle.

### Built in stages, each merged with its own version, each shown as renders first

1. ~~Chapters: the move every five rounds and the order, at today's size.~~ Built, above.
2. ~~Size: every distance following the arena, and the arenas growing.~~ Built, above.
3. ~~The ice field's regions.~~ Built, above.
4. The lava field's regions.
5. The dusk hills at full size, for the second time round.

## Queued, in the agreed order

1. Wrecks of downed capital ships that stay for the run.
2. ~~Time of day moving on each round.~~ Built: the time of day, the weather and its sound, above.
3. Ground units grouped into bases. (Proposed as part of the chapters' regions, above.)
4. Canyons for cover. (Likewise: crevasses, the rift, the river canyon.)
5. ~~A boss every fifth round.~~ Built: the dreadnought, above.

Also noted: once interceptors exist, invulnerable wingmen will look odd.

## Mistakes already made here once

- **Steering by blending the current heading toward the target heading stalls when the
  target is dead astern.** Rotate about the cross-product axis instead, as the dogfight
  code now does.
- **Things were placed off-screen twice by getting the camera geometry wrong.** The camera
  sits 9.5 behind and 2.6 above the ship. Project to screen coordinates and check the
  numbers.
- **Point defence was tuned by guesswork and shipped stopping 100% of missiles.** Measure
  before claiming.
- **Audio tests ran with the browser's tap-to-start rule switched off**, so they proved
  nothing about a real phone.

## Tests

```
node test/dusk.mjs             # smoke
node test/dusk-intercept.mjs   # the interceptors' rules and how they fly
node test/dusk-boss.mjs        # the dreadnought's rules and how long the fight is
node test/dusk-arena.mjs       # the ice landscape: nothing floating, nothing buried, and dusk comes back exact
node test/dusk-wall.mjs        # the ice wall: cracks, guns that rebuild, sections that fall, which boss comes
node test/dusk-lava.mjs        # the lava field, and the walker's every footfall for 150 seconds
node test/dusk-walker.mjs      # the walker's fight: knees, the fall, the core, bombs, lava, towers, interceptors, which boss comes
DUSK_QUICK=1 node test/dusk-walker.mjs   # its rules without the fights, for mutation runs: a minute instead of several
node test/dusk-time.mjs        # the time of day: the cycle, dusk unchanged, each sky its own, and whether enemies still stand out
node test/dusk-weather.mjs     # the weather: the draw, nothing stacking, how far you see in fog, the wind, lightning, who gets pushed
node test/dusk-wxsound.mjs     # the weather's sound: nothing before a tap, each bed under the music, thunder after its flash, the sound modes
node test/dusk-chapter.mjs     # the chapters: the order, one arena a chapter, ordinary rounds on the ice and lava, ships over the ground
node test/dusk-size.mjs        # the arenas' sizes: the spacing, the ground at every size, nothing in the wrong place, the wall's strips
node test/dusk-ice.mjs         # the ice field's territories: the plain filled, borders that blend, each place doing its job, the bases
```

`dusk.mjs` is a smoke test: the page opens, three.js loads from beside it, the picture changes between
two moments, the Sam panel shows the `BUILD` the source declares, nothing is requested from
outside the folder, and nothing throws. It reads `BUILD` from the source rather than
restating it.

`dusk-intercept.mjs` steps the real game by hand at 30 ticks a second with drawing switched
off, so its figures are the same on any machine. It works on a temp copy with one line added
(`window.__t = function (code) { return eval(code); }` before the final
`requestAnimationFrame(tick);`), never the published file. **Clearing a round brings up the
upgrade cards, which stops the clock**: give each check a fresh page.

**Neither proves how it plays.** Feel is Sam's to judge on his phone.

## Not done yet

- **Offline.** The game is not listed in `docs/sw.js`. Because that service worker covers
  the whole site and saves whatever it fetches, the game will usually open with no signal
  once it has been opened with one. It is not promised: opened cold with no signal, the
  worker answers with Grandiose's front page instead. Listing it is its own change, with
  `test/offline.mjs` run against it and a row added to that suite's `APPS`.
- **Home Screen.** No manifest or icon, so it can be bookmarked but has no icon of its own.
- **three.js was taken from npm (`three@0.128.0`, `build/three.min.js`), not from the CDN
  the artifact used.** They are the same release, but the CDN could not be reached from
  the build environment, so the two files were never compared byte for byte.
