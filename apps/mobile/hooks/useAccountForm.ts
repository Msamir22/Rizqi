import { useCallback, useMemo, useState } from "react";
import {
  AccountFormData,
  validateAccountForm,
  ValidationErrors,
} from "../validation/account-validation";

/**
 * Custom hook to manage the account creation form state and validation.
 */
export function useAccountForm() {
  const [formData, setFormData] = useState<AccountFormData>({
    name: "",
    accountType: "CASH",
    currency: "EGP",
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
    <K extends keyof AccountFormData>(field: K, value: AccountFormData[K]) => {
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
  const validate = useCallback(() => {
    const { isValid, errors: newErrors } = validateAccountForm(formData);
    setErrors(newErrors);
    return isValid;
  }, [formData]);

  /**
   * Resets the form to initial values.
   */
  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      accountType: "CASH",
      currency: "EGP",
      balance: "",
      bankName: "",
      cardLast4: "",
    });
    setErrors({});
    setIsTouched({});
  }, []);

  const isValid = useMemo(() => {
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
