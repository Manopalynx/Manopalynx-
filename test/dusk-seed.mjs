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
//  3. THE GAME'S FIRST STEP IS AS LONG AS THE REAL TIME SINCE THE PAGE LOADED, up to a twentieth of a second. A suite
//     that starts stepping 15 thousandths after load and one that starts 40 after begin from different worlds (a
//     minimal scene read 54, 55, 56 and 97 thousandths on four pages: three of them just over the cap). So once the
//     page has loaded its clock reads a second ahead: the first step is always the full twentieth. The clock still
//     runs in real time after that, so anything that waits on it (the upgrade cards' 0.6 seconds) still works.
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
    var realNow = performance.now.bind(performance), ahead = 0;
    window.addEventListener('load', function () { ahead = 1000; });
    performance.now = function () { return realNow() + ahead; };
    if (!sound) { try { localStorage.setItem('small-world-mute', '1'); } catch (e) {} }
  }, [seed, sound]);
}
