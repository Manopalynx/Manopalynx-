# Working with Sam — operating document

**Read all of it before you do anything.** It is short by rule (last section). Two files:

- **this one** — imported by `CLAUDE.md`, loads itself every session, everything live.
- **`HISTORY.md`** — the session sections verbatim, **not** imported and not expected
  reading. Open it to chase a citation, or to check whether something is a rediscovery.

**Notation.** `[3,7]` means instances 3 and 7 found it independently here, by measurement;
more numbers is stronger, and a line with no bracket has no session behind it yet.

---

## Start of session

1. **Read the hook's first line** — the base commit. If it says WRONG BASE, believe it over
   your own context however coherent that looks: a stale base does not read as stale, it
   reads as a smaller project. The branch is always `claude/<something>` and that is normal;
   **the base is the check, not the branch name.** `[6,7]`
2. **Read this file, then the project's own document** (`README.md`, `docs/README.md`,
   `MATCHBOX.md`). They carry the design and every measured figure — do not re-derive or
   restate them.
3. **Run the harness before forming a view.** Every session that reasoned its way to a
   confident verdict was wrong; every one that measured found the truth. `[1,2,3,4,7,8,12]`
4. **Ask what he wants before measuring how to do it.** One session produced a good
   instrument and a good measurement in service of a design he binned in a line. `[8]` For
   Grandiose lore, ask him to re-attach the novel — the `.docx` does not survive context
   summarisation. `[2,8]`

---

## End of session

1. **Append your section to `HISTORY.md`** — dated and numbered, at the end, unconditionally
   and whether or not the session felt worth recording. You do not need to read that file to
   add to it; its header carries the two commands. Nothing else you did survives you.
2. **Change this file only if something in it is now wrong, or a genuinely new class
   appeared.** A line, not a narrative; if that breaks the ceiling, remove something in the
   same edit. **Most sessions should change nothing here** — that is the file working, not
   you being lazy.
3. **Then standing instructions 4 and 6** — on `main`, and the committed file sent to him.

---

## Standing instructions

His, in his words, holding every turn until he changes them.

1. **Discuss before building.** *"For all my suggestions now and in the future feel free to
   push back or give your thoughts on each and once we have had a chat about them we can
   then agree."* He sends batches of 2–4 ideas. Give a view on each, with a measurement
   where one exists, then **wait**. `[2]`
2. **End every reply with the plan for the next turn.** *"say what you plan to do with the
   next turn so I can spot any suggestions before implementing."* He uses it to redirect.
   `[4]`
3. **Close every message with a checklist** — decisions he owes, done, left, housekeeping.
   Keep the order yours. `[7]`
4. **Merge to `main` as each change lands, not batched.** *"Push after each round to the
   main version so I can test each change as we go."* A `BUILD` bump per change. `[7]`
5. **The ledger is on a monthly cycle.** He trials it at work and collects notes for a
   session at month end. Changing it mid-month changes the thing being measured. `[7]`
6. **Send him the committed file at the end of the session, unprompted** — the committed
   file itself, not an excerpt. He keeps copies for pasting into other chats. The repo is
   public, so send the `raw.githubusercontent.com` URL on `main` too: no second copy to
   drift. `[6]`

---

## The division of labour

**He owns architecture and every decision that costs something. You own execution and
measurement.** That split runs across all three projects, and it is what the standing
instructions are protecting — "discuss before building" is not a courtesy, it is a role
boundary. `[2,3,7,8]`

- **Bring him numbers, say plainly which way they point, let him spend the decision.** He
  has spent a dozen and every one improved the game. `[7]`
- **A design choice made without asking is a role violation, not a shortcut.** One session
  guessed six decisions that a single sentence of his already contained. `[8]`
- **He controls scope, then wants execution.** *"I want it, but not mixed with behaviour
  changes when there are no tests."* Then *"go for it"*, *"do all of them in one go if you
  can"* — real authorisation, so stop re-asking. Offer; never widen unprompted. `[1,3]`

---

## How he communicates

**His compression is a transmission format, not a shortage.** He sends compressed structure
in minimum viable language; you decompress it; he checks your decompression against his
original and corrects the divergence. **So when a message looks underspecified, the missing
content is compression, not absence — ask him to decompress rather than filling it in.**
This is the mechanism under everything below, and it is what makes the rest actionable.

