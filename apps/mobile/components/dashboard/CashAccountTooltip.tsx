import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { AnchoredTooltip } from "@/components/ui/AnchoredTooltip";
import { palette } from "@/constants/colors";
import { useFirstRunTooltip } from "@/context/FirstRunTooltipContext";
import { useDismissOnBack } from "@/hooks/useDismissOnBack";
import { useOnboardingFlags } from "@/hooks/useOnboardingFlags";
import { setOnboardingFlag } from "@/services/profile-service";
import { logger } from "@/utils/logger";

/**
 * How far below the top of the visible scroll viewport the cash-account
 * card should land after auto-scrolling. Picked so the tooltip card
 * (~200px tall) PLUS the AnchoredTooltip's 12px vertical gap fits above
 * the anchor without clipping the screen top. Tighter values (e.g. 160)
 * make AnchoredTooltip compute cardTop = anchor.y − gap − cardHeight ≈
 * negative, which puts the tooltip off-screen above the cash card and
 * makes it look like a "floating message" disconnected from the card.
 */
const SCROLL_TOP_INSET = 280;
/**
 * Polling interval used while we wait for the cash-account anchor to
 * mount AND lay out. The first effect tick can fire before
 * AccountsSection has rendered its real cards (e.g. while it's still
 * in a loading skeleton state) — measureInWindow returns 0×0 in that
 * window. We retry every frame-ish until success or
 * `MAX_POLL_DURATION_MS` elapses. Tight interval keeps the
 * dashboard-render-to-tooltip-visible delay imperceptible.
 */
const POLL_INTERVAL_MS = 50;
const MAX_POLL_DURATION_MS = 1500;

interface CashAccountTooltipProps {
  /** Ref to the rendered cash-account card for anchor measurement. */
  readonly anchorRef: React.RefObject<View>;
  /**
   * Whether the SMS permission prompt is currently visible. Passed in by the
   * dashboard so both the SMS prompt and this tooltip share a SINGLE
   * `useSmsSync()` state. Instantiating `useSmsSync()` here would produce an
   * independent mutable state and race against the dashboard's prompt on
   * Android.
   */
  readonly isSmsPromptVisible: boolean;
  /**
   * Optional ref to the dashboard's ScrollView so the tooltip can scroll
   * the anchored cash-account card into view before showing. On first run
   * the user lands at the top of the dashboard, but the cash card sits
   * below the OnboardingGuideCard / NetWorth / LiveRates sections — so
   * without this scroll the anchor is OFF-SCREEN, which makes
   * AnchoredTooltip's arrow land below the screen edge and the tooltip
   * card looks like a floating message with no visual connection to
   * what it's describing (user-reported 2026-04-26).
   */
  readonly scrollViewRef?: React.RefObject<ScrollView>;
}

