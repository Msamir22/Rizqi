# Feature Specification: Skip Onboarding for Returning Users

**Feature Branch**: `024-skip-returning-onboarding` **Created**: 2026-04-17
**Last rewritten**: 2026-04-18 (simplified data model — per-step progress moved
to per-user AsyncStorage; only `onboarding_completed` + `preferred_language`
live in the DB) **Status**: Draft **Input**: User description: "Skip the
onboarding flow (Language → Slides → Currency → Cash-account confirmation) for
returning users who already have an existing profile on Supabase." (see linked
issue #226 for full context)

## Clarifications

### Session 2026-04-18

- Q: When the post-sign-in profile fetch fails and the retry screen is shown,
  what actions must be available to the user? → A: Two actions — **Retry** and
  **Sign out**. Sign-out clears the session and returns the user to the sign-in
  screen. Design dependency: the retry screen needs mockups before
  implementation (resolved; Variant 2 "Status Card" approved 2026-04-18).
- Q: How long does the loading state persist before the profile fetch is
  declared failed and the retry screen appears? → A: **20 seconds**.
- Q: How does this feature compose with the app's offline-first (WatermelonDB)
  architecture — do onboarding writes require connectivity? → A: **No**. Sign-in
  triggers a **blocking pull-sync** that populates the local database from the
  server; the routing gate then reads the profile from the local database. After
  that point, the app is fully offline-first — per-step onboarding progress is
  tracked in AsyncStorage and language selection writes to WatermelonDB first,
  syncing to Supabase in the background. Offline during onboarding is not a
  concern.
- Q: Should the routing gate emit observability signals to help diagnose future
  regressions? → A: **Yes, log the routing decision once per gate evaluation**:
  the outcome (dashboard / onboarding / retry) and the input used (overall flag
  value). Info-level, no PII.

### Session 2026-04-18 (second pass — simplification)

- Q: Should per-step onboarding progress (Language done, Slides viewed, Currency
  done) live in the database or in local AsyncStorage? → A: **AsyncStorage**,
  keyed by `userId` to isolate progress between different accounts on the same
  device. Database carries only the authoritative end-state flag
  (`profiles.onboarding_completed`) plus `profiles.preferred_language` as a user
  preference. No `slides_viewed` column; no per-step state on the server.
  Trade-off accepted: partial onboarding progress does not survive reinstall and
  does not cross devices.
- Q: Should `profiles.preferred_language` be nullable, and what type? → A: **Not
  nullable, Postgres enum `preferred_language_code` with values `'en'` and
  `'ar'`, default `'en'`.** The user can always read a valid language from the
  profile; the Language step simply writes the chosen value.
- Q: What happens to the legacy AsyncStorage keys `HAS_ONBOARDED_KEY` and
  `LANGUAGE_KEY`? → A: **Both are deleted** as part of this feature — the gate
  moves to the DB flag, and language is now DB-backed. The only AsyncStorage
  usage in this flow post-change is the per-user per-step cursor.
- Q: When the user completes onboarding, should the per-user AsyncStorage step
  cursor be cleared? → A: **Yes**, on completion. On sign-out mid-flow, **no** —
  leave the cursor so that if they sign back in before completing, they resume.
