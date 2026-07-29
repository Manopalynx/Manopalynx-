# Household Ledger

A single-file call and uplift ledger for a sales desk. Log calls as they happen, track
household £/mo against a monthly target, keep callbacks, and report at month end.

`upliftledger.html` is the whole application. No build step, no server, no install.
Everything is stored in the browser's `localStorage` on the machine you open it on.

## Running it

Open `upliftledger.html` in a browser. That is the entire setup.

Chrome and Edge pool all `file://` pages into one storage origin, so you can move or
rename the file and your data follows it. (Verified in Chromium only — Firefox and
Safari may isolate differently, so check once before relying on it.)

If a red storage banner appears at the top of the page, or a notice at the foot, that
browser is refusing to store data and nothing you log will survive the tab closing.
Use a different browser, or host the file over http.

The six-month chart loads Chart.js from a CDN. Offline it says so and everything else
keeps working.

## Backing up

Two exports, and they are not interchangeable:

- **Backup** writes JSON and restores completely. It is the save payload itself, so a
  round trip loses nothing — calls, callback times, attempt counts, note-done flags,
  targets, percentage targets, spotlight items, easy leads and planned shifts all
  survive. Verified by `test/interaction.mjs`.
- **Export** writes CSV for reading and for pasting into a tracker. It drops everything
  except the calls themselves.

Only a Backup clears the backup nudge. The nudge appears after 7 calls since the last
one, or after anything has sat unbacked for 3 days.

## Developer notes

Target browser is **Microsoft Edge** on desktop. That is not incidental — several
behaviours below depend on it being Chromium-based, and on the window being wide enough
for the two-column layout (≥1100px).

Before changing anything, run the tests. This file has a history of defects that read
perfectly well in the source: a quantity silently ignored on save, a duplicate warning
firing on legitimate entries, an export that threw and produced no file, a quota failure
that looked exactly like a successful save. None of those were visible by inspection.
Measure first.

### Known issues

**Toggling a note from the calls list moves the list by ~200px.** The note lives in the
notes card far above, so adding or removing a card there shifts everything below it.
This is *not* a scroll-preservation problem — anchoring to `#listTitle`, anchoring to
`#notesCard`, and removing the scroll handling entirely all measure the same −200px, so
something after that line has the last word. The fix is to stop re-rendering the whole
page from a button in the calls list and update only the note card and the row that
changed. Marked in place in the source.

### What is and is not verified

Covered by the test suite: the data-safety path (backup restores losslessly, damaged
rows cannot crash the export or read as £0.00, failed writes are loud), and the
interaction paths that were moving content mid-tap.

**Not covered: any of the arithmetic.** Nothing verifies that "3 more needed (7 of 41
calls)" is the right number, nor the Scam Guard shortfall against Device/SIM lines, the
household percentage, the conversion rate, the pace projection, or the CSV totals row.
Those read as sound, but so did everything in the list above. A wrong figure there does
not crash, jump, or warn — it just quietly reports the wrong thing all month. This is
the most valuable place to spend the next effort: hand-calculate a month of expected
figures and assert the app produces them.

## Tests

```
npm i playwright
node test/interaction.mjs
```

Each scenario seeds `localStorage`, loads the real page, performs one interaction and
asserts three things together: nothing threw, the entry count held, and the content
under your finger did not move. Displacement is one assertion of three, not the point —
almost every defect this file has had was silent rather than visual.

The viewport is pinned to 1280×800 on purpose. The ledger switches to a two-column
desktop layout at 1100px, and that is not a cosmetic variant (see below), so the width
must be stated rather than inherited from whatever the test runner defaults to.

## Layout note: the `renderKeepingAnchor` call sites

`renderKeepingAnchor()` re-anchors the viewport to a known element after a render, so
content inserted above the fold cannot shift the page under you. **On the desktop
layout its two current call sites do nothing at all.** Do not delete them on that basis.

Measured with native scroll anchoring disabled, inserting a 58px banner into
`#alertRow`:

| layout | `#logCard` top | delta measured | what actually moved |
|---|---|---|---|
| desktop, ≥1100px | 16 → 16 | **0** | `#leftCol`, by 58px |
| narrow, <1100px | −490 → −432 | **58** | everything, by 58px |

Two independent reasons on desktop, either of which alone zeroes the delta:

1. `#logCard` is in grid column 2 while `#alertRow` is in column 1, so a banner growing
   row 1 pushes `#leftCol` down and never touches the log card.
2. `#logCard` is `position: sticky` and pinned, so it reports a constant viewport top
   regardless of what happens around it.

If the layout ever changes so that `#logCard` shares a column with `#alertRow`, or stops
being sticky, those call sites become load-bearing again.

## Scroll handling

There are several idioms in the file for holding scroll position across a render. They
are not equivalent, and one of them is actively harmful:

- `window.scrollTo(0, y)` with an offset captured before the render **defeats the
  browser's own scroll anchoring**, which would otherwise have handled the case
  correctly. This caused a 71px jump on the callback attempt buttons — half a callback
  card, enough that the next tap landed on the wrong customer.
- Doing nothing at all is correct in Chromium and Firefox, which implement scroll
  anchoring, and wrong in Safari, which does not.
- `renderKeepingAnchor()` is correct in every browser, because it measures a real
  element instead of trusting a number.

Prefer anchoring. If you are tempted to delete a scroll call as redundant, check it in a
browser without scroll anchoring first.