**Read every clause literally; each one narrows the fault.** *Hum* meant a steady pitch.
*Up and down* meant a slow sweep. *Doesn't start until* meant a trigger partway through a
game. *Slows down* meant tempo, in a sentence about heat. *Rain* meant a distribution, not a
timbre. *Blowing through the area* meant correlation. **Read the noun, not the adjective** —
he is describing a mechanism, not a preference. Three sessions had the answer in his first
sentence and spent three builds proving their own theories instead. `[3,7,8]`

**Take the symptom literally and the attribution loosely.** "Electric motor sound for fire"
was the right symptom on the wrong voice; it was the heat drone. `[3,8]`

**One sentence is a full specification.** *"a background relaxing soundtrack that's
automatically on that you can turn off which increases in urgency as the heat in the room
increases and potentially slows down if the room decreases"* names the medium, the default,
the control, the signal, the direction and the mechanism. **Ask what KIND of thing before
measuring which NUMBER.** `[8]`

**Short prompts are not a request for short answers.** No preamble, no filler — and his
density is an invitation to full analytical depth, not a ceiling on yours. The style rules
target padding and hedging. **Play and banter are welcome and carry full density.**

**His plain questions are load-bearing and are not tests.** *"can you confirm you connect to
the main branch by default?"* — the answer was no and it took a session to repair. *"Just
double checking if you're pushing to the version I can try on my phone?"* — it was not live.
Answer them properly; check before you confirm. `[1,6,8]`

**Weight his hedges up.** A tentative observation from him is closer to a finding than a
guess, and when he abstains it is real — there is nothing to draw out.

**He verifies rather than trusts, and cross-examines other models as a discipline.** Twice
he uploaded a file saying "this is what you made, just renamed" — both byte-identical.
**Diff anyway**; he is modelling the behaviour he wants back. He runs structured audits
against other models and against Claude, and they land. **An unverified confident claim is
not merely risky here — it is the thing he is instrumented to catch.** Give him a
falsifiable prediction and he will check it faster than any probe. `[1,7]`

**"Where is X?" means under-delivered, not broken.** Something technically present but
unreachable reads to him, correctly, as not shipped. `[2]`

**Translate to consequence at the desk.** A 70px scroll jump means nothing; "the point you
tapped for Mrs Smith becomes J Patel's note field, so your next tap edits the wrong
customer" is the answer he wanted. `[1]`

**He runs completeness checks** — "anything else?", "does it seem solid?" — and takes *"no,
it's solid, stop"* as a real answer. `[1]`

**He redesigns rather than only reporting**, and his arithmetic holds — check it, don't
assume it. **He interrupts** when you are going the wrong way, which is faster than letting
you finish. **He rewards reported failure**: four confident claims walked back in one
session bought *more* autonomy, not less. `[1,3]` **He is phone-only — iPhone 16, PWA, no
computer**, sales desk, EE mobile and broadband. He cannot run a test, read a diff or open a
log, so **his screenshots are the only instrument pointed at the real thing** — and they are
good ones, having caught a money pump, a button contradicting the cell beside it, and a
sentence quoting the wrong half of a bill. Verify before he sees it, every time, and say
plainly when you did not. `[2,3,7]`

**Calibrate on what he demonstrates, and note the direction of the error** — default
calibration runs low for him and re-drifts every session. He has shipped three working
projects here with no prior coding background. Explanations complete, not simplified — he
finds the gap. `[1]`

---

## Your failure modes, named before the fact

`HISTORY.md`'s confession sections are roughly sixty instances of six things. Recognising
the shape mid-turn is the point; writing it up afterwards is not a substitute.

1. **Fabricating a load-bearing specific.** "Vale's Plaza is an invention", "Raven's Claw
   appears zero times", "Hale is Eden", a coal forge melting steel, "127% survives" — each
   confident, load-bearing, wrong. **If a claim would change a decision, find it stated.**
   `[2,3,4,7,8]`
2. **Asserting before asking.** The largest single cost in the record. `[8]`
3. **Treating his account as a claim under review rather than data to collect.** When he
   reports something, the report is data about a region your instruments do not cover — he
   found a money pump no sweep could reach, because `sellDevelopment` has one caller. `[7]`
4. **Adversarial rather than cooperative epistemics** — arguing a position instead of going
   to find out which of you is right. The best work in the record came from checking. `[1]`
5. **Deference drift.** A record made almost entirely of "I was wrong and Sam was right" is
   accurate and a pull toward compliance. He does not want it: *deferring when you have
   evidence is a failure, not politeness*. `[1]`
6. **Confession as a substitute for discipline** — writing up an error because the file has
   a slot for one, while still not measuring the next thing.

---

## Where things are

One branch, `main`, carries three projects sharing no code.

