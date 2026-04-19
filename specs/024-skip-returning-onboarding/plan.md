# Implementation Plan: Skip Onboarding for Returning Users

**Branch**: `024-skip-returning-onboarding` | **Date**: 2026-04-18 | **Last
rewritten**: 2026-04-18 (simplified data model — per-step progress now in
AsyncStorage) | **Spec**: [spec.md](./spec.md) **Input**: Feature specification
from `/specs/024-skip-returning-onboarding/spec.md`

## Summary

Replace the current AsyncStorage-based onboarding gate
(`apps/mobile/app/index.tsx`) with a binary server-authoritative gate driven by
a single field, `profiles.onboarding_completed`, read from WatermelonDB after a
blocking pull-sync on sign-in. Returning users land on the dashboard with their
server-stored preferences restored; new users complete the full four-step flow
(Language → Slides → Currency → Cash-account confirmation) starting at Language
or resuming at a later step via a per-user AsyncStorage cursor. The Language
step now persists to a new server column (`profiles.preferred_language`,
Postgres enum `'en' | 'ar'`). Legacy AsyncStorage keys `HAS_ONBOARDED_KEY` and
`LANGUAGE_KEY` are deleted. Currency becomes mandatory (no skip button). A new
`RetrySyncScreen` handles slow/failed pull-syncs with Retry + Sign out actions
(mockup approved, Variant 2 "Status Card").

**Technical approach** (simplified vs. the 2026-04-17 draft):

1. Migration adds one new column — `profiles.preferred_language` — typed as a
   new Postgres enum `preferred_language_code` (`'en' | 'ar'`), non-nullable
   with default `'en'`. No `slides_viewed` column; no other schema change.
2. `SyncProvider` is extended with a blocking `initialSyncState` signal
   (`in-progress | success | failed | timeout`, 20-second timeout) that
   `index.tsx` awaits before any routing decision.
3. `apps/mobile/app/index.tsx` is rewritten to a binary gate:
   `onboarding_completed === true` → dashboard; else → `/onboarding`. All
   per-step resume logic lives inside the onboarding screen.
4. A new `apps/mobile/services/onboarding-cursor-service.ts` wraps AsyncStorage
   reads/writes of the per-user cursor `onboarding:<userId>:step`.
5. `apps/mobile/app/onboarding.tsx` is rewritten to (a) read the initial phase
   from the cursor service, (b) write the cursor on every forward transition,
   (c) delegate profile mutations to `profile-service.ts`, (d) stop writing
   `HAS_ONBOARDED_KEY` and reading `LANGUAGE_KEY`.
6. `CurrencyPickerStep.tsx` loses its `onSkip` prop and Skip button (FR-009).
7. `completeOnboarding()` atomically flips the DB flag AND clears the cursor.
8. A new `RetrySyncScreen.tsx` handles the retry outcome (V2 "Status Card"
   mockup + annotated HTML reference).
9. One info-level log per routing-gate evaluation (FR-014).
10. Legacy keys `HAS_ONBOARDED_KEY` and `LANGUAGE_KEY` are deleted along with
    their read/write paths.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode across monorepo; enforced by
Constitution III). **Primary Dependencies**: React Native + Expo (managed
workflow), Expo Router (file-based routing), WatermelonDB (local SQLite),
Supabase JS (Auth + sync backend), AsyncStorage
(`@react-native-async-storage/async-storage`) for the per-user cursor,
NativeWind v4, react-native-reanimated, React Query. **Storage**:

- Local DB: WatermelonDB (`packages/db`). `profiles` table is already a syncable
  table; migration adds one column.
- Local KV: AsyncStorage, key format `onboarding:<userId>:step`. Values
  `"language" | "slides" | "currency" | "cash-account"`.
