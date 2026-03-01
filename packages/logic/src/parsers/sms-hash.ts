/**
 * SMS Body Hash Utility
 *
 * Computes a SHA-256 hash of SMS body text for deduplication.
 * Normalises the body before hashing so minor formatting
 * differences (invisible characters, whitespace) don't produce
 * different hashes.
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
const ZERO_WIDTH_CHARS_RE = /\u200B\u200C\u200D\uFEFF\u00AD\u2060\u180E/g;

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

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 hash of the normalised SMS body.
 *
 * @param body - The raw SMS body text
 * @returns Hex-encoded SHA-256 digest
 */
export async function computeSmsHash(body: string): Promise<string> {
  const normalised = normalizeSmsBody(body);
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalised
  );
}
