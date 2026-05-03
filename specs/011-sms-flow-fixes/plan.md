# Implementation Plan: Fix SMS Scan Reliability & UX

**Branch**: `011-sms-flow-fixes` | **Date**: 2026-02-28 | **Spec**:
[spec.md](file:///e:/Work/My%20Projects/Monyvi/specs/011-sms-flow-fixes/spec.md)
**Input**: Feature specification from `specs/011-sms-flow-fixes/spec.md`

## Summary

Fix SMS transaction deduplication failures and polish the SMS scan UX flow. Two
critical bugs (#67 hash instability, #62 missing transfers hash check) cause
previously saved transactions to reappear on rescan. Three UX issues (#49 no
back button, #47 no loading state, #46 text misalignment) degrade the account
setup and scan progress experience.

## Technical Context

**Language/Version**: TypeScript (strict mode) **Primary Dependencies**: React
Native, Expo Router, WatermelonDB, NativeWind, Reanimated, Ionicons **Storage**:
WatermelonDB (SQLite) → Supabase (PostgreSQL) **Testing**: Manual device
testing, unit tests (Jest) **Target Platform**: Android (iOS future) **Project
Type**: Mobile (monorepo) **Performance Goals**: Hash computation < 1ms per SMS,
loading state transition < 100ms **Constraints**: Offline-first, client-side
hashing only

## Constitution Check

| Principle                     | Status  | Notes                                                                   |
| ----------------------------- | ------- | ----------------------------------------------------------------------- |
| I. Offline-First              | ✅ Pass | Hash computed client-side, dedup is local                               |
| II. Documented Business Logic | ✅ Pass | No new business rules — bug fixes                                       |
| III. Type Safety              | ✅ Pass | All new functions will have explicit return types                       |
| IV. Service-Layer Separation  | ✅ Pass | Hash logic in service layer, UI in components                           |
| V. Premium UI                 | ✅ Pass | Skeleton loaders, back arrow, close icon                                |
| VI. Monorepo Boundaries       | ✅ Pass | Migration in `supabase/`, model in `packages/db/`, UI in `apps/mobile/` |
| VII. Local-First Migrations   | ✅ Pass | Migration 030 via local SQL file, `db:push` + `db:migrate`              |

No violations. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/011-sms-flow-fixes/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart
└── tasks.md             # Phase 2 (via /speckit.tasks)
```

### Source Code (files to modify)

```text
supabase/migrations/
└── 030_add_sms_body_hash_to_transfers.sql    # [NEW] DB migration

packages/db/src/
├── models/base/base-transfer.ts              # [AUTO] smsBodyHash field
├── schema.ts                                 # [AUTO] sms_body_hash column
├── migrations.ts                             # [AUTO+MANUAL] addColumns
└── supabase-types.ts                         # [AUTO] type update

apps/mobile/services/
├── sms-sync-service.ts                       # [MODIFY] normalizeSmsBody + loadExistingSmsHashes
└── batch-sms-transactions.ts                 # [MODIFY] set smsBodyHash on transfers

apps/mobile/components/sms-sync/
├── AccountSetupStep.tsx                      # [MODIFY] add onBack, onCancel, loading state
└── SmsScanProgress.tsx                       # [MODIFY] fix ScanHintText spacing

apps/mobile/app/
└── sms-scan.tsx                              # [MODIFY] wire onBack/onCancel to AccountSetupStep
```

## Proposed Changes

### Phase 1: SMS Dedup Fixes (#67, #62)

---

#### [NEW] `supabase/migrations/030_add_sms_body_hash_to_transfers.sql`

Add `sms_body_hash TEXT` column to `transfers` table with a partial index
(matching the pattern from migration 028).

```sql
ALTER TABLE public.transfers
  ADD COLUMN sms_body_hash TEXT;

CREATE INDEX idx_transfers_sms_body_hash
  ON public.transfers (sms_body_hash)
  WHERE sms_body_hash IS NOT NULL;
```

After creating:

- `npm run db:push` → apply to Supabase
- `npm run db:migrate` → regenerate WatermelonDB schema/types/migrations

---

#### [MODIFY] `apps/mobile/services/sms-sync-service.ts`

1. **Add `normalizeSmsBody(body: string): string`** — exported utility:
   - Strip zero-width chars (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`)
   - Normalize line endings (`\r\n` / `\r` → `\n`)
   - Collapse consecutive whitespace → single space
   - Trim

2. **Update hash computation** — call `normalizeSmsBody(body)` before passing to
   the hash function (~line 225 where `computeSmsBodyHash` is called).

3. **Update `loadExistingSmsHashes()`** — add a second query for transfers:
   ```ts
   const transferRows = await database
     .get<Transfer>("transfers")
     .query(
       Q.unsafeSqlQuery(
         `SELECT sms_body_hash FROM transfers
          WHERE sms_body_hash IS NOT NULL
          AND deleted != 1
          AND _status IS NOT 'deleted'`
       )
     )
     .unsafeFetchRaw();
   ```
   Merge transfer hashes into the same `Set<string>`.

---

#### [MODIFY] `apps/mobile/services/batch-sms-transactions.ts`

When saving ATM-withdrawal transfers, set `smsBodyHash` on the transfer record
(same as it's already done for transactions ~line 238).

---

### Phase 2: Account Setup UX (#49, #47)

---

#### [MODIFY] `apps/mobile/components/sms-sync/AccountSetupStep.tsx`

1. **Add props**: `onBack: () => void` and `onCancel: () => void`
2. **Header bar**: Add a back arrow (chevron-back) on the left and a close icon
   on the right (same pattern as sms-review.tsx discard button)
3. **Loading state**: Add `isLoading` state that starts `true` and flips to
   `false` after `buildInitialAccountState` resolves. While loading:
   - Show 2-3 skeleton card placeholders (animated `View` with pulsing opacity)
   - Disable the "Create accounts & review" button (grey out, `opacity-50`,
     `disabled` prop)

---

#### [MODIFY] `apps/mobile/app/sms-scan.tsx`

Wire `onBack` and `onCancel` callbacks to `AccountSetupStep`:

- `onBack` → return to SuccessState (set step state back)
- `onCancel` → clear all parsed data, navigate to `/(tabs)`

---

### Phase 3: Scan Progress Text Fix (#46)

---

#### [MODIFY] `apps/mobile/components/sms-sync/SmsScanProgress.tsx`

Adjust the `ScanHintText` component or its parent layout to ensure the scan
progress text sits below the pipeline status card with proper spacing. The fix
is likely adding `mt-3` or adjusting the parent `View` structure in the bottom
action area (~line 122-134).

---

## Verification Plan

### Manual Verification

1. **Dedup test**: Save SMS transactions + ATM withdrawal transfer → rescan →
   verify 0 duplicates appear
2. **Hash stability test**: Send test SMS with trailing whitespace variations →
   verify identical hashes
3. **Back button test**: Navigate to Account Setup → tap back arrow → verify
   return to SuccessState with data preserved
4. **Cancel button test**: Navigate to Account Setup → tap close icon → verify
   return to dashboard with data discarded
5. **Loading state test**: Navigate to Account Setup → verify skeleton cards
   appear during the 1-2s loading period, CTA is disabled
6. **Text alignment test**: Start SMS scan → observe progress text position →
   verify no overlap with pipeline card

### Automated Tests

- Update `sms-sync-service.test.ts` with normalization test cases
- Add test for `loadExistingSmsHashes` returning both transaction and transfer
  hashes