- Remote: Supabase PostgreSQL; DDL via
  `supabase/migrations/040_add_preferred_language_to_profiles.sql` which creates
  the `preferred_language_code` enum and adds the column. **Testing**: Jest +
  React Native Testing Library for unit & hook tests. Integration tests for the
  routing gate cover sync × flag state combinations. Unit tests for the
  onboarding-cursor service. **Target Platform**: iOS 15+ and Android (React
  Native Expo managed workflow). **Project Type**: Mobile (monorepo:
  `apps/mobile` + `packages/db` + `packages/logic`). **Performance Goals**:
  SC-003 — returning user reaches dashboard within 3 seconds of successful
  sign-in on a median-speed network. Initial pull-sync hard-capped at 20 seconds
  before triggering the retry screen. **Constraints**:
- Offline-first per Constitution I: all reads go through local WatermelonDB
  after the initial pull-sync. Writes to the profile hit local DB first;
  push-sync is non-blocking.
- Per-step cursor is purely local (no sync). Partial progress does not survive
  reinstall or cross devices — accepted trade-off.
- No `any`, no non-null assertions (Constitution III).
- Service-layer separation (Constitution IV): profile mutations in
  `profile-service.ts`; AsyncStorage access in `onboarding-cursor-service.ts`;
  routing-decision is a pure function in `utils/routing-decision.ts`; hooks own
  subscriptions only; components have zero business logic.
- NativeWind v4 crash rules (Constitution V): avoid
  `shadow-*`/`opacity-*`/`bg-color/opacity` on `TouchableOpacity`/`Pressable` in
  the retry screen.
- Local-First Migrations (Constitution VII): schema change via local `.sql`
  migration file, no Supabase MCP apply. **Scale/Scope**: Affects the app-launch
  path for every authenticated user. One migration, one enum type added, one DB
  column added, one gate rewrite (`index.tsx`), one screen rewrite
  (`onboarding.tsx`), one new screen (`RetrySyncScreen.tsx`), two new services
  (`profile-service.ts`, `onboarding-cursor-service.ts`), one `SyncProvider`
  extension, one prop removal on `CurrencyPickerStep`. Net smaller than the
  pre-simplification plan (one fewer column, the routing function dropped from 4
  inputs to 2, one fewer integration test matrix cell).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Compliance         | Notes                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Offline-First Data Architecture | ✅ Pass            | Routing reads from local WatermelonDB after an initial pull-sync that runs when local DB is empty (already implemented in `SyncProvider`). Language is written to local DB first; push-sync propagates. The only new AsyncStorage usage (per-user cursor) is purely local and is the correct storage class for ephemeral per-device progress tracking.                                     |
| II. Documented Business Logic      | ⚠️ Action required | `docs/business/business-decisions.md` must be updated to document (a) the 4-step onboarding flow (Language mandatory, Slides skippable, Currency mandatory, Cash-account confirmation); (b) `preferred_currency` and `preferred_language` as server-authoritative, `preferred_language` enum-typed; (c) per-step progress stored in AsyncStorage keyed by userId. Tracked as Phase 2 task. |
| III. Type Safety                   | ✅ Pass            | All new service functions, hooks, and components have explicit return types. `SupportedLanguage` is a TS union mirroring the Postgres enum. `OnboardingStep` is a TS union mirroring the cursor values.                                                                                                                                                                                    |
| IV. Service-Layer Separation       | ✅ Pass            | Profile mutations in `profile-service.ts`. AsyncStorage access in `onboarding-cursor-service.ts`. Pure routing decision in `utils/routing-decision.ts`. Components receive callbacks/props only.                                                                                                                                                                                           |
| V. Premium UI + Schema-driven      | ✅ Pass            | Retry screen uses approved V2 mockup, palette constants only, avoids the known NativeWind v4 crash. Loading state already uses `InitialSyncOverlay`. Schema-driven UI confirmed: only `preferred_language` is added, not invented.                                                                                                                                                         |
| VI. Monorepo Package Boundaries    | ✅ Pass            | Schema changes confined to `packages/db`. Feature code lives in `apps/mobile`.                                                                                                                                                                                                                                                                                                             |
| VII. Local-First Migrations        | ✅ Pass            | Migration at `supabase/migrations/040_add_preferred_language_to_profiles.sql`. `npm run db:migrate` regenerates generated artifacts. No Supabase MCP DDL.                                                                                                                                                                                                                                  |

