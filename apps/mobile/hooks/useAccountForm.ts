import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccountFormData,
  validateAccountForm,
  ValidationErrors,
} from "../validation/account-validation";
import { usePreferredCurrency } from "./usePreferredCurrency";

interface UseAccountFormResult {
  formData: AccountFormData;
  errors: ValidationErrors;
  updateField: <K extends keyof AccountFormData>(
    field: K,
    value: AccountFormData[K]
  ) => void;
  validate: () => boolean;
  resetForm: () => void;
  isValid: boolean;
  isTouched: Partial<Record<keyof AccountFormData, boolean>>;
}

/**
 * Manages account creation form state, real-time and full validation, and field touch tracking.
 *
 * @returns An object containing:
 * - `formData` — current form values for the account form
 * - `errors` — current field-level validation errors
 * - `updateField` — function to update a single field; performs partial validation for that field and marks it as touched
 * - `validate` — function that runs full form validation, updates `errors`, and returns `true` if the form is valid
 * - `resetForm` — function that resets the form to initial values
 * - `isValid` — `true` if the current `formData` passes validation, `false` otherwise
 * - `isTouched` — mapping of form fields to a boolean indicating whether each field has been interacted with
 */
export function useAccountForm(): UseAccountFormResult {
  const { preferredCurrency } = usePreferredCurrency();

  const [formData, setFormData] = useState<AccountFormData>({
    name: "",
    accountType: "CASH",
    currency: preferredCurrency,
    balance: "",
    bankName: "",
    cardLast4: "",
    smsSenderName: "",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isTouched, setIsTouched] = useState<
    Partial<Record<keyof AccountFormData, boolean>>
  >({});

  // Sync currency when preferredCurrency loads (async profile fetch)
  // Only update if the user hasn't manually touched the currency field
  useEffect(() => {
    if (!isTouched.currency) {
      setFormData((prev) => ({ ...prev, currency: preferredCurrency }));
    }
  }, [preferredCurrency, isTouched.currency]);

  /**
   * Updates a single field in the form and performs partial validation.
   */
  const updateField = useCallback(
    <K extends keyof AccountFormData>(
      field: K,
      value: AccountFormData[K]
    ): void => {
      setFormData((prev) => {
        const newData = { ...prev, [field]: value };

        // Real-time validation for specific field if it has been touched
        const { errors: newErrors } = validateAccountForm(newData);
        setErrors((prevErrors) => ({
          ...prevErrors,
          [field]: newErrors[field],
        }));

        return newData;
      });

      setIsTouched((prev) => ({ ...prev, [field]: true }));
    },
    []
  );

  /**
   * Validates the entire form.
   */
  const validate = useCallback((): boolean => {
    const { isValid, errors: newErrors } = validateAccountForm(formData);
    setErrors(newErrors);
    return isValid;
  }, [formData]);

  /**
   * Resets the form to initial values.
   */
  const resetForm = useCallback((): void => {
    setFormData({
      name: "",
      accountType: "CASH",
      currency: preferredCurrency,
      balance: "",
      bankName: "",
      cardLast4: "",
      smsSenderName: "",
    });
    setErrors({});
    setIsTouched({});
  }, [preferredCurrency]);

  const isValid = useMemo((): boolean => {
    const { isValid } = validateAccountForm(formData);
    return isValid;
  }, [formData]);

  return {
    formData,
    errors,
    updateField,
    validate,
    resetForm,
    isValid,
    isTouched,
  };
}
