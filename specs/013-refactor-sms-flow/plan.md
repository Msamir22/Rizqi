# Implementation Plan: Refactor SMS Transaction Flow

**Branch**: `013-refactor-sms-flow` | **Date**: 2026-03-02 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Astik/specs/013-refactor-sms-flow/spec.md)
**Input**: Feature specification from `/specs/013-refactor-sms-flow/spec.md`

## Summary

Remove the AccountSetupStep wizard from the SMS flow and replace it with inline
account resolution on the review page. The edit modal is redesigned with:
account dropdown (or text input if no accounts), `+ New` account toggle,
currency conversion notice, and a Transfer layout for cash withdrawals. Account
resolution uses batched processing (~20/batch) with progressive rendering.

---

## Technical Context

**Language/Version**: TypeScript (strict mode) **Primary Dependencies**: React
Native + Expo, NativeWind v4, WatermelonDB, React Query **Storage**:
WatermelonDB (SQLite) + Supabase (PostgreSQL) **Testing**: Jest + React Native
Testing Library **Target Platform**: iOS & Android (React Native) **Project
Type**: Mobile (monorepo: `apps/mobile`, `packages/db`, `packages/logic`)
**Performance Goals**: Batched resolution ~20 txns/batch, modal open < 200ms
**Constraints**: Offline-first (all reads/writes via WatermelonDB), NativeWind
shadow bug **Scale/Scope**: Typically 50–200 parsed SMS transactions per scan
session

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #   | Principle                 | Status  | Notes                                                                                                          |
| --- | ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| I   | Offline-First Data        | ✅ PASS | All account resolution, creation, and transaction save use WatermelonDB. No network dependency.                |
| II  | Documented Business Logic | ✅ PASS | Spec captures all rules. `business-decisions.md` to be updated post-merge.                                     |
| III | Type Safety               | ✅ PASS | All new interfaces (`PendingAccount`, `TransactionEdits`) use strict types. No `any`.                          |
| IV  | Service-Layer Separation  | ✅ PASS | Resolution logic stays in services (`sms-account-resolver.ts`). Hooks handle lifecycle only. Modal is pure UI. |
| V   | Premium UI                | ✅ PASS | Mockups approved. Uses NativeWind classes, color palette from `colors.ts`, no `isDark` ternaries.              |
| VI  | Monorepo Boundaries       | ✅ PASS | Changes are in `apps/mobile` only. No new package dependencies needed. `@astik/logic` types used via imports.  |
| VII | Local-First Migrations    | ✅ N/A  | No schema changes needed. `accounts` and `bank_details` tables already exist.                                  |

---

## Project Structure

### Documentation (this feature)

```text
specs/013-refactor-sms-flow/
├── spec.md              # Approved ✅
├── plan.md              # This file
├── research.md          # Phase 0 (inline — no unknowns)
├── data-model.md        # Phase 1 entity definitions
└── tasks.md             # Phase 2 (via /speckit.tasks)
```

### Source Code (repository root)

```text
apps/mobile/
├── components/sms-sync/
│   ├── SmsTransactionEditModal.tsx   # [MODIFY] Redesigned modal
│   ├── SmsTransactionItem.tsx        # [MODIFY] Cash withdrawal label
│   └── SmsTransactionReview.tsx      # [MODIFY] Batched resolution + PendingAccount state
├── context/
│   └── SmsScanContext.tsx            # [MODIFY] Remove SenderAccountMap, simplify
├── hooks/
│   └── useMarketRates.ts            # [READ-ONLY] Currency conversion rates
├── services/
│   ├── sms-account-matcher.ts       # [MODIFY] Extract matchAccountCore, add batching, bank-only filter
│   ├── sms-account-resolver.ts      # [MODIFY] Thin wrapper — fetches accounts, calls matchAccountCore
│   ├── batch-sms-transactions.ts    # [MODIFY] Remove createAccountsFromSmsSetup, new transactionAccountMap
│   ├── pending-account-service.ts   # [NEW] PendingAccount creation + bank_details
│   └── account-service.ts           # [READ-ONLY] ensureCashAccount reused for cash withdrawal
├── validation/
│   └── transaction-validation.ts    # [MODIFY] Add zero-amount check (FR-016)
└── __tests__/services/
    └── sms-account-matcher.test.ts  # [NEW] Tests for matchAccountCore + fallback
```