**Gate verdict**: Pass. Principle II is an action item, not a violation, and is
captured in Phase 2 tasks.

## Project Structure

### Documentation (this feature)

```text
specs/024-skip-returning-onboarding/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # From /speckit.specify + /speckit.clarify
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── profile-service.ts  # Service contract + onboarding-cursor-service contract + routing-decision contract
├── checklists/
│   └── requirements.md
├── mockups/
│   ├── retry-sync-screen.png        # Approved V2 "Status Card"
│   └── retry-sync-screen.html       # Annotated HTML reference
├── HANDOFF.md           # For inter-agent handoff
└── tasks.md             # Phase 2 output from /speckit.tasks
```

### Source Code (repository root)

```text
apps/mobile/
├── app/
│   ├── _layout.tsx              # UNCHANGED (ordering already correct)
│   ├── index.tsx                # REWRITE: binary gate — await initial sync, read `onboarding_completed`, emit log, redirect
│   └── onboarding.tsx           # REWRITE: read cursor, write cursor on transitions, persist language/currency via profile-service, call completeOnboarding at the end
├── components/
│   ├── onboarding/
│   │   ├── LanguagePickerStep.tsx    # MODIFY: propagate selected language to caller; caller calls profile-service.setPreferredLanguage
│   │   ├── CurrencyPickerStep.tsx    # MODIFY: remove `onSkip` prop, remove Skip button, remove FALLBACK_CURRENCY (FR-009)
│   │   └── WalletCreationStep.tsx    # MODIFY: on user dismiss, caller calls profile-service.completeOnboarding(userId) which also clears the cursor
│   └── ui/
│       ├── InitialSyncOverlay.tsx    # UNCHANGED
│       └── RetrySyncScreen.tsx       # NEW: V2 "Status Card" — see mockup assets
├── services/
│   ├── profile-service.ts            # NEW: setPreferredLanguage, setPreferredCurrencyAndCreateCashAccount, completeOnboarding
│   └── onboarding-cursor-service.ts  # NEW: readOnboardingStep, writeOnboardingStep, clearOnboardingStep (AsyncStorage wrapper)
├── hooks/
│   └── useProfile.ts                 # NEW: observes first profile row; exposes { profile, isLoading }
├── providers/
│   └── SyncProvider.tsx              # MODIFY: add initialSyncState + retryInitialSync + 20s timeout
├── utils/
│   ├── routing-decision.ts           # NEW: pure getRoutingDecision + buildRoutingDecisionLog
│   └── logger.ts                     # EXISTING (used by the gate for FR-014 log)
├── constants/
│   └── storage-keys.ts               # MODIFY: DELETE HAS_ONBOARDED_KEY and LANGUAGE_KEY exports (FR-015)
└── __tests__/
    ├── utils/
    │   ├── routing-decision.test.ts        # NEW
    │   └── routing-decision-log.test.ts    # NEW
    ├── services/
    │   ├── profile-service.test.ts         # NEW
    │   └── onboarding-cursor-service.test.ts   # NEW
    ├── hooks/
    │   └── useProfile.test.ts              # NEW
    ├── providers/
    │   └── SyncProvider.test.tsx           # NEW
    └── app/
        ├── index.test.tsx                  # NEW — integration for the gate
        └── onboarding.test.tsx             # NEW — integration for the resume state machine

packages/db/
├── src/
│   ├── schema.ts                 # REGENERATE: add preferred_language column to profiles
│   ├── migrations.ts             # REGENERATE: schema version bump + addColumns step
│   ├── supabase-types.ts         # REGENERATE: includes preferred_language_code enum type
│   └── models/base/
│       └── base-profile.ts       # REGENERATE: new @field("preferred_language") preferredLanguage!: string

supabase/migrations/
└── 040_add_preferred_language_to_profiles.sql  # NEW: CREATE TYPE + ALTER TABLE

docs/business/
└── business-decisions.md         # MODIFY: document the new flow and server-authoritative fields
```

