import { Account, database } from "@astik/db";
import { Model } from "@nozbe/watermelondb";
import { Alert } from "react-native";
import { DisplayTransaction } from "./useTransactionsGrouping";

interface UseTransactionOperationsResult {
  /**
   * Soft deletes the provided transactions/transfers and reverts their
   * impact on account balances.
   * @param items - Array of DisplayTransaction items to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteTransactions: (items: DisplayTransaction[]) => Promise<boolean>;
}

/**
 * Hook for transaction/transfer operations like delete, update, etc.
 * Encapsulates business logic for modifying transactions and their side effects.
 */
export function useTransactionOperations(): UseTransactionOperationsResult {
  /**
   * Soft deletes transactions/transfers and reverts account balances.
   * - For transactions: Reverts the account balance based on type (income/expense)
   * - For transfers: Reverts both source and destination account balances
   *
   * Uses a two-phase approach to avoid "pending changes" errors:
   * 1. First pass: Soft delete items and accumulate balance changes per account
   * 2. Second pass: Apply accumulated balance changes (one update per account)
   */
  const deleteTransactions = async (
    items: DisplayTransaction[]
  ): Promise<boolean> => {
    try {
      await database.write(async () => {
        const updateBatches: Model[] = [];

        // Map to accumulate balance changes per account
        // Key: account ID, Value: { account: Account, balanceDelta: number }
        const accountBalanceChanges = new Map<
          string,
          { account: Account; balanceDelta: number }
        >();

        // First pass: Soft delete items and collect balance changes
        for (const item of items) {
          if (item._type === "transaction") {
            // Soft delete transaction
            updateBatches.push(
              item.prepareUpdate((t) => {
                t.deleted = true;
              })
            );

            // Calculate balance reversion for this transaction
            const account = await item.account.fetch();
            let balanceDelta = 0;
            if (item.isIncome) {
              balanceDelta = -item.amount; // Subtract income
            } else if (item.isExpense) {
              balanceDelta = item.amount; // Add back expense
            }

            // Accumulate balance change for this account
            const existing = accountBalanceChanges.get(account.id);
            if (existing) {
              existing.balanceDelta += balanceDelta;
            } else {
              accountBalanceChanges.set(account.id, {
                account,
                balanceDelta,
              });
            }
          } else if (item._type === "transfer") {
            // Soft delete transfer
            updateBatches.push(
              item.prepareUpdate((t) => {
                t.deleted = true;
              })
            );

            // Revert source account (add back amount)
            const fromAccount = await item.fromAccount.fetch();
            const fromExisting = accountBalanceChanges.get(fromAccount.id);
            if (fromExisting) {
              fromExisting.balanceDelta += item.amount;
            } else {
              accountBalanceChanges.set(fromAccount.id, {
                account: fromAccount,
                balanceDelta: item.amount,
              });
            }

            // Revert destination account (subtract converted amount)
            const toAccount = await item.toAccount.fetch();
            const amountToDeduct = item.convertedAmount ?? item.amount;
            const toExisting = accountBalanceChanges.get(toAccount.id);
            if (toExisting) {
              toExisting.balanceDelta -= amountToDeduct;
            } else {
              accountBalanceChanges.set(toAccount.id, {
                account: toAccount,
                balanceDelta: -amountToDeduct,
              });
            }
          }
        }

        // Second pass: Apply accumulated balance changes (one update per account)
        for (const {
          account,
          balanceDelta,
        } of accountBalanceChanges.values()) {
          if (balanceDelta !== 0) {
            updateBatches.push(
              account.prepareUpdate((a) => {
                a.balance += balanceDelta;
              })
            );
          }
        }

        // Execute all updates in a single batch
        await database.batch(...updateBatches);
      });

      return true;
    } catch (error) {
      console.error("Failed to delete transactions:", error);
      Alert.alert("Error", "Failed to delete transactions");
      return false;
    }
  };

  return { deleteTransactions };
}
