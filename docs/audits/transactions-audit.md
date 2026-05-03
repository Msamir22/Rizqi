# Transactions Module — First-Release Readiness Audit

**Date:** 2026-04-28 **Status:** Pre-first-release (dev) **Scope:** Transactions
module — list, add, edit, transfers, voice flow, SMS flow, review screen **Out
of scope:** recurring payments, categories, accounts, dashboard, budgets

---

## Executive summary

The transactions module is feature-rich but carries **214 findings** across five
specialist lenses. The single highest-risk surface is the **AI-driven voice/SMS
ingestion path** — it works, but it ships several launch-gating issues
(regulatory, dedup, default-trust) that must be closed before public release.

**Verdict:** Not ready for v1.0 launch as-is. With the **P0 cluster** closed (7
issues) and the **P1 cluster** addressed (≈18 issues), the module is shippable.
The P2/P3 set is fast-follow.

---

## Statistics

| Lens                                              | Findings |
| ------------------------------------------------- | -------- |
| Logic & correctness (F-001 → F-040)               | 40       |
| TypeScript / hooks / i18n / style (T-001 → T-069) | 69       |
| Performance (P-001 → P-043)                       | 43       |
| Security & AI risk (S-001 → S-018)                | 18       |
| Product / UX (PR-001 → PR-044)                    | 44       |
| **Total**                                         | **214**  |

**By severity (after consolidation across overlapping findings):**

| Severity                        | Consolidated issues |
| ------------------------------- | ------------------- |
| **P0 — launch-blocker**         | 7                   |
| **P1 — must fix before v1**     | 16                  |
| **P2 — fast-follow post-v1**    | 10                  |
| **P3 — backlog**                | 6                   |
| **Total tracked GitHub issues** | **39**              |

---

## Test coverage map

### Tests present

- Unit: `transaction-validation`, `transaction-service`, `transfer-service`,
  `sms-account-matcher`, `sms-sync-service`, `ai-voice-parser-service`,
  `transaction-analytics`, `useSmsPermission`, `useVoiceRecorder`, `currency`,
  `ai-parser-utils`.
- E2E (Maestro): create / edit / delete transaction, change-type,
  edit-amount-quick, edit-category-quick, search-filter, swap-account.

### Notable test gaps (high-value)

- **`batch-create-transactions`** — critical persistence boundary, untested.
- **`useTransactions`**, **`useTransactionsGrouping`**,
  **`useTransactionReviewState`**, **`useTransactionEditState`**,
  **`useVoiceTransactionFlow`**, **`useSmsScan`** — all main hooks untested.
- **`voice-parser`**, **`sms-parser-strategy`**, **`sms-keyword-filter`**,
  **`sms-category-mapper`**, **`sms-hash`** — all parser/dedup logic in
  `packages/logic` untested.
- **`ai-sms-parser-service`** — only voice has a test.
- All `sms-live-*`, `sms-headless-task`, `sms-review-save-service`,
  `sms-reader-service`, `sms-edit-modal-service`, `sms-account-resolver`,
  `voice-entry-service` — untested.
- No component tests for `TransactionReview`, `TransactionItem`,
  `TransactionEditModal`, `TransactionCard`, `TransferCard`,
  `TransactionFilters`.
- **E2E gaps:** no SMS scan flow, no SMS review flow, no voice → review flow, no
  batch import.

---

## P0 — Launch-blockers

### P0-1. PDPL/CBE consent + privacy disclosure for AI processing

**Sources:** S-018, S-003, S-004, S-005, PR-017, PR-030.