export function CashAccountTooltip({
  anchorRef,
  isSmsPromptVisible,
  scrollViewRef,
}: CashAccountTooltipProps): React.ReactElement | null {
  const { t } = useTranslation("onboarding");
  const { width: screenWidth } = useWindowDimensions();
  const { isFirstRunPending, markFirstRunConsumed } = useFirstRunTooltip();
  const flags = useOnboardingFlags();

  /**
   * Whether the tooltip's preconditions are met. We separate this from
   * `tooltipReady` so we can run the scroll-into-view step in between —
   * `shouldShow` flips true as soon as the conditions are met,
   * `tooltipReady` flips true only after the scroll has settled and the
   * AnchoredTooltip can safely measure the on-screen anchor.
   */
  // Production preconditions for the cash-account first-run tooltip
  // (FR-020):
  //   - `isFirstRunPending`: set by the currency-step right after the
  //     user confirms their preferred currency. False for every
  //     subsequent session and for returning users — so the tooltip
  //     does NOT show outside the first session post-onboarding.
  //   - `!isSmsPromptVisible`: don't compete with the SMS permission
  //     dialog for visual focus on Android.
  //   - `!flags.cash_account_tooltip_dismissed`: any prior dismissal
  //     (in this session or a previous one) suppresses the tooltip
  //     forever — "any dismissal counts as seen forever" per FR-024a.
  const shouldShow =
    isFirstRunPending &&
    !isSmsPromptVisible &&
    !flags.cash_account_tooltip_dismissed;

  const [tooltipReady, setTooltipReady] = useState(false);
  // Local "user has dismissed it in this session" flag. Hides the
  // tooltip immediately when the user taps "Got it" or hardware-back —
  // independent of how `shouldShow` is derived. Without this, dismissing
  // depends on `isFirstRunPending` and `cash_account_tooltip_dismissed`
  // both flipping in the right direction, which is fragile and breaks
  // when those signals are wired differently (dev testing, future
  // refactors). A local dismiss flag is the simplest robust gate.
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  // Reset the local dismiss flag whenever the precondition changes from
  // `false` → `true` again (i.e. the tooltip is re-eligible to appear).
  // Otherwise the local dismiss would persist forever and even a fresh
  // first-run session would never see the tooltip.
  useEffect(() => {
    if (!shouldShow) setLocallyDismissed(false);
  }, [shouldShow]);

  // ------------------------------------------------------------------
  // Two independent effects so the tooltip appears the INSTANT both
  // its precondition (`shouldShow`) and its anchor (`anchorReady`) are
  // ready, without one waiting for the other.
  //
  // Previously this was a single effect gated on `shouldShow` — so if
  // `shouldShow` flipped true late (e.g. while WatermelonDB was still
  // populating `flags.cash_account_tooltip_dismissed` for a returning-
  // user dev-test, or while accounts were still loading on a cold
  // start), the polling didn't start until that moment, and the user
  // saw a multi-second gap between the cash card mounting and the
  // tooltip appearing (user-reported 2026-04-26).
  //
  // Now:
  //   1. `anchorReady` polls from component mount, regardless of
  //      `shouldShow`. The card mount is detected within one poll tick.
  //   2. The "scroll + reveal" effect runs the moment BOTH flags are
  //      true and snaps + shows synchronously on the next frame.
  // ------------------------------------------------------------------

  const [anchorReady, setAnchorReady] = useState(false);

  // Detect when the anchored cash-account card is mounted AND has a
  // non-zero layout. Polls until success or `MAX_POLL_DURATION_MS`.
  useEffect(() => {
    if (anchorReady) return;
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let elapsed = 0;

    const checkAnchor = (): void => {
      if (cancelled || !anchorRef.current) return;
      anchorRef.current.measureInWindow((_x, _y, _w, h) => {
        if (cancelled) return;
        if (h > 0) {
          if (pollInterval !== null) clearInterval(pollInterval);
          setAnchorReady(true);
        }
      });
    };

    // Try immediately — common case is the cash card is already
    // mounted by the time this effect runs.
    checkAnchor();

    pollInterval = setInterval(() => {
      if (cancelled) return;
      elapsed += POLL_INTERVAL_MS;
      if (elapsed >= MAX_POLL_DURATION_MS) {
        // Anchor never produced a non-zero layout in the polling
        // window. Log so a silent-broken tooltip surfaces in
        // telemetry instead of just disappearing into the void.
        logger.warn("cashAccountTooltip.anchorPoll.timeout", {
          elapsedMs: elapsed,
          maxDurationMs: MAX_POLL_DURATION_MS,
          pollIntervalMs: POLL_INTERVAL_MS,
        });
        if (pollInterval !== null) clearInterval(pollInterval);
        return;
      }
      checkAnchor();
    }, POLL_INTERVAL_MS);

    return (): void => {
      cancelled = true;
      if (pollInterval !== null) clearInterval(pollInterval);
    };
  }, [anchorReady, anchorRef]);

  // Scroll the cash card into view and flip `tooltipReady` true. Runs
  // the moment BOTH `shouldShow` and `anchorReady` are true. Anchor is
  // already known to be measurable here, so no polling — we measure
  // once, scroll instantly, then show on the next frame.
  useEffect(() => {
    if (!shouldShow || !anchorReady) {
      setTooltipReady(false);
      return;
    }

    let cancelled = false;
    let rafHandle = 0;

    if (scrollViewRef?.current && anchorRef.current) {
      anchorRef.current.measureInWindow((_x, anchorWindowY, _w, h) => {
        if (cancelled) return;
        if (h > 0) {
          // `animated: false` snaps the scroll instantly so the user
          // never sees a multi-hundred-millisecond animation window
          // during which they could scroll or tap something else.
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, anchorWindowY - SCROLL_TOP_INSET),
            animated: false,
          });
        }
        // Show on the very next frame so the scroll commit flushes
        // before AnchoredTooltip re-measures the anchor.
        rafHandle = requestAnimationFrame(() => {
          if (!cancelled) setTooltipReady(true);
        });
      });
    } else {
      // No scroll ref — show without scrolling (graceful degradation).
      rafHandle = requestAnimationFrame(() => {
        if (!cancelled) setTooltipReady(true);
      });
    }

    return (): void => {
      cancelled = true;
      cancelAnimationFrame(rafHandle);
    };
  }, [shouldShow, anchorReady, anchorRef, scrollViewRef]);

  // Boolean(...) coerces `boolean | undefined` (from
  // `flags.cash_account_tooltip_dismissed`, which is optional) into a
  // strict boolean so `useDismissOnBack(visible, ...)` typechecks.
  const visible = Boolean(shouldShow && tooltipReady && !locallyDismissed);

  const handleDismiss = useCallback((): void => {
    // Hide the tooltip IMMEDIATELY via the local flag — the persistence
    // write is async and the derived `shouldShow` doesn't always flip
    // false on dismiss (depends on how the visibility conditions are
    // wired), so relying on either of those alone leaves the tooltip
    // on screen until the next render cycle / forever in some setups.
    // The local flag gives us a synchronous, robust close path.
    setLocallyDismissed(true);

    // Do NOT skip mark-consumed on write failure — on failure we still
    // want the tooltip to hide and the session to advance, but we log
    // so the issue is visible. The flag persists on success; on
    // failure the sync retry catches it on the next mount.
    const finalize = (): void => {
      markFirstRunConsumed();
    };
    setOnboardingFlag("cash_account_tooltip_dismissed", true)
      .then(finalize)
      .catch((error: unknown) => {
        logger.warn(
          "cashAccountTooltip.dismiss.failed",
          error instanceof Error ? { message: error.message } : undefined
        );
        finalize();
      });
  }, [markFirstRunConsumed]);

  // Android hardware-back while visible → same path as "Got it"
  useDismissOnBack(visible, handleDismiss);

  if (!visible) return null;

  // Per mockup `05-tooltip-cash-account.png`: small green-tinted circle
  // with a sparkles icon, INLINE with the title (icon to the leading
  // edge, title beside it). The "inline-icon" layout in AnchoredTooltip
  // handles the row arrangement; we just supply the icon node here.
  const tooltipIcon = (
    <View className="h-7 w-7 items-center justify-center rounded-full bg-nileGreen-500/15">
      <Ionicons name="sparkles" size={14} color={palette.nileGreen[600]} />
    </View>
  );

  return (
    <AnchoredTooltip
      visible={visible}
      anchorRef={anchorRef}
      title={t("cash_account_tooltip_title")}
      body={t("cash_account_tooltip_body")}
      primaryLabel={t("cash_account_tooltip_got_it")}
      onPrimaryPress={handleDismiss}
      icon={tooltipIcon}
      anchorSide="above"
      layout="inline-icon"
      // First-run case: cash is the ONLY account, so the cash card
      // fills the entire accounts row. Center the tail on the cash
      // card (== screen center) and stretch the tooltip to nearly the
      // full screen width — that way the tail consistently lands above
      // the cash card regardless of locale and the bubble's width
      // matches the mockup `05-tooltip-cash-account.png`.
      tailAlign="center"
      cardWidth={screenWidth - 32}
    />
  );
}
