# Research: Trigger Conflict Analysis & Architecture Decision

**Feature**: 004-finalize-transactions  
**Date**: 2026-02-15  
**Updated**: 2026-02-15 (v2 — corrected analysis based on user feedback)

## 1. The Double-Counting Problem

### Scenario

An account has 5,000 EGP balance. The user creates a new expense transaction for
500 EGP.

**Step 1 — Local (instant):**

```
App: account.balance = 5,000 - 500 = 4,500 EGP  ← delta update
WatermelonDB marks BOTH records as dirty:
  - Transaction: NEW record (amount=500, type=EXPENSE)
  - Account: UPDATED record (balance=4,500)
```

**Step 2 — Sync push:** The `pushChanges` function iterates over all syncable
tables and pushes changes for each one. The order of table iteration is **not
guaranteed**.

**Path A — Transaction pushed first:**

```
1. INSERT INTO transactions (amount=500, type=EXPENSE)
   → Trigger fires → SUM(transactions) = -500 → account.balance = -500  ← WRONG
2. UPSERT INTO accounts (balance=4,500)
   → Overwrites trigger's -500 → account.balance = 4,500  ← Correct final result
```

**Path B — Account pushed first:**

```
1. UPSERT INTO accounts (balance=4,500) → account.balance = 4,500
2. INSERT INTO transactions (amount=500, type=EXPENSE)
   → Trigger fires → SUM(transactions) = -500 → account.balance = -500  ← WRONG
```

> [!CAUTION] **Path B produces an incorrect balance of -500 EGP.** The trigger's
> `SUM()` recalculation considers **only transactions** — it does not account
> for the account's initial/manual balance or for the app's delta-calculated
> balance. The trigger's write is the **last write**, so it wins.

### Why the Trigger's SUM() Is Fundamentally Incompatible

The trigger calculates:

```sql
SUM(CASE WHEN type='INCOME' THEN amount WHEN type='EXPENSE' THEN -amount END)
```

This assumes that account balance = sum of all transactions. But in Monyvi:

- Accounts can have an **initial balance** set during creation (currently always
  0, but could be non-zero)
- The app uses **delta-based** balance updates, not derived-from-transactions
  balance
- Transfers affect account balances but **live in a separate table**
  (`transfers`) that the trigger doesn't query

### Additional Conflict: The Sync Loop

Even in Path A (where the final value is correct), the trigger updated
`accounts.updated_at = NOW()`. This means:

1. On the next **sync pull**, WatermelonDB sees the account as "changed
   server-side"
2. The server's account record (with `updated_at` from the trigger) gets pulled
   to the device
3. If the trigger's balance differs from the app's balance (e.g., a new transfer
   happened between push and pull), this creates **balance flicker** on the
   device

---

## 2. Recommendation: Remove the Triggers

> [!IMPORTANT] **Decision: DROP the Supabase balance triggers.** Keep balance
> management entirely in the application layer.

### What to Remove (new migration)

```sql
DROP TRIGGER IF EXISTS trg_transactions_balance_insert ON public.transactions;
DROP TRIGGER IF EXISTS trg_transactions_balance_update ON public.transactions;
DROP TRIGGER IF EXISTS trg_transactions_balance_delete ON public.transactions;
DROP FUNCTION IF EXISTS public.update_account_balance_on_transaction_change();
```

### What to KEEP

- **`recalculate_account_balance(account_id)`** — Keep as a manual utility for
  data repair
- **`recalculate_all_account_balances()`** — Keep for batch repair/audit
  scenarios
- **App's local delta-based updates** — Remain the sole mechanism for balance
  management

### Why This Is Safe

1. **Offline-first architecture**: The app already manages balances correctly
   via delta updates in `transaction-service.ts` and `transfer-service.ts`
2. **Atomic writes**: All balance updates happen within `database.write()`
   blocks, ensuring local consistency
3. **WatermelonDB sync**: The synced account record carries the correct balance
   from the app
4. **Manual repair**: The kept utility functions can be run on-demand if drift
   is ever detected
5. **Future transfer triggers**: Not needed — same pattern applies (app manages
   balance, sync pushes result)

---

## 3. Transfer Trigger Gap

No transfer triggers exist, and per the decision above, **none should be
created**. Balance management for transfers is handled by the app layer in
[transfer-service.ts](file:///E:/Work/My%20Projects/Monyvi/apps/mobile/services/transfer-service.ts).

---

## 4. Cross-Currency Account Swaps

When a transaction is moved from an EGP account to a USD account:

- The original amount (e.g., 500 EGP) is reverted from the old account
- The same numeric amount (500) is applied to the new account in that account's
  currency (USD)
- No automatic currency conversion is performed — the user is responsible for
  the amount
- This matches the existing transfer model which stores `amount` and
  `convertedAmount` separately

---

## 5. Bidirectional Type Conversion

Both conversion directions are supported:

- **Transaction → Transfer**: Soft-delete transaction, create new transfer
  record (atomic)
- **Transfer → Transaction**: Soft-delete transfer, create new transaction
  record (atomic)
