# Implementation Plan: Skip Onboarding for Returning Users

**Branch**: `024-skip-returning-onboarding` | **Date**: 2026-04-18 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/specs/024-skip-returning-onboarding/spec.md`

## Summary

Replace the current AsyncStorage-based onboarding gate
(`apps/mobile/app/index.tsx`) with a server-authoritative gate driven by the
user's `profiles` row in WatermelonDB. The gate runs after a blocking initial
pull-sync on sign-in so returning users land on the dashboard without
re-onboarding, while new users see the full four-step flow (Language → Slides →
Currency → Cash-account confirmation). Adds two new `profiles` columns
(`preferred_language`, `slides_viewed`), repurposes the existing unused
`onboarding_completed` column as the single routing gate, removes the
currency-skip affordance, and introduces a retry/sign-out screen for failed
initial syncs.

**Technical approach**:

1. Migration adds `profiles.preferred_language` (text, nullable until language
   step) and `profiles.slides_viewed` (boolean, default false). The existing
   `profiles.onboarding_completed` is already present and becomes the single
   routing gate.
2. `SyncProvider` is extended with a blocking "initial sync complete" signal
   that `index.tsx` awaits (with a 20-second timeout) before making any routing
   decision.
3. `apps/mobile/app/index.tsx` is rewritten to observe the first `profiles` row
   from WatermelonDB (post-pull-sync) and route based on the 4-signal resume
   logic spelled out in the spec.
4. `apps/mobile/app/onboarding.tsx` is rewritten to read its initial phase from
   the profile (resume-aware) and persist each step's output to the profile via
   a new `profile-service.ts`, replacing all AsyncStorage usage
   (`HAS_ONBOARDED_KEY`, `LANGUAGE_KEY`).
5. `CurrencyPickerStep` loses its `onSkip` prop and Skip button per FR-009.
6. A new `RetrySyncScreen` component handles the failure state (Retry + Sign out
   actions). Needs mockups before implementation — flagged as a design
   dependency.
7. A structured info-level log is emitted on every routing-gate evaluation per
   FR-014.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode across monorepo; enforced by
Constitution III). **Primary Dependencies**: React Native + Expo (managed
workflow), Expo Router (file-based routing), WatermelonDB (local SQLite),
Supabase JS (Auth + sync backend), NativeWind v4 (Tailwind RN),
react-native-reanimated, React Query. **Storage**:

- Local: WatermelonDB (`packages/db`). `profiles` table is already a syncable
  table; migration will add two columns.
- Remote: Supabase PostgreSQL; DDL via
  `supabase/migrations/040_add_language_and_slides_viewed_to_profiles.sql`.
  **Testing**: Jest + React Native Testing Library for unit & hook tests.
  Integration tests for the routing gate cover each of the 6 resume scenarios
  (new user, partial at each step, fully completed) using a mocked WatermelonDB
  profile row. Manual/Maestro for end-to-end coverage of the sign-in → sync →
  gate path. **Target Platform**: iOS 15+ and Android (React Native Expo managed
  workflow). **Project Type**: Mobile (monorepo: `apps/mobile` + `packages/db` +
  `packages/logic`; schema changes touch `packages/db`, feature code in
  `apps/mobile`). **Performance Goals**: SC-003 — returning user reaches
  dashboard within **3 seconds** of successful sign-in on a median-speed
  network. Initial pull-sync timeout hard-capped at **20 seconds** (FR-006,
  Clarification Q2) before triggering the retry screen. **Constraints**:
- Offline-first per Constitution I: all reads go through local WatermelonDB
  after the initial pull-sync. Writes during onboarding hit local DB first;
  push-sync is non-blocking.
- No `any`, no non-null assertions (Constitution III).
- Service-layer separation (Constitution IV): profile mutations in a new
  `apps/mobile/services/profile-service.ts`; hooks own subscriptions only;
  components have zero business logic.
- NativeWind v4 crash rules (Constitution V): avoid
  `shadow-*`/`opacity-*`/`bg-color/opacity` on `TouchableOpacity`/`Pressable` in
  the new retry screen.
- Local-First Migrations (Constitution VII): schema change via local `.sql`
  migration file, no Supabase MCP apply.
- No hardcoded strings for the new retry-screen copy (Constitution Workflow).
  **Scale/Scope**: Affects the app-launch path for every authenticated user. One
  screen rewrite (`onboarding.tsx`), one gate rewrite (`index.tsx`), one new
  screen (`RetrySyncScreen`), one new service (`profile-service.ts`), one
  `SyncProvider` extension, one migration, and minor prop removal on
  `CurrencyPickerStep`. No impact on tabs, accounts, transactions, budgets, or
  any other feature.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Compliance         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Offline-First Data Architecture | ✅ Pass            | Routing reads from local WatermelonDB after an initial pull-sync that runs when local DB is empty (already implemented in `SyncProvider`). Per-step onboarding writes hit local DB first; push-sync is non-blocking. The only "blocking" element is the initial pull-sync on fresh install / empty local DB — this is not a new blocker, the `InitialSyncOverlay` already covers it; we are additionally gating the _routing decision_ on its completion. Not a violation because the app has no local data to be "fully functional" with until the first sync completes. |
| II. Documented Business Logic      | ⚠️ Action required | `docs/business/business-decisions.md` must be updated to document: (1) the 4-step onboarding flow (Language mandatory, Slides skippable, Currency mandatory, Cash-account confirmation); (2) `preferred_currency` and `preferred_language` as server-authoritative; (3) retirement of AsyncStorage `HAS_ONBOARDED_KEY` and `LANGUAGE_KEY` for onboarding gate purposes. Tracked as a task in Phase 2.                                                                                                                                                                     |
| III. Type Safety                   | ✅ Pass            | All new service functions, hooks, and components have explicit return types. Zod not required here (no external API parsing — the profile row comes through WatermelonDB's type-safe schema). `strict: true` enforced by root tsconfig.                                                                                                                                                                                                                                                                                                                                   |
| IV. Service-Layer Separation       | ✅ Pass            | New `profile-service.ts` (plain async functions) owns writes. Hooks (`useProfile`, extended `usePreferredCurrency`) own subscriptions only. `RetrySyncScreen` and `onboarding.tsx` are pure UI receiving callbacks/props. `Alert.alert()` stays in the component layer.                                                                                                                                                                                                                                                                                                   |
| V. Premium UI + Schema-driven      | ✅ Pass            | Retry screen uses NativeWind v4 with palette colors only, avoids the known `bg-color/opacity` on `Pressable` crash. Loading state already uses `InitialSyncOverlay`. The onboarding components already match the current database schema; new columns are additions, not invented fields.                                                                                                                                                                                                                                                                                 |
| VI. Monorepo Package Boundaries    | ✅ Pass            | Schema changes are confined to `packages/db`. New service lives in `apps/mobile/services/`. Dependency direction preserved.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| VII. Local-First Migrations        | ✅ Pass            | New migration at `supabase/migrations/040_add_language_and_slides_viewed_to_profiles.sql`. `npm run db:migrate` regenerates `packages/db/src/schema.ts`, `supabase-types.ts`, and `packages/db/src/migrations.ts`. No Supabase MCP DDL.                                                                                                                                                                                                                                                                                                                                   |

**Gate verdict**: Pass. One follow-up (Principle II) is an action, not a
violation, and is captured in Phase 2 tasks.

## Project Structure

### Documentation (this feature)

```text
specs/024-skip-returning-onboarding/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # From /speckit.specify + /speckit.clarify
├── research.md          # Phase 0 output (this command)
├── data-model.md        # Phase 1 output (this command)
├── quickstart.md        # Phase 1 output (this command)
├── contracts/
│   └── profile-service.ts  # Service contract (TS interface) for profile mutations
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit.specify)
└── tasks.md             # Phase 2 output — NOT created here; produced by /speckit.tasks
```

### Source Code (repository root)

```text
apps/mobile/
├── app/
│   ├── _layout.tsx              # MODIFY: AuthGuard stays; ensure InitialSyncOverlay is ordered above children
│   ├── index.tsx                # REWRITE: routing gate — awaits initial sync, reads profile, routes
│   └── onboarding.tsx           # REWRITE: resume-aware phase from profile; writes to profile-service
├── components/
│   ├── onboarding/
│   │   ├── LanguagePickerStep.tsx    # MODIFY: call profile-service.setPreferredLanguage
│   │   ├── CurrencyPickerStep.tsx    # MODIFY: remove `onSkip` prop and Skip button (FR-009)
│   │   └── WalletCreationStep.tsx    # MODIFY: on completion, call profile-service.completeOnboarding
│   └── ui/
│       ├── InitialSyncOverlay.tsx    # UNCHANGED (already owns the sync-in-progress UI)
│       └── RetrySyncScreen.tsx       # NEW: Retry + Sign out actions (mockups required first)
├── services/
│   └── profile-service.ts            # NEW: setPreferredLanguage, markSlidesViewed,
│                                     #      setPreferredCurrencyAndCreateCashAccount,
│                                     #      completeOnboarding
├── hooks/
│   ├── useProfile.ts                 # VERIFY/EXTEND: already exists — observes first profile row;
│                                     #         verify it exposes the fields needed by routing gate
│   └── usePreferredCurrency.ts       # UNCHANGED — already observes profile correctly
├── providers/
│   └── SyncProvider.tsx              # MODIFY: expose a blocking "initial sync resolution" promise
│                                     #         or state (success | failed | in-progress),
│                                     #         and a 20-second timeout trigger
├── utils/
│   └── routing-decision.ts           # NEW: pure function — inputs (profile fields), output (route)
├── constants/
│   └── storage-keys.ts               # MODIFY: mark HAS_ONBOARDED_KEY and LANGUAGE_KEY as
│                                     #         deprecated; new code must not read from them.
│                                     #         (Do not delete — the keys may still be written
│                                     #         by pre-release installs; remove in a follow-up.)
└── __tests__/
    ├── utils/
    │   └── routing-decision.test.ts  # NEW: unit tests for the routing decision function
    ├── services/
    │   └── profile-service.test.ts   # NEW: unit tests for each profile mutation
    └── app/
        └── index.test.tsx            # NEW: integration — sync success / timeout / retry paths

