/**
 * AnchoredTooltip Component
 *
 * A first-run tooltip that shows a dimmed backdrop over the screen with a
 * tooltip card positioned relative to an anchor element, plus a small
 * tail (arrow) pointing at the anchor.
 *
 * ## Layouts
 *
 * Two layouts are supported, picked via the `layout` prop:
 *
 *   - `"centered"` — used by `MicButtonTooltip` per mockup
 *     `06-tooltip-mic-button.png`. The icon is centered as a block above
 *     the title, title and body are center-aligned, and the primary
 *     action sits centered at the bottom. An optional `X` close affordance
 *     renders at the top-trailing corner.
 *
 *   - `"inline-icon"` — used by `CashAccountTooltip` per mockup
 *     `05-tooltip-cash-account.png`. The icon sits to the leading edge
 *     of the title (inline row), the body wraps full-width below, and
 *     the primary action sits at the bottom-trailing corner as a text
 *     button.
 *
 * ## Tail alignment
 *
 * The tail (small triangle pointing at the anchor) can be either:
 *   - `"center"` (default): tip aligns with the anchor's horizontal
 *     center; card centered horizontally on the anchor.
 *   - `"start"`: tip sits near the card's leading bottom corner; card
 *     aligned so its leading edge is near the anchor's leading edge.
 *     Used for the cash-account tooltip so the bubble visibly "speaks
 *     from" the cash card directly below it.
 *
 * ## Why StyleSheet, not className
 *
 * The overlay + card live inside an absolute-positioned overlay (not a
 * `<Modal>`) per `.claude/rules/android-modal-overlay-pattern.md`. We
 * keep all styles in `StyleSheet.create` to avoid the NativeWind v4
 * race-condition that strips styles intermittently inside overlay
 * subtrees on Android.
 *
 * @module AnchoredTooltip
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  I18nManager,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { logger } from "@/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnchoredTooltipLayout = "centered" | "inline-icon";
export type AnchoredTooltipTailAlign = "center" | "start";

interface AnchoredTooltipProps {
  /** Whether the tooltip is currently visible */
  readonly visible: boolean;
  /**
   * Ref to the anchor View the tooltip points at.
   *
   * Typed as `RefObject<View | null>` so that callers using React 19's
   * updated `useRef<View>(null)` signature (which returns
   * `RefObject<View | null>`) can pass the ref directly without a cast.
   * Under `.measureInWindow(...)` we already null-check before reading.
   */
  readonly anchorRef: React.RefObject<View | null>;
  /** Tooltip title text */
  readonly title: string;
  /** Tooltip body text */
  readonly body: string;
  /** Label for the primary action button */
  readonly primaryLabel: string;
  /** Callback when primary button is pressed */
  readonly onPrimaryPress: () => void;
  /** Callback when backdrop or close X is pressed. If omitted, only the primary button dismisses */
  readonly onClose?: () => void;
  /** Localized accessibility label for the close-X button. Required when onClose is set. */
  readonly closeAccessibilityLabel?: string;
  /** Optional icon rendered above (centered) or beside (inline-icon) the title */
  readonly icon?: React.ReactNode;
  /** Whether the tooltip appears above or below the anchor. Default: "above" */
  readonly anchorSide?: "above" | "below";
  /** Layout variant — see module docstring. Default: "centered". */
  readonly layout?: AnchoredTooltipLayout;
  /** Tail alignment — see module docstring. Default: "center". */
  readonly tailAlign?: AnchoredTooltipTailAlign;
  /**
   * Color of the primary button label. Defaults to dark slate on light
   * mode and light slate on dark mode (a regular text-button color).
   * Pass `palette.nileGreen[600]` for the mic-tooltip's "Try it now"
   * green text style per mockup.
   */
  readonly primaryButtonColor?: string;
  /**
   * Override the card's fixed width. When omitted, the card uses
   * `CARD_MAX_WIDTH` as a max (content-driven width, capped at 280).
   * When provided, the card's width is fixed at this value — used by
   * the cash-account tooltip to match the mockup's wide bubble that
   * spans nearly the full accounts row on first-run (when the cash
   * card is the only account).
   */
  readonly cardWidth?: number;
}

