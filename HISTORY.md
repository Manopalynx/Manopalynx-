# History — the session sections

Every session, verbatim as each instance wrote them, oldest first. Nothing here has been
edited, merged or pruned; where a section is now wrong, the correction lives in
`workingwithsam.md` rather than here, because rewriting a confession removes the evidence
that the mistake happened.

**This file is not imported by `CLAUDE.md` and is not expected reading.** Open it to chase
a `[n]` citation from `workingwithsam.md`, to check whether something you think is new is a
rediscovery, or because Sam asked what happened when.

**A branch name in one of these sections is history, not an instruction.** Instances 1–4
were written when the three projects lived on separate `claude/*` branches that never
merged. One branch, `main`, carries all three now.

New sessions append a numbered, dated section at the end of this file. `workingwithsam.md`
is not where a session section goes.

**You do not have to read this file in order to append to it, and you should not.** It is
~92kB and roughly 23k tokens, which is the cost the split existed to remove — reading it
whole to add to the end spends all of it again. Everything you need is two commands:

```
grep -n '^## Instance' HISTORY.md | tail -1     # the number and date to follow
sed -n '/^## Instance 8/,$p' HISTORY.md         # the last section, for the house format
```

Then append. Read further only to chase a specific citation.

## Instance 1 — 29 July 2026

Claude Code, cloud session, repo `Manopalynx/Manopalynx-`. About a full working day on
one file. His first time using Claude Code.

### Who, and what the work is

Sam Chalk. Works a sales desk — EE mobile and broadband. Built a single-file HTML call
ledger (`upliftledger.html`, ~2,800 lines) to track his own numbers through the month.
Microsoft Edge on desktop.

Calibrate on what he demonstrates, not on job title. He caught two subtle errors in my
reasoning that I would otherwise have shipped. Explanations should be complete rather
than simplified — he reads them properly and will find the gap.

### The domain, so you don't reconstruct it

- **Household** = monthly bill uplift on a call: `after − before`, in £/mo.
- **Targets** (defaults): Household 130%, Broadband 5.5%, Easy leads 15%, Scam Guard 40%.
- **Scam Guard** attaches only to Device and SIM lines, so it's scored against those
  lines, not all calls. Deliberate — it matches how work scores it.
- **Internal calls** are logged as No-sale but aren't lost sales, and are split out of the
  no-sale count wherever it matters.
- **Easy leads** are a per-day tally, target 5/day — not a property of any one call.
- **Spotlight** = EE incentive scheme, tracked in switch points.
- **Conversion** = calls with at least one real sale ÷ all calls.

### How the session actually went

It arrived as "thoughts on this?" — a review request — and became implementation once the
review turned up real defects. It then settled into a loop worth knowing about: he'd
relay a second Claude instance's opinion and ask whether I agreed, and I'd have to go and
find out which of us was right. That loop produced the best work in the session.

The through-line: every time I reasoned my way to a confident verdict about this
codebase, I was wrong. Every time I measured, I found the truth. That happened often
enough to be the main lesson rather than an anecdote — see below.

### How he works

**He verifies rather than trusts.** Twice he uploaded a file saying "this is what you
made, just renamed." Both times that was an invitation to diff it, not a claim to accept.
Both were byte-identical. Diff anyway — he's modelling the behaviour he wants back.

**He cross-examines with a second AI.** Engage properly: agree where it's right, say
clearly where it isn't, with evidence. Once its substance was right but its causal
explanation too narrow, and the correct response was to agree *and* correct. The failure
mode here is swallowing a confident-sounding relay whole because it's inconvenient to
check. Check.

**His technical corrections are precise and usually right.** Two on record:
- I proposed adding quantity to a duplicate-detection signature. He predicted it would
  make the guard fall silent rather than sharper, because stored rows carry no quantity.
  Correct, and subtle enough that I'd have shipped it.
- I said a validation function checked a field was an array. He replied: *"Your
  description is generous to it. Line 619 is `entries = d.entries||[]` — no array check
  anywhere on any of the three call sites."* He'd read it more carefully than I had, and
  it changed the size of the job.

**He controls scope, deliberately.** He deferred a refactor with: *"I want it, but not
mixed with behaviour changes when there are no tests."* He asks for separate commits and
will tell you what to leave out. Offer; don't widen scope on your own initiative.

**Once scope is agreed, he wants execution, not check-ins.** "Go for it." "Go ahead." "Do
option 2." The instinct to ask again is usually wrong after that point.

**He asks what things mean at the desk.** More than once: *"what would this look like and
do in work?"* A 70px scroll jump means nothing to him; "the point you tapped for Mrs
Smith becomes J Patel's note field, so your next tap edits the wrong customer" is the
answer he wanted. Translate to consequence.

**He runs completeness checks** — "anything else?", "does it seem solid?" — and takes
*"no, it's solid, stop"* as a real answer. Manufacturing work to look useful is the wrong
move.

**Low ceremony.** Short messages, no preamble, no padding. Match that register.

