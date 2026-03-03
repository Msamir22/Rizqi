# Gap Analysis: Refactor SMS Transaction Flow

**Branch**: `013-refactor-sms-flow` | **Date**: 2026-03-03 **Cross-referenced**:
`spec.md`, `plan.md`, `data-model.md`, `tasks.md`, `checklists/requirements.md`

---

## Summary

| Category                                | Implemented |      Gaps Found       |
| --------------------------------------- | :---------: | :-------------------: |
| User Stories (US1–US6)                  |   5 of 6    |      **1 major**      |
| Functional Requirements (FR-001–FR-017) |  14 of 17   |  **3 not verified**   |
| Tasks (T001–T045)                       |  41 of 45   |      **4 open**       |
| Edge Cases                              |   5 of 6    | **1 not implemented** |
| Automated Tests                         |   0 of 3    |     **3 missing**     |
| Docs & Session History                  |   0 of 1    |      **1 open**       |

---

## ✅ Verified (Previously Reported as Gap)

### ~~GAP-1: Cash Withdrawal Label on Card (US5 — FR-009)~~ ✅ FALSE ALARM

**Spec says**: When `isAtmWithdrawal === true`, the card shows a "Cash
Withdrawal" label.

**Actual code**: ✅ **IMPLEMENTED** — `SmsTransactionItem.tsx` lines 148-154
contain the `isAtmWithdrawal` check and render an amber-styled "Cash Withdrawal"
badge. The initial grep search used an incorrect regex pattern and yielded false
negatives.

**Status**: No action needed. FR-009, T037, T038 are correctly completed.

---

## 🔴 Major Gaps (Functionality Not Implemented)

### GAP-2: Cash Withdrawal Edit Modal — Transfer Layout (US6 — FR-010, FR-011)

**Spec says**: The edit modal for cash withdrawals must:

- Show only the "Transfer" type tab (hide Income/Expense)
- Show From (bank) and To (cash) account fields
- Auto-select the first cash account if one exists
- Show text input with "Cash" pre-populated if no cash accounts exist

**Actual code**: `SmsTransactionEditModal.tsx` has **no reference** to
`isAtmWithdrawal`, `Transfer`, `toAccountId`, `toAccountName`, `FROM ACCOUNT`,
`TO ACCOUNT`, or any transfer layout logic. The entire cash withdrawal edit flow
is missing.

**Affected tasks**: T039, T040, T041, T042 (marked ✅ in tasks.md but NOT in
code) **Affected FRs**: FR-010, FR-011

---

### GAP-3: Auto-Create Cash Account on Save (FR-013)

**Spec says**: When saving a cash withdrawal where no cash account exists in
that currency, the system auto-creates a cash account.

**Actual code**: `SmsTransactionReview.tsx` does **not call**
`ensureCashAccount()`. The cash account auto-creation logic is missing from the
save flow.

**Affected tasks**: T042 (marked ✅ in tasks.md but NOT in code) **Affected
FRs**: FR-013

---

## 🟡 Moderate Gaps (Missing Tests & Docs)

### GAP-4: Unit Tests Not Written (T010, T044)

**Plan says**: 3 test suites should be added/verified:

1. `sms-account-matcher.test.ts` — tests for `matchAccountCore` + fallback
   (T010)
2. `transaction-validation.test.ts` — zero amount tests
3. `sms-sync-service.test.ts` — regression run (T044)

**Actual code**: `__tests__/services/sms-account-matcher.test.ts` does **not
exist**. No new tests were written.

> [!NOTE] FR-016 (zero-amount validation) IS satisfied by the existing Zod
> schema: `parseFloat(val) > 0` already rejects zero. But no dedicated test was
> added.

**Affected tasks**: T010, T044

---

### GAP-5: Session History & Project Memory Not Updated (T045)

**Tasks say**: Update `docs/agent/session-history.md` and
`docs/agent/project-memory.md`.

**Status**: Not done.

**Affected tasks**: T045

---

## 🟢 Minor Gaps (Cosmetic / Design Discrepancies)

### GAP-8: Edit Modal — Sender Info Card Missing Bank Icon

**Mockup shows**: A teal circle with a bank icon (🏛) to the left of the sender
info, with "FROM" label, bank name (white bold), and date — inside a card with a
subtle border.

**Actual code** (lines 403-414): Shows "From" label, sender name, and date in a
plain `bg-slate-800/60` card, but **no teal circle bank icon**.

**Severity**: UI polish — the card is functional but doesn't match the approved
mockup.

---

### GAP-9: Edit Modal — Helper Message Style Doesn't Match Mockup

