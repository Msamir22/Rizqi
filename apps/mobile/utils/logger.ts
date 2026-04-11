/**
 * Structured Logger — Sentry wrapper for production logging.
 *
 * Replaces raw `console.log/error/warn` calls with structured logging
 * that routes to Sentry in production and console in development.
 *
 * Usage:
 *   import { logger } from "@/utils/logger";
 *   logger.error("Payment failed", error, { paymentId: "abc" });
 *   logger.info("Transaction created", { amount: 100, currency: "EGP" });
 *   logger.warn("Rate missing for pair", { from: "EGP", to: "SAR" });
 *
 * @module logger
 */

import * as Sentry from "@sentry/react-native";

// =============================================================================
// Types
// =============================================================================

type LogContext = Record<string, unknown>;

interface Logger {
  /** Log an error with optional context. Captured by Sentry as an exception. */
  error: (message: string, error?: unknown, context?: LogContext) => void;
  /** Log a warning. Sent to Sentry as a breadcrumb with "warning" level. */
  warn: (message: string, context?: LogContext) => void;
  /** Log an info message. Sent to Sentry as a breadcrumb with "info" level. */
  info: (message: string, context?: LogContext) => void;
  /** Log a debug message. Only logged to console in development. */
  debug: (message: string, context?: LogContext) => void;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Structured logger that routes to Sentry in production and console in dev.
 *
 * - `error()` → Sentry.captureException (appears in Sentry Issues dashboard)
 * - `warn()`  → Sentry.addBreadcrumb (attached to next exception)
 * - `info()`  → Sentry.addBreadcrumb (attached to next exception)
 * - `debug()` → console only (never sent to Sentry)
 */
export const logger: Logger = {
  error(message: string, error?: unknown, context?: LogContext): void {
    if (__DEV__) {
      console.error(`[ERROR] ${message}`, error, context);
      return;
    }

    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext("errorContext", context);
      }

      if (error instanceof Error) {
        scope.setExtras({ message, ...(context ?? {}) });
        Sentry.captureException(error);
      } else {
        scope.setExtras({ originalError: error, ...(context ?? {}) });
        Sentry.captureMessage(message, "error");
      }
    });
  },

  warn(message: string, context?: LogContext): void {
    if (__DEV__) {
      console.warn(`[WARN] ${message}`, context);
      return;
    }

    Sentry.addBreadcrumb({
      category: "app",
      message,
      level: "warning",
      data: context,
    });
  },

  info(message: string, context?: LogContext): void {
    if (__DEV__) {
      console.log(`[INFO] ${message}`, context);
      return;
    }

    Sentry.addBreadcrumb({
      category: "app",
      message,
      level: "info",
      data: context,
    });
  },

  debug(message: string, context?: LogContext): void {
    if (__DEV__) {
      console.log(`[DEBUG] ${message}`, context);
    }
    // Never sent to Sentry — dev-only
  },
};
