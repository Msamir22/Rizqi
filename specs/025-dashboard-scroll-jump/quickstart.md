# Quickstart: Reproduce & Verify Dashboard Scroll-Jump Fix

**Feature**: 025-dashboard-scroll-jump
**Scope**: Reproduction runbook for the bug (issue #234) and verification runbook for the fix.

## Pre-conditions

- Project built locally from the `025-dashboard-scroll-jump` branch.
- WatermelonDB has real user data (at least one account, one transaction, one upcoming payment) — the bug manifests during progressive loading of real content, not empty skeletons. If needed, sign in with a seeded test account.
- Device list:
  - **Primary (thorough)**: Android with visible navigation bar (Samsung preferred, matches original report).
  - **Secondary (smoke-test only)**: Android with gesture navigation, iOS with home indicator.

## Reproduction (before the fix)

1. Force-close the app (swipe away from recents on Android; swipe up from the app-switcher on iOS).
2. Start a screen recording on the device.
3. Tap the app icon to cold-start the app.
4. Let the Dashboard render all the way through — do NOT scroll manually.
5. Stop the recording once all sections have loaded and the UI is stable.
6. Play back frame-by-frame (or at reduced speed). Confirm:
   - During the loading phase, the `TopNav` is partially clipped by the status bar / top of screen.
   - When the last section finishes loading, the viewport visibly "snaps" upward and `TopNav` becomes fully visible.
7. Save the recording as `before-android-navbar.mp4` (and equivalent for each tested profile).

If the reproduction does NOT produce a visible clip + snap on the primary device, document the attempted reproduction in `research.md` and escalate to the feature owner before continuing — the investigation premise must be verifiable.

## Verification (after the fix)

On the **primary** Android-navbar profile:

1. Repeat steps 1–5 from the reproduction section on the post-fix build.
2. Confirm by direct observation of the recording:
   - **SC-001**: `TopNav` is fully visible from the first frame the Dashboard renders.
   - **SC-002**: The viewport does not move during the loading phase — no visible offset, no snap.
   - **SC-003**: No "snap" animation at the moment the last section resolves.
3. Additional cases to recheck on the primary profile:
   - **Resume** (User Story 2): Background the app for 30+ seconds, bring it to the foreground, confirm no jump as background refresh completes.
   - **User scrolls during load** (FR-005): Cold-start, manually scroll halfway down before the last section resolves, confirm the position is preserved and no auto-scroll to top occurs.
   - **Pull-to-refresh**: Perform pull-to-refresh on a loaded dashboard, confirm no additional jump beyond the refresh gesture itself.
4. Save the post-fix recording as `after-android-navbar.mp4` and attach it to the pull request.

On the **secondary** profiles (Android-gesture, iOS-home-indicator):

- Single cold-start per device. Confirm:
  - `TopNav` is fully visible throughout load.
  - No obvious scroll jump.
- A short recording is NOT required for secondary profiles, but any observed regression MUST be captured and blocks release.

## Evidence checklist for the PR

- [ ] `before-android-navbar.mp4` — reproduction of the bug on main baseline
- [ ] `after-android-navbar.mp4` — fix confirmed on primary profile
- [ ] Smoke-test note for Android-gesture (pass/fail, device model, OS version)
- [ ] Smoke-test note for iOS-home-indicator (pass/fail, device model, iOS version)
- [ ] `research.md` filled in with confirmed/ruled-out decisions for all four hypotheses
- [ ] No ESLint warnings introduced; TypeScript strict compilation passes
