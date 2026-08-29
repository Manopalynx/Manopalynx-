#!/bin/bash
# SessionStart hook.
#
# Six jobs, in this order. Each exists because the thing it prints was got
# wrong by a session that had every reason to think it had it right.
#
#   1. Say out loud which commit the session actually started from, and complain
#      if it is not built on main. On 15 August 2026 a session started from a
#      pinned `claude/*` branch instead of main, silently loaded that branch's
#      older CLAUDE.md, and so never imported workingwithsam.md at all. Nothing
#      about that was visible from inside the session -- the agent had a
#      plausible-looking CLAUDE.md and no reason to doubt it. This check exists
#      to make that failure loud instead of silent.
#
#      AND THE LOCAL `main` REF SEPARATELY, because HEAD being right does not
#      make `main` right. On 29 August 2026 the working branch was correctly
#      based on origin/main while the local `main` was an UNRELATED history
#      from ten days earlier with no Column in it at all. `git checkout main`
#      refused, which was luck -- `git show main:docs/column/ui.js` would have
#      answered quietly and wrongly, and an instance checking "what is live"
#      that way reads a smaller project and believes it. That is the same trap
#      as a stale base, one ref along: it does not read as stale.
#
#      IT NOW REPAIRS THAT REF rather than printing the command, having printed
#      the command for two sessions running and watched both run it by hand.
#      The repair is loud and reversible; the reasoning is at the code.
#
#   2. Install the test dependency, so `node test/*.mjs` works without a manual
#      `npm i` first -- AND THEN ACTUALLY LAUNCH A BROWSER, because this step
#      used to report on npm's exit code while claiming the browser suites were
#      ready, which are two different facts. The one that breaks is the browser.
#
#   3. Measure workingwithsam.md against its own line ceiling and print the
#      headroom. The rule lives inside the file it governs -- "if your edit
#      takes this file over 340 lines, remove something in the same edit" --
#      and it binds at the END of a session, when context is longest and rules
#      are most likely to be skimmed. It also depends on the instance
#      remembering to run wc at that moment. Printing the number at the start
#      removes the remembering: it is in front of the instance hours before
#      the edit it governs. The predecessor file reached 1,483 lines, so the
#      failure this guards against is one that has already happened once.
#
#   4. Print the version constants and name the project. `docs/data.js` BUILD
#      and `docs/sw.js` CACHE are one number written twice -- test/offline.mjs
#      exists partly to catch them disagreeing -- and every shipped change has
#      to bump them by hand. Better read before the edit than after the suite
#      says so. The project line comes off the branch name and stays silent
#      when the name says nothing, because a guess would point an instance at
#      the wrong document, which is worse than no line.
#
#   5. Print which Instance number HISTORY.md ends at. Job 6 tells the session
#      to append a numbered section to that file and NOT to read it; the number
#      it needs, and the command for getting it cheaply, both live inside the
#      file it was told not to open. One grep closes the loop.
#
#   6. Print what the session owes at the end of it. The obligation is written
#      in workingwithsam.md under "End of session", but that file used to carry
#      the same thing as a prohibition in its footer and instances skimmed past
#      it. A hook fires at the start and cannot nag at the end, so it states the
#      debt up front, where step 1 is already read.
#
# stdout from a SessionStart hook is fed to the agent as context, so anything
# echoed here is read at the top of the session.
#
# Never exit non-zero: a failure here must not stop the session starting.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# ---------------------------------------------------------------- branch guard

if git rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  head=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

  git fetch -q origin main 2>/dev/null

  if git rev-parse --verify -q origin/main >/dev/null 2>&1; then
    behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")

    if [ "$behind" = "0" ]; then
      echo "Session base: '$branch' at $head, built on current main. Good."
    else
      # Detached HEAD is not a branch name, so -B cannot be handed it.
      if [ "$branch" = "HEAD" ]; then
        fix='git checkout -B <your-working-branch> origin/main'
      else
        fix="git checkout -B \"$branch\" origin/main"
      fi
      cat <<MSG
=============================================================================
WRONG BASE -- this session did NOT start from main.

  branch          : $branch
  HEAD            : $head
  behind main by  : $behind commit(s)

The CLAUDE.md now loaded is the one from $head, NOT the one on main. If this
base predates 15 August 2026 it imports only README.md, which means
workingwithsam.md -- the operating document, and the map of which project is
which -- has NOT been loaded. Do not trust your loaded context.

Fix before doing any work:

  $fix

then read CLAUDE.md and workingwithsam.md from disk, because the harness will
not re-import them mid-session.

