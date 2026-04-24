/**
 * AnchoredTooltip Component
 *
 * A generic first-run tooltip that shows a dimmed backdrop over the screen
 * with a tooltip card positioned relative to an anchor element, plus an
 * arrow pointing at the anchor.
 *
 * Architecture & Design Rationale:
 * - Uses absolute-positioned overlay instead of React Native Modal
 *   to avoid the Android layout collapse bug with NativeWind v4.
 * - Pattern: Absolute Overlay (see .claude/rules/android-modal-overlay-pattern.md)
 * - SOLID: SRP -- positions and renders a single anchored tooltip.
 *
 * @module AnchoredTooltip
 */

import React, { useCallback, useEffect, useState } from "react";
import {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  /** Optional icon rendered above the title */
  readonly icon?: React.ReactNode;
  /** Whether the tooltip appears above or below the anchor. Default: "above" */
  readonly anchorSide?: "above" | "below";
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
  primaryButton: {
    backgroundColor: palette.nileGreen[600],
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 14,
  },
  primaryButtonLabel: {
    color: palette.slate[25],
    fontSize: 14,
    fontWeight: "700",
  },
  titleTextLight: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.slate[800],
    marginBottom: 6,
    paddingRight: 28,
  },
  titleTextDark: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.slate[25],
    marginBottom: 6,
    paddingRight: 28,
  },
  bodyTextLight: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.slate[500],
  },
  bodyTextDark: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.slate[400],
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute horizontal card position centered on anchor, clamped within screen.
 */
function computeCardLeft(anchorCenterX: number, screenWidth: number): number {
  const rawLeft = anchorCenterX - CARD_MAX_WIDTH / 2;
  const minLeft = CARD_MIN_MARGIN;
  const maxLeft = screenWidth - CARD_MAX_WIDTH - CARD_MIN_MARGIN;
  return Math.max(minLeft, Math.min(rawLeft, maxLeft));
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
            }
            // else: anchor never stabilized — render null via the
            // `!anchorMetrics` guard below.
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
  const anchorCenterX = anchorMetrics.x + anchorMetrics.width / 2;
  const cardLeft = computeCardLeft(anchorCenterX, screenWidth);
  const arrowLeft = anchorCenterX - ARROW_SIZE;

  // For "above": card bottom edge = anchor.y - VERTICAL_GAP
  //   => card top = anchor.y - VERTICAL_GAP - cardHeight
  // For "below": card top = anchor.y + anchor.height + VERTICAL_GAP
  const isAbove = anchorSide === "above";
  const cardTop = isAbove
    ? anchorMetrics.y - VERTICAL_GAP - cardHeight
    : anchorMetrics.y + anchorMetrics.height + VERTICAL_GAP;

  // Arrow sits between card and anchor
  const arrowTop = isAbove
    ? anchorMetrics.y - VERTICAL_GAP - ARROW_SIZE // arrow points down toward anchor
    : anchorMetrics.y + anchorMetrics.height + VERTICAL_GAP - ARROW_SIZE; // arrow points up toward anchor

  const arrowColor = isDark ? palette.slate[800] : palette.slate[25];

  // Don't render the card positioned above until we know its height,
  // otherwise it would flash at y=0.
  if (isAbove && cardHeight === 0) {
    // Render card offscreen to measure it
    return (
      <View style={styles.overlay} pointerEvents="none">
        <View
          style={[
            isDark ? styles.cardDark : styles.cardLight,
            { left: -9999, top: -9999 },
          ]}
          onLayout={handleCardLayout}
        >
          {icon ? <View style={{ marginBottom: 8 }}>{icon}</View> : null}
          <Text style={isDark ? styles.titleTextDark : styles.titleTextLight}>
            {title}
          </Text>
          <Text style={isDark ? styles.bodyTextDark : styles.bodyTextLight}>
            {body}
          </Text>
          <TouchableOpacity activeOpacity={0.7} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>{primaryLabel}</Text>
          </TouchableOpacity>
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

      {/* Arrow -- triangle pointing at the anchor */}
      <View
        style={[
          styles.arrow,
          { left: arrowLeft, top: arrowTop },
          isAbove
            ? { borderTopWidth: ARROW_SIZE, borderTopColor: arrowColor }
            : { borderBottomWidth: ARROW_SIZE, borderBottomColor: arrowColor },
        ]}
      />

      {/* Tooltip card */}
      <View
        style={[
          isDark ? styles.cardDark : styles.cardLight,
          { left: cardLeft, top: cardTop },
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

        {/* Optional icon */}
        {icon ? <View style={{ marginBottom: 8 }}>{icon}</View> : null}

        {/* Title */}
        <Text style={isDark ? styles.titleTextDark : styles.titleTextLight}>
          {title}
        </Text>

        {/* Body */}
        <Text style={isDark ? styles.bodyTextDark : styles.bodyTextLight}>
          {body}
        </Text>

        {/* Primary button */}
        <TouchableOpacity
          onPress={onPrimaryPress}
          activeOpacity={0.7}
          style={styles.primaryButton}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          <Text style={styles.primaryButtonLabel}>{primaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
