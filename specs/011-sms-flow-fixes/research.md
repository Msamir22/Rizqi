# Research: 011 SMS Flow Fixes

**Date**: 2026-02-28 **Branch**: `011-sms-flow-fixes`

## R1: SMS Body Hash Normalization

- **Decision**: Normalize SMS body text client-side before hashing using:
  `trim → collapse whitespace → strip zero-width chars → normalize line endings`
- **Rationale**: The hash instability (#67) is caused by invisible character
  differences in SMS bodies that produce different hashes for semantically
  identical messages. Normalizing before hashing makes the hash deterministic.
- **Alternatives considered**:
  - Server-side normalization: Adds unnecessary latency and Edge Function
    dependency. Rejected — dedup is a local-only concern.
  - Regex-only normalization (just trim + collapse whitespace): Doesn't cover
    zero-width Unicode characters. Rejected — too narrow.

## R2: Transfers Table Dedup

- **Decision**: Add `sms_body_hash` column to the `transfers` table
  (migration 030) and extend `loadExistingSmsHashes()` to query both
  transactions AND transfers.
- **Rationale**: ATM withdrawals are saved as transfers (from bank → cash
  account). If the transfers table doesn't have the hash, rescan can't detect
  them as duplicates (#62).
- **Alternatives considered**:
  - Store ATM withdrawals as transactions with a transfer flag: Would require
    major refactoring. Rejected.
  - Backfill existing transfers: Not needed — app is still in development phase.

## R3: Account Setup Navigation

- **Decision**: Add two buttons to `AccountSetupStep`:
  1. **Back arrow** (header left) → returns to SuccessState in SmsScanProgress
  2. **Cancel (close icon)** (header right) → discards all data, exits to main
     app
- **Rationale**: The screen currently has no exit path (#49). Two buttons
  provide both "go back to review results" and "exit entirely" options.
- **Styling**: Back arrow matches SmsScanProgress header. Cancel icon matches
  sms-review.tsx discard button (TouchableOpacity + Ionicons "close").

## R4: Account Setup Loading State

- **Decision**: Show skeleton card placeholders while `buildInitialAccountState`
  resolves. Disable (grey out) the "Create accounts & review" CTA until ready.
- **Rationale**: The 1-2 second delay (#47) shows only the "Add Account" button
  with no cards, making the screen look broken.
- **Alternatives considered**:
  - Spinner overlay: Less informative than skeleton loaders. Rejected.

## R5: Scan Progress Text Alignment

- **Decision**: Fix the layout of `ScanHintText` so it sits below the pipeline
  status card without overlapping (#46).
- **Rationale**: The `ScanHintText` currently renders inside the bottom action
  area. The existing layout puts it just above the "Cancel Scan" button, but
  issue #46 reports overlap with the pipeline card content.
- **Fix approach**: Adjust spacing/margins in `ScanningState` or `ScanHintText`
  to ensure proper separation.
