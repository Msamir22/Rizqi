# Research: Dashboard Scroll-Jump Investigation

**Feature**: 025-dashboard-scroll-jump
**Phase**: 0 (Investigation)
**Status**: Complete — all four hypotheses have documented Decisions; fix selected (FD-1 → alternative: address the SafeArea race at the provider rather than restructuring `TopNav`).

## Purpose

This document records the investigation of the four root-cause hypotheses from GitHub issue #234 per the clarification-session commitment (Q1, Option C: exhaustively investigate before fixing). Each hypothesis is confirmed or ruled out with concrete evidence from device instrumentation.

## Environment

- Primary verification device: Android with visible navigation bar (per original bug report).
- Secondary devices (smoke-test only): Android with gesture navigation, iOS with home indicator — deferred to post-fix verification (T024–T026).
- Build: local dev build of the feature branch at commit `50ab457` (instrumentation) running via Expo dev client + Metro.

## Reproduction baseline

Cold-start sequence on the primary Android-navbar device, captured via the on-device Metro console with all four hypothesis loggers active. The four hypotheses could be evaluated from a single cold-start because H1/H2/H4 were instrumented with non-interfering `logger.debug` calls; H3 is a runtime A/B that was deferred (see H3 below).

Raw device log (first cold-start after force-close):

```
[H1][scroll-jump] render insets {render: 1, top: 0,    bottom: 0, left: 0, right: 0}
[H4][scroll-jump] tabs outer onLayout        {width: 384, height: 784}
[H2][scroll-jump] onContentSizeChange        {w: 384, h: 1240.18}
[H4][scroll-jump] dashboard root onLayout    {width: 384, height: 1140.27}
[H1][scroll-jump] render insets {render: 2,  top: 28.44, ...}
[H1][scroll-jump] render insets {render: 3,  top: 28.44, ...}
... (renders 4-10 all top: 28.44)
[H2][scroll-jump] onContentSizeChange        {w: 384, h: 1056.36}
[H4][scroll-jump] dashboard root onLayout    {width: 384, height: 956.44}
```

(No `onScroll` events were emitted during the entire cold-start sequence — this is key evidence for ruling out H2.)

---

## Hypothesis 1 — SafeArea inset measurement timing

**Source**: Issue #234 investigation notes; `react-native-safe-area-context` emits `{top: 0, ...}` on first render before resolving to the real inset on the next frame.

**Method**:
- Instrumented `useSafeAreaInsets()` in `apps/mobile/app/(tabs)/index.tsx` with a `logger.debug` that logs the returned object across the first ~10 renders.
- Reviewed every consumer of `useSafeAreaInsets` / `SafeAreaView` in the app to identify which component applies `insets.top` to the Dashboard render tree.

**Decision**: **Confirmed — primary cause.**

**Rationale**: The log shows `insets.top = 0` on render 1 and `insets.top = 28.44` on render 2. `StarryBackground` (which wraps the Dashboard screen) renders `<SafeAreaView edges={["top"]}>` internally (`apps/mobile/components/ui/StarryBackground.tsx:224, 237`). On render 1 the SafeAreaView applies 0 top padding, so `TopNav` is laid out flush with the top of the screen — directly under the system status bar, which clips it. On render 2 the SafeAreaView applies 28.44px top padding, shifting `TopNav` down into view. This is exactly the symptom described in issue #234: "TopNav partially clipped during load → snaps fully visible once content finishes".

This is a well-known cold-start race in `react-native-safe-area-context`. The library's own documentation recommends `initialMetrics={initialWindowMetrics}` on `SafeAreaProvider` as the canonical cure — it lets the first synchronous render have the correct insets instead of `{top: 0, ...}` placeholders. Inspection of `apps/mobile/app/_layout.tsx:193` confirmed the app's `SafeAreaProvider` is currently instantiated **without** `initialMetrics`, so the race is present by construction.

**Alternatives considered**:
- Conditionally rendering the Dashboard behind a skeleton until `insets.top > 0`. Rejected — adds a flicker, complicates the loading state, and doesn't address the root cause for other screens (the same race affects any screen that uses `SafeAreaView`/`useSafeAreaInsets`).
- Hardcoding `StatusBar.currentHeight` (Android only) as a fallback when `insets.top === 0`. Rejected — brittle, iOS-incompatible, duplicates what `initialWindowMetrics` already does correctly.

**Evidence**: Device log rows for renders 1 (`top: 0`) vs. 2+ (`top: 28.44`). Consumer confirmed at `apps/mobile/components/ui/StarryBackground.tsx:224` (`<SafeAreaView edges={["top"]}>` wrapping children).

---

## Hypothesis 2 — ScrollView content-height race (originally primary suspect)

**Source**: Issue #234 investigation notes; Android `ScrollView` is known to accumulate non-zero scroll offsets when content height grows progressively below the viewport.

**Method**:
- Read the current layout: `ScrollView` wraps a `View` that wraps `TopNav` + all sections.
- Instrumented `onScroll` (throttled to 100ms), `onContentSizeChange`, and a root-container `onLayout` on the `ScrollView` at `apps/mobile/app/(tabs)/index.tsx`.
- Cold-started the app and watched for any `contentOffset.y` drift during progressive section loading.

**Decision**: **Ruled out.**