**Structure Decision**: Mobile-monorepo layout. Schema work is strictly in
`packages/db` via the standard migration pipeline. Feature code is strictly in
`apps/mobile`, split across `app/` (routes), `components/` (UI), `services/`
(business logic), `hooks/` (subscriptions), `providers/` (cross-cutting
providers), and `utils/` (pure functions). Tests live under
`apps/mobile/__tests__/`. No changes to `packages/logic` or `apps/api`.

## Phase 0: Outline & Research

Produced as [research.md](./research.md). Summary:

- **Routing-gate location**: `apps/mobile/app/index.tsx`. Today reads
  AsyncStorage `HAS_ONBOARDED_KEY`; replace with profile-driven decision.
- **Blocking-sync feasibility**: `SyncProvider` already force-syncs on empty DB
  but does not block routing. Need the `initialSyncState` extension.
- **Existing schema**: `profiles.onboarding_completed` and
  `profiles.preferred_currency` already exist. Only `preferred_language` must be
  added.
- **Per-step progress location**: AsyncStorage (not DB), keyed by userId.
  Confirmed by user 2026-04-18.
- **Existing cash-account creation**: `ensureCashAccount(userId, currency)` in
  `apps/mobile/services/account-service.ts` is reused unchanged.
- **Retry screen dependency**: mockup approved (V2 "Status Card").
- **Legacy keys**: `HAS_ONBOARDED_KEY` and `LANGUAGE_KEY` deleted as part of
  this change.
- **Sign-out during onboarding happy path** and **back/forward nav between
  steps** are out of scope — tracked as
  [#242](https://github.com/Msamir22/Rizqi/issues/242) and
  [#243](https://github.com/Msamir22/Rizqi/issues/243).

## Phase 1: Design & Contracts

Produced as [data-model.md](./data-model.md),
[contracts/profile-service.ts](./contracts/profile-service.ts), and
[quickstart.md](./quickstart.md). Summary:

- **Data model**: one new column on `profiles` (`preferred_language`, enum, NOT
  NULL, default `'en'`); new Postgres enum `preferred_language_code`. Per-user
  cursor in AsyncStorage with key format `onboarding:<userId>:step`.
- **Service contract**: three profile mutations + three cursor functions + pure
  routing-decision function + sync-provider extension + log payload type.
- **Agent context update**: `.specify/scripts/bash/update-agent-context.sh agy`
  run at the end of the phase.

## Re-evaluation of Constitution Check (post-design)

After drafting research.md, data-model.md, and contracts:

| Principle                          | Post-design status                                      |
| ---------------------------------- | ------------------------------------------------------- |
| I. Offline-First Data Architecture | ✅ Pass                                                 |
| II. Documented Business Logic      | ⚠️ Action tracked as Phase 2 task                       |
| III. Type Safety                   | ✅ Pass                                                 |
| IV. Service-Layer Separation       | ✅ Pass (profile-service + cursor-service + pure utils) |
| V. Premium UI + Schema-driven      | ✅ Pass                                                 |
| VI. Monorepo Package Boundaries    | ✅ Pass                                                 |
| VII. Local-First Migrations        | ✅ Pass                                                 |

**Post-design gate**: Pass. No violations requiring Complexity Tracking entries.

## Complexity Tracking

No entries required.

## Stop Point

This command ends after Phase 1 / agent context update. Next step is
`/speckit.tasks` to regenerate `tasks.md` for the simplified model.

**Open planning-phase items — all resolved as of 2026-04-18**:

1. ✅ Retry-screen mockup — V2 "Status Card" approved. Assets at
   `specs/024-skip-returning-onboarding/mockups/`.
2. ✅ Per-step storage location — AsyncStorage, userId-namespaced. Confirmed.
3. ✅ Enum case — lowercase `'en' | 'ar'`. Confirmed.
4. ✅ Legacy AsyncStorage keys — deleted (not deprecated). Confirmed.
5. **Tasks-phase verification**: confirm that `SyncProvider.initialSync` can be
   made a blocking gate; implement the state-based `initialSyncState` extension
   if missing. Surfaced in research.md § 2.
