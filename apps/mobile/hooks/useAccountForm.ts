import { useCallback, useMemo, useState } from "react";
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
 * Custom hook to manage the account creation form state and validation.
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
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isTouched, setIsTouched] = useState<
    Partial<Record<keyof AccountFormData, boolean>>
  >({});

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
    });
    setErrors({});
    setIsTouched({});
  }, []);

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
