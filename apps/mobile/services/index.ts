/**
 * Services index
 * Central export for all service modules
 */

export { getCurrentUserId, isAuthenticated, supabase } from "./supabase";
export { syncDatabase } from "./sync";
export {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "./transaction-service";
export { createTransfer, updateTransfer } from "./transfer-service";
export type { TransferData } from "./transfer-service";
export { createRecurringPayment } from "./recurring-payment-service";
export type { RecurringPaymentData } from "./recurring-payment-service";
export { ensureCashAccount, findCashAccount } from "./account-service";
export type { EnsureCashAccountResult } from "./account-service";
