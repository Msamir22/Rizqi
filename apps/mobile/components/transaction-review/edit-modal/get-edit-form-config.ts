import type { ReviewableTransaction } from "@astik/logic";

export interface SourceTypeBadge {
  readonly label: string;
  readonly iconName: string;
  readonly theme: "amber" | "emerald" | "blue" | "red";
}

export interface EditFormConfig {
  readonly showTypeToggle: boolean;
  readonly showCounterparty: boolean;
  readonly showCategory: boolean;
  readonly showToAccount: boolean;
  readonly sourceTypeBadge: SourceTypeBadge | null;
}

/**
 * Derives presentation and layout rules for the Edit Modal based on transaction type.
 *
 * This enforces the Open/Closed Principle (OCP) by keeping source-specific domain knowledge
 * (like what fields an ATM Withdrawal requires) out of the generic UI React components.
 */
export function getEditFormConfig(
  transaction: ReviewableTransaction
): EditFormConfig {
  const isAtmWithdrawal =
    "isAtmWithdrawal" in transaction && transaction.isAtmWithdrawal === true;

  if (isAtmWithdrawal) {
    return {
      showTypeToggle: false, // ATM is strictly a Transfer
      showCounterparty: false, // Cash withdrawal doesn't have a payee/merchant
      showCategory: false, // Handled inherently by the transfer mechanism
      showToAccount: true, // Requires a "cash" destination account
      sourceTypeBadge: {
        label: "Cash Withdrawal (Transfer)",
        iconName: "cash-outline",
        theme: "amber",
      },
    };
  }

  // Standard transaction parsing fallback
  return {
    showTypeToggle: true,
    showCounterparty: true,
    showCategory: true,
    showToAccount: false,
    sourceTypeBadge: null,
  };
}