The app sends Egyptian-bank SMS bodies, account names, and voice audio to Google
Gemini via Supabase Edge Functions. There is **no explicit consent flow**, **no
privacy notice naming Gemini**, and **no `store: false` / data-retention
opt-out** confirmed in the Edge Functions. The current in-app copy ("never
stored or used for training") is broader than the architecture can guarantee.

PDPL Law 151/2020 + Decree 1074/2023 require explicit prior consent and
disclosure for cross-border transfer of personal financial data. CBE fintech
licensing scrutiny will block this at technical review.

**Action:** consent screen + privacy screen + DPA with Google + verify
`store: false` server-side + minimize data sent (IDs not names).

### P0-2. Live SMS dedup invariant broken — duplicate transactions on rescan

**Sources:** F-001, F-002.

`createTransaction()` (used by live SMS detection and the headless task) **never
persists `sms_body_hash`**. `loadExistingSmsHashes()` filters on
`sms_body_hash IS NOT NULL`, so any live-detected SMS gets re-imported on the
next inbox rescan → duplicate balance debits. The headless task even computes
the hash, then discards it.

**Action:** add `smsBodyHash?: string` to `createTransaction` payload; persist
it; pass it from `saveDetectedTransaction` and the headless task.

### P0-3. Pre-selecting all AI-parsed transactions on review

**Source:** PR-002.

`useTransactionReviewState` initializes `selectedIndices` with **every** parsed
transaction selected. A tired user tapping "Save N" imports the whole batch
including hallucinations and low-confidence parses. This is a trust failure for
an AI-first product.

**Action:** pre-select only
`confidence > 0.8 ∧ accountMatched ∧ !isAtmWithdrawal`. Surface counts: "X
auto-selected, Y need your review".

### P0-4. Egyptian wallet/payment SMS coverage unverified

**Source:** PR-038.

Only NBE has visible parser fixtures. For under-banked Egyptians, **Vodafone
Cash / Etisalat Cash / Orange Cash / Instapay / Fawry** are more frequent than
bank SMS. Without explicit fixtures and parser support, the target audience gets
poor coverage at launch.

**Action:** add parser support + fixtures for each provider's SMS templates;
gate launch on a coverage matrix.

### P0-5. Transactions list search keystroke jank

**Sources:** P-006, P-008, P-011, P-016, T-027, T-028, T-065.

Every keystroke in the search box re-runs full WatermelonDB fetch + N+1 relation
enrichment for ~200 items (~100–250 ms per character on Snapdragon-6).
Compounded by `Object.create` proxy that breaks `React.memo`, `selectedIds` Set
rebuilding `renderItem`, and an observer that watches the entire transactions
table.

**Action:** split the effect (DB fetch deps vs. search filter); debounce search;
flatten WatermelonDB models to plain DTOs; scope observer to visible date range;
pre-cache categories.

### P0-6. SMS permission rationale dishonest + auto-prompt with no app rationale

**Sources:** PR-017, PR-018, S-011.

Two issues, same surface:

1. The native Android permission dialog is auto-fired on first scan without
   showing the app-side rationale modal first. One Deny → user stuck in `denied`
   and must go to Settings.
2. The rationale copy ("never stored or used for training") is incorrect —
   bodies leave the device to Gemini.

**Action:** show `SmsPermissionPrompt` _before_ `requestPermission()`; rewrite
copy to honestly disclose Gemini processing + offer heuristic-only opt-out (P0-1
dependency).

### P0-7. Calculator `eval()` + missing finite/upper-bound on amount

**Sources:** F-003, F-004, F-007, F-017, F-027, F-036, T-001, S-007, PR-027.

`eval(expr) as number` is duplicated across `add-transaction`,
`edit-transaction`, `edit-transfer`, `QuickEditModal`. `eval("12+")` throws →
caught → returns 0 → schema's `parseFloat("12+") = 12` already passed →
zero-amount transaction is written. `Number.isFinite` missing in 4 places, so
`Infinity` and `1e500` propagate through `Math.abs(NaN) === NaN`. The balance
arithmetic `a.balance + delta || 0` then masks the NaN by zeroing the entire
account. No upper bound on `baseTransactionSchema` amount.

**Action:** replace `eval` with a small shunting-yard parser in
`packages/logic`; add `Number.isFinite() && val > 0 && val ≤ MAX_AMOUNT` guards
in `validation/transaction-validation.ts`, services, and post-edit save paths.

---

## P1 — Must fix before v1

| #     | Title                                                                                                                                                | Sources                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| P1-1  | Cross-currency transfer math errors (`convertTransferToTransaction` ignores `convertedAmount`; `updateTransfer` drops conversion when amount edited) | F-013, F-034                                       |
| P1-2  | AI parser output validation (LLM trust gap — `z.number()` accepts NaN/Inf/0/negative, no max amount, no date sanity, malformed-chunk silently empty) | F-018, F-019, F-022, S-006, PR-035                 |
| P1-3  | PII logging in SMS services (sender, amount, currency in `console.log` → readable by `READ_LOGS`, leaked to Sentry/Crashlytics)                      | S-001, S-002, S-010, S-017                         |
| P1-4  | Account ownership not validated before WatermelonDB writes (local balance corruption surface)                                                        | S-008, S-016                                       |
| P1-5  | Voice route-param JSON: size-limit silent failure + nav stutter                                                                                      | F-010, F-011, P-028                                |
| P1-6  | Confidence not visualized on review rows + no "needs my action" filter                                                                               | PR-001, PR-007                                     |
| P1-7  | Modal-on-modal review edit (5 taps to fix one wrong category)                                                                                        | PR-004                                             |
| P1-8  | Currency mismatch on review silently converts on save                                                                                                | PR-008                                             |
| P1-9  | Live SMS detection invisible (no badge/banner)                                                                                                       | PR-020                                             |
| P1-10 | Hardcoded English strings ("Today", "Bal:", "Unknown", warning copy, voice errors, AI-service error messages)                                        | T-039 → T-049, T-052                               |
| P1-11 | Recurring "Edit Template" dead-end (shows option, refuses save)                                                                                      | PR-024, list `app/(tabs)/transactions.tsx:271-294` |
| P1-12 | Smart defaults for manual entry (last-used category per account, recent-merchants, currency override)                                                | PR-026, PR-028                                     |
| P1-13 | AI feedback loop — user category corrections discarded                                                                                               | PR-031                                             |
| P1-14 | AI cost/quota guard + offline behavior + parser version stamping + Egyptian-Arabic eval corpus                                                       | PR-032, PR-033, PR-034, PR-036, PR-039             |

---

## P2 — Fast-follow post-v1

| #    | Title                                                                                                                                                                                     | Sources                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| P2-1 | Big-files split (transactions.tsx 645, edit-transaction.tsx 935, edit-transfer.tsx 849, SmsScanProgress 970, useVoiceRecorder 627, useTransactionsGrouping 488, TransactionEditModal 491) | T-055 → T-061                                          |
| P2-2 | Strict-null violations in IDs (`useState<string>("")` → `string \| null`)                                                                                                                 | T-002, T-003, F-005                                    |
| P2-3 | Styling housekeeping (`#FFFFFF`, `shadowColor: "#000"`, inline `style={{ color: palette.xxx }}`, `ActivityIndicator` for content loading, custom header in `SmsScanProgress`)             | T-034, T-035, T-036, T-050, P-041, PR-022              |
| P2-4 | Test coverage gaps (batch-create-transactions, all main hooks, parsers, sms-live-\* services, component tests, E2E for SMS/voice flows)                                                   | self-audit                                             |
| P2-5 | Review screen polish (Discard-All weight, totals in summary, inline error hints, auto-scroll-to-error, undo, filter-defaults parity, why-this-category)                                   | PR-005, PR-006, PR-009, PR-010, PR-011, PR-012, PR-037 |
| P2-6 | Voice flow polish (analyzing time, transcript edit-and-reparse, language override, 60s timer hint, fail-recovery context)                                                                 | PR-013, PR-014, PR-015, PR-016, PR-043                 |
| P2-7 | SMS flow polish (force re-parse range, empty-state cause clarity, partial-failure surfaced)                                                                                               | PR-019, PR-021, PR-044                                 |
| P2-8 | List screen polish (Skeleton loading, expanded search scope, RTL row alignment)                                                                                                           | PR-022, PR-023, PR-040                                 |
| P2-9 | Console.error → logger across edit screens (~18 instances)                                                                                                                                | T-020 → T-025                                          |

---

## P3 — Backlog

| #    | Title                                                                                                                                                                                                                                                         | Sources                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| P3-1 | Edit/save flow correctness polish (account staleness on submit, cancellation race in grouping, locale weekday, DST, numeric search greedy, transfer source/dest collision, zero `convertedAmount`, `deleted` boolean/int normalization, audio temp file leak) | F-008, F-009, F-014, F-021, F-028, F-029, F-030, F-031, F-032, F-033, F-035, F-037, F-039, F-040 |
| P3-2 | WatermelonDB pattern fixes (consolidate same-account writes; redundant if/else branch; `console.error` → `logger`; remove dynamic Q import)                                                                                                                   | T-029, T-030, T-031, T-032, T-033                                                                |
| P3-3 | Performance micro-optimizations (formatCurrency twice per card, BaseCard module-scope reanimated logger config, `useColorScheme` per group header, `TransactionFiltersBar` shadow on TouchableOpacity)                                                        | P-009, P-010, P-014, P-015, P-038, P-039, P-042, P-043                                           |
| P3-4 | RLS perf advisor (`auth.uid()` → `(SELECT auth.uid())`); `note`/`counterparty` length cap; deprecated voice text-mode branch; mock-data import in production bundle                                                                                           | S-009, S-012, F-021, T-068                                                                       |

---

## Implementation order

1. **Security & launch-gates first** (P0-1, P0-2, P0-6, P0-7, P0-3) — because
   they're partial blockers on App Store / Play Store review and on PDPL
   exposure.
2. **Money-math correctness** (P0-7, P1-1) — the worst-case user impact is wrong
   balances, which destroys trust permanently.
3. **Performance hot-paths** (P0-5, P1-3) — the search jank is the most visible
   issue on first run.
4. **Egyptian market coverage** (P0-4, P1-14 dialect/eval) — must ship with
   credible quality on Vodafone Cash / Instapay / Fawry to retain under-banked
   users.
5. **AI trust + UX** (P0-3, P1-2, P1-6, P1-7, P1-13) — converts the AI flow from
   "demo-grade" to "production-grade".
6. **Visibility & smart defaults** (P1-9, P1-12, P1-10) — closes the everyday
   friction gap.
7. **Polish + refactor** (P2 cluster) — schedule across v1.1 and the first
   sprint after launch.
8. **Backlog** (P3) — track but don't gate.

---

## Key files to modify

### Persistence & money-math correctness

- `apps/mobile/services/transaction-service.ts`
- `apps/mobile/services/transfer-service.ts`
- `apps/mobile/services/batch-create-transactions.ts`
- `apps/mobile/services/sms-live-detection-handler.ts`
- `apps/mobile/services/sms-headless-task.ts`
- `apps/mobile/validation/transaction-validation.ts`

### Calculator & validation

- `apps/mobile/app/add-transaction.tsx`
- `apps/mobile/app/edit-transaction.tsx`
- `apps/mobile/app/edit-transfer.tsx`
- `apps/mobile/components/transactions/QuickEditModal.tsx`
- New: `packages/logic/src/parsers/expression-evaluator.ts`

### AI parsers & guardrails

- `apps/mobile/services/ai-voice-parser-service.ts`
- `apps/mobile/services/ai-sms-parser-service.ts`
- `supabase/functions/parse-sms/`, `supabase/functions/parse-voice/`
  (server-side guardrails)
- New: `packages/logic/src/parsers/ai-output-validator.ts`

### List & review performance

- `apps/mobile/app/(tabs)/transactions.tsx`
- `apps/mobile/hooks/useTransactionsGrouping.ts`
- `apps/mobile/hooks/useTransactions.ts`
- `apps/mobile/hooks/useTransactionReviewState.ts`
- `apps/mobile/components/transaction-review/TransactionReview.tsx`
- `apps/mobile/components/transactions/TransactionCard.tsx`, `TransferCard.tsx`,
  `BaseCard.tsx`

### Voice & SMS pipeline performance

- `apps/mobile/services/sms-sync-service.ts`
- `apps/mobile/services/sms-account-matcher.ts`
- `apps/mobile/services/sms-review-save-service.ts`
- `apps/mobile/hooks/useVoiceTransactionFlow.ts`
- `packages/logic/src/parsers/sms-keyword-filter.ts`
- `packages/logic/src/parsers/sms-hash.ts`

### Privacy & permissions

- `apps/mobile/components/sms-sync/SmsPermissionPrompt.tsx`
- `apps/mobile/app/sms-scan.tsx`
- `apps/mobile/locales/en/transactions.json`,
  `apps/mobile/locales/ar/transactions.json`
- New: `apps/mobile/app/privacy.tsx`
- `supabase/migrations/<next>_user_consent.sql` (consent record schema)

### i18n

- `apps/mobile/components/transactions/GroupHeader.tsx`
- `apps/mobile/hooks/useTransactionsGrouping.ts` (Today/Yesterday)
- `apps/mobile/components/transaction-review/get-expanded-content.tsx`
- `apps/mobile/components/transaction-review/edit-modal/AccountSelector.tsx`
- `apps/mobile/locales/en/transactions.json`,
  `apps/mobile/locales/ar/transactions.json`

### Egyptian market parsers

- `packages/logic/src/parsers/sms-parser-strategy.ts`
- `packages/logic/src/parsers/sms-keyword-filter.ts`
- `packages/logic/src/parsers/sms-category-mapper.ts`
- New: `packages/logic/src/parsers/__fixtures__/eg-banks/` (CIB, NBE, QNB, BM,
  AlexBank)
- New: `packages/logic/src/parsers/__fixtures__/eg-wallets/` (Vodafone Cash,
  Etisalat Cash, Orange Cash, Instapay, Fawry)

### Review UX

- `apps/mobile/components/transaction-review/TransactionItem.tsx`
- `apps/mobile/components/transaction-review/ReviewActionBar.tsx`
- `apps/mobile/components/transaction-review/get-transaction-badges.ts`
- `apps/mobile/components/transaction-review/edit-modal/TransactionEditModal.tsx`

---

## Appendix A — Cluster → GitHub issue map

The 214 individual findings have been consolidated into **39 GitHub issues**
under the `area: transactions` label and grouped by an epic tracker. Each issue
links back to the cluster numbering above and the original finding IDs (e.g.
F-013, S-018, PR-001) so the source agent context is recoverable.

### Full finding-to-issue mapping

#### Logic findings (F-001 → F-040)

| Finding                                                                                                        | Issue                        | Cluster |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------- |
| F-001, F-002                                                                                                   | #285                         | P0-2    |
| F-003, F-004, F-007, F-017, F-027, F-036                                                                       | #291                         | P0-7    |
| F-005                                                                                                          | #325                         | P2-2    |
| F-006                                                                                                          | #289 (proxy replacement)     | P0-5    |
| F-008, F-009, F-014, F-021, F-024, F-025, F-026, F-028, F-029, F-030, F-031, F-032, F-033, F-037, F-039, F-040 | #337                         | P3-1    |
| F-010, F-011, F-023                                                                                            | #302                         | P1-5    |
| F-012, F-015, F-016                                                                                            | #360                         | P1-16   |
| F-013, F-034, F-035                                                                                            | #297                         | P1-1    |
| F-018, F-019, F-020, F-022                                                                                     | #298                         | P1-2    |
| F-038                                                                                                          | #289 (selectedTypes useMemo) | P0-5    |

#### TypeScript findings (T-001 → T-069)

| Finding                                                                                                                          | Issue                                  | Cluster |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------- |
| T-001                                                                                                                            | #291                                   | P0-7    |
| T-002, T-003                                                                                                                     | #325                                   | P2-2    |
| T-004, T-006, T-007, T-008, T-009, T-010, T-013, T-014, T-015, T-016, T-017, T-019, T-026, T-062 (residual), T-063, T-064, T-069 | #362                                   | P3-5    |
| T-005                                                                                                                            | _out of scope (categories module)_     | —       |
| T-011, T-012                                                                                                                     | #289                                   | P0-5    |
| T-018                                                                                                                            | #324 (RecorderStateMachine extraction) | P2-1    |
| T-020 → T-025                                                                                                                    | #332                                   | P2-9    |
| T-027, T-028, T-065                                                                                                              | #289                                   | P0-5    |
| T-029, T-030, T-031, T-032, T-033, T-066, T-067, T-068                                                                           | #339                                   | P3-2    |
| T-034, T-035, T-036, T-037, T-050                                                                                                | #326                                   | P2-3    |
| T-038, T-051                                                                                                                     | _agent: no issues found_               | —       |
| T-039 → T-049, T-052, T-053, T-054                                                                                               | #308                                   | P1-10   |
| T-055 → T-061                                                                                                                    | #324                                   | P2-1    |

#### Performance findings (P-001 → P-043)

| Finding                                                        | Issue                             | Cluster |
| -------------------------------------------------------------- | --------------------------------- | ------- |
| P-001                                                          | #289                              | P0-5    |
| P-002, P-004, P-012, P-013, P-023, P-024 (minor), P-025, P-035 | #363                              | P3-6    |
| P-003, P-019, P-030, P-037                                     | #361                              | P2-10   |
| P-005                                                          | #289                              | P0-5    |
| P-006, P-007, P-008, P-011, P-016, P-017                       | #289                              | P0-5    |
| P-009, P-010, P-014, P-015, P-038, P-039, P-042, P-043         | #340                              | P3-3    |
| P-018, P-020, P-031, P-032, P-033, P-034, P-036                | _agent: no issues / not relevant_ | —       |
| P-021, P-022, P-024, P-026                                     | #359                              | P1-15   |
| P-028, P-029                                                   | #302                              | P1-5    |
| P-040                                                          | #291 (eval replacement)           | P0-7    |
| P-041                                                          | #326 (ActivityIndicator)          | P2-3    |

#### Security findings (S-001 → S-018)

| Finding                    | Issue                                                  | Cluster    |
| -------------------------- | ------------------------------------------------------ | ---------- |
| S-001, S-002, S-010, S-017 | #299                                                   | P1-3       |
| S-003, S-004, S-005, S-018 | #284                                                   | P0-1       |
| S-006                      | #298                                                   | P1-2       |
| S-007                      | #291 + #298                                            | P0-7, P1-2 |
| S-008, S-016               | #301                                                   | P1-4       |
| S-009, S-012               | #341                                                   | P3-4       |
| S-011                      | #290                                                   | P0-6       |
| S-013, S-014               | _agent: confirmed safe — close on acknowledgment_ #341 | P3-4       |
| S-015                      | #360                                                   | P1-16      |

#### Product findings (PR-001 → PR-044)

| Finding                                                       | Issue       | Cluster |
| ------------------------------------------------------------- | ----------- | ------- |
| PR-001, PR-007, PR-009                                        | #303        | P1-6    |
| PR-002                                                        | #286        | P0-3    |
| PR-003, PR-025, PR-029 (residual), PR-042                     | #363        | P3-6    |
| PR-004                                                        | #304        | P1-7    |
| PR-005, PR-006, PR-009 (also), PR-010, PR-011, PR-012, PR-037 | #328        | P2-5    |
| PR-008                                                        | #305        | P1-8    |
| PR-013 → PR-016, PR-043                                       | #329        | P2-6    |
| PR-017, PR-018, PR-041                                        | #290        | P0-6    |
| PR-019, PR-021, PR-044                                        | #330        | P2-7    |
| PR-020                                                        | #307        | P1-9    |
| PR-022, PR-023, PR-040                                        | #331        | P2-8    |
| PR-024                                                        | #309        | P1-11   |
| PR-026, PR-028                                                | #310        | P1-12   |
| PR-027                                                        | #291 (eval) | P0-7    |
| PR-030                                                        | #284        | P0-1    |
| PR-031                                                        | #311        | P1-13   |
| PR-032, PR-033, PR-034, PR-035, PR-036, PR-039                | #313        | P1-14   |
| PR-038                                                        | #287        | P0-4    |

**Coverage:** every numbered finding (F-001 → F-040, T-001 → T-069, P-001 →
P-043, S-001 → S-018, PR-001 → PR-044 — total 214) is accounted for. Final
verification (`gh` cross-check on 2026-04-28):

- **207 of 214** finding IDs are explicitly referenced in the `Sources` line of
  at least one consolidated issue.
- **7 are non-issues** the agents themselves marked as "no issues found /
  acceptable / not relevant":
  - `P-027` — voice waveform animations acceptable (Reanimated worklets).
  - `P-031` — `TransactionEditModal` already conditional (good pattern, no fix).
  - `P-032` — `useTransactionEditState` only runs when modal mounts (good
    pattern).
  - `P-033` — filter modals always-mounted but bodies are simple lists (leave
    as-is).
  - `P-034` — `voice-review` re-parses memoized correctly (no fix).
  - `P-036` — per-row Reanimated FadeIn/Out works well (no fix).
  - `T-047` — review search namespace is correct on inspection.
  - (Note: `T-038`, `T-051`, `P-018`, `P-020`, `S-013`, `S-014` were also marked
    "no issues" but are referenced in adjacent issues and so still appear in
    coverage.)
- **1 is out-of-scope**: `T-005` (categories module — see Appendix B).

## Appendix B — Out-of-scope but flagged

While auditing transactions, the agents noted issues in adjacent modules that
should be filed under their own area labels (NOT created here):

- Recurring payments: `RecurringEditModal` template-edit dead-end (covered in
  P1-11 because it's surfaced from the transactions list).
- Categories: `Category.iconConfig` typed as `unknown` cast at consumer (T-005)
  — should add typed property/getter on the model.
- Accounts: same-id soft-delete sync race (F-008) is partially an accounts
  concern.
