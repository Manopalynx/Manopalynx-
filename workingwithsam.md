# Working with Sam — running context

A handoff between Claude instances. Each one appends a dated section at the end.
Paste the whole file into a new chat to hand over the context this one had to earn.

**Keep it pruned.** This gets pasted into every future session, so it costs context every
time. Correct entries in place rather than stacking contradictory versions, and delete
what has gone stale. If it stops being worth its length, cut it back hard.

**Don't duplicate the repo.** `CLAUDE.md` imports `README.md` automatically, so the
target browser, how to run the tests, known issues and coverage gaps arrive on their own.
This file is for what the repo can't say.

---

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
