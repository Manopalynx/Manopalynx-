# A small world at dusk

A 3D space shooter played on a phone in portrait. One HTML file and a copy of three.js
r128 beside it; all sound is synthesised, there are no other assets. Published at
`/Manopalynx-/dusk/`.

It was built in a claude.ai artifact across earlier chats and moved here unchanged at build
`pages-1`: the only two lines that differ from the artifact are the three.js `<script>` tag
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

## Next: interceptors as real enemies

From round 3, a few peel away from the dogfight and come for him. Agreed requirements:

- They make passes **through his view**: head-on and crossing runs, then break away and
  come round. No tail-chasing. In portrait he sees only about ±22 degrees sideways, so an
  enemy behind him is one he can neither see nor shoot.
- Edge-of-screen markers showing where each one is.
- They get sounds, and they raise heat.

Not yet decided, and his to decide: how many per round, whether they count toward the
round's "to go" total, how much hull they have.

The dogfight's flight code carries over, but it is tuned for scenery at 2.4x scale, so
speeds and turn rate need re-tuning for close range.

## Queued after that, in the agreed order

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
node test/dusk.mjs
```

A smoke test: the page opens, three.js loads from beside it, the picture changes between
two moments, the Sam panel shows the `BUILD` the source declares, nothing is requested from
outside the folder, and nothing throws. It reads `BUILD` from the source rather than
restating it.

**It proves the page runs, not how it plays.** Headless Chromium draws this at a few frames
a second, so it can check mechanics and never feel. Feel is Sam's to judge on his phone.

To reach the game's internals from a test, inject
`window.__t = function (code) { return eval(code); }` just before the final
`requestAnimationFrame(tick);` in a served copy, not in the published file.

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
