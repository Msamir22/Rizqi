---
description: "Task list for feature 025-dashboard-scroll-jump"
---

# Tasks: Stable Dashboard Layout During Initial Load

**Input**: Design documents from `/specs/025-dashboard-scroll-jump/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md (complete, all FD answered) ✅, quickstart.md ✅

**Tests**: Automated visual-regression tests are OUT OF SCOPE per spec Assumptions (manual device verification with screen recordings is the evidence method per SC-002). Unit tests are included **only** where new logic is introduced (e.g., a `useDashboardLoadingState` hook if FD-3 adds one).

**Organization**: Tasks are grouped by user story so each story can be delivered and verified independently. The three user stories all share the same root cause, so Phase 2 (Foundational — Investigation) is a hard prerequisite to any story-phase work per the clarification Q1 commitment (Option C: exhaustively investigate before fixing).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are absolute-from-repo-root inside `apps/mobile/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the dev loop for reproducing the bug and iterating on fixes.

- [ ] T001 Confirm the feature branch `025-dashboard-scroll-jump` is checked out in the worktree at `.claude/worktrees/025-dashboard-scroll-jump/`
- [ ] T002 Install monorepo dependencies at repo root (`npm install`) and verify `apps/mobile` builds a dev client via `npm run start` (Expo) without errors
- [ ] T003 Identify and document the primary test device (Android with visible navigation bar) — record model + OS version in `specs/025-dashboard-scroll-jump/research.md` under "Environment"
- [ ] T004 [P] Identify and document the two smoke-test devices (Android with gesture navigation, iOS with home indicator) in `specs/025-dashboard-scroll-jump/research.md` under "Environment"
- [ ] T005 [P] Seed the primary test device's WatermelonDB with real user data (at least one account, one transaction, one upcoming payment) so progressive loading is observable — follow existing project onboarding flow; do NOT write new seed scripts

---

## Phase 2: Foundational — Investigation (Blocking Prerequisites)

**Purpose**: Per clarification Q1 (Option C), exhaustively investigate all four root-cause hypotheses before any fix is applied. The targeted fix in Phase 3 depends on which hypotheses are confirmed.

**⚠️ CRITICAL**: No user story work (Phase 3+) can begin until every hypothesis has a documented Decision in `research.md` and FD-1 through FD-4 have concrete answers.

- [X] T006 Reproduce the bug on the primary device per `specs/025-dashboard-scroll-jump/quickstart.md` "Reproduction" section; capture the baseline recording and save it as `before-android-navbar.mp4` alongside the feature's spec artifacts (or linked path documented in `research.md`)
- [X] T007 Fill in the "Reproduction baseline" section of `specs/025-dashboard-scroll-jump/research.md` with exact cold-start procedure, the first-observed frame showing the clipped TopNav, and a link to the recording
- [X] T008 [P] **Hypothesis 1 — SafeArea inset timing**: Add temporary logging (`logger.debug`) in the Dashboard screen at `apps/mobile/app/(tabs)/index.tsx` that records `useSafeAreaInsets()` values across the first ~10 render frames of cold start. Reproduce the bug, capture the log output, and record findings in the Hypothesis 1 section of `specs/025-dashboard-scroll-jump/research.md` with a Decision (confirmed / ruled out / partial) plus Rationale and Evidence
- [X] T009 [P] **Hypothesis 2 — ScrollView content-height race (primary suspect)**: Add temporary `onScroll` instrumentation (`logger.debug` the `contentOffset.y` values, throttled to avoid flooding) on the `ScrollView` at `apps/mobile/app/(tabs)/index.tsx:170`. Reproduce the bug, capture scroll-offset trace during cold start, and record findings in the Hypothesis 2 section of `specs/025-dashboard-scroll-jump/research.md` with Decision + Rationale + Evidence
- [X] T010 [P] **Hypothesis 3 — StatusBar backgroundColor interaction**: Per clarification Q2, investigate ONLY whether the current `StatusBar` config at `apps/mobile/app/_layout.tsx:264–266` causes a measurable layout hiccup during init. Reproduce the bug, then temporarily remove the `backgroundColor` prop (keep `style={colorScheme}`), re-reproduce on the same device and mode, and record findings in the Hypothesis 3 section of `specs/025-dashboard-scroll-jump/research.md`. Revert the temporary change before moving on — config is intentional unless evidence proves otherwise
- [X] T011 [P] **Hypothesis 4 — Expo Router Tabs scene-measurement race**: Add temporary `onLayout` instrumentation on the Tabs scene wrapper at `apps/mobile/app/(tabs)/_layout.tsx:51` and on the Dashboard root View at `apps/mobile/app/(tabs)/index.tsx:184`, logging height values across the first several frames. Reproduce the bug, correlate with the scroll-offset trace from T009, and record findings in the Hypothesis 4 section of `specs/025-dashboard-scroll-jump/research.md`
- [X] T012 Answer FD-1, FD-2, FD-3, FD-4 in the "Findings-driven decisions" table of `specs/025-dashboard-scroll-jump/research.md`. Explicitly confirm whether `TopNav` needs to be moved outside `ScrollView` (FD-1), whether any hypothesis beyond #2 independently contributes (FD-2), whether a defensive `scrollTo({y:0})` guard is required (FD-3 — default "no" unless FD-1 proves insufficient), and whether `app/(tabs)/_layout.tsx` requires changes (FD-4)
- [X] T013 Remove ALL temporary instrumentation added in T008–T011 from `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/_layout.tsx`, and `apps/mobile/app/(tabs)/_layout.tsx`. Confirm no `logger.debug` calls added during investigation remain. Verify TypeScript still compiles and no ESLint warnings are introduced