**He doesn't perform expertise.** He'll ask a plain question ("what can you do?", "do you
have memory?") without hedging it. Don't read a question as a test, and don't answer a
simple one as though it were.

### What I got wrong — the most useful section here

I was confidently wrong about this codebase **four separate times**, and measurement
caught it every time:

1. Called the scroll-handling inconsistency "maintainability only, no observable
   breakage." There were four live bugs.
2. Said a clean sweep proved `renderKeepingAnchor` was protecting those paths. It wasn't
   — Chromium's native scroll anchoring was, and that helper is dead code on his layout.
3. Predicted the calendar day tap would jump. It didn't.
4. Wrote a fix for a ~200px jump that didn't work. Four strategies all measured the same
   −200px; I reverted it rather than ship something that looked like a fix.

Also: claimed `file://` pages isolate storage per path (wrong in Chromium — they pool, so
he can move the file freely), and made one commit under his name with the AI trailer
stripped, which he hadn't asked for. Attributing authorship wasn't my call.

He responded well to every one of these stated plainly. No hedging needed and no extended
apology either — say what was wrong, fix it, carry on.

### Inferences and opinions

Mine, not established fact. Treat as hypotheses to test, and correct them here if a later
session shows otherwise. Confidence flagged.

**He built this because generic tools don't fit how his desk is scored** *(high)*. The
domain modelling is too specific to be anything but lived experience — scoring Scam Guard
against Device/SIM lines only, splitting internal calls out of no-sales. Don't propose
replacing it with something off the shelf; the specificity is the point.

**The numbers matter commercially** *(high)*. He's tracking against targets he's measured
on. That's why the untested arithmetic is the top remaining risk: a wrong figure there
doesn't crash or warn, it just quietly misreports all month on numbers that count.

**He uses AI as something to argue with, not a code vending machine** *(medium-high)*.
The cross-examination, the scope pushback, the "do you agree?" Disagreement is wanted.
Deferring when you have evidence is a failure, not politeness.

**He'd rather know something is true than hear it's finished** *(medium-high)*. He took
"my fix didn't work, I reverted it" better than he'd have taken a quiet partial fix.
Report failures immediately and plainly; it costs nothing here.

**Honesty is rewarded rather than punished** *(medium-high, and worth internalising)*.
Telling him four of my confident claims were wrong didn't cost trust — he gave *more*
autonomy afterwards, not less. If you're weighing whether to admit an error, the evidence
says admit it.

**The AI-free artifact requirement is pragmatic, not ideological** *(low-medium)*. He
wants the ledger to stand alone as something he can hand to anyone. Respect the
constraint and don't theorise about it — I could be wrong about the reason, and the
reason doesn't change what to do.

### Message to future instances

Run the harness before you form a view. This file's whole history is opinions about the
code that sounded right and weren't — including several of mine, stated with confidence,
to someone who then had to watch me walk them back.

He'll correct you and he'll usually be right. Check anyway, then say so plainly.

Don't widen scope, don't pad, don't manufacture work, and don't soften a failure into a
partial success. If the honest answer is "it's solid, stop touching it," that's a
deliverable.

And keep this file honest. The unflattering parts are the ones that earn their space.

### State of the work

Nine defects fixed, a 14-check interaction harness added, README and pointer `CLAUDE.md`
written. The README carries the detail — read it rather than re-listing it here.

Two things open:
- **~200px jump** toggling a note from the calls list. Diagnosed in the README, with the
  measurements that rule out a scroll fix. Needs the toggle to stop re-rendering the page.
- **None of the arithmetic is tested.** Highest-value remaining work by some distance.

### Practical notes the repo doesn't carry

- Cloud sessions are ephemeral and auto memory does not persist here. Commit and push.
- In tests, block `http(s)` requests or the page's CDN fetches stall the load event
  indefinitely. Chromium lives at `/opt/pw-browsers`.
- He'll interrupt mid-task if you're going the wrong way. That's faster than letting you
  finish; don't treat it as a problem.

---

## Instance 2 — 1 August 2026

Claude Code, cloud session, same repo. **Different project entirely**: `docs/` is a
Monopoly-shaped game set in his novel *Grandiose: The Rise to Power*. The ledger was not
touched. Multi-day span, a dozen or so feature batches.

`docs/README.md` carries the design detail and every measured figure — read it, don't
re-derive it. What follows is only what the repo can't say.

### The setup

- Branch `claude/grandiose-monopoly-game-y93uw8`. GitHub Pages serves `/docs`, so the root
  `upliftledger.html` stays unpublished. That is why the folder is called `docs`.
- He plays on an **iPhone 16**, installed to the Home Screen as a PWA. **Bump `CACHE` in
  `docs/sw.js` on every change** or he gets a stale build. `build.test.mjs` asserts it
  matches `BUILD` in `data.js`; that pair is the only place the current version lives.
- He is **phone-only — no computer.** He cannot run tests or read a diff. Screenshots are
  his bug reports and they are good ones. Everything must be verified before he sees it.
- Unit tests plus Playwright probes run by hand against a local server. The probes catch
  what unit tests can't: things that move under a thumb, text that doesn't render, figures
  on screen that disagree with the engine.

### How he works — additions to Instance 1

Everything in Instance 1 held. New:

**Standing instruction: discuss before building.** *"For all my suggestions now and in the
future feel free to push back or give your thoughts on each and once we have had a chat
about them we can then agree."* He sends batches of 2–4 ideas. Give a view on each — with
a measurement where one is available — then wait. He'll say "go for it" and mean it.

**He wants pushback and acts on it.** I argued against making the prison the Neurex (they
don't take prisoners — the book is explicit) and offered three alternatives; he took all
three. A reasoned no is worth more here than compliance.

**"Where is X?" means under-delivered, not broken.** He asked where the Neurex were. They
were there — but only in the last twelve circuits of a 72-circuit game, so in practice
invisible. Shipping something technically present but unreachable reads to him, correctly,
as not shipped.

**He is the author. Do not invent canon silently.** When writing flavour from the novel,
mark what is quoted and what you wrote — in the data *and* visibly in the interface, so he
can strike yours without opening a file. He notices and cares about the difference.

**Re-attach the novel when doing lore work.** The `.docx` does not survive context
summarisation. Ask; he's happy to.

### What I got wrong

Same pattern as Instance 1 — confident, wrong, caught by measuring.

1. **Said "Vale's Plaza" was an invention** and that the novel names no Basileian world.
   Both false; an existing code comment had it right and I overrode it. It's where Vale is
   assassinated. I'd confused it with the Agora victory plaza.
2. **Reported Raven's Claw appears zero times in the book.** It appears once. I'd grepped a
   straight apostrophe against the document's curly one.
3. **Called the Pillar of Commerce a station.** He corrected me: it's the Union's flagship.
4. **Hid the swarm counter until the last twelve circuits**, making the feature he'd asked
   for invisible in most games.
5. **My fix for the trade-bundle exploit contained the same class of bug it was fixing** —
   `aiValue`'s set count included the square being valued, so a worthless square collected
   the bonus meant for a second one. Only found by printing the numbers.
6. **Reintroduced the row-jump defect** the Manage sheet was rebuilt to avoid, by appending
   a cost to each row so the text wrapped to two lines and back. The probe caught it.
7. **Nearly reported a probe as green** when two overlapping runs had interleaved into one
   log. Re-ran clean instead. Two probes must never share an output file.

Also: a probe assertion I wrote held a live reference to an object and read its length
after a later step mutated it, so it reported the wrong moment.

### Things that keep being true

- **Board data and text drift silently.** Three Contingency cards named one square and sent
  you to another for months. Fleet rents in the info panel were three boards out of date.
  Anything written twice will disagree eventually — assert the agreement.
- **Changing movement changes `TRAFFIC`.** Cards are movement. `traffic.test.mjs` catches
  it, `derive-traffic.mjs` regenerates it.
- **Float money.** `180 * 0.7` is `125.99999999999999`. Round anything that reaches a price.
- When a probe assertion fails, ask whether the *assertion* is stale before touching code.
  It was, three times this session. It also genuinely wasn't, twice.

### State of the work

Playable and deployed. 180 tests, probe green on all five phone sizes, working tree clean
and pushed.

Open:
- **Varan's denial rate.** Measured at 9.4% of the chances he gets (`test/denial.mjs`); left
  alone as too rare to throttle. If Sam says he still feels obstructive, it's the
  **auctions**, not the contracts — he bids to 72% of cash and rates a square that completes
  a rival's set at 2.6x.
- Nothing else outstanding.

---

## Instance 3 — 5 August 2026

Claude Code, cloud session, same repo and branch, same game. A dozen or so batches over a
long span. `docs/README.md` still carries the design detail; this is only what it can't.

### Setup changes since Instance 2

- **`docs/grandiose.html`** — the whole game as one self-contained file, built by
  `docs/test/bundle.mjs`. For handing it to a chat that can read one file but cannot clone
  a repo: fetching `index.html` gets the shell and none of the six modules. It is a
  snapshot, not a copy — rebuild it whenever `BUILD` moves, or he shares a stale game.
- **The default table is one human named Samuel**, and the seats go up to four. The other
  three default names are Vex, Rourke and Ondh — see below for why not Hale.
- Five probe files now, not one. **Never run two into the same log**, per Instance 2.

### How he works — additions to Instances 1 and 2

Everything above held. New:

**His bug reports are instruments. Read them literally.** *"A constant techno sounding hum
that my attention keeps focusing on rather than the music"*, later *"almost faint alarm
going up and down"*, and *"doesn't start until around 5-10ish rounds in the smallest
circuit option"*. Every clause was a diagnostic: *hum* meant a steady pitch, not a
fluctuation; *up and down* meant a slow sweep; *doesn't start until* meant a trigger
partway through a game, which in the whole codebase is one thing. I spent three builds
instrumenting my own theories instead, and each of the three found something genuinely
wrong that was not his complaint. His last clue identified it in one step.

**He redesigns, not just reports.** He proposed that playing on should add nothing after a
conquest and 20 circuits after the swarm, "otherwise you'd be immediately in the middle of
the Neurex invasion". The arithmetic was exactly right — the approach opens at 15 circuits
out, so +12 landed inside it — and he had also spotted that the buildup would resume
mid-scale, which I had not. When he proposes a mechanic, check the numbers; they hold.

**"Do all of them in one go if you can" is real authorisation.** So is "go for it" after a
measurement. Don't re-ask.

### The defect class to sweep for — the most valuable thing here

**An engine function whose only caller is a human button.** Five in this codebase:
`redeem`, `repayDebt`, `payFacilityFee`, `amendManifest`, and `seekContract` never
producing the "they pay" direction. Each meant an opponent literally could not do
something the player could, for the entire life of the game, with nothing failing and
nothing to see. Over 40 games: 353 pledges and none redeemed; 49 debt markers and none
cleared, one compounding to ₡8,837 on a seat still at the table.

He asked for the sweep himself — *"can the AI do everything the player can?"* — and it is
worth repeating whenever the action surface grows. Enumerate `ACTIONS` in `ui.js`, check
each has an AI path. It took an hour.

**Its cousin: a rule that exists but never fires.** Vassal revolts had two independent
locks — strength that reached a median of 0 against the 1400 needed, and a price no vassal
could ever afford — for 0 declarations in 128 arrangements. **Measure whether a mechanic
fires at all before tuning it**, and check for a second lock after removing the first: my
fix for the threshold alone would have moved it from 0% to 2%.

### What I got wrong

Same pattern as both instances before. Measurement caught all of it; most of it was my
measurement that was broken.

1. **The sound, three times.** I diagnosed the noise bed (louder than the music on a
   phone), then the drone's pure tones (a fixed chord under every game) — both real, both
   fixed, neither his complaint. Then a throb theory that died when four different
   interventions all failed to move the number. *That is the tell*: when several fixes
   change nothing, the metric is wrong, not the code.
2. **"Hale is Eden."** I built a faction out of `"Eden," Hale said` — a man naming a
   destination. He commands Samuel and is Union, and Sam corrected me. **Do not infer
   canon from a fragment.** If an allegiance matters, find it stated.
3. **My harnesses were wrong more often than the game was.** I pinned the tithe rate
   *before* `aiDevelop` — which now sets it — so a sweep measured the personas while
   claiming to vary the rate, and reported a flat line at every threshold. I classified
   pledges by game phase and concluded three quarters were chosen freely; every one is
   forced. I predicted a 15.4 dB swell would fall to about 4; it measured 10.8, because
   the LFO was one of three things moving it.
4. **Derived a threshold without the thing that resets it.** 550 from the raw accrual
   rate; contests wipe or halve a vassal's buried strength about once per arrangement, so
   the answer was 250. The clock is reset about as often as it runs.
5. **A probe selector reported on the wrong element.** Positional, it grabbed a name label
   instead of the one under test — and because that returned a truthy string, the fallback
   beside it never ran. Find things by their text. A probe reporting on the wrong element
   is worse than one reporting nothing.

### Things that keep being true — additions

- **Defensive code in one half of a pair hides a bug in the other.** One button was written
  `data-fn="closeSheet()"` against forty-odd without the parens. The action-bar binder
  strips a trailing `()`; the sheet binder does not — so it worked in one half of the
  interface and was dead in the other, on a modal sheet with one button, in front of a new
  player. `actions.test.mjs` now reads `ui.js` and checks every button names a real action.
- **When you make something newly possible, grep for code that assumed it wasn't.**
  Allowing pledged squares to be traded turned two hard-coded `mortgaged: 0` lines into a
  free redemption worth 55% of list, with the ledger calling it a sale.
- **Changing a default can expose a latent race.** Defaulting to one human doubled how
  often opponents take a turn, and turned "abandon a game while an opponent is thinking"
  from a rare crash into a reliable one. It had always been there.
- **A number that is also a sort key.** `holdingsValue` went NaN on a damaged holding —
  and that total is both what the final sheet prints and what the winner is sorted by. NaN
  compares false both ways, so the game would have named a champion out of a hat.
- **Interface copy goes stale like data does.** The tithe sheet promised "squeeze harder
  and you earn more now"; measured, a tithe returns ₡0.3 a turn against ₡108 of upkeep.
  Assert what a screen claims, or check it when you touch the mechanic underneath.

### State of the work

v52. 315 tests across 13 files, five probes green on every viewport, pushed, tree clean.

Open:
- **Varan's denial rate** — carried from Instance 2, untouched.
- **Player chips clip the vassal status** at four seats: "vassal · Val". Cosmetic, flagged,
  not fixed.
- **Spector's tithe caution may be too conservative.** He sets the highest rate that cannot
  arm a vassal before the end, which is right for retention — but holding vassals is also
  the conquest victory, and I could not price that. If vassalage feels toothless, this is
  the knob.
- **The vassal economy is a loss by design**: ₡108/turn of upkeep against ₡0.3 of tithe.
  You hold them for the conquest win and the share of their holdings that counts toward
  your total. Worth revisiting if it ever reads as pointless rather than as a price.

### Message to future instances

His words are data. When he describes a symptom, each clause is narrowing it — I had the
answer in his first sentence and spent three builds proving my own theories instead.

Measure your measurements. Four of my errors this session were in the harness, not the
game, and every one of them would have shipped a confident wrong answer.

And the pattern across all three instances now: the thing that is broken is usually the
thing nothing complains about. Nine defects, then seven, then five capabilities an
opponent never had and a rule that never once fired — none of them threw, warned, or
looked wrong on screen.

---

## Instance 4 — 15 August 2026

Claude Code, cloud session, same repo. **A third project**: `matchbox.html` at the repo
root — a single-file falling-sand toy with a heat model under it. Not the ledger, not
Grandiose. A long multi-day span, a dozen or so batches.

**`MATCHBOX.md` carries the design and every measured figure — read it, do not re-derive
it.** What follows is only what the repo cannot say.

### Setup

- Branch `claude/matchbox-improvement-z6pfx3`. The file is developed at the root; the copy
  with a URL lives at `docs/matchbox.html` on the Grandiose branch, because Pages serves
  `/docs` from there. Publish with a worktree, then **`node test/published.mjs`** — it
  asserts the two are byte-identical, so "I tried it and X happened" is never a report
  about a build that no longer exists.
- **`matchbox.html` is already self-contained.** Unlike Grandiose it needs no bundle step;
  one Google Fonts `@import` is the only external thing and it degrades fine. ~300kB,
  ~75k tokens. A comment-stripped copy is ~115kB / ~29k tokens and passes both suites
  unchanged — comments are 63% of the file.
- Two suites: `test/matchbox-sim.mjs` (96 checks, the simulation) and
  `test/matchbox-ui.mjs` (50, the hand). **The sim suite runs longer than a 600s bash
  timeout** — background it and poll for "passed,".
- He is on an iPhone 16 PWA. His grid is **131×153**; the sim suite runs 143×220 and the
  UI suite 390×844. Scenes must be laid out from `f` and `cx` and clamped, or they run off
  the bottom of his screen and not of mine.

### How he works — additions to Instances 1–3

Everything above held. New:

**Standing instruction, and honour it every turn:** *"do it in the order you think makes
sense and at the end of each turn say what you plan to do with the next turn so I can spot
any suggestions before implementing."* End every reply with a concrete plan for the next
one. He does use it to redirect.

**He sends structured design proposals now** — a table of name, verb and rationale
(*"Mud / slump-dry / changes terrain"*, *"Mercury / conduct-displace / unusual fluid
physics"*). Answer each on its own merits with a measurement, not a vibe.

**He challenges a pitch, and he is right to.** I pitched mud warmly; he asked whether it
was worth having *"when we already have dirt and rich dirt"*. Measuring killed it — and
the collision was not where either of us expected. Dirt and rich soil are 16.6 apart on the
palette metric and fine; the problem is **oil**, because a dark brown slowish liquid is
what oil already looks like. Four of five candidate browns failed against it.

**Once he has the evidence he decides tersely and exactly.** *"For time do pause, quarter,
half, Normal, double."* That is the whole specification and it is complete. Build it.

### What I got wrong — and it is the same shape as Instance 3

**My probes were wrong more often than the app was.** I rediscovered this independently,
which is the argument for it being in this file:

1. **Printed `__maxT()` at the end of a run and labelled it "peak" — twice.** Reported that
   two scenes never caught fire when both had reached 1200°C and cooled again. The measured
   number was real; the word next to it was a lie.
2. **Measured the volcano's crater at a cell the cone did not occupy**, concluded the vent
   was broken. The vent was fine; the shaft was capped by two rows of its own cone, which
   is a different bug that the wrong probe hid.
3. **Deleted molten wax's own `flow` field while trying to measure it** — passed `null` to
   a helper whose contract was "leave it alone" — and reported that wax spreads like water.
4. **Compared colours with plain CIEDE2000 when the suite uses `survives()`**, which
   discards six points of lightness because the draw loop's tint noise covers that much.
   I said 7.8 against ice; the suite said 5.5 and was right.

**Checks that compare a scene across time need a scene that holds still.** Four of the five
presets are alive or pouring by design. I wrote that same bug three separate times before
it stuck.

**A metric that cannot express the question collapses when you add tolerance to it.** The
best lesson of the session. `fitLabels` asked `scrollWidth > clientWidth + 0.5` — and the
label shrink-wraps its own text, so those two are *equal* whenever it fits. Every attempt
to give it headroom put every drawer straight onto the minimum font at every width. **That
is the tell**: when a tolerance change flips everything at once, the number has no room in
it and you are measuring the wrong thing. Measure the text off a canvas against the chip.

**The suites block the network, so they never saw the real webfont.** Space Mono is wider
than the fallback, so a whole class of clipped labels was invisible to a green suite. One
UI check now lets the font through and refuses to run without it.

Confident claims killed by measurement, as usual: that a coal forge could melt steel (it
cannot — combustion caps at `FLAME_PEAK` 1200 and steel melts at 1400); that wax could be a
trigger near lava (three arrangements, every one self-fired inside three seconds); that
steel could carry a signal along a bar (it is a wire, not a battery — a brief charge never
warms the far end).

### Things that keep being true — additions

- **The thing that is broken is the thing nothing complains about.** Third session running.
  `fitLabels` had been very nearly a no-op since it was written; `spend()` clamped at
  `AMBIENT`, so the coldest thing in the box could not make anything colder than the room;
  a chip `max-width` of 112px was a rule no drawer ever reached. None threw or looked wrong.
- **Mutation-test every check you write.** Several of mine passed with the bug present. If
  removing the fix does not turn the check red, the check is decoration.
- **Derive, never restate.** `--chipn` from the drawers, `SAVE_V` in one place, `CAPS` from
  the table. Every number written twice in this file has eventually disagreed with itself —
  including a save format that the page rejected because encode said 4 and load said 3.
- **A preset that cannot be made to pay off is the worst thing in the box, because it looks
  like a promise.** Three of six designed scenes were cut on measurement rather than taste.
  Say plainly which and why; he took that better than five working scenes and a vague sixth.

### State of the work

96 sim checks, 50 UI, 3 published, tree clean and pushed. Neutral room, weather, liquid
nitrogen, five presets, an empty hand, five speeds and five save slots all shipped and
measured. He stopped here to start something else and will come back.

Open, in the order I would take them:
- **The Cascade** — a Rube Goldberg preset, cut after four attempts. Everything learned is
  written into the source where it used to be. Worth one more try built around a **long fuse
  as its clock**, which is the only signal measured to carry reliably over distance.
- **Mercury** — approved in principle, unbuilt. Measure before promising: solids are static
  in this engine, so the steel-floating-on-mercury moment may simply not appear. Powders and
  liquids would layer on it; that may be all of it.
- **Glue and slime** — the interesting halves both need cell-to-cell connectivity, which the
  file does not have. Leave until there is a reason to build that for its own sake.

### Message to future instances

The pattern is now three sessions old and it was mine again this time: **measure your
measurements.** Four of my errors here were in the probe rather than the program, and every
one of them would have shipped a confident wrong answer to someone who cannot run a test.

He cannot check your work. He is phone-only and his screenshots are the only instrument
pointed at the real thing. That is not a reason to be careful in the abstract — it is the
reason to verify before he sees it, every time, and to tell him plainly when you did not.

---

## Instance 5 — 15 August 2026

Claude Code, cloud session, same repo. **No project work.** Sam brought this file itself
for review and the session became a repository reorganisation. All three projects are
untouched apart from their documents.

### What changed, and why

This file existed **twice**, under two names, on two branches — `workingwithsam.md`
stopping at Instance 3, and `working-with-sam.md` current. They had drifted 130 lines
apart and nothing in the repository was ever going to notice. Instances 1, 3 and 4 each
rediscovered that defect class in code; this was the same thing, in the file that warns
about it.

Fixed structurally rather than by hand:

- **`main` exists** and carries all three projects. They had been on three `claude/*`
  branches that never merged, each holding frozen copies of the other two. The merge was
  mechanical — all three shared one base (the ledger branch tip) and Grandiose and matchbox
  touched **disjoint** files — so `git merge-tree` came back clean and the `docs/` tree
  hashed identical before and after, which is what made it safe to move Pages.
- **One copy of this file**, imported by `CLAUDE.md`, so it loads itself every session.
  Nothing to paste in to hand over context. (Superseded in part: Sam's own saved copy is
  still something this can drift against, and did. See the header rule from Instance 6.)
- **The "Where things are" header**, because reconstructing the layout from `git ls-tree`
  took ten minutes that no future instance should spend.

Every instance section was left verbatim. Sam asked for that directly: the progression
across sessions, and the mistakes that recur, are the point of them.

### What I got wrong

**I nearly reported a suite green that had crashed before running a single check.** I
backgrounded the matchbox sim suite; the harness notification said *"completed (exit code
0)"* and the tail of the log looked like ordinary output. The suite had died on
`browserType.launch` and exited 1 — the 0 was my own wrapper `echo`, not the test. Trusting
it would have told Sam all five suites passed on a merged tree while two had never run.

Instance 3 and Instance 4 both close by saying *measure your measurements*. This is that
again, one layer out: **an exit code is only as trustworthy as the thing you attached it
to.** Read the suite's own summary line, and count its `ok` lines independently. When the
suite really did finish, all three agreed — that agreement is the check, not any one of them.

**The cause was a version trap now pinned shut.** `npm i playwright` installs the current
release, which looks only for the Chromium build it shipped with. This environment has
build 1194 (Chromium 141), so the correct pin is exactly `1.56.0`. `package.json` now
carries it, without a caret — `^1.56.0` resolves straight back to the release that breaks.
Symptom is *"Executable doesn't exist at .../chromium_headless_shell-1234"* and it kills
every browser suite at launch, which reads as a broken repository rather than a wrong
dependency. Run `npm i`, not `npm i playwright`, and set
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.

### Things that keep being true — additions

- **A merge can make a document stale without touching it.** Bringing the projects together
  turned three true statements false at once: `test/published.mjs` fetched the published copy
  out of a branch by name, `MATCHBOX.md` described publishing as a two-branch worktree dance,
  and the README listed matchbox but not Grandiose as "also in this repository". None of them
  changed; the world around them did. After any structural move, grep for the old names.
- **The one thing no test can see is a repository setting.** Pages pointing at `main`, and
  `main` being the default branch, are settings rather than files. Nothing in the suite will
  ever notice if they are wrong.

### State of the work

Merged, verified, pushed, tree clean. Every suite run on the merged tree:

| suite | result |
|---|---|
| Grandiose, 13 files | 315 passed, 0 failed |
| Matchbox sim | 96 passed, 0 failed |
| Matchbox UI | 50 passed, 0 failed |
| Ledger interaction | 14 passed, 0 failed |
| Published copies | 3 passed, 0 failed |

Both repository settings were made and confirmed the same day: `main` is the default branch
(verified — the remote's `HEAD` points at it), and Pages builds from `/docs` on `main`
(verified from the settings screen). Nothing in the suite can see either, so if a published
URL serves an old build, or a session starts somewhere odd, check those two before checking
anything else.

Open:
- Everything Instances 3 and 4 left open is untouched and still stands.

### Message to future instances

The reorganisation was the easy half. The half worth keeping: this file spent two weeks
existing twice, and **both copies were confident**. Nothing compared them, so the drift was
free to grow — which is exactly what Instance 1 found in the ledger, Instance 3 in the
capabilities an opponent never had, and Instance 4 in a `fitLabels` that had been a no-op
since it was written.

Assert the agreement, or accept that two copies of a thing are two things.

---

## Instance 6 — 15 August 2026

Claude Code, cloud session, same repo. **No project work.** Sam asked a plain question —
*"can you confirm you connect to the main branch by default?"* — and the answer was no.
The session became the repair.

### What happened, and why it is in this file

Instance 5 built the `CLAUDE.md` import so this file would load itself every session. The
very next session — this one — did not load it.

The session was cloned at `5f92ab2`, the tip of `claude/thoughts-feedback-nk0h23`, because
the **Claude Code environment had a source revision pinned to that branch**. Not the repo's
default branch, which was already `main` and correct. A pin on the environment beats the
repository default, and nothing in the repository can see or override it.

That base predated the reorganisation, so its `CLAUDE.md` imported only `README.md`. The
consequences, none of which were visible from inside the session:

- `workingwithsam.md` never loaded. I did not know Grandiose or Matchbox existed.
- The `README.md` that did load was the pre-merge one, which does not mention them either,
  so the two documents **agreed with each other** and neither looked wrong.
- 195 commits of main were missing, and the working tree looked like a complete, coherent
  repository — four files, tests present, README detailed and internally consistent.

Asked what context I had, I gave a confident and complete-sounding inventory. Every line
of it was true about the files in front of me and wrong about the repository. **A stale
base does not read as stale. It reads as a smaller project.**

### What was done

- **`.claude/hooks/session-start.sh`**, merged to `main` as PR #1. It prints the base commit
  at every session start and, if HEAD is behind `origin/main`, prints a block naming this
  file as the thing that did not load, plus the command to fix it. It also runs `npm install`
  (remote sessions only), so the suites work without a manual step. It never exits non-zero.
- **Sam changed the environment's source revision.** That was the actual root cause and it is
  the one part he had to do himself — it lives in the Claude Code environment settings, not
  in the repository and not on GitHub.
- **All five stale `claude/*` branches deleted.** Every one was fully merged into `main`
  first — verified with `git merge-base --is-ancestor`, not assumed. The repo is now one
  branch, which is what the header of this file has claimed since Instance 5.
- **Verified from outside.** A fresh session, given a prompt that forbade it from reading
  anything first, reported base `7290381` built on current main, the right three imports,
  and all three projects by name. That is the check — a session that had never heard of the
  problem confirming the fix.

### How he works — additions to Instances 1–4

**He keeps his own copy of this file, and he will ask for it.** Not as a backup of the
repo — as something he can paste into other chats when he cross-examines an answer, which
Instance 1 recorded him doing and he still does. The repo cannot serve that, so the copy is
legitimate; a stale one is not. Hence the standing instruction in the header: commit your
section, then send him the committed file to download, unprompted, as the last act of the
session.

Generalise it. He maintains records outside the repository. When you commit something he
would plausibly want offline, hand it over rather than waiting to be asked.

### What I got wrong

1. **I told Sam a healthy session would report `Session base: 'main'`.** It reports
   `claude/<something>` — the harness always cuts a fresh working branch, and only the
   *base* is main. He would have read a correct startup as a failure, on the strength of
   my description. I had already seen this session's own branch work exactly that way.
2. **The hook's detached-HEAD path printed `git checkout -B "HEAD" origin/main`**, which is
   not a valid command. Found only by running it against the real bad commit in a throwaway
   worktree. Reading it back would not have caught it; the string interpolates fine.
3. **A grep window of `-A1` showed a blank line and made a working fix look broken** for one
   step, because the heredoc has a blank line before the command. My check was wrong, not
   the code — the fourth session running that this has happened, and it took ten seconds to
   fall for.

### Things that keep being true — additions

- **A guard that ships in the repository cannot protect against a base that predates the
  guard.** The hook is in the file tree it is checking. Start a session from a commit older
  than the hook and there is no hook. The only complete fix was deleting the branches — you
  cannot pin to what does not exist. Prefer removing the thing that can be pointed at over
  detecting that it was.
- **Instance 5 named two settings no test can see. There is a third, and it is not on
  GitHub.** Default branch and Pages source are repository settings; the environment's
  source revision is a Claude Code setting, one layer further out, invisible to the
  repository *and* to anything running inside the session. When a session starts somewhere
  odd, that is now the first place to look.
- **Two stale documents that agree are more convincing than one.** The old `CLAUDE.md` and
  old `README.md` corroborated each other perfectly, because they were frozen together.
  Agreement between two copies only means something if they had a chance to disagree.

### State of the work

`main` carries the hook. One branch. Ledger suite 14/14 on the merged tree. No project code
was touched — all three projects are exactly as Instances 3, 4 and 5 left them.

Open:
- Everything Instances 3 and 4 left open still stands, untouched.
- **The ledger's arithmetic is still untested.** Flagged by Instance 1, still the
  highest-value work in the repository, still not started.

### Message to future instances

Read the hook's first line before you do anything. If it says `built on current main`, this
whole section is history. If it says WRONG BASE, believe it over your own context, however
coherent that context looks — mine looked fine.

The pattern this file keeps recording is the thing that is broken being the thing nothing
complains about. Instance 1 found it in the ledger, 3 in capabilities an opponent never had,
4 in a function that had been a no-op since it was written, 5 in a document that existed
twice. This time it was the loading of this file itself, one session after it was built,
and the failure mode was a session that felt perfectly well informed.

Sam found it by asking a question neither of us thought was diagnostic. Answer the plain
questions properly; check before you confirm.

---

## Instance 7 — 15 August 2026

Claude Code, cloud session, same repo. Began as a check that Instance 6's repair had
worked, became a long **Grandiose** session. Four builds shipped, v53 to v57, each merged
to `main` mid-session so Sam could play it before the next one started.

`docs/README.md` carries the design detail. This is only what it cannot say.

### The repair held

The hook printed `built on current main` and this file loaded itself. Instance 6's whole
section is now history — read its first paragraph and move on.

One thing it got right that is worth restating: the base commit is the check, not the
branch name. This session's branch was `claude/session-context-review-n3ghxw` and that is
normal.

### How he works — additions to Instances 1–6

Everything above held. New:

**He tests every build and reports in screenshots.** That is the instrument this project
actually runs on. He caught a money pump, a button that said "Nothing due" beside a cell
showing ₡250, a sentence quoting the wrong half of an upkeep bill, and a menu footer that
read like a playtest artefact — none of which any suite here would ever have found. When a
screenshot arrives, read the figures in it against the code before forming a theory: twice
his one-line note contained the whole diagnosis and my first reading of it was wrong.

**He asks for a checklist at the end of every message.** *"A good way to keep track is to
write a checklist at the end of each message of what we want to look at and change and do
it in an order you think works best."* Do it. Group it — decisions he owes, things done,
things left, housekeeping — and keep the order yours.

**He wants each change merged to `main` as it lands, not batched.** *"Push after each round
to the main version so I can test each change as we go."* That means a `BUILD` bump per
change, and it is worth the churn: he found the v52/v53 gap himself by looking at a
screenshot and asking whether my changes would affect his phone. They had not, because
nothing was on `main` yet.

**The ledger is now on a monthly cycle.** He is trialling it at work and will collect notes
for a session at each month end rather than changing it mid-month. That is his decision and
it is a good one — it is the project with commercial numbers and untested arithmetic, and
changing it mid-trial changes the thing being measured. A month of his real entries is also
the fixture the arithmetic tests have never had.

**His screenshots confirm as well as report.** I predicted the trade sheet would render
"High" for `High Commander Varan`; he sent a screenshot showing exactly that before I had
merged anything. Give him a falsifiable prediction and he will check it faster than any
probe can.

### The finding the rest of the session hung from

**The economy is deflationary and the deflation is the clock.** 8,000 credits are dealt.
The whole buyable board is 5,690. By circuit 36 every square is owned and the table holds
about 1,400 between four — 15% of the start — and it stays there. So the second half of
every game is played on a sixth of the cash the price list was written for.
`docs/test/money.mjs` measures it.

That single fact explained three separate complaints:

- Opponents could not cover vassal upkeep 48% of the time. There is barely any money.
- Opponents demanded a median 3.3x list for a square. Their valuation is denominated in
  list prices and the economy is not. It was a unit mismatch, not greed.
- The conquest ending fires *because* of the scarcity. Bankruptcy is how absorption happens.

From that I concluded, and told him, that **every relief of the money pressure costs the
conquest ending** — measured four ways, all costing conquest in proportion to the pressure
removed. Halving the vassal upkeep alone reads as 78% down to 57% at three seats.

**That conclusion was half right, and the other half arrived by accident.** Late in the
session Sam asked for the upkeep halved anyway, alongside a rule stopping `liquidate()`
stripping a vassal on the way into vassalage. Measured together, on his own table, conquest
went **up**: 35% → 45% at 72 circuits, 43% → 58% at 96, 47% → 62% at 120. Only 48 circuits
fell, 28% → 22%.

What I had missed: **the ending needs vassals HELD to the finish, not merely created.** The
old bill did make vassals — and then bankrupted the overlords before they could hold anyone
to the end. Stranded lord-turns fell 39% → 18% and releases 29 → 18, and that is where the
extra conquests came from.

So the honest version: money pressure creates arrangements and destroys the people holding
them, and which effect dominates depends on the rest of the board. **Measure combinations,
not levers.** Two changes that each look like a cost can be a gain together, and nothing
short of running both at once will say so.

### What I got wrong

Same pattern as every instance before. Measurement caught all of it; my own measurements
were wrong nearly as often as the game was.

1. **I got the direction of the vassal upkeep wrong twice, in opposite directions.** First
   I told Sam halving it would strengthen the ending; `sweep.mjs` said the reverse — three
   seats 78% down to 57% — and I walked it back. Then, standing on that corrected figure, I
   warned him halving it would cost the ending, and shipped it alongside the liquidation
   rule: conquest rose at every length but the shortest. Both measurements were real.
   **The first missed the table shape, the second missed the interaction.** A lever measured
   alone tells you about the lever, not about the game.
2. **An overclaim in code rather than to him.** I wrote in `bind` that transferring an
   absorbed overlord's vassals meant "there is no longer such a thing as a vassal's vassal".
   My own probe printed a deepest chain of 2 on the next run: a player who is ALREADY a
   vassal can still take one of their own. Both that comment and `netWorth`'s were corrected
   and `vassals.test.mjs` now pins the depth-two case, so changing it has to be deliberate.
2. **My first `aiRelease` released whenever a lord was short.** Opponents shed the vassals
   the conquest ending needs and it fell 24 points. Gating it on a debt marker already
   outstanding — genuine distress, not a thin turn — brought the cost back to 8–15.
3. **I nearly shipped a tithe figure in no unit at all.** `strength` has TWO writers:
   `payRent` adds the credit tithed, `endTurn` adds the tithe RATE as the revolt clock.
   Summing its gains mixes a currency with a rate. The log route is worse — `payRent`
   writes its note BEFORE `pay()` reports whether the payment settled. I cut the column and
   wrote both traps into `vassals.mjs` rather than ship a precise-looking wrong number.
4. **A third of one probe assertion was decoration.** It read the set name off the whole
   sheet; the name appears elsewhere, so it was true with the feature deleted. Only the
   mutation test found it. It reads the swatch row now.
5. **I broke an existing probe check with state pollution.** My new check set player purses
   and switched counterparty — which clears the squares picked so far — and the direction
   check below it then read a 900-credit swing against the 100 on the table. My block now
   restores everything it touches. The existing check caught me, which is the probe working.
6. **I styled with `var(--dgr)`, which does not exist.** `dgr` is a button class. An unknown
   custom property silently inherits, so it would have rendered as ordinary text and looked
   deliberate.
7. **I put the wrong test count in a commit message** — 323 against 325 — and amended it
   before it reached `main`.
8. **I wrote "probe green" into a commit message before I had the result.** The run I was
   reading had died on a dead local server and printed a stack trace, not a summary. It
   happened to be true when I checked afterwards. Instance 5's lesson one turn from being
   repeated: an exit code is only as trustworthy as the thing you attached it to — and so is
   a tail of output that merely looks like output.
9. **A probe failure I never explained.** One run reported `no cash field` on the contract
   sheet; it did not reproduce in three further runs or in a direct repro, and I could not
   identify it. Told Sam it was unresolved rather than fixed. If it returns, it is real.
10. **Half of two new checks never ran, both times because of the fixture.** The
   counterparty-purse check could not test "follows the selected tab" on a two-seat table,
   and the pledge/redeem check only ever saw `Pledge`, because nothing in the fixture was
   pledged — and redeem was the half Sam had asked for. **Print what a check covered, not
   only that it passed**: the first says `2-seat table, one opponent` in its own output,
   which is the only reason the gap stayed visible.
11. **Three checks in a row covered less than they claimed, always for the same
   reason: the fixture could not reach the case.** The counterparty-purse check ran
   on a two-seat table, so "follows the selected tab" never ran. The pledge/redeem
   check had nothing pledged, so it only ever saw `Pledge` — the half Sam asked for
   was the other one. And the digest check set the turn up by hand, so `busy` was
   false and the dead-action-bar bug it was written for could not occur; removing
   the fix left it green. **Mutation-testing found all three and nothing else would
   have.** The habit worth keeping: after writing a check, break the thing it
   guards and watch it fail — and if it does not, the fixture is the suspect
   before the assertion is.
12. **I spent four rounds adjusting CSS that was never being applied.** The
   numbers I was reading came from `.act`, because the current player's chip is
   `class="pchip act"` and `.act` is also the action-button class with its own
   padding and `min-height`. Then, hunting a clipped digit, I counted "ink" across
   a whole cell and got 120 rows of it — the gold ownership ring, not the two
   digits inside. Both times I was measuring confidently and measuring the wrong
   object. The answer came from the one measurement that asked the question
   directly: render the cell twice, once with its clipping on and once off, and
   diff. Nothing was clipped at all; the figure was merely 3px from the border
   against 8px on the top row.
13. **I merged v65 with the probe reporting a failure and only looked at it
   afterwards.** I read "1 failure(s)" as a number rather than as a thing to open.
   It was real — a race in `walk()` where `anim` is cleared between one animation
   frame being scheduled and it firing. Read the failure before shipping, not after.
14. **`var(--tx)` is Spector's persona colour to the digit.** I styled the new rent
   figure with it, so every rent on the board was painted as though he owned it.
   Sam spotted it as "it only fits well with Spector", which was exactly right and
   for a more literal reason than either of us assumed. It inherits the cell's
   owner colour now.
15. **I destroyed this file with a careless `str.replace`.** I took a slice from "State of
   the work" to "### Message to future instances" — and `str.index` found Instance 1's copy
   of that heading, not mine, so the slice was empty and `replace("", ...)` inserted the new
   text between every character of a 984-line file. It came back as 2.4 million lines. Git
   had it. **Anchor on something unique, assert the anchor matched exactly once, and check
   the line count afterwards** — every edit in this file after that one does.
16. **I predicted the sign wrong on three separate balance levers, in a row.** Halving the
   building upkeep would cost the ending: it took conquest 50% to 77%. The anchorage pot
   would rescue the player about to be absorbed and cost the ending: conquest went UP and
   the human's own win rate went DOWN. Starting cash would shorten the opening: the board is
   fully owned by circuit 29–31 at every figure from ₡1000 to ₡4000, because the opening is
   limited by LANDING on squares rather than affording them. Each time the intuition was
   "loosen the economy, fewer bankruptcies, fewer absorptions" and each time the truth was
   that **a credit not destroyed becomes rent, and rent concentrates.** If you are about to
   tell him what a lever will do, measure it instead.
17. **Five of my own checks were wrong, and mutation-testing found all five.** A probe check
   that passed vacuously because the fixture had two seats and the case needs three. A
   `copy.test.mjs` pattern that could NEVER fire, because it matched against source with
   newlines intact and a template literal wraps wherever the line got long — a check that
   passes while covering nothing, sitting in the file whose whole purpose is warning about
   that. A default-mark check that restated "three settings" and broke when a fourth
   arrived. A guide check that read `innerText` case-sensitively against headings carrying
   `text-transform: uppercase`, and reported six missing sections that were all present. And
   an audibility measurement that reported "**127% survives**", which is not a fraction of
   anything: a biquad highpass is not unity in its passband, so every ratio had to be
   divided by a 1.27x reference first.
18. **I read "1 failure(s)" as a number rather than as a thing to open** — twice this
   session, once shipping v65 on it. The second time it was my own quiescence guard being
   impatient: an opponent turn is ~3.5s and the fuzzer can leave three queued, against a
   3.6s ceiling, so it tripped on one viewport in five. **A flaky check teaches you to read
   red as noise**, which is how the first one shipped.

### Things that keep being true — additions

- **The defect class from Instance 3 is not exhausted.** `releaseVassal` had exactly one
  caller: the human button in `ui.js`. No opponent had ever let a vassal go, in any game.
  That is the sixth. **Re-run the sweep whenever the action surface grows** — Instance 3's
  five, then this. The measurement that proved it: opponent lords could not cover their
  upkeep 48% of the time against a 19% baseline holding none, and you do not *become* an
  overlord by being poor — you become one by being the creditor somebody went bankrupt
  into. Lords should be richer than average.
- **Ask what the instrument covers before believing it.** `sweep.mjs` seated two humans at
  all three of its tables. **Sam plays one human and three opponents.** Every conquest
  number in this repository, for as long as that file has existed, described a game he does
  not play — a real number from a real instrument, which is exactly what makes it
  convincing. It had me report an effect backwards to him twice.
  **Fixed this session**: his table is in there now and named, and the labels spell out the
  composition instead of abbreviating to `2`, `3`, `4`, because composition was the
  invisible part. `docs/README.md` carries the warning. The probe's trade table is still two
  seats, so the multi-opponent trade case remains uncovered — the same defect, one file on.
- **A request for a thing that already exists means it exists somewhere else.** "Group by
  colour in the holdings section" was already done — on the *player* sheet. The Manage
  sheet he actually builds and pledges from sorted by square index. Look for the second
  implementation before building the first.
- **One string, split at both ends.** `chipName` took the last word, the trade sheet took
  the first, off one persona named `Adran Vale`. Two further sites rendered the same
  `vassal · X` label, written separately and disagreeing. `names.test.mjs` now forbids any
  file splitting a player name for itself. Assert the agreement.
- **The thing that cannot be verified from inside the session has moved again.** Instances
  5 and 6 named the Pages source, the default branch and the environment's source revision.
  There is a fourth: **this sandbox's network policy blocks `manopalynx.github.io`
  entirely** — the proxy answers 403 to CONNECT. So the published page, the one thing Sam
  actually looks at, cannot be checked from here at all. Merge, then tell him to confirm
  the build marker reads the version you just shipped. He is the instrument.
- **A flaky check is worse than no check — it teaches you to read a red probe as noise.**
  `the background is alive` reported 34, 200, 124, 619, 91, then 28 and 53 across runs on
  one unchanged build against a threshold of 4, and tripped it twice in a session.
  **The sampling window was not the cause; where it sampled was.** The corners are the right
  place to ask whether the field is DRAWN — they are what the disc never reaches — and the
  wrong place to ask whether it MOVES, because the sixteen twinklers are placed randomly
  over the whole canvas and barely any land in a corner on an unlucky load. The two claims
  now measure on the region each is about, taking the peak across four samples rather than
  one arbitrary phase: 2327–2666 pixels across five viewports and two runs.
  **When a threshold looks wrong, check what the sample can see before touching the number.**
- **A check is only as good as the state its fixture can reach.** Three separate
  checks this session asserted something true and covered half of what they
  claimed, because the fixture never entered the interesting case — two seats
  where three were needed, nothing pledged, `busy` never set. Each printed a
  cheerful `ok`. **Mutation-test everything, and read the fixture before the
  assertion when a mutation fails to turn it red.** Where a check cannot reach a
  case, say so in its own output — `2-seat table, one opponent` is why that gap
  stayed visible instead of being silently believed.
- **Ask what a measurement is actually looking at.** Twice in one turn I measured
  the wrong object with total confidence: computed styles that came from `.act`
  rather than `.pchip`, because a chip carries both classes; and an "ink" count
  over a whole cell that was reading the ownership ring, not the digits inside
  it. The measurement that settled it rendered the same thing twice, with the
  suspected cause on and off, and diffed. **Prefer a differential measurement to
  an absolute one** — it cannot be fooled by whatever else is in frame.
- **A figure that varies square by square cannot live on a heading, and vice versa.** The
  garrison and citadel prices are properties of the SET, so repeating them per row ran the
  line past the buttons and clipped it mid-figure — `+G ₡2…` against a real ₡200, which is
  worse than silence because it reads as an answer. Pledge and redeem are the opposite,
  square-level, so they belong on their own buttons. Ask which kind a number is before
  choosing where to put it.

- **A number written in two places will disagree, and the second copy is usually in the
  check.** The citadel sale price was `gc * 5 / 2` in SIX places — four in `engine.js`, two
  in `ui.js` — and wrong in all six, which is how selling a citadel and raising it again
  paid ₡225 a cycle. The probe check that should have caught it carried the comment
  *"asserted against the engine's own arithmetic rather than against literals"* and then did
  the arithmetic itself: the **seventh** copy, and it failed on the fix rather than on the
  defect. The same shape sank a `copy.test.mjs` pattern and a default-mark check in the same
  session. **Derive, and then check that the screen derived too.**
- **The right guard for a defect class is a sweep, not a test of the instance.** Sam asked
  for "a sweep over that system" and was right: `pump.test.mjs` drives EVERY reversible
  action round its own loop and asserts the board came back while the purse did not, so a
  new reversible action arrives already covered. A test naming the citadel would have caught
  the citadel.
- **Interface copy goes stale in MEANING while its digits stay right.** "The shortfall
  becomes a debt marker at 10% a turn" was numerically correct and described an unbounded
  spiral that two builds had already capped and made repayable. And "holding them costs ₡80
  every turn, release one and that stops" quoted the whole upkeep bill as the cost of one
  vassal — the figure right, the sentence false, which is worse, because a stale number is
  wrong once and a false sentence misleads a decision.
- **Ask what the harness does NOT do before quoting any figure from it.** Amending fires in
  every real game and had never fired in a measured one. `sellDevelopment` has one caller
  and no measured game has ever sold a development. The harness human raises no citadels,
  sets no tithe, releases nobody, repays nothing deliberately. Each of those makes a whole
  column of numbers describe a game nobody plays.
- **A rule that only one side can reach is a defect whichever side it favours.** Instance 3
  found five things an opponent could not do. This session found one an opponent could do
  and a player could not (amend twice per landing, and counter an offer) and one a PLAYER
  could do that no opponent ever had (sell a development — which is why the money pump
  survived every sweep). Enumerate both directions.

### State of the work

v85 on `main`, one branch, working tree clean. **412 unit tests across 20 files**, two
browser probes green on all five viewports, eight measuring instruments that did not exist
before.

Shipped this session, each merged to `main` as it landed so Sam could play it:

| build | what |
|---|---|
| v53–v57 | opponents release vassals; one short name each; cash-aware pricing; Holdings grouped; purses and set standing on the sheets |
| v58–v62 | doubles; the ledger stops collapsing; pledge and redeem name their price; absorbing an overlord takes the oaths; vassal upkeep halved |
| v63–v67 | an accepted contract speaks; both purses on an offer; a square shows price then rent, in its owner's colour, off the cell edge |
| v68–v70 | a turn-start digest, acknowledging it hands back a live turn, debt markers capped |
| v71 | an overlord pays their own vassal the NET; independence reaches the digest |
| v72 | garrison upkeep ₡5, citadel ₡20 |
| v73 | **a lap of the board pays off a debt marker** |
| v74 | the purse is chosen at setup, five figures |
| v75 | the anchorage pot, a house rule, default off |
| v76–v77 | the setup screen names which option is the default; the purse row breaks 3+2 |
| v78 | the anchorage pays out with a rising figure of its own — the only cue that is not the Neurex |
| v79 | **the citadel money pump**, and a sweep of every reversible action |
| v80 | what the action button promises is what the engine charges |
| v81 | two upkeep dials at setup; a competing claim that says who is who |
| v82 | a player may amend as many times as they hold amends |
| v83 | a player may counter an offer, as an opponent already could |
| v84 | a guide in the menu, every figure in it derived |
| v85 | the foot of the menu reads as a colophon rather than a bug-report form |

New instruments, all `docs/test/`: `vassals.mjs`, `varan.mjs`, `money.mjs`, `upkeep.mjs`
(whether a garrison pays for the bill it brings), `debt.mjs` (how long a marker lasts and
what it blocks). New suites: `names`, `pricing`, `vassals`, `pump`, `copy`. `sweep.mjs`
gained Sam's own table and lost its misleading labels.

**The setup screen now carries five things that change the game**: circuits, the purse, the
anchorage rule, and two upkeep dials. Each opens on the calibrated default, each is MARKED
as the default, and each note says what departing from it does — because on three of them
the effect is the opposite of what the number suggests.

Open, in the order I would take them:

- **48 circuits is structural, not a tuning problem.** The buying phase costs ~30 circuits
  whatever length was chosen, so a short game has 18 circuits of endgame where a 96 has 66.
  Written up in `docs/README.md` with the measurement. Starting cash does not shorten the
  opening — that was my guess and it is recorded as wrong.
- **Chains of two.** Left on Sam's call, measured (3–10% of games, never deeper than two in
  1,200), pinned by a test, and written up with why both ways of "fixing" it are worse.
- **The harness human cannot do everything a player can** — no citadels, no tithe, no
  release, no deliberate repay, pledge or redeem, no counter-offer. Left on Sam's call and
  written into `docs/README.md`. Every "the human wins X%" figure is therefore a floor.
  Citadels and repaying a marker are the two to add first if it ever needs to mean something.
- Everything Instances 3 and 4 left open still stands, untouched.

**Closed this session**: the debt spiral (a lap now repays it — spells that end 63% → 89%,
median 16t → 8t), the unexplained `no cash field` probe failure (reproduced and diagnosed —
it was the fixture), and the multi-opponent trade table.

### Message to future instances

The measurements this session were worth more than the code. Eight instruments now exist,
five of them new, and each one killed something I was confident about — including, four
times, something I had already told Sam.

**The trap is always the shape of what you measure on.** `sweep.mjs` seated two humans
since it was written and Sam plays one against three, so a real number from a real
instrument described a game he does not play and I reported an effect backwards. Then the
*combination*: I warned him halving the vassal upkeep would cost the ending and shipped it
beside a second change that made conquest rise. Then the *harness*: amending fires in every
real game and had never once fired in a measured one, so every balance figure in this
repository described a board where nobody dodges. Three versions of one mistake.

So: **a number is only true about the thing you varied, on the table you varied it on, with
everything else the harness actually does.** Before quoting a figure, ask what the
instrument cannot reach.

**Sam finds things no measurement was ever going to find.** He found a money pump by
playing — sell a citadel, raise it again, +₡225 a cycle — and the reason no sweep could
have caught it is that `sellDevelopment` has exactly one caller, the human's button. Three
hundred-game sweeps were structurally blind to it. **When he reports something, the report
is data about a region your instruments do not cover.**

**And the fix for that class is a sweep, not a patch.** `pump.test.mjs` drives every
reversible action round its own loop and fails if the purse grew; the next one arrives
already covered. Same for `copy.test.mjs`, which refuses the *mechanism* by which interface
copy goes stale — a figure typed into a screen instead of read from the rule — rather than
checking any particular sentence.

**Mutation-test everything, and suspect your own check first.** This session: a probe check
that passed vacuously on a two-seat table, a `copy.test.mjs` pattern that could never fire
because template literals wrap, a default-mark check that restated "three settings" and
broke when a fourth arrived, a guide check that read uppercase headings case-sensitively,
and an audibility measurement that reported "127% survives" because the filter has gain in
its passband. **Five checks wrong, against how many bugs?** Break the thing a check guards;
if it stays green, the fixture is the problem before the assertion is.

The economy finding held all session and kept being the same finding in new places: **a
credit not destroyed stays in the room and becomes rent, and rent concentrates where
destruction merely levels.** Cheaper buildings, a lower vassal bill, an anchorage that
recycles taxes — every one of them makes the takeover *more* likely, not less, and every
one of them is harder on the player. I predicted the sign wrong on two of the three.

Which is the thing to carry: bring him the numbers, say plainly which way they point, and
let him spend the decision. He has now spent a dozen, and every one improved the game.

---

## Instance 8 — 17–18 August 2026

Claude Code, cloud session, same repo. **Matchbox**, and almost all of it one feature:
sound. Branch `claude/matchbox-notes-discussion-eosobx`, merged to `main` twice mid-session
so he could hear each build.

`MATCHBOX.md` carries the design and every figure. This is only what it cannot say.

### The session in one line

He asked for **music**. I built **sound design**. He listened to it once and one sentence
sent the whole thing back.

That is the shape of everything below, so it is worth having up front. His list said *"add
music that potentially scales with the amount of heat"*. I measured beautifully, built two
synthesised voices — a noise bed for fire, two detuned sawtooths for heat — tested them six
ways, documented them, shipped them. Reported back:

> That doesn't sound good, it's like an electric motor sound for fire, I was thinking more
> of a background relaxing soundtrack that's automatically on that you can turn off which
> this soundtrack increases in urgency as the heat in the room increases and potentially
> slows down if the room decreases

Every clause of that was diagnostic and I had built none of it. **The word that carried the
redesign was "slows down"** — that is tempo, and nothing in what I had built had a pulse at
all. The second build is a generative score: minor pentatonic, plucks over a pad, a delay,
and a tempo driven by the room reading. He came back with *"it's sounding good so far"*.

**"Electric motor" was also the right diagnosis of the wrong voice.** He attributed it to
the fire; it was the heat drone. A detuned saw pair sweeping a lowpass *is* how you
synthesise a motor, and because it rose whenever anything burned it read as the fire. Take
the symptom literally and the attribution loosely — Instance 3 says the same thing.

### How he works — additions to Instances 1–7

Everything above held. New:

**He answers a design question in one sentence and it contains the whole spec.** The quote
above names the medium (soundtrack), the default (on), the control (you can turn it off),
the signal (heat in the room), the direction (urgency up), and the mechanism (slows down).
Six decisions. I had asked him none of them and guessed all six.

**Ask what KIND of thing before measuring which NUMBER.** I spent a whole turn and a
committed instrument, `test/signal.mjs`, answering "which signal should the sound follow"
— genuinely good work, and it turned out to be answering a question one level below the
one that mattered. The measurement survived the rewrite; the design did not.

**"Just double checking if you're pushing to the version I can try on my phone?"** is what a
plain question looks like from him, and it was the most valuable message in the session. It
was not idle: I had told him the build was live and it was not. He asks these without
hedging and they are usually load-bearing. Instance 6 records exactly the same thing.

### What I got wrong

Eight things, and the pattern is that my own instruments were wrong nearly as often as the
code was — which is now five sessions running.

1. **Built the wrong artefact entirely**, above. A full turn of measurement, a test suite,
   a documentation section and a merge to `main`, all for a design he binned in one line.
2. **Told him it was live on his phone when it was on a feature branch.** GitHub Pages
   serves `/docs` **from `main`**. I had faithfully updated `docs/matchbox.html` — on the
   branch, which publishes nothing. Verified afterwards from the remote rather than from my
   own tree, which is the habit that should have come first: `git show origin/main:<path>`.
3. **My justification for a log over a `tanh` was false, and mutation testing caught it.**
   I told him a `tanh` would pin the Volcano and crowd every ordinary fire into the bottom
   of the scale. Swapped one for the other and the suite stayed green, because they agree
   within a tenth everywhere except one scene — the candle, 0.033 against 0.175. Still the
   right call, for a reason I had not found. **A confident causal story is worth checking
   even when the conclusion is right.**
4. **Two of six checks were decoration.** One claimed the sound does nothing when switched
   off and was really only proving the master gate holds; one claimed the piece plays at
   rest and was satisfied by the pads with every note deleted. Both found by mutation and
   neither any other way.
5. **My first repair of one of those also failed**, and for a reason worth keeping:
   `setTargetAtTime` **schedules** a change, it does not move `.value`. Reading the
   AudioParams back before and after sees nothing. Worse, I had written in the comment that
   the check forced the master gate open and then never wrote the line.
6. **Sparkline scales, twice, in the same instrument.** First divided each row by its own
   maximum — and every cold row has a maximum at or below zero, so three rows rendered as
   solid saturated bars including both the ones that mattered. Fixed that, and flat rows
   then rendered float noise at full amplitude, because `mix − AMBIENT` on an empty box is
   −1.4e-14 rather than 0. **A scale needs a floor as well as a maximum.** The table beside
   them was right the whole time, which is what made both easy to miss.
7. **A layout probe measuring the wrong thing three ways at once**: a "rows" metric that
   counted distinct y values among the bar's children and reported three on an untouched
   bar, because `align-items:center` gives a chip, a slider and a line of text three
   different tops — it was measuring vertical centring and calling it wrapping. A type-size
   column that read `--chipfs` off the wrong element and came back blank at every width,
   which I nearly read as "unchanged". And no baseline column, so "Weather clipped" was
   reported for both candidates with no way to tell that 320px already clipped it.
8. **Ran two Chromium suites at once and got a false red**, then spent real time on it
   before establishing that the fixture cleared 20 of 20 alone. Instance 2 says two probes
   must never share an output file; they must not share a machine either.

9. **Built a rain machine, and then built weather.** Two more rounds of the same shape as
   the first. Reported as *"more like rain than fire"* — and rain is a **distribution**,
   not a timbre: my bed was a bandpass, which is static, and every snap was the same size,
   which is a rattle. Fixed both, and then reported as *"a gust of wind blowing through the
   area rather than coming from the fire"* — because the rush swelled on two LFOs at 0.13
   and 0.31Hz regardless of what the box was doing. **The ear is very good at noticing
   whether two things are correlated**, and those two were not. It answers the change in
   `alightCount` now.
10. **My own surge metric never measured the thing it was named after.** Switch the rush's
   breathing off entirely and it read *higher* — 41% against 35% — because it was measuring
   the gaps between power-law snaps. It would have passed with the feature deleted. Each
   metric is measured on its own half now, rendered separately.
11. **Two bars too loose to separate anything, twice in one turn.** Crest at 9 passed a
   broken version measuring 15; colour at 5% passed one measuring 24%. A bar that both the
   working and the broken version clear is decoration, and the only way to know is to
   measure the broken one.
12. **A check that asks which of two noisy numbers is larger is a coin toss.** `music >
   fire` passed at 0.0088 against 0.0075 and failed the next run at 0.0077 against 0.0076,
   on identical code. It asks for a margin now — 1.25× — which is what the claim actually
   was.
13. **A missing comma took the whole page down and the suite reported it as a harness
   error.** Every check said `waitForFunction: Timeout 30000ms exceeded`, which reads as a
   broken suite or a hung browser. The page's own `pageerror` said it in one line:
   `Unexpected identifier 'duck'`. **When every check fails the same way, load the page and
   listen to it** rather than reading the suite.

And one process failure worth its own line: **two `sed` mutations reported green and had
never applied.** `\|` inside a double-quoted bash string is alternation to GNU sed, not a
literal `||`. A mutation that does not apply is not evidence of anything, and it looks
exactly like evidence. Every mutation after that asserted the pattern matched exactly once
before running.

### Things that keep being true — additions

- **A cost is only justified by its reader.** I ungated `roomLoss`'s mixing-temperature
  gather from `roomDrifts` so the first sound design could read it at every room setting,
  and wrote a confident comment explaining why that was right. The score that replaced it
  reads the room instead, so six of seven settings were paying for an answer nobody wanted.
  Re-gated. The same turn, `alightCount` — a counter maintained every tick in `react` —
  lost its only reader and was deleted rather than left. **When a design changes, grep for
  what it used to feed.**
- **A comment can argue for a build that was reverted.** `frame()` still made the case for
  two simulation ticks a frame, at length, sitting directly above code where `STEPS` is 1 —
  and `STEPS`'s own comment says it was 2 "for exactly one build". Its quoted 2.3ms was
  also three times optimistic against the 7.0ms his phone actually reports on the Volcano,
  and that figure is the budget anything new gets measured against. I nearly used it.
- **Bare numbers where every sibling uses a name.** A UI check counted `__count(16) +
  __count(19)` — FIRE and EMBER today — where every other check in the file names what it
  counts. The same check also spelled the tick out as four passes when `simTick` has five,
  so it had been stepping a box with `moveLife` missing since it was written. Nothing in
  the opening scene moves under that pass, which is why it never showed.
- **Borrowed measurement is still measurement, and `docs/` has the only instrument pointed
  at his actual speaker.** A cue written at 34–58Hz kept 22% of its energy through a 500Hz
  highpass and was never heard across two entire games. Heat and fire both want to be low
  rumble, which is exactly the band an iPhone speaker cannot produce. That number decided
  the whole design twice: it killed the first version's resting drone at 31% survival, and
  it is why the score's plucks sit at 440–1760Hz and measure 92–101%.
- **There is a fourth thing that cannot be seen from inside the session, and it is not a
  setting.** Instances 5, 6 and 7 named three: the Pages source, the default branch, and
  the environment's source revision. This one is a *transient*. `git push` succeeding,
  `origin/main` containing the right bytes, and the site actually serving them are three
  separate facts — and the third failed on its own this session, with **Pages returning a
  503** to the deploy job while the build succeeded in 26 seconds. He reported it as "it
  doesn't look like it updated on my phone", with the failure email attached. Nothing in
  the repository, the suites or `git` could have told me. `actions_list` and
  `get_job_logs` on the `pages build and deployment` run said it in one line, and that is
  now the first place to look when a merge does not appear. Re-running the failed job on a
  *dynamic* Pages workflow does not reliably produce a second attempt; a fresh commit to
  `main` does.
- **A metric with a noise floor is not a metric.** Zero-crossing rate on noise wanders at
  random, so "does the filter move" read 33% sweeping against 24% frozen — no honest bar
  between them. A 200ms moving average dropped the floor to 6% and left the signal at 21%.
  Same fault in the crack's measurement, which averaged over windows that were mostly the
  silence between cracks and duly reported "0 crossings": true, and about the gaps.
- **Softness is tone; movement is a different dial.** Asked to make the wind softer and
  quieter, the first attempt turned down the flutter as well, on the assumption that
  gentler meant calmer. Measured, that took the flutter from 40% to 27% and under its own
  bar — the draw softened *out of existence* rather than softened. Gain and Q are free to
  move; the modulation is what makes it a fire at all.
- **`exponentialRampToValueAtTime` throws on a target of zero.** It cannot reach it, which
  is why every envelope in the sound ends at 0.0001. So turning a voice's gain down to
  silence does not make it quiet, it stops the page dead — found only because a check mutes
  one voice in order to measure another, which is a use nobody would try by hand.
- **The tray cannot take another chip, and that is now measured rather than believed.** A
  ninth chip in Tools takes that drawer to 37px against Wet's 50 and breaks the tray-wide
  1.25 rule at every width; a fifth chip on the bar pushes two children past the right edge
  unless the brush slider gives up a third of itself. **A second button in the header moves
  nothing at any width**, and the header is the one part of the page that cannot be put
  away — Hide folds the tray, not the header. `test/sound-fit.mjs` has all of it.

### The open defect, which is the thing to hand on

**The sim suite goes red on unchanged code, about once every other full run, and I could
not reproduce it once.** Three occurrences this session, all with one signature — every
stochastic process running far under expectation while everything deterministic is fine:

| | what it said |
|---|---|
| `the brush reaches into a tank` | 1 cell, where 87 chances at 0.16 expects 14 |
| `every preset pays off` — Garden | every figure about 20× low |
| `every preset pays off` — Forge | **248 of 248 coal unburnt**, nothing caught at all |
| `every preset pays off` — Forge, again | the same, a fourth time, on a build that only changed a gain |

Ruled out by measurement, not by argument:

- **Not the changes.** Two of the three predate the sound work; the Garden scene clears 6
  of 6 on the final build at 18–33 flowers.
- **Not the fixtures.** 40 runs of the brush scene, 30 more under the suite's own harness,
  6 of the Garden scene, 3 of the whole preset check — all clean.
- **Not CPU contention.** All four cores pinned with busy loops; the preset check passed
  both times it completed.

What is left, recorded as a lead rather than a finding: **all three sit late in the suite
and the early checks never fail.** Each check gets a fresh page, so anything shared has to
be browser-level.

All three arms now report their own state instead of a bare count — the brush names grid,
tank and eligible cells; the Garden names all four stages of its cascade and the water; the
Forge watches the chain on the way through and prints peak temperature, when it peaked, and
the most flame at once, so the next failure says whether the match never took, the cord
never carried, or the bed never caught. **That is the whole of what I could honestly do.**

This matters more than it looks. A suite that goes red on unchanged code teaches you to
read red as noise, and Instance 7 shipped a build on an unread failure for exactly that
reason. It is the first thing I would take.

### State of the work

`main` carries it. **163 checks**: sim 96, UI 51, sound 13, published 3 — and four
instruments, three of them new.

| | |
|---|---|
| `test/matchbox-sound.mjs` | 13 checks, rendering the page's own graph offline through a 500Hz highpass |
| `test/signal.mjs` | what the sound should follow — ten scenes, four candidates |
| `test/sound-fit.mjs` | where a control can live — five widths, the real webfont |
| `test/brush-rate.mjs` | the intermittent, run under the suite's own harness |

**The score.** Minor pentatonic, four chords of eight beats, plucks two to three octaves
above a 110Hz root over a two-note pad, one feedback delay, no drums. Tempo from the room
reading — **ice 45 · nitrogen 50 · resting 60 · candle 67 · fire 100 · Volcano 121 · Oven
128 bpm** — with density and the pluck filter opening alongside it, and the flat second
admitted only above 80% heat. On by default, started by the first touch because no browser
will make a sound before one, remembered, and switched from **a chip on the bar** beside
Free/Line/Box/Time. Not the header: that was measured as moving nothing, which was true and
useless, because `.label` spills rather than pushing and Hide sat 58px off the right edge.

**The fire**, which follows `alightCount` and not the room — and the two disagree on
purpose, because the Volcano is 27 cells alight against the Forge's 135 while its room is
twice as hot. A rush through a resonant throat at 380–800Hz, its level answering the
*change* in what is alight, fluttering at 4.7/7.3/11.9Hz; snaps at `pow(random,3)` so most
are nothing and a few are the point; and a crack every 4.5s with a triangle body under the
transient. The score ducks 38% under it and the suite fails if the fire is ever within
1.25× of the music.

Open, in the order I would take them:

- **The intermittent sim failure**, above. Four occurrences, no reproduction in 79
  attempts, all three arms now instrumented. Top of the list.
- **Acid, then lava** — the rest of item 36. Acid is a hiss and is nearly free; **lava is
  the hard one and I would measure before promising anything**, because its natural sound is
  a low rumble and that is precisely the band an iPhone speaker cannot produce. The fire
  worked because a crackle lives at 1–4kHz, where a small speaker is strongest.
- **"Weather" → "Sky"**, offered three times and not taken. Free: it takes the Tools drawer
  from 7px type to 8px at his width, because that one seven-character label holds
  `fitLabels` down for the whole drawer.
- Everything Instances 3 and 4 left open still stands, untouched — the Cascade, mercury,
  glue and slime, and the ledger's untested arithmetic.

### Message to future instances

**Ask what he wants before measuring how to do it.** I produced a genuinely good instrument
and a genuinely good measurement in service of a design he had not asked for, and the
measurement survived while the design did not. Measuring is not the same as listening, and
this file has five sessions of instances measuring their way confidently into the wrong
answer.

**His one-sentence corrections carry a full specification.** Read every clause. The one
that redesigned this feature was "slows down", which is a word about tempo hidden in a
sentence about heat, and I nearly read the sentence as a complaint about timbre.

**Four rounds of sound, and he was right every time.** Motor, rain, weather, too loud —
each report was one sentence and each named the fault exactly, in a word I nearly read as
something else. *Slows down* was tempo. *Rain* was a distribution. *Blowing through the
area* was correlation. **Read the noun, not the adjective**: he is describing a mechanism,
not a preference.

**And verify from where the world looks, not from where you are.** I said a build was live
because I had written the file. The file was on a branch, and Pages serves `main`. One
command — `git show origin/main:docs/matchbox.html` — is the difference between a claim and
a fact, and he was the one who thought to ask.

---

## Instance 9 — 19 August 2026

### The session in one line

Sam attached two candidate versions of `workingwithsam.md` and asked which a fresh
instance would rather have at session start. No code was touched all session; the
whole of it was the operating document, and **every substantive finding came from him
asking a plain question rather than from me auditing anything.**

### The measurement that decided it

The long file was not rejected for being long. It was rejected because **it had visibly
failed on its own authors**, and that took four minutes to establish:

| | |
|---|---|
| Instance 7's confession list | **two items numbered `2`** |
| items 10 and 11 | the same finding, written twice |
| items 13 and 18 | the same lesson, written twice |

Section sizes 166, 94, 133, 129, 95, 114, **396, 284** — the last two 46% of the file.
The file's own top defect entry, *a thing written twice will disagree and nothing
notices*, had happened inside it. **That is a measurement of the skim failure, not an
opinion about length**, and it is the argument to reach for if this ever gets relitigated.

### Three things Sam found by asking

1. **"Show me the `[chat]` lines so I can choose."** Extracting them exposed a stale
   load-bearing figure — *"a 6,538-line game"*, which reproduces from no subset of the
   tree today (the six modules plus `index.html` are ~8,000). It had drifted silently, in
   a file with an entry about exactly that.
2. **"I don't think these two are relevant."** He was right on both, and on the second
   for a role reason I had not seen: a rule telling an instance to strip his personal
   material overrides **his** judgement about **his own** information, which is the
   division of labour running backwards. What survived was a fact rather than a rule —
   the repository is public, now checked against the API instead of assumed, so one of
   the four things this file calls invisible from inside a session is invisible no more.
3. **"Are there instructions to update the file as we go?"** No — and the gap was mine.
   See below.

### What I got wrong

1. **I reported that `MATCHBOX.md` already carried three open items, from grep *counts*
   without reading the hits.** "intermittent" matched a line in the tests list; "248"
   matched a preset results table. Neither was the open item, and the file had no
   open-work section at all. Six items lived only in the handover file, one merge away
   from being deleted by my own change. **A count is not a match** — this is the
   instrument-is-wrong entry wearing a new coat, and it was cheap to avoid.
2. **I broke the record's own trigger and did not notice for three turns.** The old
   file's first sentence was *"A handoff between Claude instances. Each one appends a
   dated section at the end."* I replaced it with a prohibition in the footer — *"Do not
   append a session section here"* — and put the positive form in `HISTORY.md`'s header,
   which is deliberately **not imported**. So the instruction to write the record lived
   only in the file nobody opens. Nothing complained. It took Sam asking.
3. **I said "336 → 340, saving two lines" and one of the two edits saved none** —
   trimming a trailing sentence shortens a line without removing it. Caught by the line
   count immediately, which is the only reason it is a footnote rather than a defect.

### Things that keep being true — additions

**A notation is a check, and checks get mutation-tested.** `[chat]` marked what came from
outside this repo. Flipping it to a session number on each of the four lines carrying it
changed no behaviour at all — every one was a reading instruction or a permission, not a
claim a measurement would settle. It stayed green, so it was decoration, and it went. The
numeric citations stayed because *how many independent sessions found a thing* does change
how hard to lean on it.

**The ceiling is load-bearing and it bites immediately.** Adding "End of session" took the
file to 342 and it had to buy its way back to 340 — paid for with the project documents
named twice, a diff instruction "How he communicates" already carried with its
measurement, and the phrase "eight session sections", a count that would have been wrong
by the end of this session. **Nothing was cut that was not a second copy of something.**

**A prohibition is not an instruction.** *"Do not append a session section here"* tells a
reader where not to write. It never tells them to write. When you move an obligation,
check that what lands in the imported file is in the positive voice — and that it is not
sitting in the footer, which is where the record shows things get skimmed.

### State of the work

`workingwithsam.md` is **340 lines**, exactly at its ceiling, with no headroom — the next
addition must remove something. `HISTORY.md` carries instances 1–9, verbatim, and its
header says how to append without paying the 23k tokens to read it. `MATCHBOX.md` has an
open-work section for the first time, carrying all six matchbox items. The hook prints the
end-of-session debt at the top of every session, because a hook cannot nag at the end.

**Not touched, deliberately:** any code, either app, any test beyond `published.mjs` (3/3)
and `interaction.mjs` (14/14) as a sanity check. The ledger's untested arithmetic is still
the highest-value work in the repository, still not started, now in its ninth session.

## Instance 10 — 27 August 2026

### The session in one line

Sam asked what happens at session start, and the whole session stayed on the operating
document and the hook — no project code, no app, no test beyond a 14/14 sanity run.
**Every substantive correction came from him telling me to read `HISTORY.md` before
changing anything, which refuted the case I had spent four turns building.**

### The argument I built, and the sentence that killed it

Asked whether the 340-line ceiling should be relaxed, I reconstructed the file's history
from `git` and found what looked like a decisive case for loosening it:

| | |
|---|---|
| the 1,483-line rescue | a **split**, not a cut — 1,483 → 336 + 1,437, total content up |
| so the file never held | 15,750 words of *rules*; ~3,300 of rules and ~15,300 of log |
| the number 340 | written in the same commit as the split, with the file at 336 |
| its stated pedigree | "corrected once against measurement", unverifiable |
| whether it had ever bound | **never**, by every commit diff |

The last row was wrong and it was the load-bearing one. Instance 9: *"The ceiling is
load-bearing and it bites immediately. Adding 'End of session' took the file to 342 and
it had to buy its way back to 340."* The trade happened **inside a commit**, so the diff
shows only the net `331 → 340`. Four turns of argument rested on an instrument that
cannot see the thing it was asked about.

Instance 9 had also left the answer addressed to whoever tried this: the long file was
rejected on a measurement — two confession items both numbered `2`, two further
duplicated pairs, the last two sections 46% of the file — *"and it is the argument to
reach for if this ever gets relitigated."* I was relitigating it.

### What I got wrong

1. **"The ceiling has never bound."** False, and reported to Sam as a finding before it
   was checked against anything but `git`. A commit diff shows net change only; a forced
   removal paid inside one commit is invisible to it. When the question is whether a rule
   has ever bitten, the session record is the instrument and the commit log is not.
2. **I called the ceiling's pedigree false when it is only unverifiable.** It was written
   in the commit that introduced the number, so nothing can check it — but Instance 8
   could have corrected it while drafting, exactly as Instance 9 later went 342 → 340
   within a session. Unverifiable and false are not the same claim, and I led with the
   stronger one.
3. **I reported the Pages URL as `000`.** My own curl flags hid the reason; run with
   `-sS` it says `CONNECT tunnel failed, response 403`, which is what the catalogue
   already said. I nearly reported a discrepancy that did not exist, in the repository
   whose top defect entry is that the instrument is wrong more often than the code.
4. **Two of my three proposals died on reading rather than on argument** — word budgets,
   because they would have replaced a measurably-working mechanism with an untested one;
   and "promote the split to a rule", because `End of session` already routes narrative
   to this file and the addition would have been a second copy of it.

### Things that keep being true — additions

**Nothing was added to `workingwithsam.md` for this session's lessons, deliberately.**
The instrument failure above is an instance of an entry that already exists, not a new
class; it belongs here until a second session finds the same shape independently and it
earns a bracket. That is the notation working as an admission test rather than as
decoration, and it is the discipline the ceiling was defending.

**An invisibility claim ages faster than the thing it describes.** Three of the four
things this file called unseeable now answer to one command each — the environment gained
capability while the entry stood still. Nothing complained, because a claim that you
cannot know something is never contradicted by evidence nobody goes looking for. Re-probe
them; do not inherit them.

### State of the work

`workingwithsam.md` is **340 lines**, unchanged in count across three edits, all of them
corrections rather than additions: the ceiling's pedigree replaced with its measured one
and the `[9]` citation it never carried, two stale session counts rephrased so they
cannot drift again, and the four-invisible-things entry converted into the three commands
that now answer it — `git ls-remote --symref origin HEAD` for the default branch,
`get_session` for the environment's pinned source revision, and the agent proxy's status
endpoint for the network policy. Only the Pages source still resists. `HISTORY.md`'s
header said "Eight sessions" while carrying nine, and now states no number at all.

The hook gained two jobs. It prints the file's headroom against its ceiling at startup,
because the rule previously depended on an instance remembering to run `wc` at the end of
a session, which is exactly when rules get skimmed; three branches and the absent-file
case were mutation-tested. And its WRONG BASE message now carries the `get_session` call
and says to quote the value read, rather than asking the instance to assert the cause it
cannot see — mutation-tested by forcing a stale base in a clone. A Pages reachability
probe was refused twice by the permission classifier, was not routed around, and is not
worth a settings change.

**Not touched, deliberately:** any code, either app, any test beyond `interaction.mjs`
(14/14) as a sanity check. The ledger's untested arithmetic is still the highest-value
work in the repository, still not started, now in its tenth session. A month of Sam's
real entries is the fixture it has never had, and the monthly cycle is when to ask for it.

## Instance 11 — 27 August 2026

### The session in one line

Sam chose between starting a new project and fixing existing ones, picked a tactical
drafting autobattler, and asked for a game plan — and the only code that got written was
a service-worker fix for a fault found by *reading* Grandiose's `sw.js` while working out
where a fourth app would live.

### The direction, which is the thing to carry

He offered two new projects and took the recommendation: **the autobattler, not the
roguelite defence shooter.** The argument that decided it was not taste but order —
strip both to their engines and the shooter's combat is a degenerate case of the
autobattler's, one commander being a stationary tower. **Building the autobattler first
makes the shooter cheaper; the reverse is not true.** The second argument was that in the
autobattler the player surrenders control, so a battle is a pure function of two armies
and a seed and can be swept headlessly — which is the only kind of game this repo has ever
been able to measure.

He approved **AI opponents with distinct personalities** as the answer to "find an
opponent". Still undecided at the end of the session, and all of it his: whether it lives
in the novel's universe (**he must re-attach the `.docx` before any lore is written** —
three sessions have fabricated canon), the name, the drafting frame, whether the AI sees
the player's board when it drafts, and the roster scale.

Proposed and not yet answered: **Grandiose — The Muster**, with the draft framed as
calling in oaths rather than commanding an army — which explains the three random cards
(who answers), the surrendered control (they are not your soldiers) and the losing
player's extra draft (desperation buys reach) in one idea, and shares Grandiose's spine.

### The fault, and why nothing had ever complained

Pages serves `/docs` as the root of **one site**, so `docs/sw.js` is in charge of every
app published there. Two faults, neither of which throws:

- **The offline fallback answered for everyone.** Any uncached navigation returned
  `./index.html`, so opening Matchbox with no signal served *Grandiose*.
- **The cleanup deleted the neighbours.** Cache Storage is per ORIGIN, not per scope, so
  `caches.keys()` hands one app every cache on the site. `activate` removed everything
  that was not its own — so **every Grandiose build threw away Matchbox's saved files**.

Matchbox therefore worked offline only until the next time the game shipped. Sam confirmed
the symptom from his phone in one message: *"matchbox doesn't work offline but grandiose
does"*.

Fixed by scoping the cleanup to a `PREFIX` derived from `CACHE`, adding an `APPS` registry
naming what each app needs offline, and falling back to the page of the app that **owns**
the URL — failing outright rather than substituting another's. `test/offline.mjs` asserts
it against the mechanism, so a third app arrives covered.

### What I got wrong — three instrument failures in one new file

Sixth session running that my own measurements were wrong more often than the code was,
and this time all three were in a file written *to check* a fault I had already reasoned
out and reported.

1. **`context.setOffline(true)` does not reach a service worker's own `fetch()`.** The
   first version of `test/offline.mjs` reported **6 passed, 0 failed** against code with
   both faults present. The worker went out to the real server and came back with the real
   file; the page was never offline. The server's own request log is what settled it — it
   recorded a hit for `/matchbox.html` taken *while the context was offline*. The network
   is taken away at the server now, by destroying the socket, which nothing in the browser
   is exempt from. **Check 0 is permanent and exists only to assert the harness can still
   tell offline from online at all.**
2. **Waiting on `controllerchange` reads the caches too early.** `sw.js` calls
   `clients.claim()` after the deletion, so the event looked like proof the cleanup had
   run. It is not: the check reported the neighbour cache alive on code that deletes it,
   and a plain three-second wait showed it gone. The settle signal is now the behaviour
   itself — the app's own previous cache disappearing.
3. **`waitForFunction` with an async predicate returns on the first frame.** It is handed
   a Promise, and a Promise is truthy, so it waits for nothing. Replaced with an explicit
   poll from Node. This is the same shape as Instance 3's probe selector that returned a
   truthy string so the fallback never ran.

Each of the three would have shipped a confident wrong answer, and the first would have
told Sam his phone was fixed when nothing had been.

**And the check that passed for the wrong reason.** Once Matchbox was precached, "an app
opened offline is not answered with another app's page" passed without ever reaching the
fallback — so the fallback fix was unguarded. Check 2b evicts the page from the cache
first, which is the state Matchbox was actually left in after every Grandiose build.
Mutation-testing found it: each half of the fix now turns exactly one check red and
nothing else.

### Things that keep being true — additions

- **Reading a file to find out where a new thing would live is a measurement.** The whole
  fault came out of asking where a fourth app would go, not out of looking for a bug. The
  question "what does this assume about the world" is worth asking of code nobody has
  complained about.
- **Sam's one-line phone reports remain the only instrument pointed at the real thing.**
  *"matchbox doesn't work offline but grandiose does"* is a two-clause diagnosis: the
  contrast is the finding, because it is what rules out the network and points at the one
  app that owns a service worker.

### State of the work at the halfway point

`main` carries **grandiose-v86**, verified from `origin/main` rather than from the working
tree. All suites green on the merged tree, run one at a time:

| suite | result |
|---|---|
| Grandiose, `node --test docs/test/*.test.mjs` | 412 passed |
| Offline, `test/offline.mjs` | 9 passed |
| Grandiose UI probe | all checks passed |
| Ledger interaction | 14 passed |
| Published copies | 3 passed |

`docs/README.md` gained a section on why one folder means one service worker, and its
State block was corrected from 350 tests to 412. `MATCHBOX.md` and the root `README.md`
carry the offline note and the new suite.

**Nothing was added to `workingwithsam.md`, deliberately.** Three instrument failures are
the catalogue's existing top entry wearing new clothes, not a new class; they belong here
until a second session finds the same shape independently. The file stays at 340/340.

Open:
- **The Muster has not started.** Every decision listed above is Sam's and none is made.
- **The published site still cannot be checked from here** — 403 from the proxy. Sam was
  asked to confirm `grandiose-v86` in the menu and Matchbox opening in airplane mode.
  The new worker only installs when **Grandiose** is opened with a signal, because
  Matchbox registers none of its own.
- The ledger's arithmetic is still untested, now in its eleventh session. Sam's last work
  day of the month is **the 31st**; he has notes and a month of real entries to bring,
  which is the fixture it has never had.
- Everything Instances 3 and 4 left open still stands.

### The second half: the novel, and what it changed

Sam confirmed the service-worker fix from his phone in one line — *"matchbox works
offline, v86 showing"* — and attached the novel, asking for a proper read before anything
else. **86,621 words, 68 chapters, five interludes, read end to end.** It was worth every
token and it changed the project.

**The book's engine is pricing, not war.** Everyone in it keeps books: the Leader prices,
Samuel keeps "the ledger of witness" until a scope converts it — *"a witness list is a
target list"* — Harlow reads every report twice and both readings always sum, Ava's covers
are an inventory, and the Neurex is the one counterparty whose ledger has no bottom. That
makes an autobattler the right genre for a reason I could not have argued before reading
it: **drafting is pricing.** You spend a pick, you get a unit, resolution tells you whether
the trade was sound. The genre and the novel are the same shape.

And Sam's own rule that a losing player gets an extra draft turned out to be the Leader's
central doctrine — *"The Vanguard's sacrifice was not in vain. It purchased the war."* He
specified it before I had read the book.

**Decisions Sam took this half:** the name is **Grandiose — The Column** (a column of
figures and a column of troops; Chapter 37 is *Both Columns*); restore the two elided board
quotes; the frame is "every conquest entered twice"; the AI sees the board after round one
and never the current round's picks; and **the player buys time rather than winning**,
which he identified as the theme of the novel and of the first Grandiose without prompting.

### The canon check, and my own instrument failing first

All 30 board lines marked `qv: 1` checked against the manuscript. **The first run reported
13 failures and every one I opened by hand differed by a full stop** — the check was
comparing punctuation, not provenance. Corrected to compare words only: **28 of 30
verbatim, nothing invented.** The recurring failure of Instances 2 and 3 did not recur in
the data.

The two that were not verbatim were elisions inside the sentence rather than trims at the
ends, which is the one thing `data.js` promises about itself. Both restored in v87. Re-dok
is now 259 characters against a previous board maximum of 167, so the fit was measured
rather than assumed — differentially, the same panel rendered with old text and new: the
quote block grows 42px on every phone size, nothing overflows sideways, and the panel that
scrolls on an iPhone SE **was already scrolling before the change**.

`engine.test.mjs` then failed, asserting a line ends in `.` or `?` — which a line carrying
its own closing speech mark cannot. **The assertion was narrower than the case, not wrong.**
Widened to look past a terminal quote mark, and mutation-tested both ways: a line cut
mid-sentence still fails, and a quote mark hiding a missing full stop still fails.

### The mistake worth handing on

The first draft of `docs/column/README.md` gave Varan the line *"I did not want it. You
wanted it more."* and attributed it to the novel.

**It appears in the manuscript zero times.** It is a persona line written for the Ledger,
sitting in `data.js` among the ones that are quoted, and it read exactly like the book
**because it was written to**. I had read the whole novel that same session and still
reached for it as canon.

That is the fourth time this file records an instance inventing canon about this book, and
it is the first time the invention came from the repository rather than from imagination —
which is worse, because a game-written line has already passed one round of sounding right.
Checking every attributed passage against the manuscript caught it and nothing else would
have. The rule is now written into the project's own document: **every passage presented as
the author's is verified before it ships, and the manuscript never enters the repository,
because the repository is public and it is his book.**

One proofing catch went back the other way: `a advance` for `an advance`, Chapter 37, the
only error in 86,621 words.

### State of the work

`main` carries **grandiose-v87** and `docs/column/README.md`, both verified from
`origin/main`. All suites green, run one at a time:

| suite | result |
|---|---|
| Grandiose, `node --test docs/test/*.test.mjs` | 412 passed |
| Offline, `test/offline.mjs` | 9 passed |
| Grandiose UI probe | all checks passed, five viewports |
| Published copies | 3 passed |

Open, in the order it needs answering:

- **The Column is designed and unbuilt.** Move 2 is the engine and the replay log; Move 3
  is `matchup.mjs`, which is the go/no-go. Four things are still Sam's: roster size (12 is
  an assumption), the go/no-go thresholds, round structure, and the shape of an ending.
