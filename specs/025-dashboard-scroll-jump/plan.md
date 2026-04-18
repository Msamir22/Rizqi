# Implementation Plan: Stable Dashboard Layout During Initial Load

**Branch**: `025-dashboard-scroll-jump` | **Date**: 2026-04-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-dashboard-scroll-jump/spec.md`

## Summary

Eliminate the visible scroll-jump / TopNav-clipping behavior that occurs on the Dashboard during the initial data-loading phase on Android (primary) and iOS. The spec's clarification session (2026-04-18) committed to an **investigation-first** approach: exhaustively verify each of the four hypotheses from issue #234 (SafeArea inset timing, ScrollView content-height race, `StatusBar` config interaction, Expo Router Tabs scene-measurement race), record findings in `research.md`, and apply targeted fixes only to the confirmed root cause(s). A secondary defensive `scrollTo({y:0, animated:false})` guard is NOT applied by default — it is only introduced if the targeted fixes alone are insufficient, because the clarifications committed to fixing the root cause rather than masking the symptom.

Verification is thorough on the primary Android-navbar profile (video evidence for SC-002) and smoke-test only on Android-gesture and iOS (per clarification Q4).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, NON-NEGOTIABLE per constitution III)
**Primary Dependencies**: React Native + Expo (managed workflow), Expo Router (file-based routing, `Tabs`), `react-native-safe-area-context`, `expo-status-bar`, NativeWind v4
**Storage**: N/A — UI-stability fix, no data-model changes
**Testing**: Jest + React Native Testing Library for any new layout-assertion unit tests; manual device verification with screen recordings per spec SC-002/SC-004
**Target Platform**: Android (primary — issue reported on Samsung with visible navigation bar) and iOS (smoke-test only)
**Project Type**: Mobile monorepo (`apps/mobile` in npm workspaces + Nx, per constitution VI)
**Performance Goals**: Zero automatic scroll-position changes during the loading phase (SC-002); no perceivable "snap" animation when the last section resolves (SC-003); fix must not regress 60fps scroll performance
**Constraints**: Must NOT regress existing skeleton/loading affordance, pull-to-refresh, safe-area handling, or status-bar appearance (FR-008, FR-009); changes live inside `apps/mobile` only — no new dependencies, no changes to `packages/db` or `packages/logic` (constitution VI)
**Scale/Scope**: Single screen (`apps/mobile/app/(tabs)/index.tsx`), its tab layout wrapper (`apps/mobile/app/(tabs)/_layout.tsx`), the root layout (`apps/mobile/app/_layout.tsx`), and the `TopNav` component (`apps/mobile/components/dashboard/TopNav.tsx`). No new screens.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
|---|---|---|
| I. Offline-First Data Architecture | ✅ Not affected | Pure UI-layout fix; no data reads/writes changed. |
| II. Documented Business Logic | ✅ Not affected | No business rules involved. |
| III. Type Safety (NON-NEGOTIABLE) | ✅ Pass | All new/modified code will use strict TypeScript with explicit return types; no `any`; `unknown` narrowed in catch blocks. |
| IV. Service-Layer Separation | ✅ Pass | Fix stays in component/screen/hook layer. No business logic introduced. No database writes. If a dedicated hook is needed (e.g., `useDashboardLoadingState`), it only orchestrates existing per-section loading flags — no calculations, no writes. |
| V. Premium UI with Consistent Theming | ✅ Pass | Uses NativeWind classes; preserves dark-mode via `dark:` variants; preserves `StatusBar` appearance unless investigation confirms it contributes to the jump. Will NOT regress existing visual state. |
| VI. Monorepo Package Boundaries | ✅ Pass | Changes confined to `apps/mobile`. No imports added to `packages/db` or `packages/logic`. |
| VII. Local-First Migrations | ✅ Not affected | No schema changes. |

**Gate result**: PASS. No violations. No complexity-tracking entries required.

**Re-check after Phase 1 design**: PASS (no design decisions surfaced that would change the above; documented at bottom of this file).

## Project Structure

### Documentation (this feature)

```text
specs/025-dashboard-scroll-jump/
├── plan.md              # This file
├── research.md          # Phase 0 output — investigation of 4 hypotheses, findings, chosen fix(es)
├── quickstart.md        # Phase 1 output — how to reproduce the bug, how to verify the fix
├── checklists/
│   └── requirements.md  # Pre-existing from specify phase
└── tasks.md             # Phase 2 output (created later by /speckit.tasks)
```

Note: `data-model.md` and `contracts/` are **intentionally omitted** — this is a UI-stability bug fix with no new entities, no new APIs, and no schema changes.

### Source Code (repository root)

```text
apps/mobile/
├── app/
│   ├── _layout.tsx                    # Root layout — StatusBar config (hypothesis #3)
│   └── (tabs)/
│       ├── _layout.tsx                # Tabs wrapper — scene measurement context (hypothesis #4)
│       └── index.tsx                  # Dashboard screen — TopNav currently inside ScrollView (hypothesis #2)
├── components/
│   └── dashboard/
│       ├── TopNav.tsx                 # Likely extracted out of ScrollView as part of the fix
│       ├── AccountsSection.tsx        # Per-section loading; no changes expected
│       ├── LiveRates.tsx              # Per-section loading; no changes expected
│       ├── RecentTransactions.tsx     # Per-section loading; no changes expected
│       ├── ThisMonth.tsx              # Per-section loading; no changes expected
│       ├── TotalNetWorthCard.tsx      # Per-section loading; no changes expected
│       └── UpcomingPayments.tsx       # Per-section loading; no changes expected
└── hooks/
    └── (possibly) useDashboardLoadingState.ts  # NEW if needed — aggregates per-section loading flags
