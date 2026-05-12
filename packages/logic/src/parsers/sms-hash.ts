/**
 * SMS Fingerprint Utility
 *
 * Computes a SHA-256 fingerprint for SMS deduplication.
 * The fingerprint includes sender, normalized body, and received timestamp so
 * repeated real-world messages with identical text remain distinct.
 *
 * @module sms-hash
 */

import * as Crypto from "expo-crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Regex matching zero-width Unicode characters commonly injected by
 * telecom gateways or messaging apps. These are invisible to the user
 * but produce different hash outputs if left in the body.
 */
const ZERO_WIDTH_CHARS_RE = /\u200B|\u200C|\u200D|\uFEFF|\u00AD|\u2060|\u180E/g;

export interface SmsFingerprintInput {
  readonly sender: string;
  readonly body: string;
  readonly receivedAtMs: number;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalise SMS body text before hashing:
 * 1. Strip zero-width Unicode characters (U+200B, U+200C, U+200D, U+FEFF)
 * 2. Normalise line endings (CRLF / CR → LF)
 * 3. Collapse consecutive whitespace to a single space
 * 4. Trim leading/trailing whitespace
 *
 * Exported as `normalizeSmsBody` for use in unit tests and external callers.
 */
export function normalizeSmsBody(body: string): string {
  return body
    .replace(ZERO_WIDTH_CHARS_RE, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSmsSender(sender: string): string {
  return sender.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 fingerprint from the SMS sender, normalized body, and
 * received timestamp in milliseconds.
 *
 * @returns Hex-encoded SHA-256 digest
 */
export async function computeSmsFingerprint(
  input: SmsFingerprintInput
): Promise<string> {
  const fingerprintInput = JSON.stringify({
    sender: normalizeSmsSender(input.sender),
    body: normalizeSmsBody(input.body),
    receivedAtMs: input.receivedAtMs,
  });

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fingerprintInput
  );
}