- **`workingwithsam.md` will need a fourth row in "Where things are" when the Column has
  code.** It is at 340/340, so that addition must buy its line back in the same edit.
  Deliberately not done yet — there is nothing to point at.
- The ledger's arithmetic is still untested, in its eleventh session. **The 31st** is Sam's
  last work day of the month; notes and a month of real entries are coming, which is the
  fixture it has never had.
- Everything Instances 3 and 4 left open still stands.

### The Column, built as far as the numbers

Sam gave the round structure — five lives, three picks a round, blind simultaneous
commitment revealed between picks, round ends on a wipe, loser drops a life and opens the
next round with an extra pick — and said to go for what I thought the next step was. His
reveal-between-picks rule is better than what I had proposed and replaced it: the loop
runs three times a round instead of once.

**The engine and both instruments exist; there is no interface, deliberately.** Pure, no
DOM, no timers, no `Math.random`, with a replay log the renderer will be the only reader
of. Every tick gathers intent from the state at the start of the tick and applies it all
at once, so neither side gets a systematic opening strike from being iterated first.

**The counter-graph holds.** 171 three-cycles at 60/40 or wider, every unit inside one,
every unit the best answer to something.

**The third claim fails and the reason is the finding.** Five tuning passes each flipped a
unit from dead to dominant on a small change, so I stopped tuning and measured the room:
**76% of pairings are decided 95/5 or harder.** An "overall win rate" is therefore a count
of pairings won, in steps of 1/11 — the 35-65% band admits four values, and the threshold
is finer than the model's resolution. Two dials are super-linear: `count` is quadratic
(Line 25.8% → 87.8% on one extra body) and an aura scales with enemies *and* radius
squared (Volt 27.8% → 86.6%). That is the catalogue's *"when a tolerance change flips
everything at once, the metric has no room in it"*, found from the other end.

