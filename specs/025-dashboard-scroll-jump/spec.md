# Feature Specification: Stable Dashboard Layout During Initial Load

**Feature Branch**: `025-dashboard-scroll-jump`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "GitHub issue #234: Dashboard scrolls/shifts during initial load — TopNav partially hidden until content fully loads. On cold start, the dashboard appears scrolled down a few dp during the loading phase. Once all data finishes loading, the page snaps back to scroll=0. TopNav is only partially visible during loading. Must work on Android (primary) and iOS, cold start and resume."

## Clarifications

### Session 2026-04-18

- Q: How should the fix strategy treat the four root-cause hypotheses (SafeArea timing, ScrollView content-height race, StatusBar `isDark` inversion, tab navigator scene measurement race)? → A: Exhaustively investigate all four hypotheses, document findings, then fix confirmed causes.
- Q: Should the `StatusBar` `backgroundColor={isDark ? lightTheme.background : darkTheme.background}` config be treated as a bug, or as intentional visual separation of system chrome? → A: Keep it in the investigation list; change the config only if evidence shows it contributes to the scroll jump or causes a measurable layout hiccup. Otherwise treat the existing pattern as an intentional design choice (status bar contrast strip) and document the conclusion.
- Q: What defines "loading complete" for the purposes of FR-005 (user-scroll preservation) and any defensive scroll-to-top guard? → A: All section-level loading flags have individually resolved — each dashboard section (accounts, budgets, net worth, upcoming payments, market rates, etc.) has rendered real content, an empty state, or an error placeholder.
- Q: What device-verification scope is required for "done"? → A: Thorough verification limited to the primary reported profile (Android with visible navigation bar). iOS and Android-gesture profiles receive a smoke-test only (quick sanity check that nothing obviously regresses).
- Q: What evidence format satisfies SC-002 ("zero automatic scroll-position changes")? → A: A recorded screen capture of the cold-start loading sequence, judged by direct observation — no code-level scroll-offset instrumentation required.

## User Scenarios & Testing

### User Story 1 - Stable Dashboard on Cold Start (Priority: P1)

A user opens the Rizqi app from a fully closed state. While their financial data (accounts, budgets, net worth, upcoming payments, market rates) is still loading, they see the dashboard skeleton with the top navigation bar fully visible at the top of the screen. As data arrives progressively, nothing visually jumps, shifts, or re-scrolls. The final, populated dashboard appears in the exact same vertical position as the skeleton did.

**Why this priority**: Cold start is the most common and most visible entry point to the app. The current behavior hides part of the top navigation during loading and produces a jarring "snap" when content finishes loading — this is the first impression most users get in any given session and undermines the app's perceived quality and trustworthiness.

**Independent Test**: Force-close the app, reopen it, and observe the dashboard from first paint through full data load. The top navigation bar stays fully visible throughout, and no automatic scroll movement occurs at any point during the loading phase or when loading completes.

**Acceptance Scenarios**:

1. **Given** the app is fully closed, **When** the user launches it and lands on the dashboard, **Then** the top navigation bar is fully visible (not clipped or partially hidden) from the first frame the dashboard is rendered.
2. **Given** the dashboard is in its skeleton/loading state, **When** individual sections finish loading and replace their skeletons with real content, **Then** the viewport does not scroll or jump on its own.
3. **Given** the dashboard has finished loading all sections, **When** the user looks at the scroll position, **Then** the dashboard is at the top (scroll offset zero) without any visible "snap" animation having occurred.

---

### User Story 2 - Stable Dashboard on App Resume (Priority: P2)

A user returns to the app after it was backgrounded (e.g., switching from another app, unlocking the phone). The dashboard re-appears with the top navigation fully visible and no scroll shift while any re-hydration or refresh of data occurs.

**Why this priority**: Resume is a frequent interaction pattern but less impactful than cold start because cached content typically renders instantly. Still, any residual shift on resume reads as a bug to users.

