/**
 * SMS Reader Service
 *
 * Wraps `react-native-get-sms-android` with a typed interface for
 * reading the Android SMS inbox. Returns empty results on iOS.
 *
 * Architecture & Design Rationale:
 * - Pattern: Adapter Pattern
 * - Why: Isolates the untyped native module behind a typed interface.
 *   If the underlying library changes or needs swapping, only this
 *   file is affected.
 * - SOLID: Single Responsibility — only handles SMS reading, not parsing.
 *
 * @module sms-reader-service
 */

import { Platform } from "react-native";
import type { SmsMessage } from "@astik/logic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmsReaderOptions {
  /** Maximum number of SMS messages to read. Defaults to 1000. */
  readonly maxCount?: number;
  /** Only read messages after this timestamp (ms since epoch). */
  readonly minDate?: number;

  readonly address?: string;
}

// ---------------------------------------------------------------------------
// Native Module Interface
// ---------------------------------------------------------------------------

/**
 * The raw filter object expected by react-native-get-sms-android.
 * @see https://github.com/nickalderilan/react-native-get-sms-android
 */
interface SmsFilter {
  box: "inbox";
  maxCount?: number;
  minDate?: number;
  address?: string;
}

/**
 * Raw SMS record from the native module (snake_case keys).
 */
interface RawNativeSms {
  _id: string;
  address: string;
  body: string;
  date: string;
  read: number;
}

/**
 * Typed interface for the react-native-get-sms-android native module.
 * Provides type safety over the dynamically imported module.
 */
interface NativeSmsModule {
  list(
    filter: string,
    onFail: (error: string) => void,
    onSuccess: (count: number, smsList: string) => void
  ): void;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read SMS messages from the Android inbox.
 *
 * @param options - Optional filtering (maxCount, minDate)
 * @returns Array of typed SmsMessage objects. Empty array on iOS.
 */
export async function readSmsInbox(
  options?: SmsReaderOptions
): Promise<readonly SmsMessage[]> {
  if (Platform.OS !== "android") {
    return [];
  }

  try {
    // Dynamic import to avoid crash on iOS where the native module isn't linked.
    // The module uses `module.exports = NativeModules.Sms` (no .default wrapper).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeModule = require("react-native-get-sms-android") as
      | NativeSmsModule
      | { default: NativeSmsModule };
    const SmsAndroid: NativeSmsModule =
      "list" in nativeModule
        ? nativeModule
        : (nativeModule as { default: NativeSmsModule }).default;

    const filter: SmsFilter = {
      box: "inbox",
      maxCount: options?.maxCount ?? 1000,
      ...(options?.address ? { address: options.address } : {}),
      ...(options?.minDate ? { minDate: options.minDate } : {}),
    };

    return new Promise<readonly SmsMessage[]>((resolve, reject) => {
      SmsAndroid.list(
        JSON.stringify(filter),
        (fail: string) => {
          reject(new Error(`SMS read failed: ${fail}`));
        },
        (_count: number, smsList: string) => {
          try {
            const rawMessages = JSON.parse(smsList) as readonly RawNativeSms[];
            const messages: SmsMessage[] = rawMessages
              .filter(
                (message) => message.body !== "" && message.address !== ""
              )
              .map(mapNativeSms);
            resolve(messages);
          } catch (parseError) {
            reject(
              new Error(
                `SMS parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`
              )
            );
          }
        }
      );
    });
  } catch (error) {
    // Native module not available (dev build issue or iOS)
    console.warn(
      "[sms-reader-service] Native SMS module unavailable:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

/**
 * Get the total count of SMS messages in the inbox.
 * Returns 0 on iOS.
 */
export async function getSmsCount(): Promise<number> {
  if (Platform.OS !== "android") {
    return 0;
  }

  try {
    const messages = await readSmsInbox({ maxCount: 1 });
    // The native module doesn't provide a count-only API,
    // so we use a maxCount of 1 just to check availability
    return messages.length > 0 ? -1 : 0; // -1 means "messages exist, count unknown"
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Map a raw native SMS record to our typed SmsMessage interface.
 */
function mapNativeSms(raw: RawNativeSms): SmsMessage {
  return {
    id: String(raw._id),
    address: raw.address,
    body: raw.body,
    date: parseInt(raw.date, 10) || Date.now(),
    read: raw.read === 1,
  };
}
