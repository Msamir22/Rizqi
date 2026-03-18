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

import { Account, BankDetails, database } from "@astik/db";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BankDetailsData {
  readonly bankName: string;
  readonly cardLast4: string;
  readonly smsSenderName: string;
}

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

  useEffect(() => {
    if (!id) {
      setAccount(null);
      setBankDetails(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const collection = database.get<Account>("accounts");
    const subscription = collection.findAndObserve(id).subscribe({
      next: (record) => {
        setAccount(record);

        // Fetch bank details if this is a bank account
        if (record.isBank) {
          record.bankDetails
            .fetch()
            .then((details) => {
              const typedDetails = details as unknown as BankDetails[];
              if (typedDetails.length > 0) {
                const bd = typedDetails[0];
                setBankDetails({
                  bankName: bd.bankName ?? "",
                  cardLast4: bd.cardLast4 ?? "",
                  smsSenderName: bd.smsSenderName ?? "",
                });
              } else {
                setBankDetails(null);
              }
            })
            .catch((err: unknown) => {
              console.error("[useAccountById] Bank details fetch error:", err);
              setBankDetails(null);
            });
        } else {
          setBankDetails(null);
        }

        setIsLoading(false);
      },
      error: (err) => {
        console.error("[useAccountById] Observation error:", err);
        setAccount(null);
        setBankDetails(null);
        setIsLoading(false);
      },
    });

    return (): void => {
      subscription.unsubscribe();
    };
  }, [id]);

  return { account, bankDetails, isLoading };
}