**Independent Test**: Open the dashboard, send the app to the background for 30+ seconds, then bring it back. Observe that the top navigation remains fully visible and no scroll adjustment occurs as data refreshes.

**Acceptance Scenarios**:

1. **Given** the app was backgrounded on the dashboard, **When** the user brings it back to the foreground, **Then** the dashboard redisplays with the top navigation fully visible and no scroll jump.
2. **Given** background data refresh completes after resume, **When** sections update with fresh values, **Then** the scroll position does not change automatically.

---

### User Story 3 - Stable Dashboard Across Device Shapes (Priority: P3)

A user on any supported device — including Android phones with on-screen navigation bars, Android phones with gesture navigation, iPhones with a home indicator, and iPhones with a physical home button — experiences the same stable dashboard behavior. Safe area insets (status bar, navigation bar, home indicator) do not cause visible layout shifts during the loading phase.

**Why this priority**: Device-shape coverage ensures the fix generalizes. The primary bug was reported on Android, but the fix must not regress iOS or cause new shifts on devices with different safe-area profiles.

**Independent Test**: Reproduce User Story 1 in full on one Android device with a visible navigation bar (primary profile). On one Android device with gesture navigation and on one iOS device with a home indicator, perform a smoke-test only — single cold-start confirming the TopNav is fully visible and no obvious scroll jump occurs. Any regression observed on the smoke-tested profiles blocks release.

**Acceptance Scenarios**:

1. **Given** an Android device with a visible navigation bar, **When** the dashboard loads on cold start, **Then** behavior matches User Story 1.
2. **Given** an iOS device with a home indicator, **When** the dashboard loads on cold start, **Then** behavior matches User Story 1.
3. **Given** any supported device, **When** safe area insets are resolved after the first frame, **Then** the dashboard does not visibly shift to accommodate them.

---

### Edge Cases

- **Slow networks / slow data sources**: When one or more sections take unusually long (e.g., several seconds) to load, the dashboard must remain stable throughout — no scroll movement when the slow section eventually resolves.
- **Sections that change height significantly**: When a section's skeleton height differs from the real content height (e.g., a list that turns out to have many items), the layout may legitimately grow downward, but the viewport's scroll position relative to the top must remain pinned at zero until the user scrolls.
- **Empty states**: When a section finishes loading with no data (e.g., no upcoming payments), the transition from skeleton to empty-state content must not cause a scroll shift.
- **Orientation change during load**: If the device rotates while the dashboard is still loading, the re-layout must not introduce an additional scroll jump beyond the expected orientation re-flow.
- **Error states**: When a section fails to load and shows an error placeholder, the error placeholder replacing the skeleton must not cause a scroll shift.
- **User scrolls during load**: If the user intentionally scrolls down while data is still loading, the app must respect the user's scroll position and must not auto-scroll back to top when loading completes.
- **Pull-to-refresh on an already-loaded dashboard**: Pull-to-refresh is an explicit user gesture; data updates triggered by it must not cause an additional scroll jump beyond the refresh gesture itself.

## Requirements

### Functional Requirements

- **FR-001**: The top navigation bar MUST be fully visible (not clipped by the status bar, notch, or any other system UI) from the first frame the dashboard is rendered, including during the skeleton/loading phase.
- **FR-002**: The dashboard MUST NOT automatically change its scroll position at any point during the loading phase as a side effect of sections transitioning from skeleton to real content.
- **FR-003**: The dashboard MUST NOT produce a visible "snap" or scroll animation when the last loading section resolves.
- **FR-004**: The dashboard MUST start with its scroll position at the top (offset zero) on initial render, whether the app is launched cold or resumed from background.
- **FR-005**: When the user manually scrolls the dashboard during the loading phase, the app MUST preserve the user's scroll position and MUST NOT auto-scroll to top when loading completes. For the purposes of this requirement, "loading completes" is defined as the moment at which every section-level loading flag has individually resolved — each dashboard section (accounts, budgets, net worth, upcoming payments, market rates, and any future sections added to the dashboard) has rendered real content, an empty state, or an error placeholder.
- **FR-006**: The fix MUST behave consistently on Android (primary target) and iOS.
- **FR-007**: The fix MUST behave consistently on cold start (app fully closed) and on resume (app brought back from background).
- **FR-008**: The fix MUST NOT regress the existing skeleton loading experience (skeletons remain visible until their underlying data is ready).
- **FR-009**: The fix MUST NOT regress the status bar or safe-area behavior (status bar content remains visible and readable; safe-area insets continue to be respected on all supported devices).
- **FR-010**: Sections whose real content height differs from their skeleton height MAY grow or shrink the scrollable content area downward, but MUST NOT change the viewport's scroll offset relative to the top of the content.

