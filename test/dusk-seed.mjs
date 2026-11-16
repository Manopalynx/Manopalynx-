// One way to make a Dusk suite's game repeat itself, shared by every suite.
//
// Two things made a seeded suite drift from run to run, both found while measuring the bomb (HISTORY.md, Instance 17):
//
//  1. SEEDING AFTER THE PAGE LOADS IS TOO LATE. The page builds part of its world as it loads -- the far dogfight,
//     whose ships become a round's interceptors -- on whatever Math.random is there at the time. This installs the
//     seeded one from an init script, so it is in place before the page's own script runs.
//  2. SOUND DRAWS FROM THE GAME'S OWN RANDOM, and whether a sound plays depends on the real audio clock (each effect
//     has a least gap between plays, measured in real time). With sound on, a seeded game drifts with wall time. So the
//     game is opened with no audio system at all unless the suite is about sound. The game still counts every sound it
//     would have made (a suite that wraps sfx sees them all); it only stops short of playing them.
//
//  3. THE CLOCK. Every suite starts its step counter from "the time now" and adds a thirtieth of a second a step.
//     Two things followed. The game's first step is as long as the real time since the page loaded, up to a twentieth
//     of a second, so a suite that began 15 thousandths after load and one that began 40 after began from different
//     worlds. And adding a thirtieth of a second to different starting numbers rounds differently in the last places,
//     which a long fight magnifies: two runs that drew exactly the same random numbers at every step still ended
//     apart. So once the page has loaded its clock is not the real one: each reading is the next of a fixed series
//     (ten million, twenty million ...), far enough apart that no suite's stepping reaches the next. Every run of a
//     suite reads the same numbers. A suite that times real work, or waits in real time, asks for the real clock.
//
//  4. THE MUSIC RUNS ON A REAL-TIME TIMER AND DRAWS FROM THE SAME RANDOM, silent or not. Between a page loading and a
//     suite stepping it, and between one piece of a suite's work and the next, that timer fires however many times the
//     machine's pace allows, each time moving the seeded stream on. (Found by fingerprinting fresh pages: the first
//     page a browser opens, which is slower, differed from every later one, and those agreed.) So whatever the page
//     runs from a timer is given the browser's own random for as long as it runs; only what the suite itself drives,
//     the game's steps, draws from the seed.
//
// Use, straight after the page is made and before it goes anywhere:
//
//     await seedPage(page);                      // seeded and silent
//     await seedPage(page, { sound: true });     // seeded, sound left on and the real clock: for a suite about sound
//     await seedPage(page, { realClock: true }); // seeded and silent, the real clock: for a suite that times real work
//
// Inside the page, window.__reseed() puts the seed back to where it started (or to a number given), for a suite that
// wants several runs to begin alike. A suite that swaps in its own Math.random later still can: the world built at
// load is seeded either way.

export async function seedPage(page, { seed = 20261116, sound = false, realClock = sound } = {}) {
  await page.addInitScript(([seed, sound, realClock]) => {
    window.__seed = seed;
    var nativeRandom = Math.random;
    ['setInterval', 'setTimeout'].forEach(function (name) {
      var real = window[name];
      window[name] = function (fn) {
        var args = Array.prototype.slice.call(arguments);
        if (typeof fn === 'function') args[0] = function () { var keep = Math.random; Math.random = nativeRandom; try { return fn.apply(this, arguments); } finally { Math.random = keep; } };
        return real.apply(window, args);
      };
    });
    Math.random = function () { var s = window.__seed | 0; s = s + 0x6D2B79F5 | 0; window.__seed = s; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.__reseed = function (n) { window.__seed = n === undefined ? seed : n; };
    if (!realClock) {
      var realNow = performance.now.bind(performance), loaded = false, reads = 0;
      window.addEventListener('load', function () { loaded = true; });
      performance.now = function () { return loaded ? 1e7 * ++reads : realNow(); };
    }
    // Silent means no audio system at all, which the game allows for (some browsers have none). Muting was not enough:
    // the first step taken once the audio has woken builds the weather's sound, thousands of draws inside a game step,
    // and whether it has woken by then is a matter of milliseconds.
    if (!sound) { window.AudioContext = undefined; window.webkitAudioContext = undefined; try { localStorage.setItem('small-world-mute', '1'); } catch (e) {} }
  }, [seed, sound, realClock]);
}