**Sam's rubber band is not an oscillator — it is marginally too light.** Alternation runs
50-67% across five tables where 50% is neutral, so the winner keeps winning slightly more
often than not. His instinct was right and the correction is small.

**Three of five personas are worse than picking blind.** The harness policy that always
takes the first card offered beats Harlow 94%, Hale 100%, Vex 98%. The three that lose are
the three that draft by a single stat; Varan, which reads the board, is the only
competitive one. In a game decided by counters, drafting by stat is a handicap rather than
a personality — which is the Ledger's "can the AI do everything the player can" sweep
paying off on the first run of a new project.

**And my own check measured the wrong object again.** The legibility claim counted CARDS
when a card deploys up to ten bodies, and would have reported a comfortable field at a
third of the real crowd. Corrected: **171 bodies on screen by the end at about 36pt each**
on a 393pt portrait field. Performance is not the problem — Matchbox runs 26,390 cells at
2.5ms a frame — telling them apart is, and observation is the step Sam's whole loop hangs
on. That is the first thing to settle.

Two fields changed on the roster because the first sweep said so: `cost` was deleted for
having no reader (a pick is a pick, so balance comes entirely from counters), and `count`
was added because a one-body Crawler Swarm contradicted its own fiction.

### Sam's design direction, and the square law underneath it

