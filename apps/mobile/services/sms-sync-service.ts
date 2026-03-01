/**
 * SMS Sync Service
 *
 * Orchestrates the scan → filter → AI-parse → dedup pipeline for SMS transactions.
 * Reads the SMS inbox, filters by known Egyptian bank/fintech sender names,
 * sends financial candidates to Gemini AI for structured parsing, and deduplicates.
 *
 * Architecture & Design Rationale:
 * - Pattern: Pipeline / Orchestrator
 * - Why: Separates scan orchestration from parsing logic (SRP).
 *   Two-stage approach: fast on-device sender filter, then cloud AI.
 * - SOLID: Open/Closed — the AI service can be swapped without
 *   touching this orchestrator. SRP — only orchestrates, no UI.
 *
 * @module sms-sync-service
 */

import { database, Transaction, Transfer } from "@astik/db";
import {
  computeSmsHash,
  isKnownFinancialSender,
  type ParsedSmsTransaction,
  type SmsMessage,
} from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { InteractionManager } from "react-native";
import {
  parseSmsWithAi,
  type ParseSmsContext,
  type SmsCandidate,
} from "./ai-sms-parser-service";
import { readSmsInbox } from "./sms-reader-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Progress callback payload emitted during scanning. */
export interface SmsScanProgress {
  readonly totalMessages: number;
  readonly messagesScanned: number;
  /** Number of AI-parsed transactions found so far. */
  readonly transactionsFound: number;
  /** Number of SMS candidates that passed the keyword filter (stable after filtering). */
  readonly candidatesFound: number;
  readonly currentPhase: "filtering" | "ai-parsing" | "complete";
  readonly currentSender: string;
  /** Number of AI parsing chunks completed (only during ai-parsing phase). */
  readonly aiChunksCompleted?: number;
  /** Total AI parsing chunks to process (only during ai-parsing phase). */
  readonly aiChunksTotal?: number;
  /** Timestamp (ms since epoch) when the scan pipeline started. Used by UI for elapsed timer. */
  readonly scanStartedAt: number;
  /**
   * Estimated time remaining for the AI parsing phase in milliseconds.
   * `undefined` until the first AI chunk completes AND total chunks >= 2.
   */
  readonly estimatedRemainingMs?: number;
}

/** Result returned when scanning completes. */
export interface SmsScanResult {
  readonly transactions: readonly ParsedSmsTransaction[];
  readonly totalScanned: number;
  readonly totalFound: number;
  readonly totalFilteredCandidates: number;
  readonly durationMs: number;
}