packages/db/
├── src/
│   ├── schema.ts                     # REGENERATE: add preferred_language, slides_viewed columns to profiles
│   ├── migrations.ts                 # REGENERATE: schema version bump + addColumns step
│   ├── supabase-types.ts             # REGENERATE
│   └── models/base/
│       └── base-profile.ts           # REGENERATE: two new @field decorators

supabase/migrations/
└── 040_add_language_and_slides_viewed_to_profiles.sql  # NEW: DDL for the two new columns

docs/business/
└── business-decisions.md             # MODIFY: document the new flow and server-authoritative fields
```

**Structure Decision**: Mobile-monorepo layout (Option 3 from the template).
Schema work is strictly in `packages/db` via the standard migration pipeline.
Feature code is strictly in `apps/mobile`, split across `app/` (routes),
`components/` (UI), `services/` (business logic), `hooks/` (subscriptions),
`providers/` (cross-cutting providers), and `utils/` (pure functions). Tests
live under `apps/mobile/__tests__/`. No changes to `packages/logic` or
`apps/api`.

## Phase 0: Outline & Research

Produced as [research.md](./research.md). Summary:

- **Routing-gate location**: confirmed at `apps/mobile/app/index.tsx`. Reads
  `HAS_ONBOARDED_KEY` from AsyncStorage today; we replace with a profile-driven
  decision.
- **Blocking-sync feasibility**: `SyncProvider` already performs an initial
  force-sync when `accounts` collection is empty; it exposes `isInitialSync`
  used by `InitialSyncOverlay`. It is **not** currently awaited by `index.tsx`
  (which renders its own redirect before sync completes). The gap is the routing
  decision, not the sync trigger.
- **Existing schema**: `profiles` already has `onboarding_completed` (unused by
  the router) and `preferred_currency` (NOT NULL at schema level). Must add
  `preferred_language` (nullable) and `slides_viewed` (boolean, default false).
- **Existing cash-account creation**: `ensureCashAccount(userId, currency)`
  already exists in `apps/mobile/services/account-service.ts` and is called by
  `WalletCreationStep`. Removing currency-skip means this always runs.
- **Existing onboarding screen**: already implements a 4-phase state machine in
  a single file. Refactor focuses on replacing AsyncStorage with profile-service
  calls and on reading the initial phase from the profile.
- **Retry screen dependency**: no existing mockups; one of the two
  planning-level dependencies flagged by the spec.

## Phase 1: Design & Contracts

Produced as [data-model.md](./data-model.md),
[contracts/profile-service.ts](./contracts/profile-service.ts), and
[quickstart.md](./quickstart.md). Summary:

- **Data model**: two new columns on `profiles`. No new tables. No changes to
  RLS policies (existing row-level policy on `profiles` covers them).
- **Service contract**: four pure async functions in `profile-service.ts`, one
  per step + `completeOnboarding` + `getRoutingDecision` composite helper.
  Contract file defines the TypeScript signatures.
- **Agent context update**: `.specify/scripts/bash/update-agent-context.sh agy`
  runs at the end of this phase to refresh the agent-specific file with any new
  conventions.

## Re-evaluation of Constitution Check (post-design)

After drafting research.md, data-model.md, and contracts:

| Principle                          | Post-design status                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| I. Offline-First Data Architecture | ✅ Pass — design confirms local-DB reads after initial pull-sync; no runtime network calls for routing.        |
| II. Documented Business Logic      | ⚠️ Action tracked — `business-decisions.md` update is explicit Phase 2 task.                                   |
| III. Type Safety                   | ✅ Pass — contract interface in `contracts/profile-service.ts` is fully typed, no `any`.                       |
| IV. Service-Layer Separation       | ✅ Pass — all mutations funnel through `profile-service.ts`. Pure routing-decision function is framework-free. |
| V. Premium UI + Schema-driven      | ✅ Pass — pending retry-screen mockup; schema-driven UI confirmed (only new fields are added, not invented).   |
| VI. Monorepo Package Boundaries    | ✅ Pass — no cross-boundary imports introduced.                                                                |
| VII. Local-First Migrations        | ✅ Pass — migration file planned; regeneration commands documented in quickstart.                              |

**Post-design gate**: Pass. No violations requiring Complexity Tracking entries.

## Complexity Tracking

No entries required — all principles pass without justification.

## Stop Point

This command ends after Phase 1 / agent context update. Next step is
`/speckit.tasks` to produce `tasks.md` (Phase 2), which will break the above
design into dependency-ordered, independently testable tasks per the TDD
workflow.

**Open planning-phase dependencies — all resolved as of 2026-04-18**:

1. ✅ **Retry-screen mockups** — resolved 2026-04-18. Variant 2 "Status Card"
   approved. Reference assets saved at:
   - `specs/024-skip-returning-onboarding/mockups/retry-sync-screen.png` (visual
     reference)
   - `specs/024-skip-returning-onboarding/mockups/retry-sync-screen.html`
     (component structure + Tailwind reference)
   - **Implementation note (flagged during approval)**: the Stitch output
     includes a top-app-bar with a Close (X) button and "Sync Status" title —
     this MUST BE OMITTED in the React Native component. The retry screen is
     rendered before the user has any navigable destination; the sole escape
     hatches are the Retry and Sign out buttons inside the card (per FR-006).
     The HTML file header comment repeats this warning for implementers.
2. **`hasPreferredCurrency` vs `hasCashAccount` — resolved 2026-04-18**:
   confirmed Option B (data-model.md § 3). The routing gate and
   `getRoutingDecision` contract use `hasCashAccount` as the "currency step
   complete" signal — no `handle_new_user()` trigger archaeology required.
   `contracts/profile-service.ts` already reflects this; no additional change
   needed there.
3. **Sign-in / pull-sync behavior investigation** — still a tasks-phase
   verification. The current `SyncProvider.initialSync` sets `isInitialSync` but
   does not block `index.tsx` routing (confirmed in research.md § 2). Tasks
   T011/T012 extend `SyncProvider` with the blocking `initialSyncState` the
   router needs.
