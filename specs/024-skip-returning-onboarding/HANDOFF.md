# Handoff — 024-skip-returning-onboarding

**Outgoing agent:** Claude Opus 4.7 **Handoff date:** 2026-04-18 **Git branch:**
`024-skip-returning-onboarding` **Worktree path:**
`E:/Work/My Projects/Monyvi/.claude/worktrees/024-skip-returning-onboarding`
**Worktree type:** linked worktree (the main checkout at
`E:/Work/My Projects/Monyvi` is on an unrelated branch
`refactor/dashboard-polish-round1`) **GitHub issue:**
[#226 — Skip onboarding flow (language, currency, wallet creation) for returning users](https://github.com/Msamir22/Astik/issues/226)

> The incoming agent MUST operate from the **Worktree path** above. If your
> session is not already there, `cd` into it before doing anything else. Do not
> create a new worktree or check the branch out elsewhere. The repo has been
> renamed from "Rizki" to "Monyvi"; the worktree's `.git` pointers were repaired
> earlier in this session — if `git status` errors with a stale "Rizki" path,
> report it back to the user rather than attempting a self-repair.

## Feature summary

Returning users on a reinstall or new device currently see the full onboarding
flow again (Language → Slides → Currency → Cash-account confirmation) because
the existing gate at `apps/mobile/app/index.tsx` reads an AsyncStorage flag that
is empty after a fresh install. This feature replaces that gate with a
server-authoritative one driven by `profiles.onboarding_completed` in
WatermelonDB (seeded on sign-in via a blocking pull-sync). New columns are added
to support per-step resume. Currency becomes mandatory (no skip), and a new
retry screen handles slow/failed syncs with Retry + Sign out actions.

## Spec artifacts

- Spec: [`specs/024-skip-returning-onboarding/spec.md`](./spec.md) — 4 user
  stories (US1 P1 returning-user-to-dashboard, US2 P1 new-user-full-flow, US3 P2
  partial-resume, US4 P2 retry-on-sync-failure), 14 functional requirements, 6
  measurable success criteria
- Plan: [`specs/024-skip-returning-onboarding/plan.md`](./plan.md) —
  file-by-file change map, constitution gate all-green, rationale per-principle
- Tasks: [`specs/024-skip-returning-onboarding/tasks.md`](./tasks.md) — 43 tasks
  across 7 phases (TDD-first; tests must FAIL before implementation)
- Clarifications: inline in `spec.md` `## Clarifications` section (4 Q&A
  resolved 2026-04-18)
- Research: [`specs/024-skip-returning-onboarding/research.md`](./research.md) —
  9 investigations, all resolved
- Data model:
  [`specs/024-skip-returning-onboarding/data-model.md`](./data-model.md)
- Contracts:
  [`specs/024-skip-returning-onboarding/contracts/profile-service.ts`](./contracts/profile-service.ts)
  — TypeScript signatures for the 4 mutations + routing-decision function +
  sync-provider extension + log payload
- Quickstart:
  [`specs/024-skip-returning-onboarding/quickstart.md`](./quickstart.md) —
  implementer hand-off with migration commands and manual QA checklist
- Checklists:
  [`specs/024-skip-returning-onboarding/checklists/requirements.md`](./checklists/requirements.md)
  — all 16 quality items pass
- **Mockups (approved)**:
  - [`specs/024-skip-returning-onboarding/mockups/retry-sync-screen.png`](./mockups/retry-sync-screen.png)
    — Variant 2 "Status Card" approved 2026-04-18
  - [`specs/024-skip-returning-onboarding/mockups/retry-sync-screen.html`](./mockups/retry-sync-screen.html)
    — annotated HTML reference with implementer warnings in the file-header
    comment

## Key decisions made during spec/plan/tasks

These are the non-obvious calls confirmed by the user during this session. They
are not all derivable from the spec/plan text alone:

- **Anonymous auth is out of the product** per
  `docs/business/business-decisions.md` (2026-03-09 decision). The spec
  explicitly contains no anonymous-account scenarios, FRs, or assumptions. Early
  drafts referenced anon flows (lifted from the GitHub issue body); they were
  stripped.
- **Terminology: "account" / "cash account", NEVER "wallet"**. The codebase uses
  `accounts` (see `packages/db/src/schema.ts` and `base-account.ts`). The user
  explicitly corrected this. Any new UI copy or service naming must use
  "account". The existing `WalletCreationStep.tsx` component name is retained
  for blast-radius control; it conceptually represents the "cash-account
  confirmation" step in the spec.
- **The onboarding flow is 4 steps, not 3** as issue #226 implied: Language →
  Slides carousel → Currency → Cash-account confirmation. The slides carousel
  was missing from the issue text; it exists today in
  `apps/mobile/app/onboarding.tsx`. The spec was rewritten mid-clarify session
  to reflect reality.
- **Currency is mandatory (FR-009, no skip)**. The existing
  `CurrencyPickerStep.tsx` has an `onSkip` prop and a Skip button; both must be
  removed. The previously-intended "timezone-based auto-currency on skip"
  behavior (that the user initially recalled) is NOT how the code works today —
  timezone detection only pre-selects an item in the picker; Skip today creates
  no cash account. User confirmed: remove skip entirely.
- **Single overall flag `profiles.onboarding_completed` as the routing gate, NOT
  a derived signal** (FR-011). Per-step signals (`preferred_language`,
  `slides_viewed`, cash-account presence) are used ONLY for the resume-point
  decision when the flag is false. Dedicated vs. derived was an early ambiguity;
  dedicated won in Clarification Q1.
- **`onboarding_completed` flips on dismissing the cash-account confirmation
  message** (the final step), NOT earlier. User picked this explicitly when
  asked about the trigger point.
- **The existing `profiles.onboarding_completed` column is reused, semantically
  redefined.** It was historically (incorrectly) wired to represent "slides
  viewed" and was never consumed by any component. We are NOT renaming it — too
  destructive for a pre-production app — but we ARE adding a separate
  `slides_viewed` column for the per-step signal, and the repurposed
  `onboarding_completed` now means "reached end of flow".
- **New columns**: migration
  `040_add_language_and_slides_viewed_to_profiles.sql` adds
  `preferred_language TEXT NULL` and
  `slides_viewed BOOLEAN NOT NULL DEFAULT FALSE` to `profiles`. No other schema
  changes.
- **`preferred_language` is newly persisted server-side** — today it only lives
  in AsyncStorage (`LANGUAGE_KEY`). The legacy key gets a deprecation JSDoc in
  Phase 2 (T015); we do NOT delete it this feature — follow-up issue T042.
- **`hasCashAccount` (Option B), not `hasPreferredCurrency`, is the "user
  completed currency step" signal** in the routing decision. Rationale:
  `profiles.preferred_currency` is NOT NULL and seeded by `handle_new_user()`
  trigger, so a NULL check is unreliable. Cash-account presence is unambiguous
  (cash account is only created AFTER currency is confirmed per FR-010). User
  confirmed on 2026-04-18 with the mockup approval.
- **The app is offline-first — onboarding writes go to WatermelonDB first;
  Supabase push-sync is non-blocking.** The ONLY blocking network operation in
  this feature is the on-sign-in pull-sync that seeds the local profile row;
  this is a one-time cost per install, and the existing `InitialSyncOverlay`
  already covers its UI. This was not obvious and was clarified mid-session
  (user corrected an earlier framing where I treated onboarding writes as
  needing connectivity).
- **Blocking pull-sync on sign-in is required** and must be verified /
  implemented (T011/T012). `SyncProvider` sets `isInitialSync` today but
  `index.tsx` does NOT await it — today's routing decision runs BEFORE sync
  completes. This is the actual root cause of issue #226, surfaced during
  research.
- **Sync failure timeout is 20 seconds** (Clarification Q2). If the pull-sync
  has not resolved within that window, the router shows `RetrySyncScreen`. User
  picked "forgiving" over "aggressive".
- **Retry-screen mockup: Variant 2 "Status Card" approved.** Stitch project:
  `projects/10917437892104454921`. Critical caveat: the Stitch HTML includes a
  top-app-bar with a Close (X) button and "Sync Status" title — this MUST be
  omitted in the React Native component. The retry screen has no valid close
  destination; only Retry and Sign out are legitimate actions. Comment banner is
  in the HTML file header for the implementer.
- **Observability (FR-014)**: single info-level `onboarding.routing.decision`
  log per gate evaluation, with outcome + 4 booleans + syncState. No PII.
- **Pre-production → no migration strategy needed** (Assumption 5). Pre-release
  devices with legacy AsyncStorage state will flow through the new onboarding
  once and land correctly.
- **MVP = US1 + US2 combined** (both P1). Shipping US1 alone would be broken:
  today's onboarding writes AsyncStorage, not the profile, so a new user would
  complete the flow and then be sent back to onboarding on next launch. Both P1s
  must ship together. US3 and US4 are true independent increments on top.
- **Planning-phase blockers both resolved** as of 2026-04-18: mockups approved
  (T001 ✅) and currency-signal decision made (T002 ✅). Phase 2 can start
  immediately.

## Open questions / risks

- **Is the existing `handle_new_user()` trigger seeding `preferred_currency`
  with a specific default** we need to be aware of? Not strictly relevant under
  Option B (we use cash-account presence instead), but worth a quick look during
  T004 / T014 if a weird default appears. Low risk.
- **Does the existing `logout-service.ts` expose a callable `signOut()` suitable
  for the retry screen?** Research.md § 5 assumes yes. T034 includes a fallback
  note: treat any discrepancy as a sub-investigation — do not invent a new
  logout path.
- **i18n: Arabic copy for the new retry-screen strings**
  (`common.sync_failed_title`, `common.sync_failed_description`) needs to be
  written. The implementer can translate or the user may want to handle it
  explicitly. Non-blocking for US1/US2 MVP.
- **No feature flag / staged rollout** was designed, intentionally
  (pre-production). Confirm at implement-time that this is still acceptable.
- **End-to-end coverage** (Maestro) is listed as "if time permits" in
  research.md § 8. Jest integration tests are mandatory; Maestro is optional.

## Anchors the incoming agent must respect

- Constitution: `.specify/memory/constitution.md` (highest authority). Seven
  principles; all pass for this feature.
- Project rules: `CLAUDE.md` at repo root — enforces NativeWind v4,
  offline-first, service-layer separation, strict typing, TDD.
- Business decisions: `docs/business/business-decisions.md` — update required
  per Constitution II (tracked as T014).
- NativeWind v4 crash rule: no `shadow-*` / `opacity-*` / `bg-color/opacity` on
  `TouchableOpacity` or `Pressable`. Use inline `style` for those cases. Pattern
  reference: `apps/mobile/components/onboarding/WalletCreationStep.tsx` lines
  230-241.

## Next steps for the incoming agent

1. Read this entire file, then read `spec.md`, `plan.md`, and `tasks.md` end to
   end.
2. Read `CLAUDE.md` and the constitution.
3. Run `/speckit.analyze` to produce a gap analysis across the three spec
   artifacts.
4. **Gap-handling protocol:**
   - If gaps are found and you are confident you can fill them without
     introducing new decisions the user should weigh in on, fill them directly
     (edit `spec.md` / `plan.md` / `tasks.md` as appropriate), then re-run the
     analysis to confirm no gaps remain.
   - If any gap requires a judgment call the user should approve (ambiguous
     requirement, architectural trade-off, business rule not documented), write
     a `gap-analysis.md` under `specs/024-skip-returning-onboarding/` describing
     each open item and STOP. Wait for user approval.
5. Once no gaps remain (or the user approves your resolutions), proceed to
   `/speckit.implement`.

**First task when implement begins** (T003 in Phase 2): write the migration SQL
at `supabase/migrations/040_add_language_and_slides_viewed_to_profiles.sql`. See
data-model.md § 6 for the exact SQL body.
