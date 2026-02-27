# Implementation Plan: Default Cash Account

**Branch**: `009-default-cash-account` | **Date**: 2026-02-26 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/009-default-cash-account/spec.md)
**Input**: Feature specification from `/specs/009-default-cash-account/spec.md`

## Summary

Auto-create a **Cash** account (type `"CASH"`, zero balance, user's preferred
currency) when a new user completes onboarding. Show a playful toast
notification. Replace the lazy `findOrCreateCashAccount` codepath in
`batch-sms-transactions.ts` with a lookup of the pre-existing Cash account. Skip
ATM withdrawals with a user message when no Cash account exists.

## Technical Context

**Language/Version**: TypeScript (strict mode) **Primary Dependencies**: React
Native + Expo, WatermelonDB, NativeWind, expo-localization **Storage**:
WatermelonDB (local SQLite) → Supabase (PostgreSQL sync) **Testing**: Jest +
React Native Testing Library **Target Platform**: Android (iOS future), Egyptian
market **Project Type**: Mobile (monorepo: `apps/mobile`, `packages/db`,
`packages/logic`) **Performance Goals**: Cash account created within 2 seconds
of onboarding completion **Constraints**: Offline-first, no network dependency
for account creation **Scale/Scope**: One Cash account per user (auto-created),
users may create additional CASH accounts manually

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status  | Notes                                                                                                 |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| I. Offline-First              | ✅ PASS | Cash account created locally in WatermelonDB, syncs via background sync                               |
| II. Documented Business Logic | ✅ PASS | Spec documents all business rules; `business-decisions.md` update needed post-implementation          |
| III. Type Safety              | ✅ PASS | All new code uses strict TypeScript, no `any`, explicit return types                                  |
| IV. Service-Layer Separation  | ✅ PASS | New `account-service.ts` for DB writes, hook-free currency detection extracted as utility             |
| V. Premium UI                 | ✅ PASS | Toast notification via existing `useToast` infrastructure                                             |
| VI. Monorepo Boundaries       | ✅ PASS | Service in `apps/mobile/services/`, currency util in `packages/logic/` — follows dependency direction |
| VII. Local-First Migrations   | ✅ PASS | No schema changes needed — `accounts` table already supports `type = "CASH"`                          |

## Project Structure

### Documentation (this feature)

```text
specs/009-default-cash-account/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
apps/mobile/
├── app/
│   ├── index.tsx                    # [MODIFY] Add ensureCashAccount call after auth
│   └── onboarding.tsx               # [MODIFY] Add ensureCashAccount call in handleFinish
├── services/
│   ├── account-service.ts           # [NEW] ensureCashAccount + findCashAccount
│   └── batch-sms-transactions.ts    # [MODIFY] Remove findOrCreateCashAccount, use findCashAccount
└── components/
    └── ui/
        └── Toast.tsx                # [EXISTING] Used for playful notification

packages/logic/
└── src/
    └── utils/
        └── currency-detection.ts    # [NEW] Extract detectCurrencyFromDevice as pure util
```

**Structure Decision**: All new service logic goes into
`apps/mobile/services/account-service.ts` following Constitution IV
(Service-Layer Separation). The pure `detectCurrencyFromDevice` function moves
to `packages/logic/` following Constitution VI (Monorepo Package Boundaries)
since it has no React/mobile dependencies.

---

## Proposed Changes

### Component 1: Currency Detection Utility (`packages/logic`)

Extract `detectCurrencyFromDevice()` from
`apps/mobile/hooks/usePreferredCurrency.ts` into a shared utility in
`packages/logic/`. This function is pure (no React imports) and will be needed
by the new `account-service.ts` which has no access to hooks.

#### [NEW] [currency-detection.ts](file:///e:/Work/My%20Projects/Astik/packages/logic/src/utils/currency-detection.ts)

- Export `detectCurrencyFromDevice(): CurrencyType` — uses `expo-localization`
  `getLocales()`, checks against `SUPPORTED_CURRENCIES`, falls back to `"USD"`.
- Export from `packages/logic/src/index.ts` barrel.

#### [MODIFY] [usePreferredCurrency.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/hooks/usePreferredCurrency.ts)

- Import `detectCurrencyFromDevice` from `@astik/logic` instead of defining
  locally.
- Delete the local `detectCurrencyFromDevice` function.

---

### Component 2: Account Service (`apps/mobile/services`)

New service file providing Cash account operations.

#### [NEW] [account-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/account-service.ts)

Two exported functions:

