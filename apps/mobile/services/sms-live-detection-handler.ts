/**
 * SMS Live Detection Handler
 *
 * Shared orchestrator used by both Tier 1 (JS-level listener) and
 * Tier 2 (Headless JS from BroadcastReceiver) to process detected
 * financial SMS transactions.
 *
 * Flow: parse result → resolve account → check preference → notify or save
 *
 * Architecture & Design Rationale:
 * - Pattern: Mediator (coordinates notification, resolution, and save)
 * - Why: Single entry point for all detected SMS regardless of source.
 *   Both tiers share identical business logic.
 * - SOLID: SRP — orchestration only. Delegates to specialized services
 *   for resolution, notification, and persistence.
 *
 * @module sms-live-detection-handler
 */

import type { ParsedSmsTransaction } from "@astik/logic";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ACTION_CONFIRM,
  registerNotificationActionHandler,
  showTransactionNotification,
} from "./notification-service";
import { resolveAccountForSms } from "./sms-account-resolver";
import { createTransaction } from "./transaction-service";
import { createSmsAtmTransfer } from "./transfer-service";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** AsyncStorage key for the auto-confirm preference */
const AUTO_CONFIRM_KEY = "@astik/sms_auto_confirm";

/** AsyncStorage key for the live detection enabled preference */
const LIVE_DETECTION_KEY = "@astik/sms_live_detection_enabled";

// ---------------------------------------------------------------------------
// T046: Review page conflict — queue management
// ---------------------------------------------------------------------------

/**
 * When the user is on the SMS review page, incoming transactions are
 * queued here instead of triggering notifications.
 */
let reviewingActive = false;
const transactionQueue: ParsedSmsTransaction[] = [];

// ---------------------------------------------------------------------------
// Preference helpers
// ---------------------------------------------------------------------------

/**
 * Check whether auto-confirm is enabled.
 * Defaults to false (ask me each time).
 */
export async function isAutoConfirmEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(AUTO_CONFIRM_KEY);
  return value === "true";
}

/**
 * Set the auto-confirm preference.
 */
export async function setAutoConfirm(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_CONFIRM_KEY, String(enabled));
}

/**
 * Check whether live SMS detection is enabled.
 * Defaults to false (opt-in).
 */
export async function isLiveDetectionEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(LIVE_DETECTION_KEY);
  return value === "true";
}

/**
 * Set the live detection enabled preference.
 */
export async function setLiveDetectionEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(LIVE_DETECTION_KEY, String(enabled));
}

// ---------------------------------------------------------------------------
// Transaction saving
// ---------------------------------------------------------------------------

/**
 * Save a detected SMS transaction to the database.
 */
async function saveDetectedTransaction(
  parsed: ParsedSmsTransaction,
  accountId: string
): Promise<void> {
  // ATM withdrawals: route as bank → cash transfer
  if (parsed.isAtmWithdrawal) {
    const result = await createSmsAtmTransfer({
      bankAccountId: accountId,
      amount: parsed.amount,
      currency: parsed.currency,
      date: parsed.date,
      smsBodyHash: parsed.smsBodyHash,
      senderDisplayName: parsed.senderDisplayName,
    });

    if (!result.success) {
      throw new Error(
        `[sms-detection] ATM transfer failed: ${result.error ?? "unknown error"}`
      );
    }

    console.info(
      `[sms-detection] Saved ATM transfer: ${parsed.amount} ${parsed.currency}`
    );
    return;
  }

  // Regular transactions
  await createTransaction({
    amount: parsed.amount,
    currency: parsed.currency,
    categoryId: parsed.categoryId,
    counterparty: parsed.counterparty || undefined,
    accountId,
    note: `[SMS] ${parsed.merchant ?? parsed.senderDisplayName}`,
    type: parsed.type,
    date: parsed.date,
    source: "SMS",
  });

  console.log(
    `[sms-detection] Saved transaction: ${parsed.type} ${parsed.amount} ${parsed.currency}`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Handle a detected financial SMS transaction.
 *
 * Called from both the Tier 1 JS listener and Tier 2 Headless JS task.
 *
 * Flow:
 * 1. Resolve target account via bank_details chain
 * 2. Check auto-confirm preference
 * 3. Auto-confirm → save directly
 * 4. Ask me → show notification with Confirm/Discard actions
 * 5. If no account resolved → show notification asking to configure
 *
 * @param parsed - The AI-parsed SMS transaction
 */
export async function handleDetectedSms(
  parsed: ParsedSmsTransaction
): Promise<void> {
  // T046: Queue if the user is on the review page
  if (reviewingActive) {
    transactionQueue.push(parsed);
    console.log(
      `[sms-detection] Queued transaction (review active): ${parsed.type} ${parsed.amount}`
    );
    return;
  }

  try {
    // Step 1: Resolve account using senderDisplayName + rawSmsBody
    const resolved = await resolveAccountForSms(
      parsed.senderDisplayName,
      parsed.rawSmsBody,
      parsed.currency
    );

    if (!resolved) {
      // No account configured — show notification asking to set up
      console.warn(
        "[sms-detection] No account resolved for SMS — prompting user"
      );
      await showTransactionNotification(parsed, "", "No Account Configured");
      return;
    }

    // Step 2: Check preference
    const autoConfirm = await isAutoConfirmEnabled();

    if (autoConfirm) {
      // Step 3: Auto-confirm — save directly
      await saveDetectedTransaction(parsed, resolved.accountId);
    } else {
      // Step 4: Ask me — show notification
      await showTransactionNotification(
        parsed,
        resolved.accountId,
        resolved.accountName
      );
    }
  } catch (err) {
    console.error(
      "[sms-detection] Failed to handle detected SMS:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Initialize the notification action handler for Confirm/Discard responses.
 *
 * Must be called once at app startup. When the user taps "Confirm" on a
 * transaction notification, the transaction is saved to the database.
 * "Discard" simply dismisses the notification (no-op).
 *
 * @returns Cleanup function to unsubscribe
 */
export function initializeDetectionActionHandler(): () => void {
  return registerNotificationActionHandler(async (actionId, payload) => {
    if (actionId === ACTION_CONFIRM && payload.resolvedAccountId) {
      await saveDetectedTransaction(
        payload.transactionData,
        payload.resolvedAccountId
      );
    }
    // ACTION_DISCARD is a no-op — notification is auto-dismissed
  });
}

// ---------------------------------------------------------------------------
// T046: Review page conflict — public API
// ---------------------------------------------------------------------------

/**
 * Mark the review page as active / inactive.
 * While active, incoming live-detected transactions are queued
 * instead of triggering notifications.
 *
 * Call with `true` on review page mount, `false` on unmount.
 */
export function setReviewingActive(active: boolean): void {
  reviewingActive = active;
}

/**
 * Process any transactions that were queued while the review page
 * was active. Call this after the review page is dismissed.
 *
 * @returns The number of transactions that were flushed
 */
export async function flushQueuedTransactions(): Promise<number> {
  if (transactionQueue.length === 0) {
    return 0;
  }

  const queued = transactionQueue.splice(0);
  console.log(`[sms-detection] Flushing ${queued.length} queued transactions`);

  for (const parsed of queued) {
    await handleDetectedSms(parsed);
  }

  return queued.length;
}