Tell Sam this happened, with the evidence rather than the inference. The
environment's pinned source revision is readable from inside the session:
call get_session (claude-code-remote MCP) with no session_id and read
session_context.sources[].git_repository.revision. If that is not
refs/heads/main, it is the cause, and it will keep happening until it is
changed. Quote the value you read; do not assert the cause without it.
=============================================================================
MSG
    fi
  else
    echo "Session base: '$branch' at $head. Could not reach origin/main, so the base is unverified."
  fi

  # ------------------------------------------------------ the local `main` ref
  # A separate question from HEAD, and silent when it is wrong: `git show
  # main:<path>` and `git log main` answer from whatever `main` points at, with
  # no hint that it is not what is published.
  #
  # IT REPAIRS THE REF NOW RATHER THAN PRINTING THE FIX. It printed the fix for
  # two sessions running and both ran it by hand, which is a manual step the
  # hook was already in a position to take. What made that safe is measured
  # rather than assumed: on 29 August 2026 the stale main was 80e7300, and
  #
  #   git merge-base origin/main 80e7300   -> nothing. NO common ancestor.
  #   every one of its 75 file paths       -> present in origin/main's 103.
  #
  # It was not a stale main, it was an unrelated root history wearing the name,
  # and it held nothing unique. The "50 commits on local main only" the hook
  # used to print reads alarming and is not.
  #
  # It is still not silent, because a ref moving under an instance without
  # saying so is the exact failure this whole section exists to prevent: it
  # prints both shas, and it parks the old tip on a branch so the repair is
  # reversible by anyone who reads this at all.
  if git rev-parse --verify -q refs/heads/main >/dev/null 2>&1 &&
     git rev-parse --verify -q origin/main >/dev/null 2>&1 &&
     [ "$(git rev-parse main)" != "$(git rev-parse origin/main)" ]; then
    only=$(git rev-list --count origin/main..main 2>/dev/null || echo "?")
    lag=$(git rev-list --count main..origin/main 2>/dev/null || echo "?")
    was=$(git rev-parse --short main)
    now=$(git rev-parse --short origin/main)

    if [ "$branch" = "main" ]; then
      # `git branch -f` refuses to move the branch you are standing on, and it
      # is right to. Nothing to do but say so.
      cat <<MSG
-----------------------------------------------------------------------------
STALE LOCAL main -- '$was', not origin/main '$now'.

  commits on local main only : $only
  commits it is missing      : $lag

You are ON main, so the hook cannot move it for you. The base check above is
the one that matters. To repair by hand:

  git fetch origin main && git reset --hard origin/main
-----------------------------------------------------------------------------
MSG
    elif git branch -f main-before-hook-repair main 2>/dev/null &&
         git branch -f main origin/main 2>/dev/null; then
      cat <<MSG
-----------------------------------------------------------------------------
STALE LOCAL main -- REPAIRED by this hook.

  main was : $was
  main now : $now   (= origin/main, which is what GitHub Pages serves)

It had $only commit(s) origin/main did not, and was missing $lag that it has.
A large first number is normal and is not lost work: the ref has twice been an
unrelated history wearing the name rather than a stale copy of this one.

The old tip is kept on 'main-before-hook-repair', so this is reversible:

  git branch -f main main-before-hook-repair

Read 'origin/main' by preference regardless. It is the published truth and it
cannot go stale between the fetch above and whatever you do next.
-----------------------------------------------------------------------------
MSG
    else
      cat <<MSG
-----------------------------------------------------------------------------
STALE LOCAL main -- '$was', not origin/main '$now', AND THE REPAIR FAILED.

  commits on local main only : $only
  commits it is missing      : $lag

Anything you read through 'main' -- git show main:<path>, git log main, a diff
against main -- is answering from that ref and will NOT say it is stale. Read
'origin/main' instead, or repair it by hand:

  git fetch origin main && git branch -f main origin/main
-----------------------------------------------------------------------------
MSG
    fi
  fi
fi

