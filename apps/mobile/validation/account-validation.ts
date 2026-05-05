import { AccountType, CurrencyType } from "@monyvi/db";
import { t } from "i18next";
import { z } from "zod";

const NON_NEGATIVE_BALANCE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SIGNED_BALANCE_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

const BALANCE_VALIDATION_MESSAGES = {
  createInvalid: "validation_balance_create_invalid",
  editInvalid: "validation_balance_edit_invalid",
} as const;

export function isValidAccountBalance(
  value: string,
  options: { readonly allowNegative: boolean }
): boolean {
  const pattern = options.allowNegative
    ? SIGNED_BALANCE_PATTERN
    : NON_NEGATIVE_BALANCE_PATTERN;
  return pattern.test(value);
}

/**
 * Zod schema for account form validation.
 */
export const accountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "validation_name_required")
    .max(50, "validation_name_max"),
  accountType: z.enum([
    "CASH",
    "BANK",
    "DIGITAL_WALLET",
  ] as const) as z.ZodType<AccountType>,
  currency: z
    .string()
    .min(1, "validation_currency_required") as z.ZodType<CurrencyType>,
  balance: z
    .string()
    .min(1, "validation_initial_balance_required")
    .refine(
      (val) => isValidAccountBalance(val, { allowNegative: false }),
      BALANCE_VALIDATION_MESSAGES.createInvalid
    )
    .refine(
      (val) => parseFloat(val) >= 0,
      "validation_initial_balance_non_negative"
    ),
  bankName: z
    .string()
    .max(50, "validation_bank_name_max")
    .optional()
    .or(z.literal("")),
  cardLast4: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || /^\d{4}$/.test(val), "validation_card_last_4"),
  smsSenderName: z
    .string()
    .max(100, "validation_sms_sender_name_max")
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
      errors[path] = t(`accounts:${issue.message}`);
    }
  });

  return {
    isValid: false,
    errors,
  };
}

/**
 * Zod schema for edit account form validation.
 * Allows negative balances (e.g., overdrafts) unlike the create schema.
 */
export const editAccountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "validation_name_required")
    .max(50, "validation_name_max"),
  balance: z
    .string()
    .min(1, "validation_balance_required")
    .refine(
      (val) => isValidAccountBalance(val, { allowNegative: true }),
      BALANCE_VALIDATION_MESSAGES.editInvalid
    ),
  bankName: z
    .string()
    .max(50, "validation_bank_name_max")
    .optional()
    .or(z.literal("")),
  cardLast4: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || /^\d{4}$/.test(val), "validation_card_last_4"),
  smsSenderName: z
    .string()
    .max(100, "validation_sms_sender_name_max")
    .optional()
    .or(z.literal("")),
});

export type EditAccountFormData = z.infer<typeof editAccountFormSchema>;

export type EditValidationErrors = Partial<
  Record<keyof EditAccountFormData, string>
>;

/**
 * Validates the edit account form data using zod.
 * Unlike validateAccountForm, this allows negative balances.
 *
 * @param data - The form data to validate
 * @returns Object with isValid boolean and errors object
 */
export function validateEditAccountForm(data: unknown): {
  isValid: boolean;
  errors: EditValidationErrors;
} {
  const result = editAccountFormSchema.safeParse(data);

  if (result.success) {
    return { isValid: true, errors: {} };
  }

  const errors: EditValidationErrors = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path[0] as keyof EditAccountFormData;
    if (path && !errors[path]) {
      errors[path] = t(`accounts:${issue.message}`);
    }
  });

  return {
    isValid: false,
    errors,
  };
}
