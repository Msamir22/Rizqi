# Implementation Plan: Fix SMS Transaction & Default Cash Account Bugs

**Branch**: `012-fix-sms-account-bugs` | **Date**: 2026-03-02 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Monyvi/specs/012-fix-sms-account-bugs/spec.md)
**Input**: Feature specification from `/specs/012-fix-sms-account-bugs/spec.md`

## Summary

Fix 5 GitHub issues (#42, #43, #44, #55, #61) covering:

1. **Default Cash account bugs** — prevent duplicates, use local currency
   instead of USD fallback, move creation to final onboarding step with
   dedicated UI
2. **SMS review UX** — separate chevron expand from card edit tap
3. **Edit modal validation** — validate required fields before save, no
   side-effect edits

Technical approach: Modify 8 existing files, create 2 new component files,
update 1 test file, add 1 new test file.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) **Primary Dependencies**:
React Native + Expo, WatermelonDB, NativeWind v4, React Native Reanimated, Zod
**Storage**: WatermelonDB (SQLite) + Supabase (PostgreSQL) **Testing**: Jest +
React Native Testing Library **Target Platform**: iOS + Android (Expo managed
workflow) **Project Type**: Mobile (monorepo: apps/mobile + packages/logic +
packages/db) **Constraints**: Offline-first, SUPPORTED_CURRENCIES whitelist (35
currencies)

## Constitution Check

_GATE: All 7 principles checked. No violations._

| Principle                     | Status  | Notes                                                                             |
| ----------------------------- | ------- | --------------------------------------------------------------------------------- |
| I. Offline-First              | ✅ PASS | Cash account created via WatermelonDB `database.write()`. No network dependency.  |
| II. Documented Business Logic | ✅ PASS | Spec documents all decisions. business-decisions.md will be updated if needed.    |
| III. Type Safety              | ✅ PASS | All new code will use strict types, explicit return types, Zod validation.        |
| IV. Service-Layer Separation  | ✅ PASS | `account-service.ts` handles DB logic; new onboarding screens are presentational. |
| V. Premium UI                 | ✅ PASS | Stitch mockups approved. NativeWind + Reanimated for animations.                  |
| VI. Monorepo Boundaries       | ✅ PASS | Only `apps/mobile/` modified. `@monyvi/logic` currency-data.ts read-only.         |
| VII. Local-First Migrations   | ✅ PASS | No schema changes required — only code-level fixes.                               |

## Project Structure

### Documentation (this feature)

```text
specs/012-fix-sms-account-bugs/
├── plan.md              # This file
├── spec.md              # Feature specification (clarified)
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (TBD via /speckit.tasks)
```

### Source Code (files affected)

```text
apps/mobile/
├── app/
│   ├── index.tsx                        # [MODIFY] Remove SHOW_CASH_TOAST_KEY, keep silent retry
│   ├── onboarding.tsx                   # [MODIFY] Add currency picker + wallet creation steps
│   └── (tabs)/
│       └── index.tsx                    # [MODIFY] Remove toast display logic
├── components/
│   ├── onboarding/
│   │   ├── CurrencyPickerStep.tsx       # [NEW] Conditional currency selection screen
│   │   └── WalletCreationStep.tsx       # [NEW] Final onboarding step with loading/success
│   └── sms-sync/
│       ├── SmsTransactionItem.tsx       # [MODIFY] Separate chevron tap from card tap
│       └── SmsTransactionReview.tsx     # [MODIFY] Filter unrecognized currencies, validation
├── constants/
│   └── storage-keys.ts                  # [MODIFY] Remove SHOW_CASH_TOAST_KEY
├── services/
│   └── account-service.ts              # [MODIFY] Accept currency param, currency-aware idempotency
├── utils/
│   └── currency-detection.ts           # [MODIFY] Return null instead of USD fallback
└── __tests__/
    ├── services/
    │   └── account-service.test.ts      # [NEW] Tests for ensureCashAccount currency-aware logic
    └── validation/
        └── transaction-validation.test.ts  # [EXISTING] May add SMS edit modal coverage
```

