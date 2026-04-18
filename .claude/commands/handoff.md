---
description:
  Generate a handoff package so a different agent (in a fresh session) can pick
  up speckit work after /speckit.tasks and continue through /speckit.analyze and
  /speckit.implement. Writes specs/<slug>/HANDOFF.md and prints a paste-ready
  prompt for the receiving agent.
---

## User Input

```text
$ARGUMENTS
```

The argument is the **feature slug** — the directory name under `specs/` (e.g.
`001-optimize-logout`). Required, because the outgoing agent may be running in a
worktree whose branch name does not match the spec folder.

If `$ARGUMENTS` is empty, STOP and ask the user for the slug. Do not guess.

## What this command does

You are the **outgoing agent** (the one who has been driving spec → plan →
tasks). Your job now is to package everything the **incoming agent** needs to
resume in a new session with zero prior context, run `/speckit.analyze`, fill
any gaps autonomously where safe, and proceed to `/speckit.implement`.

Produce two artifacts:

1. `specs/<slug>/HANDOFF.md` — the canonical handoff document the incoming agent
   will read first.
2. A **paste-ready prompt** printed in your final message that the user can copy
   into the new agent's session. The prompt must instruct the new agent to read
   `HANDOFF.md` before doing anything else.

## Steps

1. **Resolve the feature directory.** Set `FEATURE_DIR = specs/<slug>`. Verify
   it exists. Verify `spec.md`, `plan.md`, and `tasks.md` are all present. If
   any are missing, STOP and tell the user which file is missing — handoff is
   only valid after `/speckit.tasks` has completed.

2. **Gather context from the current session.** Reflect on the conversation so
   far and extract:
   - The original user ask (feature or bug, with GitHub issue link if any).
   - Key decisions made during `/speckit.specify`, `/speckit.clarify` (if run),
     `/speckit.plan`, and `/speckit.tasks` — especially decisions that are not
     obvious from reading the three spec files alone (trade-offs, rejected
     alternatives, assumptions the user confirmed).
   - Open questions or known risks still outstanding.
   - Any user-specific preferences surfaced during the session that should carry
     over.

3. **Capture the working location the incoming agent must use.** The outgoing
   agent is often running in a git worktree (the user runs multiple parallel
   sessions, so each feature lives on its own worktree rather than a shared
   branch), so the incoming agent needs to know exactly where to work — not just
   the branch name. Capture all of:
   - Current branch: `git branch --show-current`
   - Current worktree path (repo toplevel): `git rev-parse --show-toplevel`
   - Whether this is the main checkout or a linked worktree, via
     `git worktree list --porcelain` — identify the entry matching the toplevel
     above. Record all three in the handoff. The incoming agent MUST operate
     from the same worktree path. If its session is spawned elsewhere, its first
     action (after reading the handoff) is to `cd` into that path. It MUST NOT
     create a new worktree or check the branch out into a different location.

4. **Write `specs/<slug>/HANDOFF.md`** using this structure. Use real content
   from the session — do not leave placeholders.

   ```markdown
   # Handoff — <feature slug>

   **Outgoing agent:** <model name, e.g. Claude Opus 4.7> **Handoff date:**
   <YYYY-MM-DD> **Git branch:** <branch name> **Worktree path:** <absolute path
   from `git rev-parse --show-toplevel`> **Worktree type:** <"main checkout" |
   "linked worktree"> **GitHub issue:** <link, or "none">

   > The incoming agent MUST operate from the **Worktree path** above. If your
   > session is not already there, `cd` into it before doing anything else. Do
   > not create a new worktree or check the branch out elsewhere.

   ## Feature summary

   <2–4 sentences: what we are building/fixing and why. Plain English.>

   ## Spec artifacts

   - Spec: `specs/<slug>/spec.md`
   - Plan: `specs/<slug>/plan.md`
   - Tasks: `specs/<slug>/tasks.md`
   - Clarifications (if any): `specs/<slug>/clarifications.md` or inline in spec
   - Checklists: `specs/<slug>/checklists/` (if present)

   ## Key decisions made during spec/plan/tasks

   <Bulleted list. Focus on non-obvious decisions: rejected alternatives,
   trade-offs the user confirmed, scope boundaries, explicit non-goals. Each
   bullet should be self-contained — the incoming agent has no conversation
   history to fall back on.>

   ## Open questions / risks

   <Anything still uncertain, any area you flagged as "revisit during
   implement", any dependency on external decisions. If none, write "None
   identified.">

   ## Anchors the incoming agent must respect

   - Constitution: `.specify/memory/constitution.md` (highest authority)
   - Project rules: `CLAUDE.md` at repo root

   ## Next steps for the incoming agent

   1. Read this entire file, then read `spec.md`, `plan.md`, and `tasks.md` end
      to end.
   2. Read `CLAUDE.md` and the constitution.
   3. Run `/speckit.analyze` to produce a gap analysis across the three spec
      artifacts.
   4. **Gap-handling protocol:**
      - If gaps are found and you are confident you can fill them without
        introducing new decisions the user should weigh in on, fill them
        directly (edit `spec.md` / `plan.md` / `tasks.md` as appropriate), then
        re-run the analysis to confirm no gaps remain.
      - If any gap requires a judgment call the user should approve (ambiguous
        requirement, architectural trade-off, business rule not documented),
        write a `gap-analysis.md` under `specs/<slug>/` describing each open
        item and STOP. Wait for user approval.
   5. Once no gaps remain (or the user approves your resolutions), proceed to
      `/speckit.implement`.
   ```

5. **Print the paste-ready prompt** to the user as your final message. It must
   be a single self-contained block the user can copy into the new agent's
   session. Use this template (substitute `<slug>` with the real slug):

   ```
   You are taking over a spec-driven-development task from a previous
   session. A handoff file has been prepared for you.

   The prior session was running in a git worktree. You MUST work from the
   same worktree path listed in the handoff — do not create a new worktree,
   do not check the branch out elsewhere, do not operate from the main
   checkout unless the handoff explicitly says that is where the work lives.

   Before doing anything else:
   1. Read `specs/<slug>/HANDOFF.md` end to end.
   2. If your current working directory is not the "Worktree path" listed
      at the top of that file, `cd` into it before any other action. Verify
      with `git rev-parse --show-toplevel` and `git branch --show-current`.
   3. Read the three spec artifacts (`spec.md`, `plan.md`, `tasks.md`) end
      to end.
   4. Read `CLAUDE.md` at the repo root and `.specify/memory/constitution.md`.

   Then follow the "Next steps for the incoming agent" section of the
   handoff file. In short: run `/speckit.analyze`, fill gaps autonomously
   where safe, pause for my approval only if a gap requires a judgment call
   I should weigh in on, and otherwise proceed to `/speckit.implement`.

   Do not summarize the handoff back to me. Start by reading.
   ```

6. **Do not run `/speckit.analyze` or `/speckit.implement` yourself.** Your job
   ends at producing the handoff. The incoming agent drives the rest.

## Constraints

- Do not modify `spec.md`, `plan.md`, or `tasks.md` during handoff.
- Do not invent decisions that were not actually made in the session. If you are
  unsure whether something was decided, list it under "Open questions" rather
  than "Key decisions".
- If `HANDOFF.md` already exists at the target path, read it first and ask the
  user whether to overwrite or append a new section — do not silently clobber a
  prior handoff.