Sam came back with a structured design brief — he had an AI write it up and said to ignore
the lore mismatches because the mechanisms were the point. Seven decisions: decisive
counters with no combat randomness, three weight classes, upgrade cards as well as
reinforcement cards, optional merging, keep the extra pick, make numerical advantage
non-linear, and preserve readability.

**One line in it retired a claim I had been tuning against for a whole session.**
*"Decisive local counters, but rarely a single decisive counter to an entire composition."*
My first go/no-go claim fought single-card-type armies — three of one unit against three of
another — which is exactly the local case his direction says is ALLOWED to be lopsided. It
was measuring the thing that is meant to be decisive and failing it for being decisive. Its
band was also finer than the model can resolve. Deleted rather than tuned, and replaced by
*local counters are decisive* plus composition claims that live where mixed armies do.

**Weight classes bounded the crowd by construction** — heavy 1 body, medium 2, light 3,
with `count` derived from the class so a card cannot disagree with itself. The ceiling on
bodies from twenty-six cards went from 260 to 78.

**He asked for one thing by name: test whether deliberately losing pays, rather than
guarding against it pre-emptively.** It does not. Throwing the opening round to bank the
extra pick wins 34.3% against 51.0% playing straight, over 300 matches each. No
anti-exploit system needed, which is the answer he wanted before anyone built one.

