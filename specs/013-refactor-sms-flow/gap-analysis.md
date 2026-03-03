# Gap Analysis: Refactor SMS Transaction Flow

**Branch**: `013-refactor-sms-flow` | **Date**: 2026-03-03 **Cross-referenced**:
`spec.md`, `plan.md`, `data-model.md`, `tasks.md`, `checklists/requirements.md`,
mockup images

---

## Summary

| Category                                | Implemented |    Gaps Found    |
| --------------------------------------- | :---------: | :--------------: |
| User Stories (US1–US6)                  |   5 of 6    |   **1 major**    |
| Functional Requirements (FR-001–FR-017) |  14 of 17   | **3 remaining**  |
| Tasks (T001–T045)                       |  41 of 45   |    **4 open**    |
| Automated Tests                         |   0 of 3    |  **3 missing**   |
| Mockup Fidelity                         |   3 of 4    | **4 deviations** |
| Docs & Session History                  |   0 of 1    |    **1 open**    |

---

## ✅ Verified (Previously Reported — No Action Needed)

### ~~GAP-1: Cash Withdrawal Label on Card (US5 — FR-009)~~ ✅ FALSE ALARM

`SmsTransactionItem.tsx` lines 148-154 already contain the `isAtmWithdrawal`
check and render an amber-styled "Cash Withdrawal" badge. Initial grep used an
incorrect regex and yielded false negatives.

---

## 🔴 Major Gaps (Functionality Not Implemented)

### GAP-2: Cash Withdrawal Edit Modal — From/To Transfer Layout (US6 — FR-010, FR-011)

**Spec says**: The edit modal for cash withdrawals must show:

- Only the "Transfer" type tab (hide Income/Expense)
- Two account fields: "FROM" (bank) → arrow → "TO" (cash)
- Auto-select the first cash account if one exists
- Text input with "Cash" pre-populated if no cash accounts exist

**What IS implemented**:

- ✅ `isAtmWithdrawal` detected (line 203)
- ✅ Type toggle hidden for ATM withdrawals (lines 416-451)
- ✅ "Cash Withdrawal (Transfer)" amber badge shown (lines 453-467)

**What is MISSING**:

- ❌ No From/To dual-account layout (only single Account dropdown)
- ❌ No cash account dropdown for "TO" field
- ❌ No "Cash" pre-populated text input when no cash accounts exist
- ❌ `toAccountId` / `toAccountName` never set in `handleSave`

**Affected tasks**: T039 (partial), T040, T041 **Affected FRs**: FR-010
(partial), FR-011 **Mockup**: Mockup 4 — partially matched

---

### GAP-3 + GAP-7 (Merged): ATM Withdrawal Skips Instead of Auto-Creating Cash Account (FR-013)

**Spec says** (FR-013): When saving a cash withdrawal where no cash account
exists, the system MUST auto-create one.

**Actual code** (`batch-sms-transactions.ts` lines 168-174):

```typescript
if (tx.isAtmWithdrawal) {
  if (!cashAccountId) {
    skippedAtmCount++; // ← SKIPS instead of creating
    continue;
  }
  // ... creates Transfer record
}
```

The batch service uses `findCashAccount()` (line 140-142) which only looks up an
existing cash account. If none exists, it **skips** the ATM withdrawal entirely.
The fix: replace `findCashAccount()` with `ensureCashAccount()` (which already
exists in `account-service.ts` and creates one if missing).

**Affected tasks**: T042 **Affected FRs**: FR-013

---

## 🟡 Moderate Gaps (Missing Tests & Docs)

### GAP-4: Unit Tests Not Written (T010, T044)

3 test suites planned but none written:

1. `sms-account-matcher.test.ts` — `matchAccountCore` tests (T010)
2. `transaction-validation.test.ts` — zero amount test
3. `sms-sync-service.test.ts` — regression run (T044)

### GAP-5: Session History & Project Memory Not Updated (T045)

---

## 🟢 Minor Gaps (Design / Cosmetic)

### GAP-6: Currency Conversion Notice — Rate Value Not Shown

**Spec** (FR-008): `"≈ {converted} {targetCurrency} at rate {rate}"` **Code**
(line 510): Shows `"≈ {converted} {currency} at current rate"` — no actual rate
number.

### GAP-8: Edit Modal — Sender Info Card Missing Bank Icon

**Mockup**: Teal circle with bank icon (🏛) next to sender info. **Code** (lines
403-414): Plain slate card with "From" label, no icon.

### GAP-9: Edit Modal — Helper Message Style Doesn't Match Mockup

**Mockup 2**: Emerald confirmation bar with ✓ icon:
`WE'LL CREATE AN ACCOUNT NAMED 'BANQUE MISR' IN EGP.` **Code** (lines 612-616):
Plain gray `text-slate-500` text:
`"No bank accounts found. Enter a name and we'll create one for you."`

Differences: no checkmark icon, no emerald background, different wording, no
dynamic account name/currency in message.

---

## FR Cross-Reference

| FR     | Description                    | Status     | Notes                                           |
| ------ | ------------------------------ | ---------- | ----------------------------------------------- |
| FR-001 | Skip Account Setup             | ✅ Done    | AccountSetupStep removed                        |
| FR-002 | Remove setup utilities         | ✅ Done    | Deleted + build-initial-account-state           |
| FR-003 | Account matching per card      | ✅ Done    | `matchTransactionsBatched` works                |
| FR-004 | First bank fallback (Step 5)   | ✅ Done    | `matchAccountCore` Step 5                       |
| FR-005 | Sender name when no accounts   | ✅ Done    | `senderDisplayName` shown                       |
| FR-006 | Account dropdown in edit modal | ✅ Done    | Dropdown with auto-select                       |
| FR-007 | Text input when no accounts    | ✅ Done    | Pre-populated with sender name                  |
| FR-008 | Currency conversion notice     | ⚠️ Partial | Missing actual rate number. See GAP-6           |
| FR-009 | Cash withdrawal card label     | ✅ Done    | Lines 148-154 SmsTransactionItem                |
| FR-010 | Transfer-only tab for ATM      | ⚠️ Partial | Tab hidden ✅, but no From/To layout. See GAP-2 |
| FR-011 | From/To fields for ATM         | ❌ Missing | See GAP-2                                       |
| FR-012 | Persist Account + BankDetails  | ✅ Done    | `persistPendingAccounts` creates both           |
| FR-013 | Auto-create cash account       | ❌ Missing | Skips ATM instead. See GAP-3                    |
| FR-014 | "+ New" toggle                 | ✅ Done    | Works, switches dropdown ↔ text input           |
| FR-015 | In-memory pending accounts     | ✅ Done    | Session state, persisted on save                |
| FR-016 | Zero-amount validation         | ✅ Done    | Zod schema: `parseFloat(val) > 0`               |
| FR-017 | Batched resolution (~20)       | ✅ Done    | `BATCH_SIZE = 20` with progressive render       |

---

## Recommended Fix Order

1. **GAP-3** (quick fix): Replace `findCashAccount()` with `ensureCashAccount()`
   in `batch-sms-transactions.ts`. Remove skip logic.
2. **GAP-2** (US6): Add From/To transfer layout to edit modal for ATM
   withdrawals. Needs `cashAccounts` prop and dual dropdown UI.
3. **GAP-8 + GAP-9** (design polish): Add bank icon to sender card, style helper
   message as emerald bar with dynamic text.
4. **GAP-6** (cosmetic): Show actual conversion rate in the notice.
5. **GAP-4** (tests): Write `matchAccountCore` unit tests.
6. **GAP-5** (docs): Update session history.
