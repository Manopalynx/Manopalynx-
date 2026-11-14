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

## Queued, in the agreed order

1. Wrecks of downed capital ships that stay for the run.
2. Time of day moving on each round.
3. Ground units grouped into bases.
4. Canyons for cover.
5. A boss every fifth round.

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
