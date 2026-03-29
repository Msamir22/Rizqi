import { TransactionType } from "@astik/db";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Zod schema for expense/income transaction form validation.
 */
const baseTransactionSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      "Amount must be greater than 0"
    ),
  accountId: z.string().min(1, "Account is required"),
  categoryId: z.string().min(1, "Category is required"),
});

/**
 * Zod schema for transfer form validation.
 */
const transferSchema = z
  .object({
    amount: z
      .string()
      .min(1, "Amount is required")
      .refine(
        (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
        "Amount must be greater than 0"
      )
      .refine(
        (val) => parseFloat(val) <= 1000000000,
        "Amount must be less than 1,000,000,000"
      ),
    fromAccountId: z.string().min(1, "Source account is required"),
    toAccountId: z.string().min(1, "Destination account is required"),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Source and destination accounts must be different",
    path: ["toAccountId"],
  });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransactionFormData = z.infer<typeof baseTransactionSchema>;
export type TransferFormData = z.infer<typeof transferSchema>;

/** Union of all possible form field keys for error display */
export type TransactionValidationErrors = Partial<
  Record<
    "amount" | "accountId" | "categoryId" | "fromAccountId" | "toAccountId",
    string
  >
>;

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

/**
 * Validates transaction form data using the appropriate Zod schema
 * based on the transaction type.
 *
 * @param type - The current transaction type/mode
 * @param data - The form data to validate
 * @returns Object with `isValid` boolean and `errors` record
 */
export function validateTransactionForm(
  type: TransactionType | "TRANSFER",
  data:
    | { amount: string; accountId: string | null; categoryId: string }
    | { amount: string; fromAccountId: string; toAccountId: string }
): { isValid: boolean; errors: TransactionValidationErrors } {
  const schema = type === "TRANSFER" ? transferSchema : baseTransactionSchema;
  const result = schema.safeParse(data);

  if (result.success) {
    return { isValid: true, errors: {} };
  }

  const errors: TransactionValidationErrors = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path[0] as keyof TransactionValidationErrors;
    // Keep only the first error per field
    if (path && !errors[path]) {
      errors[path] = issue.message;
    }
  });

  return { isValid: false, errors };
}
