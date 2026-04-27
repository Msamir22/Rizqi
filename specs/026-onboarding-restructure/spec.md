# Feature Specification: Onboarding Restructure

**Feature Branch**: `026-onboarding-restructure` **Created**: 2026-04-23
**Status**: Draft **Input**: User description: Onboarding restructure per GitHub
issue #246 — a ground-up rebuild of the first-time-user experience. Pre-auth
slides (voice/SMS/live-market pitch) + single required post-auth step
(currency) + three sequential first-run dashboard tooltips (SMS permission,
cash-account tooltip, mic-button tooltip) + enhanced setup-guide card.
Supersedes closed issues #242 and #243 and bundles #245. Design artifacts
(mockups + dark-mode token table) live under
`specs/026-onboarding-restructure/design/`.

## Clarifications

### Session 2026-04-23

- Q: Where should the new per-profile onboarding markers (cash-account tooltip
  dismissed, mic-button tooltip seen) be stored? → A: A single per-profile
  onboarding-flags record holding the markers as boolean keys, kept alongside
  the existing profile row. Follows the same pattern already used for other
  per-profile preference bundles in Rizqi, so new tooltip flags can be added
  later without schema migrations.
- Q: Should this feature add structured analytics/telemetry for the onboarding
  funnel (pitch → auth → Currency → tooltips)? → A: No. Rizqi is still in dev
  phase with no production users, so no funnel telemetry is shipped with this
  feature. Success criteria that depended on quantitative measurement are
  softened to internal-testing verification (see SC-003, SC-004).
- Q: How should the Android hardware back button behave across the new
  onboarding surfaces? → A: Platform-convention. Pitch slides: back navigates to
  previous slide; slide 1 back exits the app. Tooltips: back dismisses
  (equivalent to the tooltip's own dismiss button — "Got it" for cash-account, X
  close for mic-button, specifically NOT equivalent to "Try it now" which also
  opens voice). Currency step: back is blocked (required screen). Auth screen:
  back navigates to pitch if pitch not marked seen, otherwise exits app.
- Q: If the user taps "Try it now" but then denies microphone permission (or the
  voice flow otherwise fails to complete), should the mic-button tooltip
  re-appear on subsequent taps of the voice step's action button? → A: No. The
  tooltip's purpose is one-time education about the mic button. Once the user
  has seen it (via either dismiss path), it never re-appears. The voice flow
  owns its own permission-denied and error UX; the tooltip doesn't re-gate
  repeated voice attempts.