```

**Structure Decision** (finalized post-investigation): The fix lives entirely in `apps/mobile`. No packages touched. The actual edit targets, per the confirmed H1 root cause and FD-1..FD-4 outcomes, are:

1. `apps/mobile/app/_layout.tsx` — pass `initialMetrics={initialWindowMetrics}` to `SafeAreaProvider` for first-frame inset stability (defence-in-depth; benefits every screen).
2. `apps/mobile/components/ui/StarryBackground.tsx` — apply `paddingTop` from `initialWindowMetrics?.insets.top ?? 0` on a plain `View`, bypassing `SafeAreaInsetsContext` re-providers that shadow root metrics on cold start (the effective fix).
3. `apps/mobile/components/dashboard/TopNav.tsx` — remove the redundant nested `SafeAreaView edges={["top"]}` so the top inset has a single source.

`apps/mobile/app/(tabs)/index.tsx` is NOT modified — FD-1 ruled out the "extract `TopNav` from `ScrollView`" hypothesis (H2 had zero scroll drift).

No new package dependencies. No schema changes. No migrations.

## Phase 0: Investigation & Research

**Deliverable**: `research.md`

Per the clarification session's Q1 commitment (Option C: exhaustively investigate all four hypotheses before fixing), Phase 0 is the substantive phase of this feature. Each hypothesis gets its own section in `research.md` with:

- **Decision** — confirmed cause / ruled out / partial contributor
- **Rationale** — what instrumentation / reproduction step yielded this conclusion
- **Alternatives considered** — fix approaches rejected, and why
- **Evidence** — link to screen recording, scroll-offset log, or code-pointer

### Hypotheses to investigate

1. **SafeArea inset measurement timing** — Does `react-native-safe-area-context` emit a `{top: 0, ...}` first frame that causes a one-frame layout drift affecting TopNav position? Instrument by logging `useSafeAreaInsets()` values across the first N frames of cold start.

2. **ScrollView content-height race** (primary suspect) — `TopNav` is currently rendered INSIDE the `ScrollView` (`app/(tabs)/index.tsx:185`). On Android, when ScrollView content height grows progressively (skeletons → real content), the scroll offset can drift non-zero and push content above the viewport. Verify by: (a) reading current layout, (b) observing scroll offset during cold start, (c) testing whether moving `TopNav` outside the `ScrollView` (sibling, not child) eliminates the symptom.

3. **StatusBar `backgroundColor` interaction** — Per clarification Q2, treat the current `isDark ? lightTheme : darkTheme` pattern as intentional visual separation. Investigate only whether toggling `backgroundColor` during dark-mode init causes a measurable status-bar-region layout hiccup that the ScrollView would compensate for. Do NOT rewrite the config unless evidence demands it.

4. **Expo Router `Tabs` scene-measurement race** — When `Tabs` mounts, the scene area may be sized without accounting for the tab bar, then shrink once the tab bar measures. Verify by measuring dashboard scene height across the first several frames and checking whether ScrollView scroll offset correlates with the transition.

### Defensive-guard decision

A defensive `scrollTo({y:0, animated:false})` on "all sections loaded" is explicitly **deferred**. Per Q1's Option C (and contrary to Q1's Option B which included a defensive guard), the clarification selection was "fix confirmed causes only." A defensive guard will only be added in Phase 1 if Phase 0 investigation shows the targeted fixes are demonstrably insufficient. If added, it MUST also respect FR-005 (do not override user scroll position) and use the "all section loading flags resolved" definition from clarification Q3.

### Findings-driven decision points (to be resolved in research.md)

- **FD-1** — Is the primary fix to move `TopNav` outside `ScrollView`? (likely yes, pending Phase 0 reproduction)
- **FD-2** — Does any hypothesis beyond #2 independently cause visible symptoms, or are #1/#3/#4 ruled out?
- **FD-3** — Is a defensive `scrollTo` guard needed? (default: no; only yes if FD-1 insufficient)
- **FD-4** — Does the fix require changes to `app/(tabs)/_layout.tsx` for tab-bar measurement ordering? (default: no)

**Exit criterion for Phase 0**: All four hypotheses have a documented Decision (confirmed / ruled out / partial) with evidence, and FD-1 through FD-4 have concrete answers.

## Phase 1: Design & Verification Contracts

**Prerequisites**: `research.md` complete with all hypotheses resolved.

### 1. Data model

**N/A** — No entities, no schema changes. File `data-model.md` is intentionally omitted.

### 2. Contracts

**N/A** — No new APIs, no new hooks returning new shapes. If `useDashboardLoadingState` is introduced (only if FD-3 escalates to needing a defensive guard), its contract is trivial: `() => { allSectionsLoaded: boolean }`, returned inline in the hook's file. No separate contract file required.

### 3. Quickstart (`quickstart.md`)

The quickstart doubles as the **reproduction + verification runbook** for this feature. It will contain:

- Pre-conditions (clean install, cleared app data for cold start)
- Steps to reliably reproduce the bug on the primary Android-navbar profile
- Steps to capture the "before" screen recording (evidence the bug exists)
- Steps to capture the "after" screen recording (evidence SC-002 is met)
- Smoke-test checklist for Android-gesture and iOS profiles (per clarification Q4)

### 4. Agent context update

Run `.specify/scripts/bash/update-agent-context.sh` to refresh the agent-specific context file with this feature's technology markers. Since this feature adds no new dependencies, the update is effectively a no-op metadata refresh — but the script is run for consistency with the spec-kit workflow.

### Post-design constitution re-check

✅ **PASS.** No new violations surfaced during design. The `useDashboardLoadingState` hook (if introduced) stays within constitution IV (hooks handle lifecycle/subscriptions only — aggregating loading booleans is pure lifecycle orchestration, not business logic). No new package cross-boundary imports.

## Complexity Tracking

> _None — no constitution violations to justify._

## Phase 2 preview (not executed by this command)

`/speckit.tasks` will break Phase 0 investigation + Phase 1 fix into discrete tasks with TDD ordering. Expected task clusters:

- **T1xx: Investigation tasks** (one per hypothesis) — reproduce + instrument + record findings in `research.md`
- **T2xx: Fix implementation** — targeted fixes for confirmed hypotheses (likely starts with `TopNav` extraction from `ScrollView`)
- **T3xx: Verification tasks** — capture before/after videos on primary profile, smoke-test on secondary profiles, update PR description

---

**Artifacts generated by this command**: `plan.md` (this file), `research.md` (scaffold), `quickstart.md` (scaffold).
**Next command**: `/speckit.tasks`
