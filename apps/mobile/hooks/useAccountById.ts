/**
 * useAccountById Hook
 *
 * Observes a single account by ID from WatermelonDB, including its
 * associated bank details (if it's a bank-type account).
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook with reactive observable (findAndObserve)
 * - SOLID: SRP — data observation only, no mutation logic
 * - Modelled after useTransactionById for consistency
 *
 * @module useAccountById
 */

import { Account, BankDetails, database } from "@rizqi/db";
import { useEffect, useRef, useState } from "react";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BankDetailsData = Pick<
  BankDetails,
  "bankName" | "cardLast4" | "smsSenderName"
>;

interface UseAccountByIdResult {
  /** The observed Account model or null when not found / loading */
  readonly account: Account | null;
  /** Pre-fetched bank details (null for non-bank accounts) */
  readonly bankDetails: BankDetailsData | null;
  /** Whether the initial fetch is still in progress */
  readonly isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Observes a single Account record reactively by its ID.
 *
 * Automatically subscribes to changes and unsubscribes on unmount.
 * Also fetches associated bank details for bank-type accounts.
 *
 * @param id - The WatermelonDB record ID of the account
 * @returns The observed account, its bank details, and loading state
 */
export function useAccountById(id: string): UseAccountByIdResult {
  const [account, setAccount] = useState<Account | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const bankDetailsRequestIdRef = useRef(0);

  useEffect(() => {
    let isActive = true;

    if (!id) {
      setAccount(null);
      setBankDetails(null);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);

    const loadBankDetails = async (record: Account): Promise<void> => {
      const requestId = ++bankDetailsRequestIdRef.current;
      if (!record.isBank) {
        if (!isActive || requestId !== bankDetailsRequestIdRef.current) return;
        setBankDetails(null);
        setIsLoading(false);
        return;
      }

      try {
        const details = (await record.bankDetails.fetch()) as BankDetails[];
        if (!isActive || requestId !== bankDetailsRequestIdRef.current) return;

        if (details.length > 0) {
          const bd = details[0];
          setBankDetails({
            bankName: bd.bankName,
            cardLast4: bd.cardLast4,
            smsSenderName: bd.smsSenderName,
          });
        } else {
          setBankDetails(null);
        }
      } catch (err: unknown) {
        if (!isActive || requestId !== bankDetailsRequestIdRef.current) return;
        logger.error(
          "useAccountById_bank_details_fetch_failed",
          err instanceof Error ? { message: err.message } : { error: err }
        );
        setBankDetails(null);
      } finally {
        if (isActive && requestId === bankDetailsRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    const collection = database.get<Account>("accounts");
    const subscription = collection.findAndObserve(id).subscribe({
      next: (record) => {
        setAccount(record);
        void loadBankDetails(record);
      },
      error: (err: unknown) => {
        logger.error(
          "useAccountById_observation_failed",
          err instanceof Error ? { message: err.message } : { error: err }
        );
        setAccount(null);
        setBankDetails(null);
        setIsLoading(false);
      },
    });

    return (): void => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [id]);

  return { account, bankDetails, isLoading };
}
