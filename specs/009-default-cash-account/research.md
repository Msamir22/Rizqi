# Research: Default Cash Account

**Branch**: `009-default-cash-account` | **Date**: 2026-02-26

## Research Findings

### 1. Where to trigger Cash account creation

**Decision**: Dual trigger — onboarding completion (primary) + app
initialization (fallback).

**Rationale**: The `handleFinish()` in `onboarding.tsx` is the natural insertion
point since it already calls `AsyncStorage.setItem("hasOnboarded", "true")`.
However, failures must be recovered, so `index.tsx`'s `initializeApp()` runs
`ensureCashAccount` as a catch-all retry. Both paths converge on the same
idempotent service function.

**Alternatives considered**:

- SyncProvider initialization — rejected: fires too late (after sync), and sync
  can be slow on first launch.
- Dashboard component mount — rejected: would run on every tab navigation,
  introducing unnecessary DB queries.
- Supabase trigger (server-side) — rejected: violates Constitution I
  (offline-first). Account creation must work with zero network.

### 2. How to detect preferred currency without hooks

**Decision**: Extract `detectCurrencyFromDevice()` from
`usePreferredCurrency.ts` into `packages/logic/src/utils/currency-detection.ts`.

**Rationale**: The function is pure (uses only `expo-localization` and the
`SUPPORTED_CURRENCIES` constant). Moving it to `@astik/logic` respects monorepo
boundaries and allows `account-service.ts` (a service, not a hook) to use it
directly.

**Alternatives considered**:

- Pass currency as parameter from calling code — rejected: adds coupling and
  complexity to both callsites (`index.tsx` would need a hook, but it's not a
  component with hook access).
- Hardcode EGP — rejected: not all users are Egyptian. The existing
  `findOrCreateCashAccount` hardcodes `"EGP"`, which this fixes.

### 3. How to show toast after navigation

**Decision**: Use `AsyncStorage` flag (`showCashAccountToast`) set at creation
time, consumed on Dashboard mount.

**Rationale**: Since `onboarding.tsx` navigates away with
`router.replace("/(tabs)")`, any toast triggered before navigation would be
unmounted immediately. The flag pattern is already used in the app
(`hasOnboarded`, `hasCompletedSmsSync`).

**Alternatives considered**:

- Expo Router params — rejected: `router.replace` params are lost on remount and
  not persisted.
- React Context — rejected: context is lost across navigations with
  `router.replace`.
- Global event emitter — rejected: added complexity for a one-time event, no
  existing pattern in the codebase.

### 4. How to identify the Cash account for ATM routing

**Decision**: Query by `type = "CASH"`, return the first result.

**Rationale**: This matches the existing `findOrCreateCashAccount` pattern. The
`Account` model already has `isCash` getter. If multiple CASH accounts exist,
the first by query order is used, and the user can change it during the review
step (per clarification Q1).

### 5. How to handle ATM withdrawals with no Cash account

**Decision**: Skip them and return a count + reason in `BatchSaveResult`.

**Rationale**: Per clarification Q2, ATM withdrawals should be skipped with a
user message. The component layer (not the service) shows the message,
maintaining Constitution IV (service-layer separation). The service only returns
data; the UI decides how to present it.
