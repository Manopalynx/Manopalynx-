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

## Interceptors (build `interceptors-1`)

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

**How they fly.** Attack run, pass, break away, come round. Three rules keep every attack
inside a portrait view about 20 degrees wide either side:

1. A run only starts from dead ahead of him and at least 110 away, and is abandoned if he
   turns so that it is no longer in front.
2. After a pass they overtake him and go out to a point 200 ahead and off to one side, so the
   turn back happens where he can watch it.
3. **The guns fire only while the interceptor is on his screen**, measured against the
   screen's real shape rather than a round cone.

Each has a red marker: a diamond on it while in view, an arrow at the screen edge when not.

**Measured** by `test/dusk-intercept.mjs`: round 5, two interceptors, nothing else alive, 180
game-seconds, a stand-in player who never aims. Run it for current figures; one run gave:

| stand-in player | passes | on screen before each | shots | hits on him |
|---|---|---|---|---|
| straight legs across the map, cruising | 39 | 2.9s | 35 | 13 |
| straight legs, full throttle | 31 | 3.1s | 17 | 5 |
| legs with a gentle weave | 20 | 4.8s | 3 | 1 |
| legs with a hard weave | 11 | 2.4s | 0 | 0 |
| circling without ever stopping | 50 | 0.3s | 0 | 0 |

Of 55 shots across those runs, none came from behind him and none from off the screen;
removing rule 3 turns both checks red.

**What the figures say that is not settled:**

- **They die fast.** The stand-in holds Fire and flies its line, never aiming, and still
  kills both inside 12 to 26 seconds. A head-on run comes straight down the gun line. Three
  hull may be too little; that is Sam's to change.
- **A player who circles without stopping is buzzed but never shot at.** They cannot get in
  front of a nose that never stops moving, and they will not fire from where he cannot see.
- **A hard weave is a complete defence** against their guns; a gentle one nearly so.
- Roughly one pass in ten is never on screen, when he turns at the map edge with one already
  inbound. Those fire nothing.

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
