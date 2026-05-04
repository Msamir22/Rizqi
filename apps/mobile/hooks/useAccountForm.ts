import { t } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkAccountNameUniqueness } from "../services/edit-account-service";
import { getCurrentUserId } from "../services/supabase";
import { logger } from "../utils/logger";
import {
  AccountFormData,
  validateAccountForm,
  ValidationErrors,
} from "../validation/account-validation";
import { usePreferredCurrency } from "./usePreferredCurrency";

const UNIQUENESS_DEBOUNCE_MS = 300;
const DEFAULT_INITIAL_BALANCE = "0";

interface UseAccountFormOptions {
  /**
   * Pre-select an account type. Used by deep-links such as the
   * OnboardingGuideCard "Add bank account" step which should land the user
   * on the form with BANK already chosen.
   */
  readonly initialAccountType?: AccountFormData["accountType"];
}

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
  isCheckingUniqueness: boolean;
}

/**
 * Manages account creation form state, real-time and full validation, field
 * touch tracking, and debounced account-name uniqueness checks.
 *
 * Uniqueness is checked against (userId, currency, name) — case-insensitive,
 * trimmed — so changing either the name OR the currency re-runs the check.
 * The Save button should be disabled while `isCheckingUniqueness` is true.
 *
 * @returns An object containing:
 * - `formData` — current form values for the account form
 * - `errors` — current field-level validation errors
 * - `updateField` — function to update a single field; performs partial validation for that field and marks it as touched
 * - `validate` — function that runs full form validation, updates `errors`, and returns `true` if the form is valid
 * - `resetForm` — function that resets the form to initial values
 * - `isValid` — `true` if the current `formData` passes validation, `false` otherwise
 * - `isTouched` — mapping of form fields to a boolean indicating whether each field has been interacted with
 * - `isCheckingUniqueness` — `true` while a debounced uniqueness query is in flight
 */
export function useAccountForm(
  options: UseAccountFormOptions = {}
): UseAccountFormResult {
  const { preferredCurrency } = usePreferredCurrency();
  const { initialAccountType } = options;

  const [formData, setFormData] = useState<AccountFormData>({
    name: "",
    accountType: initialAccountType ?? "CASH",
    currency: preferredCurrency,
    balance: DEFAULT_INITIAL_BALANCE,
    bankName: "",
    cardLast4: "",
    smsSenderName: "",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isTouched, setIsTouched] = useState<
    Partial<Record<keyof AccountFormData, boolean>>
  >({});
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);

  // Resolve the current userId once on mount. Used to scope the uniqueness
  // check; if it stays null we silently skip the check (screen will block
  // submit anyway when getCurrentUserId returns null).
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCurrentUserId()
      .then((id) => {
        if (!cancelled) userIdRef.current = id;
      })
      .catch((err: unknown) => {
        logger.warn("useAccountForm_user_id_resolve_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce timer for uniqueness check — mirrors useEditAccountForm.
  const uniquenessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (uniquenessTimerRef.current) {
        clearTimeout(uniquenessTimerRef.current);
      }
    };
  }, []);

  /** Run a debounced uniqueness check for the given (name, currency) pair. */
  const checkUniqueness = useCallback(
    (name: string, currency: AccountFormData["currency"]): void => {
      if (uniquenessTimerRef.current) {
        clearTimeout(uniquenessTimerRef.current);
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        setIsCheckingUniqueness(false);
        return;
      }

      const userId = userIdRef.current;
      if (!userId) {
        // Not signed in yet — don't surface a uniqueness error; the create
        // flow will block submit on the missing session.
        setIsCheckingUniqueness(false);
        return;
      }

      setIsCheckingUniqueness(true);

      uniquenessTimerRef.current = setTimeout(() => {
        void (async () => {
          const result = await checkAccountNameUniqueness(
            userId,
            trimmedName,
            currency
          );

          if (result.isUnique && !result.error) {
            setErrors((prev) => {
              if (prev.name === t("accounts:validation_account_name_taken")) {
                const { name: _removed, ...rest } = prev;
                return rest;
              }
              return prev;
            });
          } else if (!result.isUnique && !result.error) {
            setErrors((prev) => ({
              ...prev,
              name: t("accounts:validation_account_name_taken"),
            }));
          } else if (result.error) {
            // Don't block the user on uniqueness query failures.
            logger.warn("uniqueness_check_failed", { error: result.error });
          }

          setIsCheckingUniqueness(false);
        })();
      }, UNIQUENESS_DEBOUNCE_MS);
    },
    []
  );

  // Sync currency when preferredCurrency loads (async profile fetch).
  // Only update if the user hasn't manually touched the currency field.
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

        if (field === "name") {
          checkUniqueness(value as string, newData.currency);
        } else if (field === "currency") {
          checkUniqueness(newData.name, value as AccountFormData["currency"]);
        }

        return newData;
      });

      setIsTouched((prev) => ({ ...prev, [field]: true }));
    },
    [checkUniqueness]
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
      accountType: initialAccountType ?? "CASH",
      currency: preferredCurrency,
      balance: DEFAULT_INITIAL_BALANCE,
      bankName: "",
      cardLast4: "",
      smsSenderName: "",
    });
    setErrors({});
    setIsTouched({});
    setIsCheckingUniqueness(false);
    if (uniquenessTimerRef.current) {
      clearTimeout(uniquenessTimerRef.current);
      uniquenessTimerRef.current = null;
    }
  }, [preferredCurrency, initialAccountType]);

  const isValid = useMemo((): boolean => {
    const { isValid: schemaValid } = validateAccountForm(formData);
    return (
      schemaValid &&
      !isCheckingUniqueness &&
      errors.name !== t("accounts:validation_account_name_taken")
    );
  }, [formData, isCheckingUniqueness, errors.name]);

  return {
    formData,
    errors,
    updateField,
    validate,
    resetForm,
    isValid,
    isTouched,
    isCheckingUniqueness,
  };
}