**Checkpoint**: All four hypotheses have documented Decisions with Evidence. FD-1..4 have concrete answers. Research artifact is complete. User stories can now begin.

---

## Phase 3: User Story 1 — Stable Dashboard on Cold Start (Priority: P1) 🎯 MVP

**Goal**: Eliminate the visible scroll-jump and TopNav clipping on cold start of the app on the primary Android-navbar device. The dashboard skeleton's TopNav stays fully visible throughout loading; no viewport shift occurs when the last section resolves.

**Independent Test**: Force-close the app, reopen it, observe the Dashboard from first paint through full data load on the primary device. TopNav stays fully visible; no auto-scroll occurs at any point. Recorded via `after-android-navbar.mp4` attached to the PR.

### Implementation for User Story 1

- [X] T014 [US1] **Fix applied at SafeArea provider boundary + StarryBackground (three-stage iteration).** Per FD-1=No, FD-2=No, FD-4=No: root cause is the `react-native-safe-area-context` cold-start inset race (H1 confirmed; insets.top 0 → 28.44 between render 1 and render 2). Stage 1: edited `apps/mobile/app/_layout.tsx` to pass `initialMetrics={initialWindowMetrics}` to `<SafeAreaProvider>`. Stage 2: removed a redundant nested `<SafeAreaView edges={["top"]}>` from `apps/mobile/components/dashboard/TopNav.tsx` (the library does not deduplicate padding). Stage 3 (final, effective fix): in `apps/mobile/components/ui/StarryBackground.tsx`, replaced the `<SafeAreaView edges={["top"]}>` with a plain `<View>` whose `paddingTop` is sourced directly from the module-level `initialWindowMetrics.insets.top`. This bypasses `SafeAreaInsetsContext` entirely — intermediate navigators (expo-router / react-native-screens) were re-providing the context with zero-initialized defaults and shadowing the root `initialMetrics`. A plain JS import cannot be shadowed by any downstream provider, so the top padding is stable from the first synchronous render. User confirmed the final fix eliminates the scroll-jump
- [X] T015 [US1] Skipped — FD-2 ruled out all non-H1 hypotheses. H2 (ScrollView drift) had zero onScroll events; H3 (StatusBar) deferred per clarification Q2 boundary and unnecessary given H1 explains symptom; H4 (Tabs scene) logged a single onLayout and did not resize. No additional targeted fixes required
- [X] T016 [US1] Skipped — FD-3 concluded "No defensive scroll guard required" because H2 evidence shows scroll offset never drifts from 0. The `useDashboardLoadingState` aggregating hook is not needed for the fix
- [X] T017 [US1] Skipped — depended on T016, which was skipped per FD-3=No
- [X] T018 [US1] Skipped — depended on T016, which was skipped per FD-3=No
- [X] T019 [US1] Manual verification pass on the primary device — user confirmed cold-start scenarios SC-001 (TopNav fully visible first frame), SC-002 (zero auto-scroll during load), SC-003 (no snap animation) all pass after the final fix (StarryBackground uses `initialWindowMetrics` directly). Post-fix recording `after-android-navbar.mp4` to be captured and attached to PR
- [ ] T020 [US1] Manual verification pass on the primary device for FR-005: cold-start, manually scroll halfway down before the last section resolves, confirm the scroll position is preserved (no auto-scroll to top when loading finishes). Document pass/fail in `research.md` under "Verification results"

