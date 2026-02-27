/**
 * SMS Live Listener Service
 *
 * Subscribes to native SMS events emitted by SmsEventModule (via the
 * SmsBroadcastReceiver) when the app process is alive. Filters incoming
 * SMS with on-device keyword filter, sends financial candidates to AI
 * for parsing, and notifies registered handlers.
 *
 * Architecture & Design Rationale:
 * - Pattern: Observer Pattern (event subscription with typed handlers)
 * - Why: Decouples SMS reception from processing. Multiple consumers
 *   can subscribe without modifying the listener itself.
 * - SOLID: SRP — only manages the native SMS event subscription.
 *   All parsing and notification logic lives in detection handler.
 * - Change: Replaced RegexSmsParser with keyword filter + AI Edge Function.
 *
 * @module sms-live-listener-service
 */

import {
  type ParsedSmsTransaction,
  computeSmsHash,
  isLikelyFinancialSms,
} from "@astik/logic";
import {
  DeviceEventEmitter,
  type EmitterSubscription,
  Platform,
} from "react-native";
import { parseSmsWithAi, type SmsCandidate } from "./ai-sms-parser-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Callback for detected financial SMS transactions */
type LiveSmsEventHandler = (parsed: ParsedSmsTransaction) => void;

/** SMS data shape emitted by native SmsEventModule */
interface NativeSmsEvent {
  readonly sender: string;
  readonly body: string;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Event name matching SmsEventModule.EVENT_NAME in Kotlin */
const NATIVE_SMS_EVENT = "onSmsReceived";

/** Max recent hashes to track (prevents memory leak) */
const MAX_RECENT_HASHES = 200;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let isListening = false;
let nativeSubscription: EmitterSubscription | null = null;
const handlers = new Set<LiveSmsEventHandler>();

/** Track recently processed hashes to avoid duplicates within a session */
const recentHashes = new Set<string>();

// ---------------------------------------------------------------------------
// Internal processing
// ---------------------------------------------------------------------------

/**
 * Process an incoming SMS event from native:
 * 1. Keyword filter for financial relevance
 * 2. If financial, compute hash for dedup
 * 3. Send to AI Edge Function for parsing
 * 4. Emit to registered handlers
 */
async function processNativeSmsEvent(event: NativeSmsEvent): Promise<void> {
  try {
    // Step 1: Fast on-device keyword filter
    if (!isLikelyFinancialSms(event.body)) {
      return;
    }

    // Step 2: Compute hash for deduplication
    const hash = await computeSmsHash(event.body);

    // Check against recent hashes to avoid duplicate processing
    if (recentHashes.has(hash)) {
      console.log("[sms-live-listener] Duplicate SMS detected, skipping");
      return;
    }

    // Track this hash
    recentHashes.add(hash);

    // Prevent unbounded growth
    if (recentHashes.size > MAX_RECENT_HASHES) {
      const iterator = recentHashes.values();
      const firstValue = iterator.next().value;
      if (firstValue !== undefined) {
        recentHashes.delete(firstValue);
      }
    }

    // Step 3: Send to AI Edge Function for structured parsing
    const candidate: SmsCandidate = {
      message: {
        id: `live-${event.timestamp}`,
        address: event.sender,
        body: event.body,
        date: event.timestamp,
        read: false,
      },
      smsBodyHash: hash,
    };

    const aiResult = await parseSmsWithAi([candidate]);

    // Step 4: Emit parsed transactions to all registered handlers
    for (const parsed of aiResult.transactions) {
      for (const handler of handlers) {
        handler(parsed);
      }
    }
  } catch (err) {
    console.error(
      "[sms-live-listener] Failed to process SMS:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start listening for incoming SMS events from native SmsEventModule.
 *
 * Subscribes to DeviceEventEmitter events emitted by the native
 * SmsBroadcastReceiver → SmsEventModule bridge.
 *
 * Idempotent — calling multiple times is safe.
 */
export function startSmsListener(): void {
  if (Platform.OS !== "android") {
    console.log("[sms-live-listener] SMS listening only available on Android");
    return;
  }

  if (isListening) {
    console.log("[sms-live-listener] Already listening");
    return;
  }

  try {
    nativeSubscription = DeviceEventEmitter.addListener(
      NATIVE_SMS_EVENT,
      (event: NativeSmsEvent) => {
        processNativeSmsEvent(event).catch((err: unknown) => {
          console.error(
            "[sms-live-listener] Processing error:",
            err instanceof Error ? err.message : String(err)
          );
        });
      }
    );

    isListening = true;
    console.log("[sms-live-listener] Started listening for native SMS events");
  } catch (err) {
    console.error(
      "[sms-live-listener] Failed to start:",
      err instanceof Error ? err.message : String(err)
    );
    isListening = false;
  }
}

/**
 * Stop listening for incoming SMS events.
 * Idempotent — calling when not listening is safe.
 */
export function stopSmsListener(): void {
  if (!isListening) {
    return;
  }

  if (nativeSubscription) {
    nativeSubscription.remove();
    nativeSubscription = null;
  }

  isListening = false;
  console.log("[sms-live-listener] Stopped listening");
}

/**
 * Whether the listener is currently active.
 */
export function isSmsListenerActive(): boolean {
  return isListening;
}

/**
 * Register a handler for detected financial SMS transactions.
 *
 * @param handler - Called when a financial SMS is parsed successfully
 * @returns Cleanup function to unsubscribe
 */
export function onTransactionDetected(
  handler: LiveSmsEventHandler
): () => void {
  handlers.add(handler);

  return () => {
    handlers.delete(handler);
  };
}

/**
 * Clear the recent hashes cache.
 * Useful for testing or when the user performs a full re-scan.
 */
export function clearRecentHashes(): void {
  recentHashes.clear();
}
