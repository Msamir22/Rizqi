import { calculateNextDueDate, getNextMonthSameDay } from "@/utils/dateHelpers";
import {
  CurrencyType,
  database,
  RecurringAction,
  RecurringFrequency,
  RecurringPayment,
  TransactionType,
} from "@astik/db";
import { getCurrentUserId } from "./supabase";

export interface RecurringPaymentData {
  name: string;
  amount: number;
  currency: CurrencyType;
  type: TransactionType;
  accountId: string;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: Date;
  action: RecurringAction;
  notes?: string;
}

/**
 * Create a new recurring payment record.
 */
export async function createRecurringPayment(
  data: RecurringPaymentData
): Promise<RecurringPayment> {
  const userId = await getCurrentUserId();
  if (!userId) {
    // i18n-ignore — developer-facing error
    throw new Error("User not authenticated");
  }

  const recurringCollection =
    database.get<RecurringPayment>("recurring_payments");

  return await database.write(async () => {
    return await recurringCollection.create((rec) => {
      rec.userId = userId;
      rec.name = data.name;
      rec.amount = Math.abs(data.amount);
      rec.currency = data.currency;
      rec.type = data.type;
      rec.accountId = data.accountId;
      rec.categoryId = data.categoryId;
      rec.frequency = data.frequency;
      rec.startDate = data.startDate;
      rec.nextDueDate = getNextMonthSameDay(data.startDate);
      rec.action = data.action;
      rec.status = "ACTIVE";
      rec.deleted = false;
      rec.notes = data.notes;
    });
  });
}

/**
 * Update the next due date of a recurring payment after a "Pay Now" action.
 * Calculates the next due date based on the payment's frequency.
 */
export async function updateRecurringPaymentNextDueDate(
  paymentId: string,
  currentDueDate: Date,
  frequency: string
): Promise<void> {
  const recurringCollection =
    database.get<RecurringPayment>("recurring_payments");

  await database.write(async () => {
    const payment = await recurringCollection.find(paymentId);
    await payment.update((record) => {
      record.nextDueDate = calculateNextDueDate(currentDueDate, frequency);
    });
  });
}