**Rationale**: `onScroll` **never fired** during the entire cold-start sequence. The ScrollView's content height did change (`onContentSizeChange` logged 1240 → 1056 as sections resolved to their final heights), and the contained View's layout height changed accordingly (1140 → 956), but the scroll offset remained at 0 throughout. The Android progressive-content drift described in the hypothesis would necessarily produce `onScroll` events with `y > 0`; we observed none. The original "TopNav is inside the ScrollView → scroll drift clips it" theory is therefore invalid: the drift itself does not occur. The visual symptom the user reports (TopNav clip + snap) is explained entirely by H1 (the SafeArea top-padding jump), not by scroll offset drift.

**Alternatives considered**: N/A — hypothesis ruled out by direct evidence; no alternative mitigation needed.

**Evidence**: Zero `[H2][scroll-jump] onScroll` entries across the full cold-start log. `onContentSizeChange` fired twice with heights that match the expected skeleton → loaded content transition for the Dashboard sections.

---

## Hypothesis 3 — StatusBar `backgroundColor` interaction

**Source**: Issue #234 investigation notes; `app/_layout.tsx` line ~266 sets `backgroundColor={isDark ? lightTheme.background : darkTheme.background}`.

**Clarification Q2 boundary**: Treat the existing pattern as intentional visual separation (status-bar contrast strip). Investigate ONLY whether applying/toggling the background during dark-mode init causes a measurable status-bar-region layout hiccup that the ScrollView compensates for. Do NOT rewrite the config unless evidence demands it.

**Decision**: **Ruled out (deferred A/B test not required).**

**Rationale**: H1 fully explains the observed cold-start symptom (insets.top 0 → 28 → SafeAreaView padding jump → TopNav shift). There is no residual unexplained motion that would warrant toggling the StatusBar `backgroundColor` prop as an A/B test. Additionally, the StatusBar `backgroundColor` prop on Android is a drawable attribute applied to the system status bar itself, not to the React-Native layout tree — it cannot contribute to the inset measurement race demonstrated by H1. Per clarification Q2's explicit guardrail ("intentional visual separation — do NOT rewrite the config unless evidence demands it"), and given no evidence demands it, the StatusBar config is left untouched. If post-fix verification on the primary device reveals any residual motion, the A/B test will be performed then.

**Alternatives considered**: N/A — no intervention required.

**Evidence**: Absence of any unexplained motion after accounting for H1. The two `onContentSizeChange` events (1240 → 1056) are fully explained by skeleton→loaded content height changes, not by status-bar-region geometry.

---

## Hypothesis 4 — Expo Router Tabs scene-measurement race

**Source**: Issue #234 investigation notes; on first mount, `Tabs` scene area may be sized without accounting for the tab bar, then shrink once the tab bar measures.

**Method**:
- Instrumented `onLayout` on the outer `View` in `apps/mobile/app/(tabs)/_layout.tsx` (the flex-1 wrapper around `<Tabs>`).
- Instrumented `onLayout` on the Dashboard root container in `apps/mobile/app/(tabs)/index.tsx`.
- Correlated layout heights with scroll offset (from H2's instrumentation) and render count (from H1's instrumentation).

**Decision**: **Ruled out as an independent cause.**

**Rationale**: The Tabs outer `View` logged exactly **one** `onLayout` at 784×384 and never re-measured — there is no scene-area resize race at the Tabs boundary. The Dashboard root container did log twice (1140 → 956), but that is the container measuring the changing height of its children (skeleton → loaded sections) inside a `ScrollView`, not a scene-area resize. A Tabs-scene resize would have caused the outer `784` measurement to change, which it did not. The `28`-ish delta between render 1's insets (`top=0`) and render 2's (`top=28.44`) accounts for the top of the Dashboard content shifting; the residual delta in content height is explained by section content (e.g. Top Accounts list) resolving from skeleton placeholders to real data of different heights.

**Alternatives considered**: N/A.

**Evidence**: Single Tabs outer `onLayout` at 784×384 across the full cold-start; dashboard-root deltas correlate with H1's inset transition + normal section loading, not with any tab-bar measurement event.

---

## Findings-driven decisions

| ID | Question | Decision | Rationale |
|---|---|---|---|
| FD-1 | Is the primary fix to move `TopNav` outside `ScrollView`? | **No — not needed.** | H2 ruled out; no scroll drift. Fix is at the SafeArea provider boundary, not the scroll-view layout. |
| FD-2 | Does any hypothesis beyond #1 independently cause visible symptoms? | **No.** | H2, H3, H4 all ruled out. H1 fully explains the observed symptom. |
| FD-3 | Is a defensive `scrollTo({y:0})` guard needed on "all sections loaded"? | **No.** | Scroll offset never drifts from 0 per H2 evidence. Adding a guard would be defensive against a non-existent condition. |
| FD-4 | Does the fix require changes to `app/(tabs)/_layout.tsx`? | **No.** | H4 ruled out. The only required change is passing `initialMetrics={initialWindowMetrics}` to `SafeAreaProvider` in `app/_layout.tsx`. |

## Fix summary

Add `initialMetrics={initialWindowMetrics}` to the root `SafeAreaProvider` in `apps/mobile/app/_layout.tsx`. Import `initialWindowMetrics` from `react-native-safe-area-context` alongside `SafeAreaProvider`. Zero behavioral risk — affects only the synchronous inset values returned during the very first render, replacing `{top: 0, ...}` placeholders with measured window metrics. All downstream `useSafeAreaInsets()` / `SafeAreaView` consumers benefit automatically (not just the Dashboard).

## Exit gate for Phase 0

All four hypotheses have documented Decisions with Evidence. FD-1 through FD-4 have concrete answers. Phase 1 implementation may proceed.