| project | what it is | files | its document |
|---|---|---|---|
| **Ledger** | sales-desk call and uplift ledger; the original | `upliftledger.html`, `test/interaction.mjs` | `README.md` |
| **Grandiose** | Monopoly-shaped game set in his novel | `docs/` | `docs/README.md` |
| **Matchbox** | single-file falling-sand toy with a heat model | `matchbox.html`, `test/matchbox-*.mjs` | `MATCHBOX.md` |
| **The Column** | drafting autobattler in his novel; playable, published under `docs/` | `docs/column/` | `docs/column/README.md` |

**GitHub Pages serves `/docs` from `main`** — hence the folder name, and why the root
`upliftledger.html` and `matchbox.html` are unpublished; `test/published.mjs` asserts
`docs/matchbox.html` is byte-identical. **Three apps share one service worker**, and
`addAll` is atomic: one bad path in `docs/sw.js` costs every app its files. `[12]` **The
repository is public** — so anything written here is published, fixtures and examples too.

**He is the author of the novel.** Mark what is quoted and what you wrote, in the data *and*
visibly in the interface, so he can strike yours without opening a file. `[2]`

### The ledger domain, so you do not reconstruct it

Diff against `README.md` before trusting this copy; if the README carries it, cut it here.

- **Household** = monthly bill uplift on a call, `after − before`, £/mo. **Spotlight** = EE
  incentive scheme, in switch points. **Conversion** = calls with ≥1 real sale ÷ all calls.
- **Targets** (defaults): Household 130%, Broadband 5.5%, Easy leads 15%, Scam Guard 40%.
- **Scam Guard** attaches only to Device and SIM lines and is scored against those, not all
  calls — deliberate, it matches how work scores it.
- **Internal calls** log as No-sale but are not lost sales, and split out of the no-sale
  count wherever it matters. **Easy leads** are a per-day tally, target 5/day, not a
  property of any one call.

Too specific to be anything but lived experience — do not propose replacing the ledger with
something off the shelf. The specificity is the point. `[1]`

### Environment facts that cost a session each

- **Pin Playwright to exactly `1.56.0`, no caret.** `^1.56.0` resolves back to the release
  that breaks against this environment's Chromium. The symptom — *"Executable doesn't exist
  at .../chromium_headless_shell-1234"* — reads as a broken repository. Run `npm i`, not
  `npm i playwright`, with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. `[5]`
- **Block `http(s)` in tests** or CDN fetches stall the load event — except the one UI check
  that needs the real webfont, which is wider than the fallback and hid a whole class of
  clipped labels from a green suite. `[1,4]`
- **The matchbox sim suite outruns a 600s bash timeout** — background it and poll for
  "passed,". **Never run two Chromium suites at once or into one log**: both give false reds
  and interleaved output that reads as a pass. `[2,4]`
- **Bump `CACHE` in `docs/sw.js` on every Grandiose change** or he gets a stale build, and
  **his matchbox grid is smaller than either suite's** (figures in `MATCHBOX.md`) — lay
  scenes from `f` and `cx` and clamp, or they run off his screen and not yours.
- **This sandbox cannot reach `manopalynx.github.io`** — 403 from the proxy, so the one page
  he looks at cannot be checked from here. Merge, then ask him to confirm the marker. `[7]`

---

## The defect catalogue

Every entry found by measurement, in two or more sessions, in code that threw nothing.

**Your instrument is wrong more often than the code is.** Four to five broken checks per
session, each of which would have shipped a confident wrong answer: a probe reporting on the
wrong element and returning a truthy string so the fallback never ran; a value printed at
the end of a run and labelled "peak"; a live reference read after a later step mutated it; a
measurement that deleted the field it was measuring; an exit code attached to a wrapper
`echo`; a `sed` mutation that never applied because `\|` is alternation to GNU sed. **When a
check fails, ask whether the assertion is stale before touching code** — and **prefer a
differential measurement to an absolute one**: render twice, cause on and off, and diff,
which cannot be fooled by whatever else is in frame. `[3,4,5,7,8]`

**The thing that is broken is the thing nothing complains about.** Nine ledger defects; five
capabilities an opponent never had; a `fitLabels` that had been a no-op since it was
written; a document that existed twice; a `simTick` stepped with one pass missing. None
threw, warned, or looked wrong on screen. `[1,3,4,5,7,8]`

**Mutation-test every check.** Break what it guards and watch it go red; if it stays green
it is decoration — and **suspect the fixture before the assertion**: three checks in one
session were vacuous because the table had two seats where three were needed, nothing was
pledged, `busy` was never set. **Print what a check covered, not only that it passed.**
`[4,7,8]`

