/**
 * useSmsScan Hook
 *
 * Manages the state machine for SMS inbox scanning.
 * Wraps the sms-sync-service pipeline with React state for UI consumption.
 *
 * Architecture & Design Rationale:
 * - Pattern: Facade — provides a simple API over the scan pipeline
 * - SOLID: Single Responsibility — only manages scan state, not UI
 *
 * @module useSmsScan
 */

import type { ParseSmsContext } from "@/services/ai-sms-parser-service";
import {
  scanAndParseSms,
  type SmsScanProgress,
  type SmsScanResult,
} from "@/services/sms-sync-service";
import type { ParsedSmsTransaction } from "@astik/logic";
import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScanStatus = "idle" | "scanning" | "complete" | "error";

export interface UseSmsScanResult {
  /** Current scan status */
  readonly status: ScanStatus;
  /** Live progress during scanning */
  readonly progress: SmsScanProgress | null;
  /** Final scan result when status is 'complete' */
  readonly result: SmsScanResult | null;
  /** Parsed transactions from the scan (shortcut to result.transactions) */
  readonly transactions: readonly ParsedSmsTransaction[];
  /** Error message if scan failed */
  readonly error: string | null;
  /** Start scanning the SMS inbox */
  readonly startScan: (options: StartScanOptions) => Promise<void>;
  /** Reset the scan state to idle */
  readonly reset: () => void;
}

interface StartScanOptions {
  /** Only scan messages after this timestamp (incremental sync). */
  readonly minDate?: number;
  /** Set of existing hashes for dedup. */
  readonly existingHashes: ReadonlySet<string>;
  /** Context to pass to AI for better account suggestions. */
  readonly aiContext: ParseSmsContext;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmsScan(): UseSmsScanResult {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState<SmsScanProgress | null>(null);
  const [result, setResult] = useState<SmsScanResult | null>(null);
  const [transactions, setTransactions] = useState<
    readonly ParsedSmsTransaction[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  // Guard against concurrent scans
  const isScanningRef = useRef(false);

  const startScan = useCallback(
    async (options: StartScanOptions): Promise<void> => {
      if (isScanningRef.current) {
        return;
      }

      isScanningRef.current = true;
      setStatus("scanning");
      setProgress(null);
      setResult(null);
      setTransactions([]);
      setError(null);

      try {
        const scanResult = await scanAndParseSms(
          {
            minDate: options.minDate,
            existingHashes: options.existingHashes,
            aiContext: options.aiContext,
          },
          (p) => {
            setProgress(p);
          }
        );

        setResult(scanResult);
        setTransactions(scanResult.transactions);
        setStatus("complete");
      } catch (err) {
        // Log raw error for debugging but don't expose English service
        // messages to the UI — the component falls back to t("scan_error_default")
        if (err instanceof Error) {
          console.error("[useSmsScan] Scan failed:", err.message);
        }
        setError(null);
        setStatus("error");
      } finally {
        isScanningRef.current = false;
      }
    },
    []
  );

  const reset = useCallback((): void => {
    setStatus("idle");
    setProgress(null);
    setResult(null);
    setTransactions([]);
    setError(null);
    isScanningRef.current = false;
  }, []);

  return {
    status,
    progress,
    result,
    transactions,
    error,
    startScan,
    reset,
  };
}
