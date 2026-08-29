#!/bin/bash
# SessionStart hook.
#
# Four jobs, in this order:
#
#   1. Say out loud which commit the session actually started from, and complain
#      if it is not built on main. On 15 August 2026 a session started from a
#      pinned `claude/*` branch instead of main, silently loaded that branch's
#      older CLAUDE.md, and so never imported workingwithsam.md at all. Nothing
#      about that was visible from inside the session -- the agent had a
#      plausible-looking CLAUDE.md and no reason to doubt it. This check exists
#      to make that failure loud instead of silent.
#
#   2. Install the test dependency, so `node test/*.mjs` works without a manual
#      `npm i` first.
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
#   4. Print what the session owes at the end of it. The obligation is written
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
fi

# ------------------------------------------------------------------- test deps

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -f package.json ]; then
  if npm install --no-audit --no-fund >/tmp/npm-install.log 2>&1; then
    echo "Test dependencies installed. Browser suites are ready to run."
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

# ------------------------------------------------------------ end-of-session debt

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