### Key Entities

Not applicable — this feature is a UI-stability fix and does not introduce or modify data entities.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On cold start, the top navigation bar is fully visible in 100% of dashboard loads across supported devices (no frames in which the navigation is clipped).
- **SC-002**: Zero automatic scroll-position changes occur during the dashboard loading phase, as judged by direct observation of a recorded screen capture of the cold-start loading sequence on the primary verification profile. Code-level scroll-offset instrumentation is not required; if the video shows no visible shift or snap from first paint through full data load, this criterion is satisfied.
- **SC-003**: No visible "snap" animation is perceivable when the last loading section resolves, as judged by direct observation and frame-by-frame video review.
- **SC-004**: Thorough verification (cold start, resume, and all edge cases) is performed on the primary reported profile — one Android device with a visible navigation bar — with fully passing outcomes. The remaining profiles (one Android with gesture navigation, one iOS device with a home indicator) receive a smoke-test only: a single cold-start confirming the TopNav is fully visible and no obvious scroll jump occurs. Any regression observed on the smoke-tested profiles blocks release; the absence of a regression on those profiles is sufficient evidence of parity without requiring the full acceptance-scenario matrix to be re-executed on them.
- **SC-005**: Regression rate on related dashboard behavior (skeleton display, safe-area handling, pull-to-refresh, status bar appearance) is zero across the verification device set.
- **SC-006**: User-reported issues describing a "dashboard jump" or "top bar cut off on load" drop to zero in the reporting period following the fix.

## Assumptions

- The dashboard is the primary screen where this issue manifests; sibling tabs and other screens are out of scope for this specification.
- The scroll-jump and navigation-clipping behaviors are observable on the current `main` branch and reproducible without special device configuration.
- The acceptance criteria in GitHub issue #234 are authoritative; this spec expands and formalizes them but does not override them.
- Existing skeleton components (`DashboardSkeleton`, section-level skeletons introduced in PRs #230/#232) remain the chosen loading affordance; this feature does not propose replacing them.
- The AuthGuard blank-screen issue tracked separately in #233 is out of scope and will be addressed independently.
- "Fully visible top navigation bar" means the navigation is positioned below (or appropriately inset from) the status bar / notch / camera cutout and no part of its content is clipped by system UI.
- Verification does not require automated visual-regression testing in CI for this iteration; direct device observation and recorded sessions are sufficient evidence.
- The implementation will exhaustively investigate all four hypotheses from issue #234 (SafeArea inset timing, ScrollView content-height race, `StatusBar` config, tab navigator scene measurement race), document which hypotheses are confirmed or ruled out, and apply targeted fixes only to the confirmed causes. Investigation findings will be captured in the feature's plan/research artifact before implementation begins.
- The current `StatusBar` `backgroundColor` pattern (dark background in light mode, light background in dark mode) is treated as an intentional visual-separation design choice — it provides a contrast strip between system chrome (clock/battery/signal) and app content. It will only be modified if investigation proves it contributes to the scroll jump or causes a measurable layout hiccup.

## Out of Scope

- The AuthGuard session-restore blank screen (issue #233).
- Redesigning the dashboard layout, skeleton visuals, or section composition.
- Performance improvements to data loading itself — the goal is layout stability regardless of loading speed.
- Changes to the dashboard on tabs other than the primary dashboard tab.