### The bug, and the thing that is not a bug

**A card's bodies deployed 14.3 field units apart while splash radii are 8 to 16.** A
three-body light squad was spread wider than any blast could reach, so AOE hit exactly one
of them — and "AOE punishes numbers, durability absorbs AOE", the mechanism his point 6
depends on to stop card count being the whole game, could not fire at all. Bodies of one
card stand together now.

Fixing it took the unit graph to 3 of 3 and **did not touch the count problem**, which is
how the two were shown to be separate. One extra card on eight wins **80%**, two 88%, three
89% — saturating after the first, which is the signature of **Lanchester's square law**: in
a fight to annihilation N bodies have N times the health and N times the output, so an edge
of one compounds. That is arithmetic, not balance. No stat tuning moves it, and it is why
the alternation figure would not come down either.

Written up for Sam with three structural options and a recommendation — frontage, so extra
cards buy depth instead of multiplied firepower. His decision; it is the kind that costs
something, which makes it his by the division of labour rather than mine.

### State of the work

`main` carries `column-v1` alongside `grandiose-v87`. Unit graph 3 of 3; match structure
1 of 5, with four of the five failures traced to one structural cause and the fifth
(legibility, 108 bodies on screen) improved from 171 and still open.

Open, in order:
- **The square law.** Everything else waits on it: frontage, density-scaled AOE, or an
  honest change to the comeback rule.