- Q: Are sign-out during onboarding and back/forward navigation between steps in
  scope for this feature? → A: **No, both are out of scope**. Tracked separately
  as
  [#242 — Add sign-out affordance during onboarding](https://github.com/Msamir22/Rizqi/issues/242)
  and
  [#243 — Add back/forward navigation between onboarding steps](https://github.com/Msamir22/Rizqi/issues/243).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Returning user lands on dashboard without re-onboarding (Priority: P1)

A user who previously created an account on another device, or who is
reinstalling the app on the same device, signs in and reaches the dashboard
directly. Their language, currency, and cash account — already stored with their
remote profile — are restored before any screen appears, so they never see the
onboarding flow again and never re-enter data they have already provided.

**Why this priority**: This is the core problem the feature solves. Without it,
every returning user is forced to duplicate their setup on each install/login,
which creates data inconsistency between their remote profile and fresh local
answers, and breaks the expectation that their account "remembers" them. Fixing
this unblocks reinstall and multi-device journeys in a single change.

**Independent Test**: Seed a Supabase `profiles` row with
`onboarding_completed = true`, `preferred_language = 'en'`,
`preferred_currency = 'EGP'` and a matching cash account row. Sign in on a clean
install. Verify the app transitions from `InitialSyncOverlay` directly to
`/(tabs)` (dashboard) with the stored language, currency, and cash account
visible.

**Acceptance Scenarios**:

1. **Given** a user whose remote profile has `onboarding_completed = true`, with
   a stored language, currency, and at least one cash account, **When** the user
   signs in on a fresh install, **Then** the app shows a loading indicator until
   the profile has been pulled down locally, and then routes directly to the
   dashboard with those preferences applied and the existing cash account
   visible in the account list — no onboarding screen is shown.
2. **Given** a returning user who has just signed in, **When** the dashboard
   renders for the first time, **Then** the language and currency match the
   values on the remote profile, the cash account appears in the account list,
   and no prompt to choose a language, view slides, choose a currency, or create
   an account is presented.

---

### User Story 2 - New user completes the full onboarding flow (Priority: P1)

A user signing up for the very first time — with no prior onboarding — is guided
through the four-step flow: Language → Slides → Currency → Cash-account
confirmation. Language and Currency are mandatory (the user must pick one, with
no skip affordance). Slides can be skipped or viewed; either action advances the
user. The cash-account confirmation step is an informational message confirming
the app auto-created the user's default cash account in the chosen currency. On
finishing the confirmation, `profiles.onboarding_completed` flips to `true` and
the per-user AsyncStorage step cursor is cleared.

**Why this priority**: Equally critical with US1: a silent regression here would
mean new users land on an empty dashboard without a language, currency, or cash
account, which breaks the rest of the app. The change must tighten the gate, not
loosen it.

**Independent Test**: Sign up a brand-new user (no prior profile) and confirm
the Language picker is the first screen; after language selection, the slides
carousel appears; after skip/finish of slides, the Currency picker appears
**with no Skip button** and Continue disabled until a currency is selected;
after currency selection, the cash-account confirmation appears; after
dismissing it, the dashboard appears with the cash account visible. Re-launch
the app → dashboard appears directly (confirms `onboarding_completed = true`
landed on the profile and the AsyncStorage cursor was cleared).

**Acceptance Scenarios**:

1. **Given** a user with `onboarding_completed = false` on their freshly-created
   profile, **When** sign-up completes, **Then** the Language picker is shown
   first, followed by the onboarding slides, followed by the Currency picker,
   followed by the cash-account confirmation message, before the dashboard is
   reachable.
2. **Given** a new user on the Currency step, **When** the screen is inspected,
   **Then** no skip affordance is present — currency selection is mandatory and
   the Continue action requires a selection.
3. **Given** a user who selects a currency, **When** the Continue action is
   invoked, **Then** a cash account is created in that currency and the
   confirmation message reflects it.
4. **Given** the user dismisses the cash-account confirmation, **When** the
   dismissal is processed, **Then** `profiles.onboarding_completed` is set to
   `true` and the per-user AsyncStorage step cursor `onboarding:<userId>:step`
   is cleared.

---

### User Story 3 - User resumes partial onboarding at the step they left off (Priority: P2)

A user who started onboarding previously but quit before finishing signs in
again on the same device and same account, and is taken straight to the first
step they have not yet completed. Steps they have already completed are not
re-shown. A **different** account on the same device gets its own independent
cursor.

**Why this priority**: Quality-of-life improvement that prevents a user from
redoing steps they already completed. P2 rather than P1 because it affects only
interrupted sessions.

**Trade-offs accepted** (see Assumptions): partial progress does NOT survive
reinstall, and does NOT cross devices. These are acceptable because onboarding
is a one-time event and, by definition, a "returning" user already has
`onboarding_completed = true`.

**Independent Test**: For each of the 3 partial-progress states below, seed the
AsyncStorage step cursor for the signed-in user and verify the app lands on the
specified step. Then complete the flow and confirm the cursor is cleared.

| AsyncStorage state for user X          | Expected step             |
| -------------------------------------- | ------------------------- |
| `onboarding:<X>:step = "slides"`       | Slides                    |
| `onboarding:<X>:step = "currency"`     | Currency                  |
| `onboarding:<X>:step = "cash-account"` | Cash-account confirmation |

### Acceptance Scenarios

1. **Given** a returning user whose remote profile has
   `onboarding_completed = false` AND whose AsyncStorage cursor
   `onboarding:<userId>:step` equals `"slides"`, **When** they sign in, **Then**
   the first screen they see is the onboarding slides — not the Language picker.
2. **Given** a returning user whose cursor equals `"currency"`, **When** they
   sign in, **Then** the first screen they see is the Currency picker, with
   their stored `preferred_language` already active.
3. **Given** a returning user whose cursor equals `"cash-account"`, **When**
   they sign in, **Then** the first screen they see is the cash-account
   confirmation message (the cash account was already created in a prior
   session, so no re-creation occurs).
4. **Given** two different users signed in successively on the same device,
   **When** each signs in in turn, **Then** each sees only their own
   partial-progress cursor — they do not inherit the other user's step.
5. **Given** a user who completes the resumed step(s), **When** the final
   confirmation message is dismissed, **Then** `profiles.onboarding_completed`
   is set to `true` on the remote profile, the per-user cursor is cleared, and
   they are routed to the dashboard.

---

### User Story 4 - Slow or failed initial sync does not fall through to onboarding (Priority: P2)

When a returning user signs in on a slow or flaky network, they see a loading
state while the remote profile is fetched. If the fetch fails or exceeds the
20-second timeout, they are offered Retry and Sign out actions on the retry
screen rather than silently dropped into the onboarding flow, which would cause
them to overwrite their real preferences with fresh answers.

**Why this priority**: Protects against the worst failure mode of US1 — silently
showing onboarding to a user who is already onboarded because the server
couldn't be reached in time. P2 rather than P1 because it is a correctness
safeguard on top of the primary routing change.

**Independent Test**: Simulate a slow or unavailable profile fetch after sign-in
for a known returning user, and confirm a loading screen persists for up to 20
seconds, then transitions to the retry screen. Tapping Retry with the server
restored loads the dashboard. Tapping Sign out returns to the `/auth` screen.

**Acceptance Scenarios**:

1. **Given** a returning user signing in on a slow network, **When** the profile
   fetch takes several seconds, **Then** a loading indicator is shown during the
   wait and neither the onboarding flow nor an empty-data flash of the dashboard
   appears.
2. **Given** a returning user signing in while the profile fetch fails (network
   error, server error, or the 20-second timeout fires), **When** the failure is
   detected, **Then** the user sees the retry screen with two actions — Retry
   and Sign out — rather than being routed into the onboarding flow. Tapping
   Sign out clears the session and returns the user to the sign-in screen.
3. **Given** the user taps retry after a failed fetch, **When** the fetch
   succeeds, **Then** routing resumes as if the first fetch had succeeded
   (returning user → dashboard; new or partially-onboarded user → the
   appropriate onboarding step per US2/US3).

---

### Edge Cases

- **Reinstall with cached session**: A user reinstalls the app, but the stored
  sign-in session is still valid on device. After app launch, they are treated
  as a returning user — the profile is re-fetched and they land on the dashboard
  (if `onboarding_completed = true`) or at the first onboarding step (if
  `false`, because the reinstalled AsyncStorage is empty). No onboarding flash.
- **Cleared app data, server profile intact**: Local data is wiped but the
  remote profile still exists. Pull-sync restores the profile row; the routing
  gate reads the flag from the local database. No onboarding shown if the flag
  was true. If the flag was false (user was mid-flow before clearing data), they
  restart from Language (AsyncStorage cursor lost with the wipe).
- **Remote profile with `onboarding_completed = false` and empty AsyncStorage
  cursor**: Treated as a new user — full onboarding starting at Language (US2).
- **User signs out and signs back in as a **different** user on the same
  device**: The router reads the new user's profile flag. The per-user
  AsyncStorage cursor is namespaced by `userId`, so the previous user's cursor
  is not consulted.
- **User signs out and signs back in as the **same** user (mid-flow)**: The
  per-user AsyncStorage cursor is preserved on sign-out (per the
  Clarifications), so they resume at the step they left off.
- **User deletes their account and signs up again**: Treated as a brand-new user
  — flag is false on the new profile, AsyncStorage cursor is absent, full
  onboarding shown.
- **Pre-release device where onboarding state lived in legacy AsyncStorage keys
  (`HAS_ONBOARDED_KEY`, `LANGUAGE_KEY`)**: These keys are deleted during the
  migration. The user flows through the new onboarding once if they were
  mid-flow or unfinished; already-onboarded pre-release users will have
  `onboarding_completed = false` on their server profile (because the old flow
  never wrote it), so they will re-onboard. Acceptable because the app is not
  yet in production.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST determine post-sign-in routing by reading the
  profile state from the local database **after a blocking pull-sync from the
  server has completed on sign-in**. The router's sole DB-level input is
  `profiles.onboarding_completed`.
- **FR-002**: The system MUST show a loading state between sign-in and the first
  post-sign-in screen while the remote profile is being fetched and the local
  state is being seeded.
- **FR-003**: If the remote profile indicates onboarding is completed, the
  system MUST route the user directly to the dashboard without rendering any
  onboarding step.
- **FR-004**: If the remote profile indicates onboarding is NOT completed, the
  system MUST start the onboarding flow and resolve the starting step by reading
  the per-user AsyncStorage cursor `onboarding:<userId>:step`. If the cursor is
  absent, starting step is the Language step; otherwise start at the named step.
- **FR-005**: On successful sign-in of a returning user, the system MUST restore
  the user's language, currency, and existing cash account(s) from the remote
  profile to the local state before the dashboard renders, so that the first
  render of the dashboard already reflects the user's stored preferences and
  account list.
- **FR-006**: If the remote profile fetch fails after sign-in (network error,
  server error, or the 20-second timeout), the system MUST present an error
  state with two actions — **Retry** and **Sign out** — and MUST NOT fall
  through to the onboarding flow. Sign-out clears the authenticated session and
  returns the user to the sign-in screen so they can try a different account or
  come back later.
- **FR-007**: The system MUST persist the user's chosen language to
  `profiles.preferred_language` (server column, enum-backed, non-nullable with
  default `'en'`). The column is updated at the end of the Language step.
  Subsequent launches read it from the local database and apply it via the
  existing `changeLanguage()` helper.
- **FR-008**: The system MUST persist the user's per-step onboarding progress
  **in AsyncStorage only**, using the key format `onboarding:<userId>:step`.
  Valid values are `"language"`, `"slides"`, `"currency"`, `"cash-account"`. The
  cursor is written at each transition forward.
- **FR-009**: The Currency step MUST be mandatory — the user MUST select a
  currency to continue and the step MUST NOT expose any skip affordance.
- **FR-010**: Upon currency selection, the system MUST auto-create the user's
  default cash account in the chosen currency (via the existing
  `ensureCashAccount` helper), so that the cash-account confirmation step can
  present it to the user.
- **FR-011**: The system MUST set `profiles.onboarding_completed` to `true` on
  the remote profile **only** when the cash-account confirmation step is
  dismissed (i.e., when the user has reached the end of the flow), AND MUST
  atomically clear the per-user AsyncStorage cursor on that same transition.
- **FR-012**: The routing gate described above MUST run on every
  post-authentication entry into the app — fresh install sign-in and subsequent
  launches with a cached session — so the decision is never cached from a prior
  routing outcome.
- **FR-013**: The feature MUST NOT change the behavior of the dashboard's
  setup-guide card (a separate post-onboarding guidance mechanism); this spec
  concerns only the pre-dashboard onboarding flow.
- **FR-014**: The system MUST emit one structured info-level log per
  routing-gate evaluation, capturing the chosen outcome (`dashboard` |
  `onboarding` | `retry`) and the `onboarding_completed` flag value used to
  reach it, along with the sync-state input. The log MUST NOT include any
  personally identifiable information.
- **FR-015**: The system MUST delete the legacy AsyncStorage keys
  `HAS_ONBOARDED_KEY` and `LANGUAGE_KEY` as part of this change — their read
  paths are removed and their write paths are removed. No deprecation period;
  the app is pre-production.

### Key Entities

- **User profile (remote)**: The authoritative record of a user's onboarding
  status and key preferences. Fields relevant to this feature:
  - `onboarding_completed` (boolean, non-null, default `false`) — the single
    source of truth for the router's decision. Flips to `true` only at the end
    of the flow.
  - `preferred_language` (new column, enum `preferred_language_code` with values
    `'en'` | `'ar'`, non-null, default `'en'`) — populated at the Language step;
    read on subsequent launches to set the UI language.
  - `preferred_currency` (existing text column, NOT NULL) — populated at the
    Currency step.
- **Per-user onboarding cursor (local, AsyncStorage)**: A device-local pointer
  to the next-unfinished onboarding step for a specific user. Keyed by
  `onboarding:<userId>:step`, values `"language"` | `"slides"` | `"currency"` |
  `"cash-account"`. Cleared on completion; preserved on sign-out.
- **Cash account**: The default account auto-created during the Currency step
  using the user's chosen currency. Its presence on a returning user's profile
  is restored locally on sign-in.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of returning users whose remote profile has
  `onboarding_completed = true` reach the dashboard after sign-in without any
  onboarding screen being rendered.
- **SC-002**: 100% of brand-new users (freshly-created profile with
  `onboarding_completed = false` and no AsyncStorage cursor) see the full
  four-step onboarding flow starting at Language, matching US2.
- **SC-003**: On a representative median-speed network, a returning user reaches
  the dashboard within 3 seconds of successful sign-in; the loading state is
  shown for the duration of the fetch and never replaced by the onboarding flow.
- **SC-004**: 0 reported incidents of a returning user's language, currency, or
  cash account being overwritten by fresh onboarding answers after this change
  ships.
- **SC-005**: A user who quit onboarding mid-flow on the same device as the same
  account resumes at their next incomplete step with 0 already-completed steps
  re-shown (subject to AsyncStorage persistence — see Assumptions).
- **SC-006**: Support tickets and bug reports referencing "asked to pick
  language/currency again after reinstall" or "lost my cash account after
  signing in again" trend to zero within one release cycle of the change going
  live.

## Assumptions

- The app is offline-first with WatermelonDB as the local source of truth. This
  feature composes with that model as follows: (a) sign-in performs a blocking
  pull-sync from Supabase into the local database so the routing gate has
  accurate `onboarding_completed` state on reinstalls / new devices; (b) after
  the pull-sync completes, the routing gate reads `onboarding_completed` from
  the local database only; (c) language selection writes to the local database
  first and relies on the existing background push-sync to propagate to
  Supabase; (d) per-step onboarding progress is tracked in AsyncStorage (not the
  database), keyed by userId, and never syncs. No onboarding step requires live
  connectivity once the user is signed in.
- Partial onboarding progress (the AsyncStorage cursor) **does NOT survive
  reinstall** (AsyncStorage is wiped with app data). If a user quits mid-flow
  and then reinstalls before finishing, they restart from Language. This is
  acceptable because onboarding is a one-time event.
- Partial onboarding progress **does NOT cross devices**. A user who starts on
  phone and signs in on tablet restarts from Language on the tablet. Acceptable
  for the same reason.
- The app is pre-production, so the legacy AsyncStorage keys
  (`HAS_ONBOARDED_KEY`, `LANGUAGE_KEY`) can be deleted without a migration
  window. Pre-release testers who were already "onboarded" under the old
  AsyncStorage gate will flow through the new onboarding once (because their
  server profile's `onboarding_completed` is still `false`), and complete it
  once. Acceptable.
- Retrying a failed profile fetch is a user-initiated action (tap retry) rather
  than automatic, to avoid masking persistent failures.
- The `preferred_language_code` Postgres enum is created in the same migration
  as the column. Adding new languages in the future requires an
  `ALTER TYPE ... ADD VALUE` migration.
- Sign-out during onboarding and back/forward step navigation are out of scope —
  tracked as [#242](https://github.com/Msamir22/Rizqi/issues/242) and
  [#243](https://github.com/Msamir22/Rizqi/issues/243). The retry screen's Sign
  out action (FR-006) does not fulfill #242 because it is only reachable on sync
  failure, not from inside the happy-path onboarding steps.

## Dependencies

- Availability and reliability of the remote profile fetch after sign-in — this
  feature's routing decision is gated on it.
- Existing `ensureCashAccount(userId, currency)` helper in
  `apps/mobile/services/account-service.ts` — the Currency step delegates
  account creation to it.
- Existing `changeLanguage(language)` i18n helper in
  `apps/mobile/i18n/changeLanguage.ts` — called when the Language step writes to
  the profile.
- Existing `signOut()` helper in `apps/mobile/services/logout-service.ts` — the
  retry screen's Sign out action calls it.
- **Investigation required in planning**: verify that the existing sign-in code
  path performs a blocking pull-sync of the `profiles` row into WatermelonDB
  before any routing decision. If it is non-blocking or missing, the planner
  must introduce the blocking behavior. Surfaced during research; the current
  `SyncProvider` sets `isInitialSync` but `apps/mobile/app/index.tsx` does not
  await it.