**Structure Decision**: Mobile monorepo, single app. All changes in
`apps/mobile/`. Resolution logic in services, UI in components/sms-sync, state
in context.

---

## Proposed Changes

### Component 1: Account Matching Consolidation

> **Goal**: Unify the duplicate matching logic in `resolveAccountForSms` and
> `matchTransaction` into a single shared `matchAccountCore` pure function. Uses
> `senderAddress` only (no `financialEntity`). Add first-bank-account fallback
> (Step 5) and batched processing for the review page.

---

#### [MODIFY] [sms-account-matcher.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/sms-account-matcher.ts)

**This becomes the single source of truth for all account matching logic.**

- **Extract `matchAccountCore()`**: Pure function implementing the 5-step
  resolution chain from `resolveAccountForSms`. Uses `senderAddress` only — no
  `financialEntity`.

  ```typescript
  interface MatchInput {
    readonly senderAddress: string;
    readonly cardLast4?: string;
    readonly currency?: CurrencyType;
  }
  function matchAccountCore(
    input: MatchInput,
    accounts: readonly AccountWithBankDetails[]
  ): AccountMatch;
  ```

  Resolution chain (same as current `resolveAccountForSms`):
  1. Card last 4 + sender match against `bank_details`
  2. Sender match alone against `bank_details` / account name
  3. Name+currency match via bank registry (`isKnownFinancialSender`)
  4. Default account (`isDefault` flag)
  5. **NEW**: First bank account fallback (sorted by `created_at ASC`)

- **Replace `matchTransaction()`**: Becomes a thin wrapper that maps
  `ParsedSmsTransaction` → `MatchInput` (using `senderAddress` + `cardLast4` +
  `currency`) and calls `matchAccountCore`.
- **New `matchTransactionsBatched()`**: Fetches accounts once, then processes
  ~20 transactions per batch calling `matchAccountCore` for each. Yields results
  via callback for progressive rendering.

  ```typescript
  function matchTransactionsBatched(
    transactions: readonly ParsedSmsTransaction[],
    userId: string,
    batchSize: number,
    onBatchComplete: (batch: ReadonlyMap<number, AccountMatch>) => void
  ): Promise<void>;
  ```

- **`fetchAccountsWithDetails`**: Add optional `accountType` filter param for
  bank-only queries.
- **Move `isSenderMatch()`** from `sms-account-resolver.ts` to this file
  (shared).
- **Move `extractCardLast4()`** from `sms-account-resolver.ts` to this file
  (shared).

#### [MODIFY] [sms-account-resolver.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/sms-account-resolver.ts)

**Becomes a thin wrapper for the live-detection use case (single SMS, no
pre-parsed data).**

- **Simplify `resolveAccountForSms()`**: Fetch accounts via
  `fetchAccountsWithDetails`, extract `cardLast4` from raw SMS body, build
  `MatchInput`, call `matchAccountCore()`.
- **Remove**: `isSenderMatch()`, `extractCardLast4()`, `CARD_LAST_4_PATTERNS`,
  the inline resolution chain — all moved to `sms-account-matcher.ts`.
- **Keep**: The function signature (`senderAddress, smsBody, currency?`) since
  the live detection handler depends on it.
- Net result: ~200 lines removed, replaced by ~10-line wrapper.

---

### Component 2: PendingAccount Service (New)

> **Goal**: Encapsulate logic for creating in-memory pending accounts and
> persisting them with `bank_details` on final save.

---

#### [NEW] [pending-account-service.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/pending-account-service.ts)

- `PendingAccount` interface:
  `{ tempId, name, currency, type: 'BANK', senderAddress, cardLast4? }`
- `persistPendingAccounts(pendingAccounts, userId)`: Creates real Account +
  BankDetails records in a WatermelonDB batch write. Returns a
  `Map<tempId, realAccountId>` for re-linking transactions.
- Validates name uniqueness (case-insensitive) against existing accounts before
  creation.
- Creates `bank_details` with `sms_sender_name` and `cardLast4` per
  FR-012/Clarification Q1.

---

### Component 3: Batch Save Refactor

> **Goal**: Remove `createAccountsFromSmsSetup`, update
> `batchCreateSmsTransactions` to accept resolved account IDs per-transaction
> (no more SenderAccountMap).

---

#### [MODIFY] [batch-sms-transactions.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/services/batch-sms-transactions.ts)