**Structure Decision**: Mobile-only changes in the existing `apps/mobile/`
directory structure. No new packages, no backend changes, no schema migrations.

## Proposed Changes

### Phase 1 — Currency Detection & Account Service (Foundation)

---

#### [MODIFY] [currency-detection.ts](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/utils/currency-detection.ts)

**Current**: Returns `"USD"` as fallback when device locale currency is
unsupported or missing. **Change**: Return `null` when detection fails. The
caller decides what to do (show picker vs. use default).

```diff
-const DEFAULT_CURRENCY: CurrencyType = "USD";
+// No default — callers must handle null (e.g., show currency picker)

-export function detectCurrencyFromDevice(): CurrencyType {
+export function detectCurrencyFromDevice(): CurrencyType | null {
   const locales = getLocales();
   const currencyCode = locales[0]?.currencyCode ?? null;

-  if (!currencyCode) return DEFAULT_CURRENCY;
+  if (!currencyCode) return null;

   const isSupported = SUPPORTED_CURRENCIES.some((c) => c.code === currencyCode);
-  return isSupported ? (currencyCode as CurrencyType) : DEFAULT_CURRENCY;
+  return isSupported ? (currencyCode as CurrencyType) : null;
 }
```

---

#### [MODIFY] [account-service.ts](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/services/account-service.ts)

**Changes**:

1. Accept an optional `currency` parameter (used when user selected from picker)
2. Currency-aware idempotency: check for existing cash account **in the user's
   local currency** (not just `type=CASH`)
3. If `currency` is `null` and no fallback, return error

```diff
 export async function ensureCashAccount(
-  userId: string
+  userId: string,
+  currency?: CurrencyType | null
 ): Promise<EnsureCashAccountResult> {
   try {
+    // Resolve currency: explicit param > device detection
+    const resolvedCurrency = currency ?? detectCurrencyFromDevice();
+    if (!resolvedCurrency) {
+      return { created: false, accountId: null, error: "CURRENCY_UNKNOWN" };
+    }
+
     await database.write(async () => {
       const existing = await accountsCollection
         .query(
           Q.where("type", CASH_ACCOUNT_TYPE),
           Q.where("user_id", userId),
+          Q.where("currency", resolvedCurrency),
           Q.where("deleted", Q.notEq(true)),
         )
         .fetch();
       // ... rest stays the same but uses resolvedCurrency
     });
```

---

#### [MODIFY] [storage-keys.ts](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/constants/storage-keys.ts)

**Change**: Remove `SHOW_CASH_TOAST_KEY` constant entirely.

---

### Phase 2 — Onboarding Flow (New Steps)

---

#### [NEW] [CurrencyPickerStep.tsx](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/components/onboarding/CurrencyPickerStep.tsx)

**Purpose**: Full-screen currency selection step shown when
`detectCurrencyFromDevice()` returns `null`.

**Design** (from approved Stitch mockups):

- Header: "Choose Your Currency" + subtitle
- Search bar filtering `SUPPORTED_CURRENCIES`
- List of currencies with flags, names, codes, radio buttons
- EGP pre-selected as default (target market), "Continue" always enabled
- Supports light/dark mode via NativeWind

**Approved Mockups**:

- Dark:
  `C:/Users/Mohamed/.gemini/antigravity/brain/7fa14e80-1a94-4c39-8993-f1e25e4c5a55/currency_picker_dark_1772405159474.png`
- Light:
  `C:/Users/Mohamed/.gemini/antigravity/brain/7fa14e80-1a94-4c39-8993-f1e25e4c5a55/currency_picker_light_mode_1772405050220.png`

**Props interface**:

```typescript
interface CurrencyPickerStepProps {
  readonly onCurrencySelected: (currency: CurrencyType) => void;
}
```

---

#### [NEW] [WalletCreationStep.tsx](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/components/onboarding/WalletCreationStep.tsx)