interface AnchorMetrics {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARROW_SIZE = 10;
const CARD_PADDING = 16;
const CARD_BORDER_RADIUS = 14;
const CARD_MAX_WIDTH = 280;
const CARD_MIN_MARGIN = 16;
const VERTICAL_GAP = 12;
/**
 * Horizontal inset of the tail's tip from the card's leading bottom
 * corner when `tailAlign === "start"`. Picked so the tail sits clearly
 * away from the rounded corner (`CARD_BORDER_RADIUS = 14`) and reads as
 * an intentional speech-bubble tail rather than a tooltip glitch.
 */
const TAIL_CORNER_INSET = 28;
/** Dim-backdrop opacity over the rest of the screen. */
const BACKDROP_OPACITY = 0.3;
/** `rgba(...)` literal used by StyleSheet — keep in sync with BACKDROP_OPACITY. */
const BACKDROP_COLOR = `rgba(0, 0, 0, ${BACKDROP_OPACITY})`;

// ---------------------------------------------------------------------------
// Styles -- StyleSheet for ALL overlay/backdrop/arrow to avoid NativeWind
// interference inside the absolute overlay on Android
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP_COLOR,
  },
  cardLight: {
    position: "absolute",
    backgroundColor: palette.slate[25],
    borderRadius: CARD_BORDER_RADIUS,
    padding: CARD_PADDING,
    maxWidth: CARD_MAX_WIDTH,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardDark: {
    position: "absolute",
    backgroundColor: palette.slate[800],
    borderRadius: CARD_BORDER_RADIUS,
    padding: CARD_PADDING,
    maxWidth: CARD_MAX_WIDTH,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  arrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  // Layouts ----------------------------------------------------------------
  inlineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  centeredIconWrapper: {
    alignSelf: "center",
    marginBottom: 10,
  },
  // Title/body — color set inline so it tracks `isDark`
  titleCentered: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  titleInline: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  bodyCentered: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  bodyInline: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  // Primary button
  primaryButtonCentered: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  primaryButtonInline: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 10,
  },
  primaryButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CardPositionInputs {
  readonly anchor: AnchorMetrics;
  readonly screenWidth: number;
  readonly tailAlign: AnchoredTooltipTailAlign;
  /** Effective horizontal width the card will render at. */
  readonly effectiveCardWidth: number;
}

interface CardPosition {
  /** `left` style value for the card. */
  readonly cardLeft: number;
  /** `left` style value for the arrow's bounding box. */
  readonly arrowLeft: number;
}

/**
 * Compute horizontal positions for the card AND the tail tip.
 *
 * For `tailAlign === "center"`: card is centered on the anchor (clamped
 * to screen edges), tail tip is at the anchor's center.
 *
 * For `tailAlign === "start"`: the tail TIP is placed at the anchor's
 * horizontal CENTER (so the speech-bubble visibly "speaks from" the
 * anchor), and the card is positioned so the tail sits near one of its
 * bottom corners. The corner is auto-picked based on which half of the
 * screen the anchor lives in:
 *
 *   - Anchor in LEFT half → tail at the card's bottom-LEFT corner; the
 *     card extends rightward off the tail.
 *   - Anchor in RIGHT half → tail at the card's bottom-RIGHT corner;
 *     the card extends leftward off the tail.
 *
 * This adapts to whatever order the consumer's parent renders its
 * children in. Initially we always put the tail on the LEFT, but the
 * cash account's position depends on the accounts list ordering (which
 * sorts by balance in this app), so cash sometimes lands on the right
 * side of the screen — making a fixed-left tail point at the WRONG
 * sibling card (user-reported 2026-04-26).
 *
 * NOTE: this code intentionally works in raw window coords (LTR space).
 * RTL flipping is handled higher up by writing `right:` instead of
 * `left:` when `I18nManager.isRTL` is true, which the auto-swap then
 * unwinds back to the right window-coord X.
 */
function computeCardPosition({
  anchor,
  screenWidth,
  tailAlign,
  effectiveCardWidth,
}: CardPositionInputs): CardPosition {
  const minLeft = CARD_MIN_MARGIN;
  const maxLeft = screenWidth - effectiveCardWidth - CARD_MIN_MARGIN;
  const clamp = (value: number): number =>
    Math.max(minLeft, Math.min(value, maxLeft));

  if (tailAlign === "start") {
    // Tail tip at the anchor's CENTER (in window coords).
    const tailTipX = anchor.x + anchor.width / 2;

    // Auto-pick which bottom corner the tail attaches to, based on the
    // anchor's position. Anchor in left half → tail on the LEFT corner
    // and card extends rightward; anchor in right half → tail on the
    // RIGHT corner and card extends leftward.
    const screenCenterX = screenWidth / 2;
    const anchorOnRight = tailTipX > screenCenterX;
    const desiredLeft = anchorOnRight
      ? tailTipX + TAIL_CORNER_INSET - effectiveCardWidth
      : tailTipX - TAIL_CORNER_INSET;
    const cardLeft = clamp(desiredLeft);

    // Arrow's bounding box is `2 * ARROW_SIZE` wide; the visible tip
    // sits at its horizontal center. So placing the bbox at
    // `tailTipX - ARROW_SIZE` lands the tip exactly at `tailTipX`.
    const arrowLeft = tailTipX - ARROW_SIZE;
    return { cardLeft, arrowLeft };
  }

  // Default: center on anchor.
  const anchorCenterX = anchor.x + anchor.width / 2;
  const cardLeft = clamp(anchorCenterX - effectiveCardWidth / 2);
  const arrowLeft = anchorCenterX - ARROW_SIZE;
  return { cardLeft, arrowLeft };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A first-run tooltip anchored to a specific element with a dimmed backdrop.
 *
 * Usage:
 * ```tsx
 * // See CashAccountTooltip.tsx and MicButtonTooltip.tsx for real usage.
 * // All user-facing strings (title/body/primaryLabel) MUST come from i18n;
 * // passing literal English is never correct in production code.
 * ```
 */
export function AnchoredTooltip({
  visible,
  anchorRef,
  title,
  body,
  primaryLabel,
  onPrimaryPress,
  onClose,
  closeAccessibilityLabel,
  icon,
  anchorSide = "above",
  layout = "centered",
  tailAlign = "center",
  primaryButtonColor,
  cardWidth,
}: AnchoredTooltipProps): React.JSX.Element | null {
  const { isDark } = useTheme();
  const [anchorMetrics, setAnchorMetrics] = useState<AnchorMetrics | null>(
    null
  );
  const [cardHeight, setCardHeight] = useState<number>(0);

  // Use `useWindowDimensions` (not `Dimensions.get("window")`) so the tooltip
  // re-positions correctly on orientation changes, split-screen size changes,
  // and keyboard-open layout shifts.
  const { width: screenWidth } = useWindowDimensions();

  // Measure anchor when the tooltip becomes visible.
  //
  // `.measureInWindow` may not have correct layout on the first frame (the
  // anchor's `onLayout` hasn't fired yet). We defer the measurement to the
  // next animation frame, which is RN's idiomatic "wait one frame" hook and
  // avoids the flake of an arbitrary `setTimeout(..., 50)` on slow devices.
  useEffect(() => {
    if (!visible) {
      setAnchorMetrics(null);
      return;
    }

    // A single rAF can still fire before the anchor has committed its layout
    // (e.g. the dashboard is still settling when `isFirstRunPending` flips).
    // If `measureInWindow` returns 0×0, retry on the next frame up to
    // `MAX_ATTEMPTS` times before giving up. Giving up is safe — the
    // tooltip renders null, so the user just does not see it (graceful
    // degradation); a hard crash on absent metrics would be worse.
    const MAX_ATTEMPTS = 5;
    let cancelled = false;
    let rafHandle = 0;
    let attempts = 0;

    const attemptMeasure = (): void => {
      if (cancelled) return;
      attempts += 1;
      rafHandle = requestAnimationFrame(() => {
        if (cancelled) return;
        anchorRef.current?.measureInWindow(
          (x: number, y: number, width: number, height: number) => {
            if (cancelled) return;
            if (width > 0 && height > 0) {
              setAnchorMetrics({ x, y, width, height });
              return;
            }
            if (attempts < MAX_ATTEMPTS) {
              attemptMeasure();
              return;
            }
            // Anchor never stabilized after MAX_ATTEMPTS frames. We
            // render null via the `!anchorMetrics` guard below
            // (graceful degradation — better to skip the tooltip than
            // crash). Log a warning so silent first-run breakage is
            // observable in telemetry / Sentry rather than disappearing
            // (round-2 review #14).
            logger.warn("anchoredTooltip.measure.timeout", {
              attempts,
              measuredWidth: width,
              measuredHeight: height,
            });
          }
        );
      });
    };

    attemptMeasure();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafHandle);
      setAnchorMetrics(null);
    };
  }, [visible, anchorRef]);

  const handleCardLayout = useCallback((event: LayoutChangeEvent): void => {
    setCardHeight(event.nativeEvent.layout.height);
  }, []);

  const handleBackdropPress = useCallback((): void => {
    onClose?.();
  }, [onClose]);

  if (!visible || !anchorMetrics) {
    return null;
  }

  // --- Positioning ---
  // Effective card width: caller-provided override OR fall back to the
  // standard max width, then clamped down to "screen width minus
  // margins" so the card never overflows the viewport even on very
  // narrow screens (round-1 review M3: `computeCardLeft` inverts when
  // `screenWidth < CARD_MAX_WIDTH + 2 * CARD_MIN_MARGIN`). We don't
  // upscale a smaller `cardWidth` request to fill the screen — only
  // clamp DOWN.
  const screenAvailable = Math.max(0, screenWidth - CARD_MIN_MARGIN * 2);
  const effectiveCardWidth = Math.min(
    cardWidth ?? CARD_MAX_WIDTH,
    screenAvailable
  );

  const { cardLeft, arrowLeft } = computeCardPosition({
    anchor: anchorMetrics,
    screenWidth,
    tailAlign,
    effectiveCardWidth,
  });

  // RTL handling.
  //
  // `cardLeft` and `arrowLeft` above are computed in window coords
  // (LTR space — measureInWindow always returns LTR-origin coords).
  // RN's `I18nManager.swapLeftAndRightInRTL` defaults to `true`, which
  // auto-swaps any `left: V` to `right: V` at render time when the
  // layout direction is RTL. That makes the tooltip land on the
  // OPPOSITE side of the screen from the anchor — for the
  // cash-account tooltip, the tail ended up pointing at the SAVINGS
  // card instead of CASH (user-reported 2026-04-26).
  //
  // Fix: in RTL, write the position using the `right` property. The
  // auto-swap converts `right: V` back to `left: V` at render time, so
  // the card lands at the same window-coord X we computed.
  const horizontalStyle = I18nManager.isRTL
    ? { right: cardLeft }
    : { left: cardLeft };
  const arrowHorizontalStyle = I18nManager.isRTL
    ? { right: arrowLeft }
    : { left: arrowLeft };

  // For "above": card bottom edge = anchor.y - VERTICAL_GAP
  //   => card top = anchor.y - VERTICAL_GAP - cardHeight
  // For "below": card top = anchor.y + anchor.height + VERTICAL_GAP
  const isAbove = anchorSide === "above";
  const cardTop = isAbove
    ? anchorMetrics.y - VERTICAL_GAP - cardHeight
    : anchorMetrics.y + anchorMetrics.height + VERTICAL_GAP;
  const cardBottom = cardTop + cardHeight;

  // Tail (arrow) position.
  //
  // Previously this was buggy — the arrow's bounding box ended up
  // INSIDE the card region, so it got drawn under the card and was
  // never visible. We now anchor the arrow's BOUNDING TOP at the
  // card's bottom edge so the tail sits cleanly in the gap between the
  // card and the anchor. The CSS-triangle shape (a colored top border
  // with transparent left+right borders) makes the visible tip point
  // toward the anchor.
  const arrowTop = isAbove
    ? cardBottom - 1 // -1px overlap with card, so the colored triangle visually merges with the card surface
    : cardTop - ARROW_SIZE + 1;

  const arrowColor = isDark ? palette.slate[800] : palette.slate[25];

  // Color tokens used by the layout-specific render paths.
  const titleColor = isDark ? palette.slate[25] : palette.slate[800];
  const bodyColor = isDark ? palette.slate[400] : palette.slate[500];
  const defaultButtonColor = isDark ? palette.slate[200] : palette.slate[800];
  const buttonLabelColor = primaryButtonColor ?? defaultButtonColor;

  // Renders the inside of the card. Two layouts; both share text +
  // button colors so theme consistency is preserved.
  const renderCardBody = (): React.ReactNode => {
    if (layout === "inline-icon") {
      return (
        <>
          <View style={styles.inlineHeaderRow}>
            {icon}
            <Text style={[styles.titleInline, { color: titleColor }]}>
              {title}
            </Text>
          </View>
          <Text style={[styles.bodyInline, { color: bodyColor }]}>{body}</Text>
          <TouchableOpacity
            onPress={onPrimaryPress}
            activeOpacity={0.7}
            style={styles.primaryButtonInline}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
          >
            <Text
              style={[styles.primaryButtonLabel, { color: buttonLabelColor }]}
            >
              {primaryLabel}
            </Text>
          </TouchableOpacity>
        </>
      );
    }

    // "centered" layout — used by mic tooltip per mockup 06.
    return (
      <>
        {icon ? <View style={styles.centeredIconWrapper}>{icon}</View> : null}
        <Text style={[styles.titleCentered, { color: titleColor }]}>
          {title}
        </Text>
        <Text style={[styles.bodyCentered, { color: bodyColor }]}>{body}</Text>
        <TouchableOpacity
          onPress={onPrimaryPress}
          activeOpacity={0.7}
          style={styles.primaryButtonCentered}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          <Text
            style={[styles.primaryButtonLabel, { color: buttonLabelColor }]}
          >
            {primaryLabel}
          </Text>
        </TouchableOpacity>
      </>
    );
  };

  // Don't render the card positioned above until we know its height,
  // otherwise it would flash at y=0.
  if (isAbove && cardHeight === 0) {
    // Render card offscreen to measure it. We pass the same fixed width
    // we'll use on-screen so the measured height is accurate (otherwise
    // the off-screen card may use a content-driven width and produce a
    // different wrap → wrong measured height).
    return (
      <View style={styles.overlay} pointerEvents="none">
        <View
          style={[
            isDark ? styles.cardDark : styles.cardLight,
            { left: -9999, top: -9999, width: effectiveCardWidth },
          ]}
          onLayout={handleCardLayout}
        >
          {renderCardBody()}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Tooltip card — rendered BEFORE the arrow so the arrow's small
          1px overlap visually reads as part of the card surface. */}
      <View
        style={[
          isDark ? styles.cardDark : styles.cardLight,
          horizontalStyle,
          { top: cardTop, width: effectiveCardWidth },
        ]}
        onLayout={isAbove ? undefined : handleCardLayout}
      >
        {/* Close X button */}
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={[
              styles.closeButton,
              {
                backgroundColor: isDark
                  ? palette.slate[700]
                  : palette.slate[100],
              },
            ]}
            accessibilityLabel={closeAccessibilityLabel}
            accessibilityRole="button"
          >
            <Ionicons
              name="close"
              size={16}
              color={isDark ? palette.slate[400] : palette.slate[500]}
            />
          </TouchableOpacity>
        )}

        {renderCardBody()}
      </View>

      {/* Tail (arrow) — small triangle pointing at the anchor. Rendered
          AFTER the card so its colored top edge can overlap the card's
          bottom edge by 1px and visually merge into the card surface. */}
      <View
        style={[
          styles.arrow,
          arrowHorizontalStyle,
          { top: arrowTop },
          isAbove
            ? { borderTopWidth: ARROW_SIZE, borderTopColor: arrowColor }
            : { borderBottomWidth: ARROW_SIZE, borderBottomColor: arrowColor },
        ]}
      />
    </View>
  );
}