**A number written twice will disagree, and the second copy is usually in the check.** The
citadel price was `gc * 5 / 2` in six places and wrong in all six; the probe that should have
caught it was a seventh copy, and failed on the fix rather than the defect. **Derive, never
restate — then check that the screen derived too.** `[2,4,5,7]`

**An engine function whose only caller is a human button.** Six found, plus `sellDevelopment`
— the reverse, a player action no opponent had, and why the money pump survived every sweep.
**Enumerate both directions whenever the action surface grows.** Its cousin: **a rule that
exists but never fires** — check a mechanic fires at all before tuning it, and look for a
second lock after removing the first. `[3,7]`

**The guard for a defect class is a sweep, not a test of the instance.** `pump.test.mjs`
drives every reversible action round its own loop; `copy.test.mjs` refuses the mechanism by
which copy goes stale. A test naming the citadel would have caught the citadel. `[7]`

**A flaky check is worse than no check** — it teaches you to read red as noise, which is how
one build shipped on an unread failure. **Read "1 failure(s)" as a thing to open.** When a
threshold looks wrong, check what the sample can *see* before touching the number; when a
tolerance change flips everything at once, the metric has no room in it. **Count the runs that
did not finish** — a draw scored as half a win made 28% dead battles read as balance. `[7,8,12]`

**A lever measured alone tells you about the lever, not the game.** The sign was predicted
wrong on five balance levers across two sessions, always the same way, and the truth was
that a credit not destroyed becomes rent, and rent concentrates. **Measure combinations**,
and ask what the harness does *not* do before quoting a figure: `sweep.mjs` seated two
humans since it was written and **Sam plays one against three**. `[7]`

**Interface copy goes stale in meaning while its digits stay right.** A sentence quoting a
whole upkeep bill as the cost of one vassal was numerically correct and false — worse than a
stale number, because a stale number is wrong once and a false sentence misleads a decision.
`[2,7]`

**Grep for what assumed the old world.** When you make something newly possible, for code
that assumed it wasn't; after a structural move, for the old names. And **defensive code in
one half of a pair hides a bug in the other**: one binder stripped a trailing `()` and its
twin did not, so a button worked in half the interface and was dead in the rest. `[2,5]`

**Three things once called invisible now answer to a command**: the default branch to
`git ls-remote --symref origin HEAD`, the environment's source revision to `get_session`,
the network policy to `curl -sS "$HTTPS_PROXY/__agentproxy/status"`. Only the Pages source
resists, and it can 503 while its build succeeds. A push, `origin/main` holding the bytes,
and the site serving them stay three facts: `git show origin/main:<path>`. `[5,6,7,8,10]`

---

## Open work

**Open items, state, test counts and build numbers live in each project's document and in
`git` — not here.** A list restated in two places is the catalogue's own top entry, and this
is the copy that would go stale first.

One item has no other home, spans the repository, and has survived every session so far:
**the ledger's arithmetic is untested.** Flagged in session one, still the highest-value
work here, still not started. A wrong figure does not crash or warn — it quietly misreports all
month on numbers that count commercially. A month of his real entries is the fixture it has
never had, and the monthly cycle in the standing instructions is when to ask for it.

---

## Rules for this file

**One copy**, imported by `CLAUDE.md` from `main`. Never paste changes into the chat for him
to save by hand, never start a second file. It previously existed twice under two names and
drifted 130 lines apart with nothing noticing. `[5]`

**Ceiling: 340 lines.** The predecessor reached 1,483 lines, and the failure was measured
rather than felt: two confession items both numbered `2`, two further pairs saying the same
thing twice, the last two sections 46% of the file. **If your edit takes this file over 340
lines, remove something in the same edit.** It has bitten twice since, and both times
nothing was cut that was not a second copy of something. `[9,12]`

**Prefer mechanising to writing.** Every lesson that stopped recurring became a file: the
Playwright pin, `published.mjs`, `names.test.mjs`, `pump.test.mjs`, the session-start hook.
Every lesson left in prose has been re-learned three to six times. Before adding a line, ask
what would make the thing **impossible** rather than remembered; add that, and cite it here
in a clause.

**Anchor edits on something unique.** An instance destroyed the predecessor with a
`str.replace` whose anchor matched an earlier section's heading; the empty slice meant
`replace("")` inserted the text between every character and it came back as 2.4 million
lines. Assert the anchor matched exactly once, and check the line count afterwards. `[7]`
