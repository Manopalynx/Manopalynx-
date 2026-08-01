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
  `docs/sw.js` on every change** or he gets a stale build. Currently `grandiose-v26`.
- He is **phone-only — no computer.** He cannot run tests or read a diff. Screenshots are
  his bug reports and they are good ones. Everything must be verified before he sees it.
- 180 tests plus a five-viewport Playwright probe (`docs/test/ui.probe.mjs`, run by hand
  against a local server). The probe catches what unit tests can't: things that move under
  a thumb, text that doesn't render, figures on screen that disagree with the engine.

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

**Keep replies short.** A long final message cost him 61% of a usage window. Lead with what
changed, cut the narration. This is a real constraint, not a style note.

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
