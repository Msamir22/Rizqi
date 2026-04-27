/**
 * useDismissOnBack
 *
 * Small focus-scoped hook that wires Android's hardware back button to a
 * dismiss callback, but only while some `visible` flag is true. Used by
 * first-run tooltips where pressing back should close the tooltip rather
 * than navigate away from the screen.
 *
 * Architecture: SRP — one concern, one hook. Keeps tooltip components free
 * of repeated `BackHandler` + `useFocusEffect` boilerplate.
 *
 * iOS is a no-op — `BackHandler` never fires there; the hook still runs
 * safely because listener registration resolves to a no-op subscription.
 */

import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * Register a hardware-back handler that dismisses when `visible` is `true`.
 *
 * - Scoped to screen focus via `useFocusEffect` so the listener never leaks.
 * - When `visible === false`, the listener is not installed — back navigates
 *   normally.
 * - The handler swallows the event (`return true`) so the system default
 *   (pop screen / exit app) is not triggered.
 */
export function useDismissOnBack(
  visible: boolean,
  onDismiss: () => void
): void {
  useFocusEffect(
    useCallback(() => {
      if (!visible) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          onDismiss();
          return true;
        }
      );
      return (): void => subscription.remove();
    }, [visible, onDismiss])
  );
}