**Checkpoint**: User Story 1 implementation is complete and the primary cold-start scenarios (SC-001..SC-003 via T019) are verified. Final sign-off is pending T020 (FR-005 user-scroll preservation during load).

---

## Phase 4: User Story 2 — Stable Dashboard on App Resume (Priority: P2)

**Goal**: Confirm the Phase 3 fix also eliminates any jump when the app is brought back from background on the Dashboard.

**Independent Test**: Open the Dashboard, background the app for 30+ seconds, bring it to the foreground. TopNav remains fully visible; no auto-scroll during background data refresh.

### Implementation for User Story 2

- [ ] T021 [US2] Manual verification pass on the primary device for resume: open Dashboard → background for 30+ seconds → foreground. Confirm no scroll jump and TopNav is fully visible throughout re-hydration (covers Acceptance Scenario 1 of US2)
- [ ] T022 [US2] Manual verification pass on the primary device for resume with background refresh: allow the background refresh to complete after resume; confirm the scroll position does not change automatically (Acceptance Scenario 2 of US2)
- [ ] T023 [US2] If any resume-specific regression is observed in T021 or T022, open a task in `research.md` under a new "Resume-specific findings" section, diagnose, and apply a targeted fix in `apps/mobile/app/(tabs)/index.tsx` or the offending component. Document the fix in this task's commit. If no regression observed, document "No regression — US1 fix covers resume" in the commit/task note

**Checkpoint**: US1 + US2 both verified on the primary device.

---

## Phase 5: User Story 3 — Stable Dashboard Across Device Shapes (Priority: P3)

**Goal**: Smoke-test the fix on the secondary device profiles (Android gesture navigation, iOS with home indicator) to confirm it does not regress them. Full acceptance-scenario coverage is limited to the primary profile per clarification Q4 (SC-004).

**Independent Test**: Single cold-start per secondary device. TopNav fully visible. No obvious scroll jump.

### Implementation for User Story 3

- [ ] T024 [P] [US3] Smoke-test on Android with gesture navigation: single cold-start. Document pass/fail, device model, OS version in the PR description. Record a short clip ONLY if any regression is observed
- [ ] T025 [P] [US3] Smoke-test on iOS with home indicator: single cold-start. Document pass/fail, device model, iOS version in the PR description. Record a short clip ONLY if any regression is observed
- [ ] T026 [US3] If either T024 or T025 detected a regression, diagnose the device-specific cause, add findings to `specs/025-dashboard-scroll-jump/research.md` under a "Device-specific regressions" section, and apply a targeted fix. Release is blocked until smoke-tested profiles pass. Skip this task if both T024 and T025 passed

**Checkpoint**: All three user stories verified to their respective depth (US1 thorough, US2 thorough, US3 smoke-test).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, regression sanity, and PR readiness.

- [ ] T027 [P] Verify FR-008 (skeleton/loading regression check): confirm existing loading affordance in `apps/mobile/app/(tabs)/index.tsx` (the `!isDbReady` branch) still renders correctly; no changes to its appearance
- [ ] T028 [P] Verify FR-009 (status-bar and safe-area regression check): light mode and dark mode both render the status bar with expected contrast on the primary device; safe-area insets respected on all three tested profiles
- [ ] T029 [P] Verify pull-to-refresh regression: on a fully-loaded dashboard, perform pull-to-refresh, confirm refresh completes and NO additional jump beyond the gesture itself occurs (edge case in spec)
- [ ] T030 Run `npx tsc --noEmit` at repo root to confirm TypeScript strict compilation passes across the monorepo (no type errors introduced). Fix any issues in the files edited by this feature
- [ ] T031 Run ESLint on the modified files (`apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(tabs)/_layout.tsx`, plus any new hook/test files). Fix any new warnings introduced by this feature
- [ ] T032 Final sweep of `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/_layout.tsx`, and `apps/mobile/app/(tabs)/_layout.tsx` to confirm zero residual `logger.debug` or `console.log` calls from the investigation phase remain
- [ ] T033 Update `specs/025-dashboard-scroll-jump/research.md`: flip every hypothesis's Decision from "TBD" to its final value, attach evidence links, and mark the research document as "Status: Complete"
- [ ] T034 Open the pull request with body containing: (a) link to issue #234, (b) investigation summary from `research.md`, (c) embedded `before-android-navbar.mp4` and `after-android-navbar.mp4`, (d) smoke-test results for secondary profiles, (e) confirmation that FR-001..FR-010 and SC-001..SC-006 are satisfied per the spec

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Investigation)**: Depends on Phase 1 completion. **BLOCKS every user story** per clarification Q1 (Option C). T006–T007 must complete before T008–T011 (reproduction must be confirmed before instrumenting). T008–T011 can run in parallel. T012 and T013 depend on all of T008–T011
- **Phase 3 (US1)**: Depends on Phase 2 completion, specifically T012 (FD-1..4 answered). T014 must complete before T015/T016. T017 depends on T016. T018 depends on T016. T019/T020 depend on T014–T017
- **Phase 4 (US2)**: Depends on Phase 3 completion (the fix applied in T014 is the one being verified on resume)
- **Phase 5 (US3)**: Depends on Phase 3 completion (the same fix is being smoke-tested on different profiles). T024 and T025 can run in parallel on different devices
- **Phase 6 (Polish)**: Depends on Phases 3–5 being complete. T027–T029 can run in parallel. T030–T034 are sequential

