import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for recurring payment form validation.
 * Mirrors required DB columns from `recurring_payments`.
 */
const recurringPaymentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be under 100 characters"),
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecurringPaymentFormData = z.infer<typeof recurringPaymentSchema>;

/** Union of all possible form field keys for error display */
export type RecurringPaymentValidationErrors = Partial<
  Record<"name" | "amount" | "accountId" | "categoryId", string>
>;

// ---------------------------------------------------------------------------
// Validation Function
// ---------------------------------------------------------------------------

/**
 * Validates recurring payment form data using the Zod schema.
 *
 * @param data - The form data to validate
 * @returns Object with `isValid` boolean and `errors` record
 */
export function validateRecurringPaymentForm(data: {
  name: string;
  amount: string;
  accountId: string;
  categoryId: string;
}): { isValid: boolean; errors: RecurringPaymentValidationErrors } {
  const result = recurringPaymentSchema.safeParse(data);

  if (result.success) {
    return { isValid: true, errors: {} };
  }

  const errors: RecurringPaymentValidationErrors = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path[0] as keyof RecurringPaymentValidationErrors;
    // Keep only the first error per field
    if (path && !errors[path]) {
      errors[path] = issue.message;
    }
  });

  return { isValid: false, errors };
}