/** Options for the scan pipeline. */
interface ScanOptions {
  /** Only process SMS after this timestamp (ms since epoch). */
  readonly minDate?: number;
  /** Maximum messages to read from inbox. Defaults to 5000. */
  readonly maxCount?: number;
  /** Set of existing sms_body_hash values for dedup. */
  readonly existingHashes?: ReadonlySet<string>;
  /** Batch size for keyword filtering — smaller = more frequent progress updates. */
  readonly batchSize?: number;
  /**
   * Yield to the UI thread every N batches via InteractionManager.
   * Prevents UI freezing on large inboxes (10K+ messages).
   * Defaults to 3.
   */
  readonly yieldInterval?: number;
  /** Context to pass to AI for better account suggestions and parsing accuracy. */
  readonly aiContext: ParseSmsContext;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_COUNT = 2000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_YIELD_INTERVAL = 3;
const SCAN_IN_PROGRESS_KEY = "@astik/sms_scan_in_progress";
/** Default to 3 months ago for both initial and full resync. */
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Regex patterns that identify non-transactional SMS from financial senders.
 * These messages should be filtered out before sending to the AI parser
 * to reduce cost and avoid false positives.
 */
const NON_TRANSACTIONAL_PATTERNS: readonly RegExp[] = [
  // OTP / verification codes (English & Arabic)
  /\bOTP[:\s]/i,
  /\bverification\s*code/i,
  /(?<!\p{Script=Arabic})رقم\s*(?:سري|مؤقت|التحقق)(?!\p{Script=Arabic})/iu,
  // Password / PIN reset
  /\binvalid\s*(IPN\s*)?PIN/i,
  /\bpassword\s*reset/i,
  /(?<!\p{Script=Arabic})إعادة\s*انشاء\s*رقم\s*سري(?!\p{Script=Arabic})/iu,
  // Promotional / marketing (Arabic telecom promos)
  /(?<!\p{Script=Arabic})افتح\s*محفظة(?!\p{Script=Arabic})/u,
  /(?<!\p{Script=Arabic})كاش\s*باك\s*مضمون(?!\p{Script=Arabic})/u,
  /(?<!\p{Script=Arabic})إستمتع\s*ب(?!\p{Script=Arabic})/u,
  // Account activation notices
  /(?<!\p{Script=Arabic})تنشيط\s*حسابكم(?!\p{Script=Arabic})/u,
  // Survey / feedback links
  /(?<!\p{Script=Arabic})تقييم\s*خبرتك(?!\p{Script=Arabic})/iu,
  /\bsurvey\b/i,
];

/**
 * Check whether an SMS body matches known non-transactional patterns
 * (OTPs, promotions, PIN resets, etc.) that should be excluded
 * from AI parsing.
 */
function isNonTransactionalSms(body: string): boolean {
  return NON_TRANSACTIONAL_PATTERNS.some((pattern) => pattern.test(body));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract sms_body_hash strings from raw query rows into a Set.
 * Shared by both the transactions and transfers queries below.
 */
function collectHashes(
  rows: ReadonlyArray<Record<string, unknown>>,
  target: Set<string>
): void {
  for (const row of rows) {
    const hash = row.sms_body_hash;
    if (typeof hash === "string") {
      target.add(hash);
    }
  }
}

/**
 * Query all existing SMS body hashes from the transactions AND transfers tables.
 * Used for deduplication — prevents re-parsing SMS messages that
 * have already been saved as either a transaction or a transfer (e.g., ATM withdrawal).
 *
 * Uses Q.unsafeSqlQuery + unsafeFetchRaw to SELECT only the hash column,
 * avoiding both full-row fetch and model hydration overhead.
 */
export async function loadExistingSmsHashes(): Promise<ReadonlySet<string>> {
  const hashes = new Set<string>();

  // ── Transactions ──────────────────────────────────────────────────────
  const txRows = await database
    .get<Transaction>("transactions")
    .query(
      Q.unsafeSqlQuery(
        `SELECT sms_body_hash FROM transactions
         WHERE source = 'SMS'
           AND sms_body_hash IS NOT NULL
           AND deleted != 1
           AND _status != 'deleted'`
      )
    )
    .unsafeFetchRaw();

  collectHashes(txRows as Array<Record<string, unknown>>, hashes);

  // ── Transfers (ATM withdrawals, etc.) ─────────────────────────────────
  const tfRows = await database
    .get<Transfer>("transfers")
    .query(
      Q.unsafeSqlQuery(
        `SELECT sms_body_hash FROM transfers
         WHERE sms_body_hash IS NOT NULL
           AND deleted != 1
           AND _status != 'deleted'`
      )
    )
    .unsafeFetchRaw();

  collectHashes(tfRows as Array<Record<string, unknown>>, hashes);

  return hashes;
}

/**
 * Scan the SMS inbox and return parsed, deduplicated transactions.
 *
 * Pipeline:
 * 1. Read SMS inbox via sms-reader-service
 * 2. On-device keyword filter → financial candidates
 * 3. Compute SHA-256 hash for each candidate
 * 4. Dedup against existing hashes in local DB
 * 5. Send deduplicated candidates to AI Edge Function
 * 6. Return AI-parsed transactions
 *
 * @param onProgress - Callback invoked after each batch with scan progress
 * @param options    - Optional filters (minDate, maxCount, existingHashes)
 * @returns Parsed, deduplicated transactions ready for review
 */
export async function scanAndParseSms(
  options: ScanOptions,
  onProgress?: (progress: SmsScanProgress) => void
): Promise<SmsScanResult> {
  // Guard against interrupted scans — clean up stale flags
  await AsyncStorage.setItem(SCAN_IN_PROGRESS_KEY, "true");

  try {
    return await executeScanPipeline(options, onProgress);
  } finally {
    // Always clear the flag, even on error/abort
    await AsyncStorage.removeItem(SCAN_IN_PROGRESS_KEY);
  }
}

/**
 * Check if a previous scan was interrupted (force-close).
 * Call on app launch to detect and clean up stale state.
 */
export async function cleanupStaleScanState(): Promise<boolean> {
  const inProgress = await AsyncStorage.getItem(SCAN_IN_PROGRESS_KEY);
  if (inProgress === "true") {
    await AsyncStorage.removeItem(SCAN_IN_PROGRESS_KEY);
    console.log("[sms-sync] Cleaned up stale scan-in-progress flag");
    return true;
  }
  return false;
}

/**
 * Internal scan pipeline implementation.
 * Separated from scanAndParseSms to allow the outer function
 * to manage the scan-in-progress guard cleanly.
 */
async function executeScanPipeline(
  options: ScanOptions,
  onProgress?: (progress: SmsScanProgress) => void
): Promise<SmsScanResult> {
  const startTime = Date.now();
  const maxCount = options?.maxCount ?? DEFAULT_MAX_COUNT;
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const yieldInterval = options?.yieldInterval ?? DEFAULT_YIELD_INTERVAL;
  const existingHashes = options?.existingHashes ?? new Set<string>();
  // Default to 3 months ago when no minDate is provided
  const effectiveMinDate = options?.minDate ?? Date.now() - THREE_MONTHS_MS;

  // ─── Step 1: Read SMS inbox ───────────────────────────────────────────
  const messages: readonly SmsMessage[] = await readSmsInbox({
    maxCount,
    minDate: effectiveMinDate,
  });

  const totalMessages = messages.length;
  let messagesScanned = 0;
  let batchCount = 0;

  // ─── Step 2: On-device keyword filter + hash + dedup ──────────────────
  const candidates: SmsCandidate[] = [];

  for (let i = 0; i < totalMessages; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

    for (const sms of batch) {
      messagesScanned++;

      // Filter by known Egyptian bank/fintech sender names
      if (!isKnownFinancialSender(sms.address)) {
        continue;
      }

      // Skip OTPs, promotions, PIN resets, etc.
      if (isNonTransactionalSms(sms.body)) {
        continue;
      }

      // Compute hash for deduplication
      const hash = await computeSmsHash(sms.body);

      // Skip if already exists in local DB
      if (existingHashes.has(hash)) {
        continue;
      }

      candidates.push({ message: sms, smsBodyHash: hash });
    }

    // Emit progress after each batch
    onProgress?.({
      totalMessages,
      messagesScanned,
      transactionsFound: 0,
      candidatesFound: candidates.length,
      currentPhase: "filtering",
      currentSender: batch[batch.length - 1]?.address ?? "",
      scanStartedAt: startTime,
    });

    // Yield to UI thread periodically
    batchCount++;
    if (batchCount % yieldInterval === 0) {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          resolve();
        });
      });
    }
  }

  // ─── Step 3: Send candidates to AI for parsing ────────────────────────
  onProgress?.({
    totalMessages,
    messagesScanned: totalMessages,
    transactionsFound: 0,
    candidatesFound: candidates.length,
    currentPhase: "ai-parsing",
    currentSender: "",
    aiChunksCompleted: 0,
    scanStartedAt: startTime,
  });

  // Track per-chunk durations for estimated time remaining calculation
  const chunkDurations: number[] = [];

  const aiResult = await parseSmsWithAi(
    candidates,
    options.aiContext,
    (aiProgress) => {
      // Accumulate chunk durations for rolling average
      chunkDurations.push(aiProgress.chunkDurationMs);

      // Calculate estimated remaining from rolling average of completed chunk durations
      const remainingChunks =
        aiProgress.totalChunks - aiProgress.chunksCompleted;
      let estimatedRemainingMs: number | undefined;

      if (
        chunkDurations.length >= 1 &&
        aiProgress.totalChunks >= 2 &&
        remainingChunks > 0
      ) {
        const avgChunkDurationMs =
          chunkDurations.reduce((sum, d) => sum + d, 0) / chunkDurations.length;
        estimatedRemainingMs = Math.round(avgChunkDurationMs * remainingChunks);
      }

      onProgress?.({
        totalMessages,
        messagesScanned: totalMessages,
        transactionsFound: aiProgress.transactionsSoFar,
        candidatesFound: candidates.length,
        currentPhase: "ai-parsing",
        currentSender: "",
        aiChunksCompleted: aiProgress.chunksCompleted,
        aiChunksTotal: aiProgress.totalChunks,
        scanStartedAt: startTime,
        estimatedRemainingMs,
      });
    }
  );

  // ─── Step 4: Return results ───────────────────────────────────────────
  const durationMs = Date.now() - startTime;

  onProgress?.({
    totalMessages,
    messagesScanned: totalMessages,
    transactionsFound: aiResult.transactions.length,
    candidatesFound: candidates.length,
    currentPhase: "complete",
    currentSender: "",
    scanStartedAt: startTime,
  });

  console.log(
    `[sms-sync] AI parsing: ${aiResult.transactions.length} transactions from ${candidates.length} candidates in ${durationMs}ms`
  );

  return {
    transactions: aiResult.transactions,
    totalScanned: messagesScanned,
    totalFound: aiResult.transactions.length,
    totalFilteredCandidates: candidates.length,
    durationMs,
  };
}
