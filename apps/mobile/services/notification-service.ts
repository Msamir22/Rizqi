/**
 * Notification Service
 *
 * Manages expo-notifications lifecycle for SMS transaction detection:
 * - Android notification channel setup
 * - Notification category with Confirm/Discard actions
 * - Show transaction notifications with action buttons
 * - Handle notification responses (action taps)
 *
 * Architecture & Design Rationale:
 * - Pattern: Observer Pattern (event-driven notification responses)
 * - Why: Decouples notification presentation from action handling.
 *   Notification categories define reusable action sets.
 * - SOLID: SRP — only handles notification lifecycle, not parsing or DB.
 *
 * @module notification-service
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { ParsedSmsTransaction } from "@astik/logic";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Android notification channel ID for SMS transactions */
const SMS_CHANNEL_ID = "sms-transactions";

/** Notification category identifier for transaction confirm/discard */
const SMS_TRANSACTION_CATEGORY = "SMS_TRANSACTION";

/** Action identifiers for notification buttons */
const ACTION_CONFIRM = "CONFIRM";
const ACTION_DISCARD = "DISCARD";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload embedded in notification data for handler retrieval */
export interface TransactionNotificationPayload {
  readonly type: "sms_transaction";
  readonly transactionData: ParsedSmsTransaction;
  readonly resolvedAccountId: string;
  readonly resolvedAccountName: string;
}

/** Callback for handling notification action responses */
type NotificationActionHandler = (
  actionId: string,
  payload: TransactionNotificationPayload
) => Promise<void>;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let isInitialized = false;
let actionHandler: NotificationActionHandler | null = null;
let responseSubscription: Notifications.Subscription | null = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the notification service.
 * Sets up the Android channel, notification category with actions,
 * and foreground notification behavior.
 *
 * Must be called once at app startup (from _layout.tsx).
 * Idempotent — safe to call multiple times.
 */
export async function initializeNotifications(): Promise<void> {
  if (isInitialized) {
    return;
  }

  // Configure foreground notification behavior
  Notifications.setNotificationHandler({
    // eslint-disable-next-line @typescript-eslint/require-await -- expo API requires Promise<NotificationBehavior>
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Create Android notification channel (no-op on iOS)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(SMS_CHANNEL_ID, {
      name: "SMS Transactions",
      description: "Notifications for detected financial SMS transactions",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
      sound: "default",
    });
  }

  // Register notification category with Confirm/Discard actions
  await Notifications.setNotificationCategoryAsync(SMS_TRANSACTION_CATEGORY, [
    {
      identifier: ACTION_CONFIRM,
      buttonTitle: "✓ Confirm",
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: ACTION_DISCARD,
      buttonTitle: "✗ Discard",
      options: {
        opensAppToForeground: false,
        isDestructive: true,
      },
    },
  ]);

  isInitialized = true;
}

// ---------------------------------------------------------------------------
// Response Handling
// ---------------------------------------------------------------------------

/**
 * Register a handler for notification action responses.
 * Called when the user taps Confirm or Discard on a transaction notification.
 *
 * @param handler - Async function receiving actionId and transaction payload
 * @returns Cleanup function to unsubscribe
 */
export function registerNotificationActionHandler(
  handler: NotificationActionHandler
): () => void {
  actionHandler = handler;

  // Remove previous subscription if any
  if (responseSubscription) {
    responseSubscription.remove();
  }

  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content
        .data as unknown as TransactionNotificationPayload;

      // Only handle our SMS transaction notifications
      if (data?.type !== "sms_transaction") {
        return;
      }

      // Ignore default tap (no action button pressed)
      if (
        actionId === Notifications.DEFAULT_ACTION_IDENTIFIER ||
        !actionHandler
      ) {
        return;
      }

      actionHandler(actionId, data).catch((err: unknown) => {
        console.error(
          "[notification-service] Action handler failed:",
          err instanceof Error ? err.message : String(err)
        );
      });
    }
  );

  return () => {
    if (responseSubscription) {
      responseSubscription.remove();
      responseSubscription = null;
    }
    actionHandler = null;
  };
}

// ---------------------------------------------------------------------------
// Show Notification
// ---------------------------------------------------------------------------

/**
 * Format a currency amount for display in notification.
 */
function formatAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

/**
 * Show a local notification for a detected SMS transaction.
 *
 * Displays the transaction summary with Confirm/Discard action buttons.
 *
 * @param parsed         - The parsed SMS transaction
 * @param resolvedAccountId   - ID of the resolved target account
 * @param resolvedAccountName - Display name of the resolved account
 */
export async function showTransactionNotification(
  parsed: ParsedSmsTransaction,
  resolvedAccountId: string,
  resolvedAccountName: string
): Promise<void> {
  const isExpense = parsed.type === "EXPENSE";
  const typeEmoji = isExpense ? "💸" : "💰";
  const typeLabel = isExpense ? "Expense" : "Income";

  const title = `${typeEmoji} ${typeLabel} Detected`;
  const body = [
    `${formatAmount(parsed.amount, parsed.currency)} from ${parsed.senderDisplayName}`,
    parsed.counterparty ? `To: ${parsed.counterparty}` : undefined,
    `Account: ${resolvedAccountName}`,
  ]
    .filter(Boolean)
    .join("\n");

  const payload: TransactionNotificationPayload = {
    type: "sms_transaction",
    transactionData: parsed,
    resolvedAccountId,
    resolvedAccountName,
  };

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      categoryIdentifier: SMS_TRANSACTION_CATEGORY,
      data: payload as unknown as Record<string, unknown>,
      sound: "default",
      ...(Platform.OS === "android" && {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        _channelId: SMS_CHANNEL_ID,
      }),
    },
    trigger: null, // Immediate
  });
}

// ---------------------------------------------------------------------------
// Constants re-exports for handler consumers
// ---------------------------------------------------------------------------

export { ACTION_CONFIRM, ACTION_DISCARD };