- **Remove**: `createAccountsFromSmsSetup()` function and `AccountSetupResult`
  type (~50 lines).
- **Update `batchCreateSmsTransactions`** signature: Instead of
  `SenderAccountMap + defaultAccountId`, accept
  `transactionAccountMap: Map<number, string>` mapping each transaction index to
  its resolved accountId. This aligns with the new flow where resolution happens
  on the review page.
- Keep existing: category resolution, balance delta accumulation, ATM/cash
  withdrawal handling.

---

### Component 4: SmsScanContext Simplification

> **Goal**: Remove `SenderAccountMap` and `defaultAccountId` — no longer needed
> since account resolution happens on the review page, not via a setup wizard.

---

#### [MODIFY] [SmsScanContext.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/context/SmsScanContext.tsx)

- Remove `senderAccountMap`, `setSenderAccountMap`, `defaultAccountId`,
  `setDefaultAccountId` (and their `useState` + `useCallback` wrappers)
- Keep: `transactions`, `setTransactions`, `clearTransactions`, `scanMode`,
  `setScanMode`
- Remove import of `SenderAccountMap` type

---

### Component 5: Review Page (Batched Resolution + PendingAccount State)

> **Goal**: Replace `matchAllTransactions` with `matchTransactionsBatched`,
> manage `PendingAccount[]` state, and pass account data to item cards.

---

#### [MODIFY] [SmsTransactionReview.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/SmsTransactionReview.tsx)

- **Replace `runMatching`**: Use `matchTransactionsBatched()` with
  `BATCH_SIZE = 20`. Update `accountMatches` state progressively as each batch
  completes.
- **Add `pendingAccounts` state**: `useState<readonly PendingAccount[]>([])` to
  hold in-memory accounts created via the `+ New` toggle in the edit modal.
- **Update `handleSave`**:
  1. Filter `pendingAccounts` to only those referenced by selected transactions.
  2. Call `persistPendingAccounts()` to create real accounts + bank_details.
  3. Re-map transaction accountIds from tempId → realId using the returned map.
  4. Call updated `batchCreateSmsTransactions()` with the resolved account map.
- **Pass new props** to `SmsTransactionEditModal`: `pendingAccounts`, callback
  to add new pending accounts, bank accounts list for dropdown.

---

### Component 6: Transaction Item (Cash Withdrawal Label)

> **Goal**: Display "Cash Withdrawal" label instead of From/To fields for ATM
> transactions.

---

#### [MODIFY] [SmsTransactionItem.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/SmsTransactionItem.tsx)

