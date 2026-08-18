# History — the session sections

Eight sessions, verbatim as each instance wrote them, oldest first. Nothing here has been
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
