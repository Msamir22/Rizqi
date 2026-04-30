/**
 * Haptics helpers
 *
 * Wraps `expo-haptics` calls so that we never let a haptic-feedback failure
 * propagate, while still emitting a structured warn breadcrumb to Sentry that
 * preserves the call site (via the required `tag`).
 *
 * @module haptics
 */

import * as Haptics from "expo-haptics";

import { logger } from "./logger";

/**
 * Trigger a notification haptic and swallow any failure, logging it as a
 * tagged warn breadcrumb (so Sentry can distinguish call sites).
 */
export function safeNotificationHaptic(
  type: Haptics.NotificationFeedbackType,
  tag: string
): void {
  Haptics.notificationAsync(type).catch((err: unknown) => {
    logger.warn(`${tag}_haptics_failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