**Purpose**: Final onboarding step that shows wallet creation progress and
success.

**Design** (from approved Stitch mockups):

- Loading state: Wallet icon + "Getting your wallet ready… Even pharaohs kept
  track of their gold!"
- Success state: Checkmark badge + "✨ Wallet Created — You're All Set!" +
  "Let's Go!" button
- Error state: Brief error message + "Let's Go!" button (navigates home anyway,
  retry on next launch)
- Animated transition using `react-native-reanimated`

**Approved Mockups**:

- Dark:
  `C:/Users/Mohamed/.gemini/antigravity/brain/7fa14e80-1a94-4c39-8993-f1e25e4c5a55/wallet_created_dark_mode_1772405063538.png`
- Light:
  `C:/Users/Mohamed/.gemini/antigravity/brain/7fa14e80-1a94-4c39-8993-f1e25e4c5a55/wallet_created_light_mode_1772405071248.png`

**Props interface**:

```typescript
interface WalletCreationStepProps {
  readonly userId: string;
  readonly currency: CurrencyType;
  readonly onComplete: () => void;
  readonly onError: () => void;
}
```

---

#### [MODIFY] [onboarding.tsx](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/app/onboarding.tsx)

**Changes**:

1. After carousel "Get Started": detect currency
2. If `null` → show `CurrencyPickerStep`; else use detected currency
3. Then show `WalletCreationStep` as the final step
4. Remove `SHOW_CASH_TOAST_KEY` import and usage
5. Remove fire-and-forget `ensureCashAccount` call (now handled by
   `WalletCreationStep`)
6. Navigation to `/(tabs)` happens after `WalletCreationStep` completes (or
   errors)

**Flow**:

```
Carousel → [CurrencyPickerStep?] → WalletCreationStep → /(tabs)
```

State management via `useState`:

```typescript
type OnboardingPhase = "carousel" | "currency-picker" | "wallet-creation";
```

---

### Phase 3 — index.tsx & Dashboard Cleanup

---

#### [MODIFY] [index.tsx](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/app/index.tsx)

**Changes**:

1. Remove `SHOW_CASH_TOAST_KEY` import and `.setItem()` call
2. Keep `ensureCashAccount(userId)` retry but don't set any flag on success
3. Pass no currency param → will use device detection; if `null`, returns
   `CURRENCY_UNKNOWN` error which is silently ignored (user will get cash
   account from onboarding anyway)

---

#### [MODIFY] [(tabs)/index.tsx](<file:///e:/Work/My%20Projects/Monyvi/apps/mobile/app/(tabs)/index.tsx>)

**Changes**:

1. Remove `SHOW_CASH_TOAST_KEY` import
2. Remove `AsyncStorage.getItem(SHOW_CASH_TOAST_KEY)` check
3. Remove toast display code for cash account creation
4. Remove `AsyncStorage.removeItem(SHOW_CASH_TOAST_KEY)` call
5. Keep all other dashboard logic unchanged

---

### Phase 4 — SMS Transaction Review UX

---

#### [MODIFY] [SmsTransactionItem.tsx](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/components/sms-sync/SmsTransactionItem.tsx)

**Current behavior**: Entire card `Pressable` has `onPress={onPress}` (opens
edit) and `onLongPress={handleToggleExpand}` (expands SMS). Chevron icon is
purely decorative.

**New behavior**:

1. **Chevron area**: Wrap in its own `Pressable` with
   `onPress={handleToggleExpand}` and `hitSlop={12}` (achieving 44×44pt touch
   target on a 20px icon)
2. **Card body**: Keep `onPress={onPress}` but ensure chevron tap is intercepted
   first (stops propagation)
3. **Checkbox**: Already has its own `Pressable` — no changes
4. **Remove** `onLongPress` from the main card `Pressable`

