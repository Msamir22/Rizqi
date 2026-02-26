import { AccountType, CurrencyType } from "@astik/db";
import { z } from "zod";

/**
 * Zod schema for account form validation.
 */
export const accountFormSchema = z.object({
  name: z
    .string()
    .min(1, "Account name is required")
    .max(50, "Account name must be less than 50 characters"),
  accountType: z.enum([
    "CASH",
    "BANK",
    "DIGITAL_WALLET",
  ] as const) as z.ZodType<AccountType>,
  currency: z
    .string()
    .min(1, "Currency is required") as z.ZodType<CurrencyType>,
  balance: z
    .string()
    .min(1, "Initial balance is required")
    .refine(
      (val) => !isNaN(parseFloat(val)),
      "Initial balance must be a valid number"
    )
    .refine(
      (val) => parseFloat(val) >= 0,
      "Initial balance cannot be negative"
    ),
  bankName: z
    .string()
    .max(50, "Bank name must be less than 50 characters")
    .optional()
    .or(z.literal("")),
  cardLast4: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || /^\d{4}$/.test(val), "Must be exactly 4 digits"),
  smsSenderName: z
    .string()
    .max(100, "SMS sender name must be less than 100 characters")
    .optional()
    .or(z.literal("")),
});

export type AccountFormData = z.infer<typeof accountFormSchema>;

/**
 * Partial and record of error messages for each form field.
 */
export type ValidationErrors = Partial<Record<keyof AccountFormData, string>>;

/**
 * Validates the account form data using zod.
 *
 * @param data - The form data to validate
 * @returns Object with isValid boolean and errors object
 */
export function validateAccountForm(data: unknown): {
  isValid: boolean;
  errors: ValidationErrors;
} {
  const result = accountFormSchema.safeParse(data);

  if (result.success) {
    return { isValid: true, errors: {} };
  }

  const errors: ValidationErrors = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path[0] as keyof AccountFormData;
    if (path && !errors[path]) {
      errors[path] = issue.message;
    }
  });

  return {
    isValid: false,
    errors,
  };
}