**Mockup shows** (Mockup 2): An **emerald/green confirmation bar** at the bottom
of the Account section with a checkmark icon:
`✓ WE'LL CREATE AN ACCOUNT NAMED 'BANQUE MISR' IN EGP.` (all caps, bold, emerald
background).

**Actual code** (lines 612-616): A plain `text-xs text-slate-500` gray text:
`"No bank accounts found. Enter a name and we'll create one for you."`

**Differences**:

- No checkmark icon
- Gray text instead of emerald background bar
- Different wording and casing
- Doesn't dynamically include the account name and currency in the message

**Severity**: UI polish — the message is functional but doesn't match the
premium design from the approved mockup.

---

### GAP-6: Currency Conversion Notice — Rate Value Not Shown

**Spec says** (FR-008): Show `"≈ {converted} {targetCurrency} at rate {rate}"`.

**Actual code**: The conversion notice shows `"≈ {converted} {targetCurrency}"`
but does **not show the exchange rate value** (`at rate {rate}` portion). The
user sees the converted amount but not the rate itself.

**Severity**: Cosmetic — the converted amount is correct; the rate display is a
nice-to-have.

---

### GAP-7: "Cash Withdrawal" ATM Skipping on Save (FR-007/batch-sms-transactions)

**Actual code**: `batch-sms-transactions.ts` references `skippedAtmCount` and
`atmSkipReason` in its return type, and `sms-review.tsx` shows a toast for
skipped ATM withdrawals. However, this logic was implemented **before** this
refactor and may not align with the new spec which expects cash withdrawals to
be saved as transfers (not skipped).

**Severity**: Behavioral inconsistency — the old code skips ATM transactions,
but the new spec (US5/US6) expects them to be saved as transfers with From/To
accounts.

---

## FR Cross-Reference

| FR     | Description                    | Status     | Notes                                                  |
| ------ | ------------------------------ | ---------- | ------------------------------------------------------ |
| FR-001 | Skip Account Setup             | ✅ Done    | AccountSetupStep removed                               |
| FR-002 | Remove setup utilities         | ✅ Done    | AccountSetupStep + build-initial-account-state deleted |
| FR-003 | Account matching per card      | ✅ Done    | `matchTransactionsBatched` works                       |
| FR-004 | First bank fallback (Step 5)   | ✅ Done    | `matchAccountCore` Step 5                              |
| FR-005 | Sender name when no accounts   | ✅ Done    | `senderDisplayName` shown                              |
| FR-006 | Account dropdown in edit modal | ✅ Done    | Dropdown with auto-select                              |
| FR-007 | Text input when no accounts    | ✅ Done    | Pre-populated with sender name                         |
| FR-008 | Currency conversion notice     | ⚠️ Partial | Shows converted amount but not rate. See GAP-6         |
| FR-009 | Cash withdrawal card label     | ✅ Done    | Lines 148-154 of SmsTransactionItem.tsx                |
| FR-010 | Transfer-only tab for ATM      | ❌ Missing | See GAP-2                                              |
| FR-011 | From/To fields for ATM         | ❌ Missing | See GAP-2                                              |
| FR-012 | Persist Account + BankDetails  | ✅ Done    | `persistPendingAccounts` creates both                  |
| FR-013 | Auto-create cash account       | ❌ Missing | See GAP-3                                              |
| FR-014 | "+ New" toggle                 | ✅ Done    | Works, switches dropdown ↔ text input                  |
| FR-015 | In-memory pending accounts     | ✅ Done    | Session state, persisted on save                       |
| FR-016 | Zero-amount validation         | ✅ Done    | Zod schema: `parseFloat(val) > 0`                      |
| FR-017 | Batched resolution (~20)       | ✅ Done    | `BATCH_SIZE = 20` with progressive render              |

---

## Recommended Next Steps (Priority Order)

1. **Implement GAP-2** (US6): Cash withdrawal Transfer edit modal layout
   (Transfer-only tab, From/To fields, cash account dropdown/text input).
2. **Fix GAP-3** (FR-013): Wire `ensureCashAccount()` into the save flow for
   cash withdrawal transfers.
3. **Fix GAP-7**: Reconcile ATM skip logic in `batch-sms-transactions.ts` with
   the new Transfer-based approach from US5/US6.
4. **Write unit tests** (GAP-4): `sms-account-matcher.test.ts` for
   `matchAccountCore`.
5. **Add rate to conversion notice** (GAP-6): Minor UI tweak.
6. **Update session history** (GAP-5): Docs update.