```diff
-<Pressable
-  onPress={onPress}
-  onLongPress={handleToggleExpand}
-  className="flex-row items-center p-4"
->
+<Pressable
+  onPress={onPress}
+  className="flex-row items-center p-4"
+>
   {/* ... existing content ... */}
   {/* Chevron — now its own tappable element */}
-  <View className="flex-row items-center ml-auto">
-    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} ... />
-  </View>
+  <Pressable
+    onPress={(e) => { e.stopPropagation?.(); handleToggleExpand(); }}
+    hitSlop={12}
+    className="flex-row items-center ml-auto p-1"
+  >
+    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} ... />
+  </Pressable>
```

---

#### [MODIFY] [SmsTransactionReview.tsx](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/components/sms-sync/SmsTransactionReview.tsx)

**Changes**:

1. **Filter unrecognized currencies**: Add a filter step before rendering —
   exclude transactions where `transaction.currency` is not in
   `SUPPORTED_CURRENCIES`
2. **Edit modal validation**: Ensure `validateTransactionForm` from
   `transaction-validation.ts` is called before save; show inline error messages
3. **No edit-on-fly**: Ensure transaction fields are only updated on explicit
   save (verify current behavior and fix if needed)

---

### Phase 5 — Tests

---

#### [NEW] [account-service.test.ts](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/__tests__/services/account-service.test.ts)

Test cases for the updated `ensureCashAccount`:

1. Creates cash account with device-detected currency (EGP)
2. Returns existing cash account without creating duplicate (same currency)
3. Returns `CURRENCY_UNKNOWN` error when currency is null and no param passed
4. Creates cash account with explicit currency param (overrides device
   detection)
5. Does NOT skip creation when existing cash account has different currency
   (allows USD Cash + EGP Cash)
6. Handles database write failure gracefully (returns error, no throw)

#### [EXISTING] [transaction-validation.test.ts](file:///e:/Work/My%20Projects/Monyvi/apps/mobile/__tests__/validation/transaction-validation.test.ts)

Verify existing tests cover:

- Missing account_id validation
- Zero/negative amount validation
- Missing category validation
- Valid form passes

## Verification Plan

### Automated Tests

**Command to run all unit tests**:

```bash
cd apps/mobile && npx jest --config jest.config.js
```

**Command to run specific test files**:

```bash
cd apps/mobile && npx jest __tests__/services/account-service.test.ts
cd apps/mobile && npx jest __tests__/validation/transaction-validation.test.ts
```

### TypeScript Compilation Check

```bash
cd apps/mobile && npx tsc --noEmit
```

### Manual Testing (User)

1. **Cash account creation (fresh onboarding)**
   - Clear app data / fresh install
   - Complete onboarding carousel
   - Verify: if locale = Egypt → skip currency picker → go to wallet creation
     step
   - Verify: wallet creation shows "Getting your wallet ready… Even pharaohs
     kept track of their gold!"
   - Verify: success shows "✨ Wallet Created — You're All Set!"
   - Verify: tap "Let's Go!" → navigates to home
   - Verify: Accounts page shows exactly 1 Cash account in EGP

2. **Currency picker (simulated)**
   - Modify `detectCurrencyFromDevice` to return `null` temporarily
   - Re-run onboarding
   - Verify: currency picker step appears with search bar and currency list
   - Verify: EGP is pre-selected, "Continue" is enabled
   - Select a different currency → "Continue" → wallet creation step

3. **No duplicate on restart**
   - After onboarding, force-quit and reopen the app 3 times
   - Verify: still only 1 Cash account in EGP

4. **Chevron vs card tap (SMS review)**
   - Navigate to SMS Transaction Review with at least 1 transaction
   - Tap the chevron icon → verify SMS body expands
   - Tap chevron again → verify it collapses
   - Tap card body → verify edit modal opens
   - Verify checkbox toggles independently

5. **Edit modal validation**
   - Open edit modal for a transaction
   - Clear account → tap save → verify "Account is required" error
   - Enter 0 amount → tap save → verify amount error
   - Close modal without saving → verify no changes persisted

6. **No dashboard toast**
   - After fresh onboarding, verify NO toast appears on the dashboard for cash
     account

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
