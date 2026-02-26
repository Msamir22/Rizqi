/**
 * SMS Scan Context
 *
 * React Context for sharing parsed SMS transactions between the
 * scan page and the review page. Data flows:
 *   sms-scan.tsx → setTransactions() → sms-review.tsx reads transactions
 *
 * Architecture & Design Rationale:
 * - Pattern: Provider Pattern (React Context)
 * - Why: Lightweight cross-route state sharing without adding Zustand.
 *   Scoped to the SMS scan flow — no global store pollution.
 * - SOLID: SRP — only holds parsed transactions for inter-screen transfer.
 *
 * @module SmsScanContext
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ParsedSmsTransaction } from "@astik/logic";
import type { SenderAccountMap } from "@/services/batch-sms-transactions";

export type SmsScanMode = "incremental" | "full";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmsScanContextValue {
  /** Parsed transactions from the scan pipeline */
  readonly transactions: readonly ParsedSmsTransaction[];
  /** Set parsed transactions (called by scan page on completion) */
  readonly setTransactions: (txns: readonly ParsedSmsTransaction[]) => void;
  /** Clear transactions (called after save or discard) */
  readonly clearTransactions: () => void;
  /** Sender config ID → account ID mapping (set by account setup step) */
  readonly senderAccountMap: SenderAccountMap;
  /** Set the sender → account mapping */
  readonly setSenderAccountMap: (map: SenderAccountMap) => void;
  /** Default account ID for unmapped senders */
  readonly defaultAccountId: string | null;
  /** Set the default account ID */
  readonly setDefaultAccountId: (id: string | null) => void;
  /** Whether the next scan should be incremental or full */
  readonly scanMode: SmsScanMode;
  /** Set the scan mode before navigating to scan page */
  readonly setScanMode: (mode: SmsScanMode) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SmsScanContext = createContext<SmsScanContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SmsScanProviderProps {
  readonly children: React.ReactNode;
}

export function SmsScanProvider({
  children,
}: SmsScanProviderProps): React.JSX.Element {
  const [transactions, setTransactionsState] = useState<
    readonly ParsedSmsTransaction[]
  >([]);
  const [senderAccountMap, setSenderAccountMapState] =
    useState<SenderAccountMap>({});
  const [defaultAccountId, setDefaultAccountIdState] = useState<string | null>(
    null
  );
  const [scanMode, setScanModeState] = useState<SmsScanMode>("incremental");

  const setTransactions = useCallback(
    (txns: readonly ParsedSmsTransaction[]) => {
      setTransactionsState(txns);
    },
    []
  );

  const clearTransactions = useCallback(() => {
    setTransactionsState([]);
    setSenderAccountMapState({});
    setDefaultAccountIdState(null);
  }, []);

  const setSenderAccountMap = useCallback((map: SenderAccountMap) => {
    setSenderAccountMapState(map);
  }, []);

  const setDefaultAccountId = useCallback((id: string | null) => {
    setDefaultAccountIdState(id);
  }, []);

  const setScanMode = useCallback((mode: SmsScanMode) => {
    setScanModeState(mode);
  }, []);

  const value = useMemo<SmsScanContextValue>(
    () => ({
      transactions,
      setTransactions,
      clearTransactions,
      senderAccountMap,
      setSenderAccountMap,
      defaultAccountId,
      setDefaultAccountId,
      scanMode,
      setScanMode,
    }),
    [
      transactions,
      setTransactions,
      clearTransactions,
      senderAccountMap,
      setSenderAccountMap,
      defaultAccountId,
      setDefaultAccountId,
      scanMode,
      setScanMode,
    ]
  );

  return (
    <SmsScanContext.Provider value={value}>{children}</SmsScanContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the SMS scan context. Must be used inside SmsScanProvider.
 */
export function useSmsScanContext(): SmsScanContextValue {
  const ctx = useContext(SmsScanContext);
  if (!ctx) {
    throw new Error("useSmsScanContext must be used within a SmsScanProvider");
  }
  return ctx;
}