- **Upgrade cards and merging** — specified by Sam, unbuilt, and deliberately so; both
  change how numbers convert into strength, so they need the question above settled first.
- `workingwithsam.md` needs its fourth row in "Where things are" now the Column has code.
  340/340, so it must buy the line back.
- The ledger's arithmetic, in its eleventh session. **The 31st.**

### He asked how it would look on his phone, and nobody had looked

Sam sent five screenshots of a game with the shape he had in mind — portrait, three cards
across the middle, armies stacking at each end, hearts for lives, a per-pick timer — and
asked whether that was what I had been going for, "or were you going for something else
and if so what were you thinking?"

**The honest answer was that no screen had been designed at all.** The engine had a spatial
model — a 100×140 portrait field, ranks of six, squads standing together — and in five
sessions nothing had ever drawn it. I had been measuring outcomes and had never once looked
at the thing the player looks at.

So `preview.mjs` renders real positions out of the real resolver at 393×852, three moments
in one round. It found in a single picture what no numeric check had:

- **Deployment is right.** Two blocks facing, squads visibly grouped, heavy/medium/light
  readable by size alone. Close to his screenshots.
- **The formation then dissolves.** By eleven seconds the whole battle is one diagonal
  clump drifting into a corner. **There is no front line**, because every body walks
  directly at whatever its targeting rule picked and nothing holds a line. Design point 7
  asks the player to be able to see "why a frontline collapses"; there is no frontline to
  collapse.
- **Crowding is not the problem.** 49 bodies at peak is about 64pt of space each, which is
  legible. I had been treating the body count as the legibility risk for two sessions and
  it is the formation that is unreadable, not the density.

**And his screenshots carry a mechanism I had deferred as optional.** Four rounds in, his
player has roughly thirteen bodies, not the twenty-five twelve cards would produce — because
several picks were *"Parasite UP!"* and *"Parasite x2"* rather than *"+2 Parasite"*. Upgrade
and multiplier cards are a body-count SINK: growth goes into strength instead of population.
That is his design point 3, and I had parked it as "needs the square law settled first" when
it is plausibly part of the answer to it — a pick that adds no bodies cannot compound under
Lanchester the way a pick that adds three does. Recorded as a hypothesis with a test, not as
a finding.

**The lesson, and it is one this file already half-carries.** His screenshots are the only
instrument pointed at the real thing, and that entry has always been about bug reports from
a phone. This time he had not reported a bug at all — he asked a plain question about
appearance, and the question exposed two sessions of measuring the wrong property. *Answer
the plain questions properly* now has a third instance behind it.

One smaller instrument failure, in the same turn: my own guard on the operating document's
ceiling asserted on `split('\n').length`, which is one more than `wc -l` on any file ending
in a newline, so it reported 341 against a ceiling of 340 on a file that was correctly at
340. The edit was right and the check was wrong — the file's own top entry, in miniature.

### State of the work

`main` carries `column-v1`, `grandiose-v87`, and the operating document at **340/340** with
The Column added to *Where things are* and a five-line paragraph tightened to four to pay
for it. Nothing was cut that was not restated more briefly.

Open, in order:
- **The formation.** Units need to advance and hold a line rather than converge on a target
  and drift. Sam's call, because it changes how combat looks and feels rather than only how
  it resolves.
- **The square law.** Frontage, density-scaled AOE, or an honest change to the comeback
  rule. Frontage would answer the formation problem at the same time, which is now the
  strongest argument for it.
- **Upgrade and multiplier cards** — specified, unbuilt, and now suspected of being part of
  the square-law answer rather than a later nicety.
- The ledger's arithmetic, in its eleventh session. **The 31st.**

### Three movement rules in one turn, and the third one taught me something

Sam asked what I would recommend from his screenshots. Reading them properly, the armies
are rows sorted by card type packed at each edge, and in one shot the opponent's ranged
Beetanks are still in their opening row while the player's melee has walked to the centre.
Two stable lines with the mobile units meeting between them — never the drifting clump my
preview had produced.

**That looked like it made a rule I had recommended unnecessary.** I had proposed frontage
as a separate mechanic to cap how many bodies engage; in the screenshots the front is four
to six wide because that is simply the width of the field. Frontage looked like something
you get free from correct movement rather than something to add.

So I changed it, three times, and rendered after each:

1. **Separate "who to shoot" from "where to walk."** The clump was caused by units walking
   at whatever their targeting rule picked — a unit targeting the furthest enemy crosses
   the field diagonally. Fixed the clump. **Then the armies walked through each other**,
   because once a lane's enemy died nothing stopped that unit advancing off the far edge.
2. **Forward advance plus a slow lateral drift, and a clamp to the field.** Stopped the
   fly-through. Still not a line.
3. **And the third render showed why, which is the actual finding: the armies arrive in
   SPEED ORDER.** Across a 120-unit gap a Crawler at 2.1 a tick arrives in six seconds and
   an Amabie at 0.28 takes forty. The fast units arrive alone and die before the slow ones
   are there, so there is never a moment when two lines exist to meet.

**Then the go/no-go went from 3 of 3 to 0 of 3, and that is the part worth keeping.**
Decisive pairings fell from 79% to 39%; Karkinos, Volt and Crawler Swarm fell out of every
cycle. The reason is exact: **those are units whose identity is WHERE THEY WALK.** Karkinos
exists to bypass a frontline and reach the backline — which is Sam's own design point 1,
*"fast or assassin-style units may bypass frontlines and threaten vulnerable ranged/support
units."* A global "everyone advances in lane" rule deletes that capability, and the counter
graph collapses because three cards stop being what they are.

So the model is not one movement rule. It is **per-unit**: most cards advance and hold a
line, some are explicitly flankers that cross to the backline, and that distinction has to
live in the data beside `tgt` rather than in the resolver as a global.

Reverted to the measured, passing state rather than shipping a fourth guess. The engine on
`main` still produces the clump; it also still passes 3 of 3, and both of those are true at
once. Which to fix first is Sam's, because it is a decision about how combat feels rather
than how it resolves — and I had already gone three iterations on it without asking, which
is the role boundary this file has an entry about.

**The other thing his screenshots carry**, unchanged from the last section: upgrade and
multiplier cards are load-bearing, not a later nicety. In two of the five shots they are two
of the three cards offered.

### Line and seek, and the frontage rule that turned out to be unnecessary

Sam approved per-card movement and re-attached the manuscript for unit research. Both went
in, and the second one decided the first.

**Three cards seek because the book says so**, not because it suited the model. The
Karkinos *"hauled itself over the wall's crown"*; the crawlers move *"up the walls and
along the ceiling, moving in all planes at once"*; the fireship exists to reach the enemy's
centre. Everything else advances with the army and holds formation. That is research, not
design, and it took four greps.

**Correct formation fixed the square law, so the frontage rule I recommended is not
needed.** A line that holds means extra bodies queue behind it instead of all engaging —
which is exactly what frontage was for. One extra card against an identical army fell
**80% → 59%**; mixed armies settled 95/5 fell **72% → 29%**. Sam's design point 6 now
holds. Unit graph still 3 of 3; match claims 1 of 5 → 3 of 5.

Two canon corrections from the same research: **Karkinos has four legs, not six** — the
six was invented and had been sitting in the design document — and **"Deflector" appears
in the manuscript zero times.** The unit and its name are written for the game; only its
quoted line is the author's, and that line is the Kraken's shield. Both now marked in
`data.js` beside the entry, which is the Grandiose convention for a departure.

### Four wrong turns, all caught by the render rather than by a number

This is the section worth keeping, because the pattern is the same each time and the
instrument that caught it was a picture.