# ------------------------------------------------------------------- test deps

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -f package.json ]; then
  if npm install --no-audit --no-fund >/tmp/npm-install.log 2>&1; then
    # AND THEN LAUNCH ONE, because npm's exit code is a fact about npm.
    #
    # This line used to read "Browser suites are ready to run" off `npm
    # install` succeeding, which is a claim about a package manager dressed as
    # a claim about a browser. The failure it has to catch does not touch npm
    # at all: each Playwright release only looks for the Chromium build it
    # shipped with, so an unpinned install resolves to a version whose browser
    # is not on this machine and every browser suite dies at launch with
    # "Executable doesn't exist at .../chromium_headless_shell-1234". That
    # reads as a broken repository and has already cost a whole session once.
    # An install that succeeded would have printed "ready to run" through all
    # of it.
    #
    # Two seconds, and the sentence becomes measured instead of inferred.
    launch=$(node -e "
      import('playwright')
        .then(({ chromium }) => chromium.launch())
        .then(b => Promise.all([b.version(), b.close()]))
        .then(([v]) => console.log(v))
        .catch(e => { console.log('FAIL ' + String(e.message).split('\n')[0]); process.exit(1); })
    " 2>&1)

    if [ $? -eq 0 ]; then
      echo "Test dependencies installed. Chromium launches ($launch) -- browser suites are ready."
    else
      echo "Test dependencies installed, BUT CHROMIUM WILL NOT LAUNCH. Browser suites"
      echo "will all fail at startup, which reads as a broken repository and is not:"
      echo "  $launch"
      echo "Check that playwright in package.json is pinned to an exact version with no"
      echo "caret, then run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm i"
    fi
  else
    echo "npm install FAILED. Browser suites will not run until this is fixed:"
    tail -15 /tmp/npm-install.log
  fi
fi

# ----------------------------------------------------------------- doc ceiling

if [ -f workingwithsam.md ]; then
  lines=$(wc -l < workingwithsam.md | tr -d ' ')
  ceiling=340
  spare=$(( ceiling - lines ))

  if [ "$spare" -gt 0 ]; then
    echo "workingwithsam.md: $lines of $ceiling lines, $spare spare."
  elif [ "$spare" -eq 0 ]; then
    echo "workingwithsam.md: $lines of $ceiling lines. No headroom -- an addition must remove something in the same edit."
  else
    echo "workingwithsam.md: $lines lines, OVER the $ceiling ceiling by $(( -spare )). Remove something before adding anything."
  fi
fi

# -------------------------------------------------------- which project, and its version
# Three published apps share one cache, and `docs/data.js` BUILD must equal
# `docs/sw.js` CACHE or `test/offline.mjs` fails. Both numbers have to be bumped
# by hand on every shipped change, so the session should be looking at them
# before it edits rather than after the suite says they disagree.

gbuild=$(sed -n "s/^export const BUILD = '\(.*\)';$/\1/p" docs/data.js 2>/dev/null)
cbuild=$(sed -n "s/^export const BUILD = '\(.*\)';$/\1/p" docs/column/data.js 2>/dev/null)
cache=$(sed -n "s/^const CACHE = '\(.*\)';$/\1/p" docs/sw.js 2>/dev/null)

if [ -n "$cache" ]; then
  if [ "$gbuild" = "$cache" ]; then
    echo "Versions: Grandiose $gbuild, Column $cbuild, cache $cache. BUILD and CACHE agree."
  else
    echo "Versions: Grandiose ${gbuild:-?}, Column ${cbuild:-?}, cache $cache -- BUILD AND CACHE DISAGREE, which test/offline.mjs fails on."
  fi
fi

# The branch name is the only hint the session carries about which of the four
# projects it is for, so say which document to open rather than leaving each
# instance to infer it. Silent when the name says nothing -- a guess here would
# point an instance at the wrong document, which is worse than no line at all.
case "$branch" in
  *ledger*|*uplift*) echo "Project: the Ledger, most likely -- its document is README.md." ;;
  *matchbox*)        echo "Project: Matchbox, most likely -- its document is MATCHBOX.md." ;;
  *column*)          echo "Project: The Column, most likely -- its document is docs/column/README.md." ;;
  *grandiose*)       echo "Project: Grandiose, most likely -- its document is docs/README.md." ;;
esac

# ------------------------------------------------------------ end-of-session debt
# The number and date the section below asks for live in HISTORY.md, and so does
# the command for reading them without paying for the whole 92kB file. Both are
# behind the same door the instruction says not to open, so the hook opens it.

if [ -f HISTORY.md ]; then
  last=$(grep '^## Instance' HISTORY.md | tail -1)
  n=$(printf '%s' "$last" | sed -n 's/^## Instance \([0-9]*\).*/\1/p')
  [ -n "$last" ] && echo "
HISTORY.md ends at '${last#\#\# }'. Yours is Instance $(( ${n:-0} + 1 ))."
fi

cat <<'MSG'

Before this session ends, three things it owes -- "End of session" in
workingwithsam.md is the authority, this is only the reminder:

  1. Append a dated, numbered section to HISTORY.md. Unconditionally, whether
     or not the session felt worth recording. Do NOT read that file to do it;
     its header carries the two commands that cost 19kB instead of 91kB.
  2. Change workingwithsam.md only if something in it is now wrong or a new
     class appeared -- and if that breaks its 340-line ceiling, remove
     something in the same edit. Most sessions should change nothing there.
  3. Merge to main, and send Sam BOTH committed files unprompted --
     workingwithsam.md and HISTORY.md. A push to a working branch does not
     reach him: CLAUDE.md imports from main, so nothing takes effect until it
     is there, and a file sent before the push is a copy of something that may
     still change.
MSG

exit 0
