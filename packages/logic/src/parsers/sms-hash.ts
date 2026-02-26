/**
 * SMS Body Hash Utility
 *
 * Computes a SHA-256 hash of SMS body text for deduplication.
 * Normalises whitespace before hashing so minor formatting
 * differences don't produce different hashes.
 *
 * @module sms-hash
 */

import * as Crypto from "expo-crypto";

/**
 * Normalise SMS body text before hashing:
 * - Trim leading/trailing whitespace
 * - Collapse multiple whitespace characters into a single space
 */
function normaliseBody(body: string): string {
  return body.trim().replace(/\s+/g, " ");
}

/**
 * Compute a SHA-256 hash of the normalised SMS body.
 *
 * @param body - The raw SMS body text
 * @returns Hex-encoded SHA-256 digest
 */
export async function computeSmsHash(body: string): Promise<string> {
  const normalised = normaliseBody(body);
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalised
  );
}
