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

## The lava field and the walker (build `lava-1`): step one of the third boss, no fight yet

Sam: "would we be able to add a new massive lava zone by the volcano with a massive walking
enemy spider tank looking thing?" and, to the design below, "Go with your ideas". He also said
**three bosses is enough for now.**

**Step one is the place and the walk.** Reached only from the Sam panel ("Lava field on/off").
Nothing in it can be fought, won or lost to. The fight is step two, after he has looked,
because whether a walk looks alive is something only his eye can say.

**The lava field** (`heightLava`, arena 2). Black rock cut by channels that dip below sea
level. **The sea, recoloured and made to glow, is the lava**, so the rivers and lakes are not
drawn: they are wherever the ground goes below nought (36% of the field). **The volcano is the
one that was always on the horizon**, brought up to the rim (`VOLC_NEAR`): its centre is 446
from the middle, where it was 703. Its streams, crater and embers come with it.

**The walker.** Six legs, a body about the size of a capital ship riding some 34 above its
feet, walking a circuit of radius 105 at 9 a second: a lap in 73 seconds.

- **Feet stand on the ground as it is.** A foot plants at `max(height, 0)`, so in a channel it
  wades on the lava's surface. 43% of its route is over lava.
- **Two bones and a knee per leg**, solved from hip and foot. The knee goes up and out, which
  is what makes it a spider and not a table.
- **The gait is two sets of three, strictly taking turns.** Nothing lifts while anything is in
  the air, and the set that went last waits.
- **The body looks a length ahead** for rising ground, because it climbs slowly.

**Measured** by `test/dusk-lava.mjs` over 150 seconds, a little over two laps, checked every
tick (27,000 foot-ticks): no planted foot off the ground or under it; no leg stretched past its
length or folded short; no knee in the ground; never more than three feet in the air and never
both sets at once; 56 steps by every leg; never less than 18.8 of room under the belly.

**The first gait was broken and this suite caught it before he saw it.** It let whichever leg
was furthest behind go next. One set starved the other: some legs took 118 steps and some 22,
and one foot was left planted 290 behind its hip, with the leg drawn stretched across the map.

**The walker was a shadow with legs** in the first render: dark machine, black rock, red haze.
It is paler now, lit from within, with glowing knees and a hot seam down each flank.

**Agreed for the fight, not built** (his "go with your ideas" covers these):

- You bring it down **by its legs**: each has a joint with a health ring; the body is armoured.
- Lose enough legs and **it falls**, exposing a core on its back for a few seconds.
- **Then it gets back up**: legs repair, it walks on. Each fall costs it a chunk of health.
- It carries **turrets that rebuild**.
- **The volcano is the third player**: each eruption throws lava bombs into the arena, landing
  in marked spots.
- **The lava hurts** if you touch it.
- With three bosses, "never the same twice running" becomes a real draw between the other two.

## Queued, in the agreed order

1. Wrecks of downed capital ships that stay for the run.
2. Time of day moving on each round.
3. Ground units grouped into bases.
4. Canyons for cover.
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