- Add logic: when `transaction.isAtmWithdrawal === true`, show a
  `"Cash Withdrawal"` label text styled in blue (#3B82F6) instead of the account
  name.
- Keep the existing expand/collapse and edit button behavior.

---

### Component 7: Edit Modal Redesign

> **Goal**: Complete redesign of the edit modal per mockups. 4 states: (1)
> dropdown with bank accounts, (2) text input without accounts, (3) `+ New`
> toggle, (4) cash withdrawal transfer layout.

---

#### [MODIFY] [SmsTransactionEditModal.tsx](file:///e:/Work/My%20Projects/Astik/apps/mobile/components/sms-sync/SmsTransactionEditModal.tsx)

**A. Account Field — Dropdown mode (user has bank accounts):**

- Show `ACCOUNT` label row with `+ New` pill button on the right.
- Tappable dropdown showing selected account name with chevron.
- Inline expandable picker list (existing pattern, filtered to bank accounts).
- First auto-matched account is pre-selected.

**B. Account Field — Text input mode (no bank accounts):**

- Show `ACCOUNT` label (no `+ New` pill since there are no accounts to switch
  to).
- Editable text input pre-populated with `transaction.senderDisplayName`.
- Helper message: "We'll create an account named '{name}' in {currency}."

**C. Account Field — `+ New` toggle (user tapped `+ New`):**

- Replace dropdown with editable text input.
- Show `✕ Cancel` pill (red) to switch back to dropdown.
- Emerald focus border on the text input to indicate creation mode.
- Helper message: "This account will be created as a Bank account in
  {currency}."
- Validate: no duplicate name (case-insensitive) against existing accounts.
- On save: add a `PendingAccount` to parent state, set as this transaction's
  account.

**D. Cash Withdrawal — Transfer layout:**

- Type toggle shows ONLY "Transfer" (hide Expense/Income).
- Replace single Account field with "FROM ACCOUNT" (bank) + arrow + "TO ACCOUNT"
  (cash).
- FROM: dropdown of bank accounts (same as A, with `+ New`).
- TO: dropdown of cash accounts, or text input if none exist (with helper
  message).
- Auto-select first cash account if one exists.

**E. Currency Conversion Notice (cross-cutting):**

- When selected account currency ≠ transaction currency, show blue notice below
  the amount field: "≈ {converted} {targetCurrency} at rate {rate}"
- Use `useMarketRates` hook to get the exchange rate.
- Original amount stays in the amount field (not replaced).

**F. Zero-amount validation (FR-016):**

- Reject save if parsed amount is 0. Show validation error.

**New Props needed**:

- `bankAccounts: readonly AccountWithBankDetails[]`
- `cashAccounts: readonly AccountWithBankDetails[]`
- `pendingAccounts: readonly PendingAccount[]`
- `onCreatePendingAccount: (account: PendingAccount) => void`
- `isCashWithdrawal: boolean`

---

### Component 8: Validation

#### [MODIFY] [transaction-validation.ts](file:///e:/Work/My%20Projects/Astik/apps/mobile/validation/transaction-validation.ts)

- Add zero-amount check: if `amount === 0`, return
  `{ isValid: false, errors: { amount: "Amount cannot be zero" } }`.

---

## Complexity Tracking

No constitution violations. No complexity justifications needed.

---

## Verification Plan

### Automated Tests

#### 1. `sms-account-matcher` — matchAccountCore test (NEW)

**File**: `apps/mobile/__tests__/services/sms-account-matcher.test.ts`

Tests to add:

- When all 4 steps fail, Step 5 returns the first bank account.
- When no bank accounts exist at all, returns null.
- When bank accounts exist but are all deleted, returns null.

**Run**:
`npx jest --config apps/mobile/jest.config.ts apps/mobile/__tests__/services/sms-account-matcher.test.ts`

#### 2. `transaction-validation` — Zero amount test (ADD TO EXISTING)

**File**: `apps/mobile/__tests__/validation/transaction-validation.test.ts` (if
exists) or new file.

Tests:

- Amount of 0 should fail validation.
- Amount of -1 should fail (already exists?).
- Amount of 0.01 should pass.

**Run**:
`npx jest --config apps/mobile/jest.config.ts apps/mobile/__tests__/validation/`

#### 3. Existing `sms-sync-service.test.ts` — Regression

**Run**:
`npx jest --config apps/mobile/jest.config.ts apps/mobile/__tests__/services/sms-sync-service.test.ts`

Ensure existing 506-line test suite still passes after removing
`createAccountsFromSmsSetup`.

### Manual Verification (User)

> [!IMPORTANT] These tests require the app running on Android/iOS with SMS
> access.

#### Test 1: Regular Transaction with Bank Accounts

1. Ensure you have at least 2 bank accounts in the app with bank_details
   configured.
2. Start an SMS scan and navigate to the review page.
3. Verify: Each transaction card shows the matched bank account name.
4. Tap a card to open the edit modal → verify dropdown shows your bank accounts.
5. Switch the account → verify a currency conversion notice appears if
   currencies differ.

#### Test 2: No Bank Accounts

1. Delete all bank accounts (or use a fresh user).
2. Start an SMS scan → review page.
3. Verify: Cards show the SMS sender display name (e.g., "CIB", "NBE").
4. Open edit modal → verify a text input pre-populated with sender name + helper
   message.
5. Save → verify the account is created in WatermelonDB with type BANK.

#### Test 3: `+ New` Account Toggle

1. Have at least 1 bank account.
2. Open edit modal, tap `+ New` pill.
3. Verify: Dropdown replaced by text input with emerald border.
4. Type a name, save.
5. Open another transaction's edit modal → verify the new account appears in the
   dropdown.
6. Save all → verify only referenced pending accounts are persisted.

#### Test 4: Cash Withdrawal

1. Have a cash withdrawal transaction in the scan results.
2. Verify: The card shows "Cash Withdrawal" label.
3. Open edit modal → verify only "Transfer" tab visible.
4. Verify: From = bank account, To = cash account (auto-selected if exists).
5. Save → verify a transfer record is created in WatermelonDB.

#### Test 5: Batched Loading

1. Scan 50+ transactions.
2. Verify: Cards populate progressively (batches of ~20), not all at once after
   a long wait.
