// One way to make a Dusk suite's game repeat itself, shared by every suite.
//
// Two things made a seeded suite drift from run to run, both found while measuring the bomb (HISTORY.md, Instance 17):
//
//  1. SEEDING AFTER THE PAGE LOADS IS TOO LATE. The page builds part of its world as it loads -- the far dogfight,
//     whose ships become a round's interceptors -- on whatever Math.random is there at the time. This installs the
//     seeded one from an init script, so it is in place before the page's own script runs.
//  2. SOUND DRAWS FROM THE GAME'S OWN RANDOM, and whether a sound plays depends on the real audio clock (each effect
//     has a least gap between plays, measured in real time). With sound on, a seeded game drifts with wall time. So the
//     game is opened in its own "silent" mode unless the suite is about sound. The game still counts every sound it
//     would have made (a suite that wraps sfx sees them all); it only stops short of playing them.
//
// Use, straight after the page is made and before it goes anywhere:
//
//     await seedPage(page);                      // seeded and silent
//     await seedPage(page, { sound: true });     // seeded, sound left on: for a suite about sound
//
// Inside the page, window.__reseed() puts the seed back to where it started (or to a number given), for a suite that
// wants several runs to begin alike. A suite that swaps in its own Math.random later still can: the world built at
// load is seeded either way.

export async function seedPage(page, { seed = 20261116, sound = false } = {}) {
  await page.addInitScript(([seed, sound]) => {
    window.__seed = seed;
    Math.random = function () { var s = window.__seed | 0; s = s + 0x6D2B79F5 | 0; window.__seed = s; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.__reseed = function (n) { window.__seed = n === undefined ? seed : n; };
    if (!sound) { try { localStorage.setItem('small-world-mute', '1'); } catch (e) {} }
  }, [seed, sound]);
}