### Within Each User Story

- Investigation is shared foundation — NO per-story investigation
- US1's `T014` (SafeAreaProvider `initialMetrics` + `StarryBackground` direct-inset padding + nested `SafeAreaView` removal from `TopNav`) is the foundational fix for ALL three stories
- US2 and US3 are primarily verification phases; they add new code only if regressions are observed (T023, T026)

### Parallel Opportunities

- **Phase 1**: T004 and T005 can run in parallel with T003
- **Phase 2**: T008, T009, T010, T011 can all run in parallel once T006–T007 complete (different files, independent instrumentation)
- **Phase 5**: T024 and T025 can run in parallel on different physical devices
- **Phase 6**: T027, T028, T029 are independent regression checks on the same device but different behaviors — can be performed in a single testing session without ordering constraints

---

## Parallel Example: Phase 2 Investigation

```bash
# Once reproduction is captured (T006–T007), launch the four hypothesis investigations in parallel:
Task: "T008 — Instrument SafeArea insets in apps/mobile/app/(tabs)/index.tsx; record findings in research.md"
Task: "T009 — Instrument ScrollView onScroll in apps/mobile/app/(tabs)/index.tsx; record findings in research.md"
Task: "T010 — Toggle StatusBar backgroundColor in apps/mobile/app/_layout.tsx; record findings in research.md"
Task: "T011 — Instrument onLayout on Tabs scene + dashboard root; record findings in research.md"
```

Note: because these tasks all write to `research.md`, coordinate by having each task append to its own hypothesis section — or serialize the final `research.md` edits at the end.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Investigation (CRITICAL — blocks all stories per Q1 Option C)
3. Complete Phase 3: User Story 1 (cold-start fix)
4. **STOP and VALIDATE**: Verify US1 on the primary device (T019–T020); attach `after-android-navbar.mp4` to the draft PR
5. Demo if ready — the primary bug is fixed at this point

### Incremental Delivery

1. Setup + Investigation → Foundation ready (research.md complete)
2. Add US1 → Verify cold-start → Demo (MVP — resolves the reported issue)
3. Add US2 → Verify resume behavior → Confirm no regression
4. Add US3 → Smoke-test secondary profiles → Ship

### Solo Developer (Expected Path)

The feature is owned by a single developer (Mohamed). All phases execute sequentially. Phase 2's hypothesis tasks (T008–T011) are tagged `[P]` for documentation but in practice run serially because they share the same test device. The solo path:

1. Finish Phase 1 (~15 min)
2. Phase 2 investigation — the most time-intensive phase (~2–4 hours depending on reproduction stability)
3. Phase 3 fix — a focused SafeArea-metric seeding + `StarryBackground` top-inset stabilization commit (~30 min) + verification (~20 min)
4. Phase 4 + Phase 5 verification — short (~20 min combined)
5. Phase 6 polish + PR (~30 min)

---

## Notes

- `[P]` tasks = different files OR different devices, no dependencies
- `[Story]` label maps tasks to the user story they deliver verification/fix for (Phase 3+ only — Setup, Foundational, and Polish tasks have no story label)
- The investigation phase is **shared infrastructure** for all three stories per the clarification Q1 commitment; it is not duplicated per story
- All edits live inside `apps/mobile/` — no changes to `packages/db` or `packages/logic` (constitution VI)
- No schema changes. No new package dependencies. No API contract changes
- Commit after each task (or logical group within a phase) following the repo's commit format: `<type>: <description>`
- Stop at the end of Phase 3 to validate the MVP before continuing to Phase 4