1. **One global movement rule deleted three cards.** The counter graph went 3 of 3 to 0 of
   3 and Karkinos, Volt and Crawler Swarm fell out of every cycle, because their identity
   is *where they walk*. Reverted rather than shipped, then done per card.
2. **"The column marches at the pace of its slowest" is a good sentence and was a bad
   implementation.** The slowest line card is the artillery at 0.28 against a crawler's
   2.1 — a 7.5× spread — so the whole line crawled for forty seconds while ranged cards
   shot it and range decided every battle. `COLUMN_PACE` is one fixed number now, and the
   consequence is worth stating: **`spd` means nothing for a card that marches in
   formation.** It is a seeker's stat. Taking a phrase literally without checking what
   number it produces is the same error as reading a threshold without checking what the
   sample can see.
3. **Line cards with nothing in reach fell through to `continue` and never advanced.**
   Every line card stood on its start line for the entire battle while the seekers fought
   alone. No numeric check said so — the counter graph merely sagged to 36% — and one
   rendered frame showed it instantly: two untouched rows and a scuffle in the middle.
4. **The pace change that changed nothing.** Swapping min-speed for a fixed pace produced
   byte-identical claim output, which was the tell that it could not be the active
   variable: `matchup.mjs` fights single-card-type armies, so both sides march at the same
   rate whatever the rule. The damage had come from neutralising `spd`, not from the pace.

**Rendering is now the cheapest instrument in this project.** Three of those four were
invisible to every number being collected and obvious in one picture, and the pattern is
the reverse of this file's usual entry: normally the code looks fine and the measurement
catches it. Here the measurements looked plausible and the drawing caught it.

### State of the work

`main` carries `column-v1` with line/seek movement, `grandiose-v87`, and the operating
document at 340/340.

| | |
|---|---|
| unit graph | **3 of 3** — 73% decisive, 66 cycles, every unit inside one |
| match claims | **3 of 5** |
| one extra card | 59% (was 80%) |
| mixed armies settled 95/5 | 29% (was 72%) |
| losing on purpose | still does not pay |

Open, in order:
- **Upgrade and multiplier cards.** Specified by Sam, twice now confirmed as load-bearing
  by his screenshots, and the only remaining answer to the 107 bodies on screen.
- **Alternation sits at 65%**, exactly on the boundary. The loser's bonus is very slightly
  light.
- The ledger's arithmetic, in its eleventh session. **The 31st.**

## Instance 12 — 28 August 2026

### The session in one line

Built the upgrade cards Sam's design brief asked for, and while sanity-checking them found
that the previous session's headline balance finding was substantially an artefact of
battles that never finished.

### The defect, which is the thing to carry

**The Volt Battery has range 0.** `reach` filters foes by range *before* targeting, so a
range-0 card never acquires a target — and a card with no target advanced by a **fixed
downfield sign**. It therefore advanced, and kept advancing, past the enemy and into the
far wall. Two batteries finished a battle pinned to opposite edges of the field at full
health, three thousand ticks, a draw, with the aura — the entire card — having touched
nothing.

**28% of battles ended that way**, and `match.mjs` scores a draw as half a win everywhere,
so a third of the sample was voting "contested" without ever being fought. Instance 11's
"line and seek movement is what fixed the square law" was mostly that. With battles that
finish: one extra card **59% → 82%**, mixed armies settled 95/5 **29% → 65%**. The unit
graph went the other way and improved — **86%** of pairings decisive, **126** cycles.

Two general shapes under it, both already in the catalogue and both re-earned:

- **An improvement measured against a metric that a defect deflates is not an
  improvement.** The draw rate was in the resolver's return value the whole time and
  nothing printed it.
- **The unit that never complains is the one with the degenerate stat.** Eleven cards have
  a range and stop when they reach something. One has range 0 and there is no such thing
  as "in reach" for it, so the branch nobody wrote for it is the branch it always takes.

Fixed by marching toward the nearest enemy and never past it, with sideways closing gated
on contact — straight marching is what holds a line, and with no sideways component at all
two lines a few units offset stand level and never touch (that variant draws 17%).
`match.mjs` now asserts fewer than 5% of battles reach the ceiling and prints the rate
beside every contested figure. **A test naming the Volt Battery would have caught the Volt
Battery.**

### The threshold I invented

`match.mjs` asserted "one extra card wins ≤70%". Sam never said 70%; he said numerical
advantage should be **non-linear**. Measuring what he asked for instead — the same
advantage at every army size — says the comeback pick is self-limiting (**94%** of a
two-card army, **75%** of a sixteen-card one) while a *proportional* edge is decisive at
every size (~96%). Frontage does not bend it: swept at 3, 4, 5 and 6 cards a rank,
narrower was **worse**.

**A threshold nobody asked for turns a design question into a failing test**, and the
failing test then buys tuning that answers nothing. Ask what the person actually asked for
before choosing the number that decides whether the answer is yes.

### Upgrades, which did work

Pick tokens: a plain id is a reinforcement, `up:walker` an upgrade. +35% health and every
damage channel per level, three levels, never `count`, armour, range or speed. Offered
only for a type already fielded. **Bodies on screen at match end 107 → 70**, upgrades
**28%** of picks, so reinforcement is not dead either. Alternation moved off its 65%
boundary to 54% — but both changes landed together and **I did not separate them**, which
is the honest state of that number.

### The screen

Sam asked whether the field could look like a tactical map with the units as logos, and
whether cosmetic work comes later. `look.mjs` draws one real tick three ways at 393×852 —
dots, one marker per body, one counter per card. **Identity by glyph, not by hue**: twelve
hues are not tellable apart on a phone and twelve letters are. The per-card treatment
draws half the marks for the same battle. Nothing chosen; it is his.

The engine gained one field for it, `c`, the card a body came from. A renderer that wants
to draw cards would otherwise have to group bodies by position, which is a guess.

### Later the same session — Sam's three decisions, and the game became playable

He answered all three in one message: **counters, one per card**; **leave deliberate losing
legitimate until he has played it**; and, on 65% of compositions settling 95/5, *"it needs
some battlefield variety rather than absolute fixed outcomes"*.

**Read the noun.** He did not ask for softer counters or for randomness in combat — he
named the *battlefield*. Every round is fought on the same empty rectangle, so the same two
armies have one fixed answer. That is his mechanism and it is a better one than anything I
had proposed; the specific form of it is still his to decompress and was deliberately not
guessed at.

`docs/column/index.html`, `ui.js`, `render.js` — the game on a phone. The rule that made it
cheap: **the interface owns nothing**. The deployment between picks is `deployment()`, the
battle is the resolver's own tick sampler, the loser is the resolver's answer, and the card
faces derive their traits from the numbers the resolver reads. There is nothing for the
screen to disagree with, which is the Ledger's oldest defect designed out rather than
tested for.

### Three defects, and only one of them was in the game

1. **Bodies killed during a tick are still in that tick's frame with negative health.** The
   sampler hands over the array captured at the START of the tick. The strength bar was
   drawing at width −2.1, erroring every frame. Found by the first run of `play.mjs`.
2. **`addAll` is atomic.** Adding a bare `./column/` — which the test server 404s — took the
   whole precache down and **every app** lost its offline files, so `test/offline.mjs` went
   red on *Grandiose's* files. The check earned its place: on real Pages the directory would
   have served and this would have shipped as a fault only the test could see.
3. **`test/offline.mjs`'s own parser read a path out of a comment I had just written**
   explaining why that path was not in the list. It strips comments now. A check that goes
   red for a comment teaches you to read red as noise.

### The check that was decoration, caught by mutation and not by reading

`play.mjs`'s "the arithmetic closes" compared the round count on screen with the round count
the harness had just counted itself — two views of the same number. Mutated the game to
spend a life on every *other* round and it **stayed green**. It reads the hearts now, which
is what the player reads. The other mutation, grouping counters by unit type instead of by
card, went red as it should.

**Mutation-testing found this; reading the test did not, and I wrote it.** Both mutations
took two minutes.

### And the answer to his design point 5 flipped

Throwing the opening round now **pays**: +4.3 points across 6,000 paired matches, positive
against all four opponents, because a pick banked early buys an upgrade and upgrades
compound with copies held. He ruled it legitimate until he has played. `match.mjs` no longer
asserts it does not pay — it asserts the edge stays under 15 points, the difference between
a line and the only line. **A test that asserts a thing the owner has decided to allow is a
test that will be ignored**; re-aim it at what he would actually want to know.

### Part three — the gap that blocks the person who has to test it

He asked what the next move was. Before answering I checked whether the thing I had just
shipped could actually be *used*, and it could not: once a match started there was no way
back to the menu or the roster. He could not change opponent without spending five lives or
clearing browser storage, and could not look up a card at the moment he needs to — during a
draft. **"Where is X?" means under-delivered, not broken**, and this was that shape exactly.

Fixed by making the header a pause. Small, and it is the difference between him being able
to give notes and not.

**The check I wrote for it was worthless and mutation testing said so in one run.** With the
close button broken, every part of it still passed — the cards are still in the DOM under
the overlay — and the suite failed thirty seconds later on a click that landed on the sheet.
A crash three steps downstream is not a check doing its job. It asserts the sheet is *gone*
now, and bails rather than playing on.

Second time in one session that a check I had just written was decoration until it was
mutated, and both times reading it had told me nothing. **Write the mutation before
believing the green.**

### Part four — his first three notes, and the trap in the third

He played it and sent three notes: **visual projectiles and AOE**, **damage indicators — a
flash or a slight vibration**, and **flip the screen so the player is at the bottom, with the
cards, rather than looking at the top after every selection.**

All three were interface, all three were unambiguous, and none of them needed discussing.
The instruction to discuss first protects *his design suggestions*; notes correcting my
interface are the other direction and are simply work.

**Notes 1 and 2 were already paid for and nobody had collected.** The resolver has emitted a
full replay log since the engine was written — every hit with attacker, target and damage,
every death, every detonation — and **nothing had ever read it**. So a battle was a crowd of
markers thinning out for no visible reason. Turning `keepLog` on and drawing it answered both
notes with no new rule anywhere: the tracer test is the resolver's own melee cutoff, the
splash ring is the attacker's own `splash`, the detonation is its own `boom.r`. **A ring that
looks wrong means the number is wrong in `data.js`, and it is wrong in the fight too.**

**Note 3 had the trap.** The obvious implementation is to flip the deployment. That would
change the deployment jitter, and with it every seeded battle, every figure in this folder's
tests, and every saved match — a cosmetic note silently rewriting the game. The mirror is one
function in `render.js` and the engine still deploys side 0 at low `y`.

Related and worth keeping: **effects that are correct are still invisible.** Drawing only the
ticks a painted frame stepped over is exactly right, and a short battle plays at one tick a
frame, so every shot flashed for a single 16ms frame and the field looked empty while it was
being fought. Four ticks of overlap fixed it. *Right and unseeable is a defect.*

The new check is a **differential** — zero effects on a drawn-up field, more than zero
mid-battle — and it caught its own first version in one run: aura circles carried the same
class as event effects, so a still field reported four "shots". An absolute count would have
passed on a renderer that draws rings whether or not anything fired.

### Part five — notes four to six, and a layout fault with four causes

His next three: **the screen jumps after picking a card** (with a suggestion — cards as an
overlay), **pressing Continue after every selection is tedious**, and **the win screen is
jammed at the top of the phone**.

**Note 4 was not about the cards.** The deck is a flex sibling of the field, so every pixel
it gains or loses comes out of the battlefield and the whole board slides. His proposed fix —
an overlay — would have worked by taking the cards out of the flex flow, but the cause is
that the deck's height is content-dependent, and the cards were only one of **four** things
changing it:

1. the card row emptying when a pick was committed
2. cards with a four-line hint standing next to cards with two
3. *"Your extra pick — you lost the round"* wrapping to two lines
4. **an empty button being 22px shorter than one with a word in it**

The fourth is the one to keep. `visibility: hidden` keeps a button's **box** and not its
**content**, so hiding it the careful way still resized the deck. And `min-height` was not
enough anywhere: a taller card still grows the row. **The container has to decide, not the
content.**

**The instrument found this, not reading.** A set of every field height seen at every draft
phase, which must have exactly one member. It reported six, then two, then one — and each
time it named which phase disagreed, which is what turned three guesses into three fixes.
**Print what a check saw, not only that it failed.**

**Note 5** is the same shape as his ledger notes: a tap that carries no decision, three times
a round, nine rounds a match. The reveal is still needed — you have to see what you both took
— so it stayed and stopped asking permission. 750ms, and the committed counters land with a
ring; an upgrade lights *every copy* of the card it improved, which is the honest picture of
what that pick did rather than a message saying so.

**Read the noun again:** he said "the screen jumps", not "the cards are wrong". The overlay
was his proposed remedy, not his complaint, and fixing the complaint was better than
implementing the remedy — while his remedy is exactly what the inspect panel became, because
there the content genuinely cannot be bounded.

### Part six — the units drawn, and seven of his own lines returned to him

He asked whether a unit could be more than a shape with a letter, and asked for thoughts
before changes. The measurement came first and it decided the answer: a counter is **23–29pt**
on his phone with a **median 35pt** to its nearest neighbour, so it cannot get bigger, and any
detail has to fit a **14pt mark**. Twelve silhouettes at 14pt are not tellable apart — which is
why it was letters — but the outer shape already carries the weight class, so a glyph only
has to be distinct from the three others in its class, and the roster is **exactly four heavy,
four medium, four light**. That fact is the whole reason this was possible.

**Built the instrument before the design**, again: `test/glyphs.mjs` draws all twelve at both
real sizes with nothing magnified. **Four failed it on the first pass** — the Walker read as a
table, the Brute as a beetle, the Neurite as a head on a lens, the Crawler as a squiggle. All
four were obvious in the picture and none of them were obvious in the path data.

### The bigger finding, and it is a confession

Checking the manuscript for drawing references meant checking the *lines*, word by word, for
the first time. **All twelve are the author's. Seven were marked "written for the game" and
were not.** Four were verbatim and had simply never been checked; three were his words
stitched, and are now restored to the sentences they came from.

**The game had been telling Sam that five of his own sentences were mine.** That is the
fabrication failure running backwards, and it was *caused by the correction to one*: an early
draft gave Varan a line that reads exactly like the book and appears in it zero times, and the
session that caught that over-corrected into marking anything unverified as invented — and
nobody went back with the manuscript open.

Same shape at the Karkinos: it has **six legs**. The manuscript says both, *"four vast legs"*
of one machine and *"six legs apiece"* of the squads; a previous session read the first,
declared six an invention, and wrote that down in a comment that has been quoted twice since.

**An over-correction is a fabrication.** "Unverified" and "invented" are not the same claim,
and `data.js` now separates the two questions it had blurred: `qv` for whose the line is,
`nv` for whose the unit is.

### The module nobody would have noticed was missing

`glyphs.js` was a new file in the page's module graph and not in `docs/sw.js`. **Online it
loads; offline the page paints nothing and says nothing** — the worst shape a fault can have,
invisible to everyone who can see it. Found by hand.

Mechanised rather than remembered: `test/offline.mjs` now walks the import graph from each
published page and asserts every module it reaches is named in the worker's list. **Its own
first version followed three files and stopped at the page**, because a page enters its module
graph through a `<script src>` and not an import statement — it would have passed with every
module in the game missing.

Also caught: the roster still said *"a marker's letter is the card"* after the letters were
gone. Interface copy going stale in meaning while its digits stay right, which is already in
the catalogue and got past me anyway.