1. **`ensureCashAccount(userId: string): Promise<EnsureCashAccountResult>`**
   - Queries WatermelonDB for existing `type = "CASH"` accounts for the user.
   - If found → returns `{ created: false, accountId }`.
   - If not found → creates one with `name = "Cash"`, `type = "CASH"`,
     `balance = 0`, `currency = detectCurrencyFromDevice()`.
   - Returns `{ created: true, accountId }`.
   - Uses `database.write()` for atomic creation.
   - Catches errors and returns `{ created: false, accountId: null, error }` —
     never throws (FR-005 retry-safe).

2. **`findCashAccount(userId: string): Promise<string | null>`**
   - Queries first `type = "CASH"` account for user.
   - Returns `accountId` or `null`.
   - Used by SMS batch save to look up (not create) Cash account.

#### [MODIFY] [index.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/index.ts)

- Re-export `ensureCashAccount` and `findCashAccount` from `account-service.ts`.

---

### Component 3: Onboarding Integration (`apps/mobile/app`)

Wire `ensureCashAccount` into both onboarding completion paths.

#### [MODIFY] [onboarding.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/onboarding.tsx)

- Import `ensureCashAccount` from `@/services/account-service` and
  `getCurrentUserId` from `@/services/supabase`.
- In `handleFinish()`, after `AsyncStorage.setItem("hasOnboarded", "true")`:
  1. Get `userId` via `getCurrentUserId()`.
  2. Call `ensureCashAccount(userId)`.
  3. If `result.created`, call a callback/state setter that triggers the toast
     on the Dashboard. (The toast must be shown after navigation since
     `onboarding.tsx` navigates away with `router.replace`).
- The cash account creation is **fire-and-forget** — doesn't block navigation.
  Errors are swallowed silently (FR-005: retried on next launch).

#### [MODIFY] [index.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/app/index.tsx)

- In `initializeApp()`, after `ensureAuthenticated()`:
  1. Get `userId` and call `ensureCashAccount(userId)`.
  2. This serves as the **retry fallback** (FR-005, FR-008) for failed
     onboarding creation.
  3. If `result.created`, persist a flag (e.g.,
     `AsyncStorage.setItem("showCashAccountToast", "true")`) to trigger the
     toast on the Dashboard.

---

### Component 4: Toast Notification (`apps/mobile`)

Show the playful toast after Cash account creation.

#### [MODIFY] Dashboard tab component (e.g., `(tabs)/index.tsx` or equivalent)

- On mount, check `AsyncStorage.getItem("showCashAccountToast")`.
- If `"true"`, show toast via `useToast()`:
  ```
  💰 Cash wallet ready! Because who leaves the house without pocket money?
  ```
- Clear the flag immediately after showing.
- Toast duration: 4 seconds (≥3s per SC-003), type: `"success"`.

---

### Component 5: SMS Batch Processing Cleanup (`apps/mobile/services`)

Remove lazy creation and use lookup instead.

#### [MODIFY] [batch-sms-transactions.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/batch-sms-transactions.ts)

- **Delete** `findOrCreateCashAccount()` function (lines 83-114).
- **Replace** ATM withdrawal routing logic (lines 188-193):
  - Import `findCashAccount` from `@/services/account-service`.
  - Call `findCashAccount(userId)` instead of `findOrCreateCashAccount(userId)`.
  - If `cashAccountId` is `null` (no Cash account exists):
    - Skip all ATM withdrawals.
    - Return skipped count in `BatchSaveResult`.
    - The caller (component) shows the user a message about skipped withdrawals.
- **Update** `BatchSaveResult` interface:
  - Add `readonly skippedAtmCount: number` field.
  - Add `readonly atmSkipReason?: string` field.

---

## Verification Plan

### Automated Tests

`apps/mobile/__tests__/services/account-service.test.ts` (new):

- Test `ensureCashAccount` creates Cash account when none exists.
- Test `ensureCashAccount` returns existing account without creating duplicate.
- Test `findCashAccount` returns `null` when no Cash account exists.
- Test `findCashAccount` returns first Cash account when multiple exist.
- Test `ensureCashAccount` uses `detectCurrencyFromDevice` for currency.

`packages/logic/__tests__/currency-detection.test.ts` (new):

- Test returns device locale currency when supported.
- Test falls back to USD when unsupported.

### Manual Verification

1. Fresh install → complete onboarding → verify Cash account on Dashboard +
   toast.
2. Skip onboarding → verify Cash account created + toast.
3. Kill app after onboarding, re-open → verify retry creates Cash account.
4. Existing user with Cash account → re-open → verify no duplicate, no toast.
5. Scan SMS with ATM withdrawals → verify transfer destination is Cash account.
6. Delete Cash account → scan SMS with ATM withdrawals → verify skipped + user
   message.
