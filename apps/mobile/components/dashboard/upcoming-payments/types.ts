/**
 * Shared types for the upcoming-payments sub-components.
 *
 * Uses RecurringPayment from @astik/db as the canonical payment type.
 */

import type { CurrencyType, RecurringPayment } from "@astik/db";

export interface PayNowModalProps {
  readonly payment: RecurringPayment | null;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSuccess: (
    amount: number,
    paymentName: string,
    paymentCurrency: CurrencyType
  ) => void;
}

export interface FeaturedPaymentCardProps {
  readonly payment: RecurringPayment;
  readonly onPayNow: () => void;
}

export interface MiniPaymentItemProps {
  readonly payment: RecurringPayment;
}