- Q: How should the routing gate behave if the profile's preferred currency
  holds a value that isn't in the app's supported-currency list? → A: Not a
  concern. The data model constrains preferred currency to the supported set at
  the storage layer (added in issue #226); invalid values cannot be persisted.
  No defensive logic needed in the routing gate.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — First-time visitor sees the pitch before committing (Priority: P1)

A user opens Rizqi for the very first time on their device. They have never
signed up. Before being asked to create an account, they see a short pitch that
explains what Rizqi does — voice-based transaction entry, bank-SMS auto-import,
live exchange rates, gold/silver tracking. They can absorb the pitch in the
language their phone is already set to. If they change their mind about the
language, they can switch it from a small corner affordance. At the end of the
pitch (or any time they skip), they land on the sign-up/sign-in screen that
carries the same visual tone as the pitch.

**Why this priority**: This is the single conversion moment for unauthenticated
visitors. Today the pitch is hidden behind the auth wall; a visitor has to
create an account before understanding what Rizqi is. That is a conversion leak.
Surfacing the pitch pre-auth, in the user's own language, is the feature's most
direct lever on new-user acquisition.

**Independent Test**: Fresh install → open app → verify pre-auth slides appear
in the device's locale (or English fallback); swipe or skip to the end; confirm
the sign-up CTA routes to the auth screen and that the auth screen renders in
the same language.

**Acceptance Scenarios**:

1. **Given** a fresh install on a device with Arabic locale, **When** the user
   opens the app, **Then** the pitch slides render in Arabic and the corner
   language affordance is visible.
2. **Given** a fresh install on a device with a locale that is neither English
   nor Arabic, **When** the user opens the app, **Then** the slides render in
   English (fallback) and the corner affordance is visible.
3. **Given** the user is viewing slide 1 in Arabic, **When** they tap the corner
   affordance and choose English, **Then** the current slide re-renders in
   English immediately, subsequent slides render in English, and the auth screen
   (when reached) renders in English.
4. **Given** the user taps Skip on slide 2, **When** the pitch ends, **Then**
   they land on the auth screen and a device-local flag records that the pitch
   has been seen.
5. **Given** the user swipes through to and views the last slide and taps its
   primary CTA, **When** the pitch ends, **Then** they land on the auth screen
   and the same flag is recorded.
6. **Given** the user force-quits the app while viewing slide 2 (without tapping
   Skip or reaching the last slide), **When** they re-open the app, **Then** the
   slides appear again from the beginning (no partial-view credit).
7. **Given** a returning user on a device where the slides have already been
   completed once, **When** they open the app while signed out, **Then** they
   land on the auth screen directly without seeing slides.
8. **Given** a fresh install on an Android device, **When** the user reaches the
   second slide in the pitch, **Then** the slide shown is the SMS auto-import
   slide ("Your bank texts. We listen.").
9. **Given** a fresh install on an iOS device, **When** the user reaches the
   second slide in the pitch, **Then** the slide shown is the Offline-first
   slide ("Record now. Sync later.") instead of the SMS slide. The slide count
   (3) and overall navigation feel identical to the Android experience.

---

### User Story 2 — First-time sign-up completes in one required decision (Priority: P1)

A user who finishes the pitch taps Sign Up, creates an account, and is asked for
one thing only: their preferred currency. On confirming currency, the app
creates their default cash account in that currency, records their onboarding as
complete, and drops them on the dashboard. No additional onboarding screens
stand between sign-up and using the app.

**Why this priority**: Speed from sign-up to value is the second-highest lever
on activation. Today the post-auth flow is a multi-step wizard (language,
slides, currency, cash-account confirmation); reducing it to one required
decision minimizes drop-off between account creation and a usable home screen.

**Independent Test**: Sign up with a fresh account → verify the only post-auth
screen is the Currency step → confirm a currency → verify the user lands on the
dashboard with a cash account in the chosen currency.

**Acceptance Scenarios**:

1. **Given** a newly signed-up user with no preferred currency, **When** they
   complete sign-up, **Then** the Currency step appears as the only post-auth
   screen.
2. **Given** the user is on the Currency step, **When** they confirm a currency,
   **Then** the system performs a single atomic write that (a) creates a default
   cash account in that currency, (b) records the user's preferred currency on
   their profile, (c) records their preferred language (derived from pre-auth
   context) if it was not already set, and (d) marks the user as onboarded. If
   any of these writes fail, none persist (the user sees an error and can
   retry). On successful write, the app then navigates to the dashboard.
   Navigation itself is not part of the atomic write — if a crash occurs between
   commit and navigation, the next app launch's routing gate reads the saved
   state and routes to the dashboard automatically.
3. **Given** a returning user whose profile already has a preferred currency,
   **When** they sign in, **Then** they route directly to the dashboard without
   ever seeing the Currency step.
4. **Given** the user is on the Currency step, **When** they tap Sign out,
   **Then** their session is cleared and they return to the pre-auth state
   (slides if their device has not seen them, auth screen otherwise).
5. **Given** a user who signed up on one device (preferred language recorded on
   their profile) and signs in on a second device where the device locale
   differs, **When** they authenticate, **Then** the app honors the
   profile-recorded language on the dashboard (a brief visual re-rendering from
   device-locale to profile-language is expected and acceptable).

---

### User Story 3 — New user's first dashboard is welcoming, not confusing (Priority: P1)

A newly-onboarded user lands on the dashboard. The dashboard shows them, in
order: the SMS permission prompt (existing behavior), then a tooltip pointing at
the cash account that was just auto-created for them. Each is dismissible in one
tap. After both are dismissed, the dashboard reads like a normal home screen
with a small Setup Guide card showing remaining tasks.

**Why this priority**: Without guidance, a new user sees a cash account they
don't remember creating and might wonder why it's there. The cash-account
tooltip is the one reassurance moment that needs to happen on the very first
dashboard view. The SMS prompt already exists and is unchanged.

**Independent Test**: Complete sign-up + currency selection → verify the SMS
permission prompt appears (Android) → dismiss it → verify the cash-account
tooltip appears → dismiss it → verify the dashboard is in its normal state with
the Setup Guide card visible.

**Acceptance Scenarios**:

1. **Given** a user who just confirmed their currency and is transitioning to
   the dashboard for the first time (on Android), **When** the dashboard
   finishes loading, **Then** the SMS permission prompt appears first.
2. **Given** the SMS permission prompt has been dismissed (granted or denied),
   **When** the dashboard re-draws, **Then** the cash-account tooltip appears,
   visually anchored to the cash account card with an arrow pointing at it, and
   it dims the rest of the dashboard subtly.
3. **Given** any of these first-run prompts is dismissed, **When** the user
   returns to the dashboard on the same device in any future session, **Then**
   that prompt does NOT re-appear.
4. **Given** a user on iOS who just confirmed their currency, **When** they
   reach the dashboard for the first time, **Then** the SMS permission prompt is
   NOT shown (iOS has no SMS auto-import); only the cash-account tooltip
   appears.
5. **Given** an already-onboarded user opening the dashboard on any device,
   **When** the dashboard loads, **Then** the first-run prompts do NOT appear —
   these prompts are triggered specifically by the transition from Currency-step
   confirmation to dashboard, not by dashboard entry in general.

---

### User Story 4 — Setup Guide card helps the user complete their setup over time; voice step educates before launching voice (Priority: P2)

A user who has just signed up sees a small expandable Setup Guide card on the
dashboard. It shows their setup progress as a fraction ("0/4" initially — or
"0/3" on iOS). Expanding it reveals four ordered steps: "Add bank account", "Try
voice transaction", "Auto-track bank SMS", "Set a budget". The "Auto-track bank
SMS" step is hidden on iOS. As the user naturally performs these actions in the
app over the following days, the card updates in real time — a completed
checkmark appears next to each finished step. When all steps are complete, the
card auto-dismisses. The user can also dismiss it manually.

When the user taps the action button on the "Try voice transaction" step for the
first time, a small tooltip anchored to the mic button in the bottom tab bar
appears: "Say it, don't type it — Tap this mic anywhere. Talk naturally — we'll
turn it into a transaction." The tooltip has two exits: a primary button labeled
"Try it now" (which both dismisses the tooltip AND opens the voice recording
flow in one action), and an X close icon in the top-right corner (which
dismisses the tooltip only, leaving the user on the dashboard). This is the
user's first introduction to voice. On subsequent taps of the voice step's
action button (regardless of how the tooltip was first dismissed — "Try it now"
or X — and regardless of whether the user actually completed a voice
transaction), the tooltip does NOT re-appear — the voice flow opens directly.
And users who tap the mic button in the bottom tab bar directly (bypassing the
card) never see this tooltip — they have discovered the feature on their own and
don't need the nudge.

**Why this priority**: The first-run tooltips in US3 (SMS + cash-account) carry
the critical first-impression weight. The Setup Guide card is the persistent
homework tracker that matures the user over time, and the voice tooltip is the
contextual preamble for the specific moment a user chooses to try voice. P2
because the card and the voice-tooltip handoff are supporting infrastructure —
not the primary first-impression moment.

**Independent Test**: As a new user, view the Setup Guide card in its initial
empty state → add a bank account through normal app flow → return to dashboard
and verify the "Add bank account" step is checked → tap the "Try voice
transaction" step's action button → verify the mic-button tooltip appears
anchored to the mic button in the tab bar → tap "Try it now" → verify the
tooltip dismisses AND the voice recording flow opens in one action → record a
voice transaction → return to dashboard and verify the "Try voice transaction"
step is checked.

**Acceptance Scenarios**:

1. **Given** a freshly onboarded user on Android, **When** they view the
   dashboard, **Then** the Setup Guide card shows four steps in order: "Add bank
   account", "Try voice transaction", "Auto-track bank SMS", "Set a budget" —
   with a progress indicator of "0/4".
2. **Given** a freshly onboarded user on iOS, **When** they view the dashboard,
   **Then** the Setup Guide card shows three steps (SMS step hidden) with
   progress "0/3".
3. **Given** the user has added a bank account elsewhere in the app, **When**
   they return to the dashboard, **Then** the "Add bank account" step shows as
   completed without the user interacting with the card itself.
4. **Given** the user has recorded a transaction via voice anywhere in the app,
   **When** they return to the dashboard, **Then** the "Try voice transaction"
   step shows as completed. Transactions recorded by other means (bank SMS
   auto-import, manual typing) do NOT mark this step complete.
5. **Given** the user has a bank SMS auto-imported transaction, **When** they
   return to the dashboard, **Then** the "Auto-track bank SMS" step shows as
   completed.
6. **Given** all steps are completed, **When** the card updates, **Then** it
   auto-dismisses and is no longer shown.
7. **Given** the user taps the Dismiss action on the Setup Guide card, **When**
   they return to the dashboard later, **Then** the card remains dismissed on
   that account across devices.
8. **Given** the user taps the "Try voice transaction" step's action button for
   the very first time, **When** the tap is registered, **Then** the mic-button
   tooltip appears anchored to the mic button in the bottom tab bar, dimming the
   rest of the dashboard subtly.
9. **Given** the mic-button tooltip is visible, **When** the user taps the "Try
   it now" button inside the tooltip, **Then** the tooltip dismisses AND the
   voice recording flow opens in one action (no separate second tap required).
10. **Given** the mic-button tooltip is visible, **When** the user taps the "X"
    close icon in the top-right of the tooltip, **Then** the tooltip dismisses
    but the voice recording flow does NOT open; the user remains on the
    dashboard. The tooltip is marked as seen.
11. **Given** the user has already seen and dismissed the mic-button tooltip
    once (via either "Try it now" or the X close icon, whether or not they
    actually completed a voice transaction afterward), **When** they tap the
    "Try voice transaction" action button again, **Then** the tooltip does NOT
    re-appear; the voice recording flow opens directly.
12. **Given** the user taps the mic button in the bottom tab bar directly
    (bypassing the Setup Guide card entirely), **When** the voice flow opens,
    **Then** the mic-button tooltip does NOT appear — even if it has never been
    seen before. The tooltip is tied to the voice step's action button, not to
    the mic button's global behavior.
13. **Given** the "Try voice transaction" step is completed (the user has a
    voice-sourced transaction), **When** the Setup Guide card is rendered,
    **Then** the voice step shows as completed (checkmark + strikethrough text)
    and has NO action button. The tooltip cannot be re-triggered because the
    action button no longer exists.

---

### User Story 5 — Dashboard opens without a flash of vanishing content (Priority: P3)

A user (any user — new, returning, signed in) opens the app. The dashboard loads
without a visible "skeleton placeholder appears, then disappears leaving blank
space, then real content slides up" flicker. The Setup Guide card, in
particular, does not reserve a slot during the initial skeleton render only to
vanish when the real data says the card is dismissed.

**Why this priority**: Polish issue, not a blocker — but affects every cold
launch for every user. P3 because it's a small, bundled fix whose main benefit
is visible calm, and bundling it with the larger onboarding work saves a
separate ticket cycle.

**Independent Test**: Force-quit the app, cold-launch, observe the dashboard
render — there should be no vertical content jump in the region above the first
data-backed section for returning users who have already dismissed the Setup
Guide card.

**Acceptance Scenarios**:

1. **Given** a returning user who has previously dismissed the Setup Guide card,
   **When** they cold-launch the app, **Then** the dashboard renders without any
   temporary placeholder appearing in the card's slot.
2. **Given** a new user, **When** they cold-launch the app for the first time,
   **Then** the Setup Guide card's arrival does not cause content below it to
   visibly shift downward.

---

### Edge Cases

- **Unsupported device locale**: If the device locale is not English or Arabic,
  the pitch defaults to English and the language affordance remains available.
- **Device locale is Arabic but user switched to English pre-auth**: On sign-up,
  the language recorded on the new profile is English (the user's explicit
  override, not the device locale).
- **Sign-in with a different account on the same device**: The per-device "pitch
  seen" flag persists; pitch does not re-appear. The tooltips, however, are
  per-account and may appear for the new account if the new account has not yet
  dismissed them.
- **Sign-up fails partway**: The user sees an error on the auth screen and
  remains on the auth screen. No partial profile data is written.
- **Currency selection fails to persist (network blip during atomic commit)**:
  The user sees an error on the Currency step and stays there; the cash account
  is NOT created, the profile is NOT updated, and nothing is left half-written.
  On retry the full commit re-attempts.
- **User signs out on the Currency step while offline**: Sign-out still works
  (local session cleared); the user sees the pre-auth state; remote session
  revocation can occur later when connectivity resumes.
- **Rapid taps or multiple open prompts**: Only one first-run tooltip is visible
  at a time. The SMS permission prompt (rendered by the existing `useSmsSync`
  path) and the new cash-account tooltip are NOT a managed queue — the
  cash-account tooltip self-gates on `!shouldShowPrompt` so it only appears once
  the SMS prompt has been dismissed.
- **Force-quit during first-run tooltip sequence**: The cash-account tooltip is
  scoped to the session that immediately follows a successful Currency-step
  confirmation (via the in-memory `FirstRunTooltipContext.isFirstRunPending`
  signal — per FR-020). If the user force-quits between dismissing the SMS
  prompt and seeing the cash-account tooltip, the cash-account tooltip is lost
  for that user — acceptable per FR-020 since they are already onboarded and the
  tooltip is educational, not functional.
- **Setup Guide card SMS step on iOS**: Hidden entirely on iOS (SMS auto-import
  is not available there). iOS users see 3 steps.
- **Returning user on a new device signing in**: They land on the auth screen
  (device's "pitch seen" flag is false → pitch shows first), then sign in, and
  the routing gate reads `profile.onboarding_completed` (per FR-031) — if
  `true`, they skip the Currency step and go to the dashboard. The first-run
  dashboard prompts (SMS popup + cash-account tooltip) do NOT appear for them
  because `isFirstRunPending` is only set by a successful Currency-step
  confirmation in the current session, which happened long ago on their original
  device.
- **Mic-button tooltip never shown if user abandons the voice step**: If the
  user sees the voice step on the Setup Guide card, dismisses the card entirely
  (manual dismiss) without ever tapping the voice step's action button, they
  will never see the mic-button tooltip. The tooltip is tied to the voice step's
  action button, not to the card being visible. If the user later rediscovers
  the mic button by tapping it directly, the voice flow opens without any
  preamble — they self-taught, which is OK.

## Requirements _(mandatory)_

### Functional Requirements

#### Pre-auth pitch flow

- **FR-001**: On first launch of the app on a device where the pitch has not yet
  been seen, the system MUST present a pitch carousel of three slides before
  presenting the auth screen. Slide 1 (Voice) and Slide 3 (Live Market) are
  identical across platforms. Slide 2 differs by platform: on Android, the
  system MUST present the SMS auto-import slide; on iOS (where SMS scanning is
  not available), the system MUST present the Offline-first slide ("Record now.
  Sync later.") instead. Slide count (3) and navigation structure remain
  identical on both platforms.
- **FR-002**: The pitch MUST be rendered in the user's device locale when
  supported (English or Arabic), or in English as a fallback if the device
  locale is neither. If the user has previously made an explicit pre-auth
  language choice on this device, that choice MUST take precedence over the
  device locale at app startup — the user MUST NOT see a brief flash of the
  device-locale language before the app settles into their chosen language
  (e.g., after an RTL-triggered reload). The language resolution order at
  startup is therefore: prior device-local language choice → device locale →
  English fallback.
- **FR-003**: Each slide MUST expose a language-switch affordance in a
  consistent corner position. Selecting a different language MUST apply
  immediately to the current slide and subsequent pitch surfaces, and MUST
  persist across app restarts on the same device.
- **FR-004**: Each slide except the last MUST expose a Skip affordance. The last
  slide MUST expose a primary CTA that advances to the auth screen.
- **FR-005**: The device-local "pitch seen" flag MUST be set only when the user
  explicitly taps Skip OR reaches the last slide. Partial views (force-quit
  during slides 1 or 2) MUST NOT set the flag.
- **FR-006**: On subsequent launches of the app on a device where the flag is
  set, the system MUST route directly to the auth screen (or the dashboard, if a
  valid session exists) without showing the pitch.

#### Auth screen

- **FR-007**: The auth screen MUST render in the language most recently selected
  in the pitch (device locale, or user override) for users who have not yet
  signed up. The auth screen MUST also expose the same language-switcher
  affordance used on the pitch slides, positioned consistently in a top corner.
  Tapping it MUST apply the new language immediately and persist the choice on
  the device, so pre-auth surfaces (pitch, auth, Currency step) share a single
  source of truth for "what language is the user currently in."
- **FR-008**: The auth screen MUST present, in order: a welcome title, a tagline
  summarizing the product promise, four compact value-prop badges (voice, bank
  SMS, live rates, precious metals), the existing sign-in-with-Google action
  preserving the current OAuth icon styling, a separator, an email/password form
  with toggle between sign-in and sign-up modes, and a footer trust microbar
  with security iconography (visually separated from the form by a thin top
  border).
- **FR-009**: The auth screen MUST NOT retain the previous prominent shield-icon
  hero or the 3-trust-badge row that formerly appeared above the form.
- **FR-010**: On a successful first sign-up, the system MUST write the user's
  currently-active app language to the profile as part of the
  Currency-confirmation atomic write (FR-014 step c). This overwrite is
  unconditional — the column is NOT NULL and always carries a default value, so
  the write ensures the profile reflects the user's explicit or implicit
  language choice.
- **FR-011**: On a subsequent sign-in for a profile that already has a preferred
  language, the system MUST NOT overwrite that stored preference with the local
  language; the profile value wins.

#### Post-auth routing and Currency step

- **FR-012**: Immediately after the user is authenticated and after the initial
  profile pull has completed, the system MUST consult the user's profile to
  decide routing: if the user has not yet completed onboarding, present the
  Currency step; if they have completed onboarding, route directly to the
  dashboard.
- **FR-013**: The Currency step MUST be a single required screen. It MUST NOT
  permit skipping without a selection. The Currency step MUST also expose the
  same language-switcher affordance used on the pitch slides and auth screen, so
  a user who arrived here in the wrong language (e.g., a second account on a
  device where the previous user picked a different language) can correct it
  before confirming. The behavior of the switcher (immediate apply, persist
  across launches) is identical on all three surfaces.
- **FR-013a**: On Android, the hardware back button MUST be blocked on the
  Currency step. The only exits from the Currency step are (a) successful
  confirmation or (b) tapping Sign out.
- **FR-014**: When the user confirms a currency, the system MUST execute a
  single atomic data write that (a) creates a default cash account in the chosen
  currency under the user's ownership, (b) writes the preferred currency to the
  profile, (c) writes the user's currently-active app language to the profile
  (the language the user sees right now on the Currency screen, which already
  reflects any switches made on pitch, auth, or Currency screens), and (d) marks
  the user as having completed onboarding. If any part of the write fails, NO
  partial data MUST be left behind (the user sees an error and can retry). On
  successful write, the system MUST then navigate to the dashboard. Navigation
  is NOT part of the atomic write — it runs after the write succeeds. If a crash
  occurs between commit and navigation, the routing gate on next app launch MUST
  read the saved state and route the user to the dashboard without a second
  Currency step. The device-local language override MUST NOT be cleared
  afterward — it persists as a device-level language preference for future
  sessions on the same device.
- **FR-015**: The Currency step MUST expose a Sign out action. Tapping Sign out
  MUST clear the local session and return the user to the pre-auth state (pitch
  if the device has not yet seen it; auth screen otherwise).
- **FR-016**: After onboarding is complete, the system MUST NOT present the
  Currency step again on subsequent sign-ins for that profile (the profile's
  preferred-currency signal gates it).

#### Dashboard first-run tooltips

<!-- Note: FR-021 is intentionally absent — numbering gap from FR-020 to FR-022 is cosmetic only. -->

- **FR-017**: The dashboard's first-run experience is composed of two
  independent prompts. They are not a single managed queue introduced by this
  feature:
  1. **SMS permission prompt** (existing, unchanged). Its visibility is governed
     by the existing SMS-sync logic and is not modified by this feature. On
     Android it appears until the user has either dismissed it or completed an
     SMS sync; on iOS it never appears.
  2. **Cash-account tooltip** (new). It is shown only when all of the following
     are true: (a) the current app session is the one that immediately followed
     a successful Currency-step confirmation; (b) the user has not previously
     dismissed this tooltip; and (c) the SMS permission prompt is not currently
     on screen — the cash-account tooltip MUST wait for the SMS prompt to be
     dismissed before appearing, so the two never overlap.
- **FR-018**: Each prompt MUST be dismissible with a single tap on its primary
  button (SMS: existing "Allow" / "Not Now"; cash-account tooltip: "Got it").
- **FR-019**: Once dismissed, the cash-account tooltip MUST NOT reappear for
  that profile on that device in any future session. The SMS prompt's dismissal
  behavior is owned by the existing SMS-sync logic and is not modified by this
  feature.
- **FR-020**: The cash-account tooltip MUST only be scoped to the app session
  that immediately follows a successful Currency-step confirmation. A returning
  or already-onboarded user (whose Currency confirmation is not part of the
  current session) MUST NOT see the cash-account tooltip even if they have never
  dismissed it. This keeps the tooltip scoped to genuinely new users. Accepted
  trade-off: if the user force-quits between dismissing the SMS prompt and the
  cash-account tooltip appearing, the cash-account tooltip is lost for that user
  — acceptable, since they are already onboarded and the tooltip is educational,
  not functional.

#### Dashboard Setup Guide card

- **FR-022**: The Setup Guide card on the dashboard MUST present the user's
  setup progress as four ordered steps with these exact labels: (1) "Add bank
  account", (2) "Try voice transaction", (3) "Auto-track bank SMS", (4) "Set a
  budget". On iOS, the "Auto-track bank SMS" step MUST be hidden, leaving three
  steps. The labels in this requirement are authoritative; any earlier mockup
  that used older copy (e.g., "Enable SMS auto-import") is superseded.
- **FR-023**: Each step's completion state MUST be derived from the user's
  actual data rather than a separate tracking flag:
  - "Add bank account" is complete when the user has at least one non-deleted
    account of type bank.
  - "Try voice transaction" is complete when the user has at least one
    non-deleted transaction whose source is voice. Transactions recorded by SMS
    import or manual entry MUST NOT satisfy this step.
  - "Auto-track bank SMS" is complete when the user has at least one non-deleted
    transaction that was imported from an SMS. (Android only.)
  - "Set a budget" is complete when the user has at least one active budget.
- **FR-024**: The voice step in the Setup Guide card MUST include a visible
  "NEW" badge and an action button. Tapping the action button for the very first
  time MUST present a mic-button tooltip anchored to the real rendered position
  of the mic button in the bottom tab bar (which is centered in the shipped app;
  the design mockup renders the mic at the far right for layout clarity only —
  the implementation MUST anchor to the real centered position). The tooltip
  MUST offer two distinct exits:
  - A primary button labeled **"Try it now"** (bottom-right of the tooltip) —
    tapping it MUST both dismiss the tooltip AND open the existing voice-entry
    flow in a single action.
  - A close icon "X" (top-right of the tooltip) — tapping it MUST dismiss the
    tooltip only. The voice-entry flow MUST NOT open. The user remains on the
    dashboard. No new voice-entry screen is introduced by this feature. Both
    exits count as "tooltip seen" for the purposes of FR-024a (tooltip does not
    re-appear on subsequent action-button taps).
- **FR-024a**: The mic-button tooltip MUST NOT re-appear on subsequent taps of
  the voice step's action button, regardless of what happened after the first
  dismissal. "Any dismissal counts as seen forever" — this explicitly includes
  all of: user cancelled voice recording without submitting, user denied
  microphone permission when prompted by the voice flow, the voice flow errored
  for any other reason, or the user tapped "Try it now" and completed a voice
  transaction successfully. The tooltip is a one-time educational artifact; any
  follow-up permission / error UX is owned by the voice flow itself. Subsequent
  taps of the voice step's action button MUST open the voice-entry flow
  directly.
- **FR-024b**: The mic-button tooltip MUST NOT appear when the user taps the mic
  button in the bottom tab bar directly. The tooltip is tied exclusively to the
  voice step's action button on the Setup Guide card. Users who tap the mic
  button directly go straight into the voice-entry flow, regardless of whether
  they have seen the tooltip.
- **FR-024c**: Once the voice step is marked complete (the user has recorded a
  voice-sourced transaction), the voice step's action button MUST be removed
  from the card (per existing completed-step rendering). The mic-button tooltip
  cannot be re-triggered after step completion.
- **FR-025**: The progress indicator on the card MUST display the count of
  completed steps over the visible total ("X/4" on Android, "X/3" on iOS).
- **FR-026**: When all visible steps are complete, the card MUST auto-dismiss
  and remain dismissed for that profile thereafter.
- **FR-027**: The user MUST be able to manually dismiss the card. A manual
  dismissal MUST persist across devices for that profile.

#### Dashboard cold-launch polish

- **FR-028**: The cold-launch skeleton state of the dashboard MUST NOT reserve a
  slot for the Setup Guide card that later collapses to nothing when the real
  data arrives. The card's first appearance (or non-appearance) MUST happen
  once, not after a flash.

#### Data model

- **FR-029**: The device-local "pitch seen" signal MUST persist on the device
  itself, not on the user's profile, because the pitch is pre-auth and there is
  no profile at the moment of completion.
- **FR-030**: The device-local language-override signal MUST persist on the
  device. It is written by the language-switcher affordance wherever it appears
  (pitch slides, auth screen, Currency step). It serves two purposes:
  1. Seeding the app's language at startup (per FR-002) so the app renders in
     the user's chosen language immediately, with no flash of the device locale.
  2. Persisting the user's device-level language preference across logout/login
     cycles on the same device. The override MUST NOT be cleared on successful
     sign-up or on any other event. It behaves as a device-level language
     preference. Future sign-ups on the same device inherit the preference but
     can always change it via the language-switcher affordance on any pre-auth
     surface.
- **FR-031**: The routing signal for "has the user completed onboarding" MUST be
  the profile's `onboarding_completed` flag, not the profile's preferred
  currency. (Rationale: `preferred_currency` always carries a default value on a
  newly-created profile, so it cannot distinguish a never-onboarded user from a
  user who legitimately chose the default. `onboarding_completed` starts `false`
  and is only flipped to `true` inside the atomic Currency-confirmation write —
  see FR-014 and FR-033.)
- **FR-032**: The deprecated per-profile "slides viewed" field is out of scope
  for this feature — a prior feature already removed it. No further data-model
  work is required here for that deprecation.
- **FR-033**: `profiles.onboarding_completed` MUST be flipped from `false` to
  `true` as part of the atomic Currency-confirmation write (FR-014 step d). It
  IS the routing signal (see FR-031). No separate bookkeeping required.
- **FR-033a**: A new per-profile onboarding-flags record MUST be added by this
  feature to hold first-run tooltip-dismissal markers. Initial shape:
  - `cash_account_tooltip_dismissed` (boolean; default `false`; set to `true` on
    US3 cash-account tooltip dismissal; one-way)
  - `voice_tooltip_seen` (boolean; default `false`; set to `true` on first tap
    of the voice step's action button regardless of which exit the user takes;
    one-way) New tooltip flags added in future features MAY extend this record
    without a schema migration.

#### Sign-out from onboarding

- **FR-034**: Sign-out MUST be reachable on the Currency step (the only
  post-auth onboarding step). Pre-auth slides have no session to clear, so no
  Sign-out affordance is needed there.
- **FR-035**: On confirmed sign-out from the Currency step, the system MUST
  return the user to the pre-auth state. If the device has seen the pitch, that
  state is the auth screen; otherwise it is the pitch.

#### Hardware back button (Android)

- **FR-039**: On Android, the hardware back button MUST follow platform
  conventions for every new or modified surface in this feature:
  - **Pitch slides**: back navigates to the previous slide; on slide 1, back
    exits the app (standard Android root-screen behavior).
  - **Cash-account tooltip**: back dismisses the tooltip (equivalent to tapping
    the tooltip's "Got it" button). Does NOT open anything — matches the
    tooltip's only affirmative action.
  - **Mic-button tooltip**: back dismisses the tooltip (equivalent to tapping
    the X close icon, NOT the "Try it now" button). The voice overlay MUST NOT
    open on back. The tooltip is still marked as "seen" (consistent with FR-024a
    — any dismissal counts).
  - **Currency step**: back is blocked (no-op). The step is a required screen;
    users exit it only via Sign out or successful currency confirmation.
  - **Auth screen**: back navigates to the pitch if `intro:seen` is false
    (returns user to where they came from); otherwise back exits the app.
- **FR-040**: On iOS, where there is no hardware back button, the on-screen Skip
  and dismiss controls (and swipe-to-go-back where applicable, per iOS
  conventions) cover the same navigation intents. This feature does not add
  iOS-only back affordances; existing swipe-back gestures on the auth screen
  remain whatever expo-router provides.

#### Dark mode

- **FR-036**: Every screen, component, tooltip, and state introduced or modified
  by this feature — pitch slides (1/2/3 on both platforms), auth screen,
  Currency step, SMS permission prompt surround, cash-account tooltip,
  mic-button tooltip, Setup Guide card (expanded and collapsed), dashboard
  skeleton fix — MUST render correctly in both light and dark mode. Correctness
  means: text remains legible against its background (WCAG AA contrast at
  minimum: 4.5:1 for body, 3:1 for large text), icons remain visible, semantic
  accent colors (success green, gold/silver for precious metals, orange for food
  chips, etc.) remain readable against the dark surfaces they sit on.
- **FR-037**: The dark-mode token mapping table in the design spec
  (`specs/026-onboarding-restructure/design/slides-concepts.md`) is the
  authoritative reference for every surface/text/accent pairing. Implementation
  MUST apply these mappings via the project's established theming mechanism
  rather than re-inventing token logic per screen.
- **FR-038**: The feature MUST be tested in both light and dark mode before
  being considered shipping-ready. Every acceptance scenario in this spec MUST
  pass on a device set to dark mode (system-level or app-level), and no
  acceptance scenario is allowed to assume a specific theme.

### Key Entities

- **Pitch-seen signal** (device-scoped, persisted locally): Records whether the
  pitch has been completed on this device. Written once, never cleared
  automatically, applies across all accounts that ever sign in on the device.
- **Language-override signal** (device-scoped, persisted locally): Records an
  explicit language choice made during the pitch, used to render subsequent
  pre-auth surfaces and hand off to the profile on first sign-up.
- **User profile**: The user's account-scoped record. Relevant signals for this
  feature are the "onboarding completed" boolean (the routing gate per FR-031 —
  always starts `false`, flipped `true` atomically during Currency
  confirmation), preferred currency (confirmed in the Currency step; always has
  a value due to `NOT NULL DEFAULT 'EGP'` so it cannot serve as the routing
  signal), preferred language (overwritten atomically with the runtime language
  during Currency confirmation), and the Setup Guide dismissal flag. Synced
  between the local and remote stores.
- **Default cash account**: The starter account created on currency
  confirmation. Owned by the user, in the chosen currency, with a default name.
  Deletable like any user-created account.
- **Onboarding flags (first-run prompts)**: Per-profile markers that track which
  first-run prompts have been dismissed. Stored as a single per-profile record
  introduced by this feature, holding the markers as boolean keys:
  - `cash_account_tooltip_dismissed` (new marker for US3 cash-account tooltip;
    one-way, set on dismissal, never cleared)
  - `voice_tooltip_seen` (new marker for US4 mic-button tooltip; one-way, set on
    first tap of the voice step's action button regardless of how the tooltip is
    dismissed) The SMS permission prompt's "seen" state remains where it already
    lives today — this feature does not migrate it. Future tooltip flags can be
    added as new keys without a schema migration.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A new user can go from opening the app for the first time to
  viewing their dashboard with a cash account created in under 60 seconds when
  they do not stop to read every word (pitch skip → sign-up → currency
  confirmation → dashboard).
- **SC-002**: 100% of first-time visitors on devices with a supported locale see
  the pitch rendered in their locale, without any manual language selection
  required from them.
- **SC-003**: A manual walkthrough of the pitch by an internal reviewer
  completes end-to-end in under 60 seconds on both platforms. Every slide
  renders correctly, language switching works on every slide, and the Get
  Started CTA on the final slide routes to the auth screen. (Dev-phase
  verification; quantitative conversion measurement deferred until funnel
  telemetry is added in a future feature.)
- **SC-004**: In internal testing, a Currency-step confirmation completes the
  atomic write (cash account + preferred_currency + preferred_language +
  onboarding_completed) with no orphaned state in 100% of test cases across both
  platforms, including simulated network failures and force-quit scenarios.
  (Dev-phase verification; "95% of real users complete the step" language is
  deferred until funnel telemetry is added.)
- **SC-005**: On a fresh sign-up, the first-run dashboard prompts appear exactly
  once each, in the correct order, on the correct platform (Android shows SMS
  prompt + cash-account tooltip; iOS shows only cash-account tooltip). No prompt
  ever reappears after dismissal in any internal test session. The mic-button
  tooltip appears only on the first tap of the voice step's action button; if
  dismissed via the primary "Try it now" button the voice flow opens; if
  dismissed via the X close icon the user remains on the dashboard; either path
  prevents the tooltip from re-appearing on subsequent action-button taps.
- **SC-006**: The Setup Guide card correctly reflects completed steps, based
  solely on the user's data, within one second of a relevant action (adding a
  bank account, recording a voice transaction, etc.), without the user ever
  having to manually check a step off.
- **SC-007**: On cold launch for a user who has previously dismissed the Setup
  Guide card, there is no perceivable "placeholder appears then disappears"
  flicker above the fold of the dashboard.
- **SC-008**: Every screen introduced or redesigned in this feature — pitch
  slides, auth screen, Currency step, tooltips, Setup Guide card — works
  correctly in both light and dark mode on a device with system theme set
  accordingly, with no unreadable text or invisible icons in either mode.
- **SC-009**: Zero users onboarded before this feature shipped see the new
  first-run prompts retroactively — guaranteed by the fact that the prompts are
  triggered by the Currency-confirmation→dashboard transition, which
  already-onboarded users do not re-execute.
- **SC-010**: Zero orphaned partial records (half-written profiles, currency
  without cash account, etc.) are produced by the Currency step during a
  one-week internal test period, regardless of network conditions or
  force-quits.

## Assumptions

- Google OAuth and email/password sign-in/up remain the supported auth methods;
  this feature does not change the auth mechanism.
- The existing voice-entry flow (reachable today via the bottom-tab-bar mic
  button) continues to work as-is. This feature does not modify its internal
  behavior; it only introduces a tooltip that points at the button and a Setup
  Guide card step that routes to it.
- The existing SMS permission popup continues to work as-is. This feature does
  not modify its content or the underlying permission flow; it only queues it as
  the first of three first-run dashboard prompts.
- The constitution-level principle that all user-facing data is offline-first
  and goes through the local store first applies to every write described in
  this spec.
- Profile data synchronization between the local store and the remote store
  continues to be handled by the existing sync pipeline. The routing gate
  already waits for the initial profile pull to complete before making any
  routing decision, and the splash screen is held during that window — this
  feature relies on that pre-existing behavior and does not modify it.
- The design spec and Stitch mockups under
  `specs/026-onboarding-restructure/design/` and
  `specs/026-onboarding-restructure/mockups/` are the authoritative visual
  source. Copy, spacing, iconography, and the dark-mode token mappings in that
  spec govern the implementation.
- Two supported app languages: English and Arabic. Additional locales may be
  added later but are out of scope here.
- "Pre-auth" and "post-auth" refer to whether a valid authenticated session
  exists in the current app process, not whether any account has ever existed on
  the device.

## Dependencies

- **Issue #226** (Skip onboarding for returning users) — introduces the
  `preferred_currency` and `onboarding_completed` profile columns this feature
  relies on. Must be merged before this feature ships.

## Out of Scope

- Changes to the sign-in-with-Google mechanism or the email/password
  authentication backend.
- Changes to the SMS permission popup content or the SMS auto-import scanning
  flow.
- Changes to the voice-entry screen or voice-parsing pipeline. This feature only
  adds an entry point (the Setup Guide card voice step and the mic-button
  tooltip) that lead the user to the existing flow.
- Changes to dashboard sections other than the Setup Guide card, the first-run
  tooltip layer, and the cold-launch skeleton fix.
- Adding new app languages beyond English and Arabic.
- Producing separate dark-mode mockups. (Dark-mode RENDERING is in scope — see
  FR-037 below — but we do not commission a parallel set of mockups for it; the
  token mapping table in the design spec is the reference.)

## Related

- Issue [#246](https://github.com/Msamir22/Rizqi/issues/246) — the canonical
  product issue for this restructure (this spec implements it)
- Issue [#226](https://github.com/Msamir22/Rizqi/issues/226) — prerequisite
  (schema + initial routing)
- Issue [#242](https://github.com/Msamir22/Rizqi/issues/242) — closed, absorbed
  (sign-out during onboarding)
- Issue [#243](https://github.com/Msamir22/Rizqi/issues/243) — closed, absorbed
  (back navigation between onboarding steps)
- Issue [#245](https://github.com/Msamir22/Rizqi/issues/245) — closed, bundled
  (cash-account tooltip)
- Design artifacts:
  [`specs/026-onboarding-restructure/design/slides-concepts.md`](./design/slides-concepts.md)
