/**
 * useEditAccountForm Hook
 *
 * Manages edit account form state with pre-filled data from an existing account,
 * dirty tracking to enable/disable the Save button, and inline uniqueness
 * validation with debounce.
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook (encapsulates form state + validation logic)
 * - SOLID: SRP — form state management only, no persistence
 * - Debounced uniqueness check avoids excessive queries
 *
 * @module useEditAccountForm
 */

import type { Account, AccountType, CurrencyType } from "@astik/db";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type EditAccountFormData,
  type EditValidationErrors,
  validateEditAccountForm,
} from "../validation/account-validation";
import { checkAccountNameUniqueness } from "../services/edit-account-service";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNIQUENESS_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Form data snapshot used for dirty tracking. */
interface OriginalAccountData {
  readonly name: string;
  readonly balance: string;
  readonly isDefault: boolean;
  readonly bankName: string;
  readonly cardLast4: string;
  readonly smsSenderName: string;
}

interface UseEditAccountFormResult {
  /** Current form field values */
  readonly formData: EditAccountFormData;
  /** Current field-level validation errors */
  readonly errors: EditValidationErrors;
  /** Whether the form passes validation */
  readonly isValid: boolean;
  /** Whether any field has been modified from its original value */
  readonly isDirty: boolean;
  /** Which fields the user has interacted with */
  readonly isTouched: Partial<Record<keyof EditAccountFormData, boolean>>;
  /** Whether a uniqueness check is in progress */
  readonly isCheckingUniqueness: boolean;
  /** Account type (read-only, for conditional field display) */
  readonly accountType: AccountType;
  /** Account currency (read-only, for display) */
  readonly currency: CurrencyType;
  /** Whether the account is currently set as default */
  readonly isDefault: boolean;
  /** Original balance before edits (needed for balance change detection) */
  readonly originalBalance: number;
  /** Update a single form field */
  readonly updateField: <K extends keyof EditAccountFormData>(
    field: K,
    value: EditAccountFormData[K]
  ) => void;
  /** Toggle the isDefault flag */
  readonly toggleDefault: () => void;
  /** Run full form validation; returns true if valid */
  readonly validate: () => boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages edit account form state.
 *
 * Pre-fills from an existing Account model record.
 * Tracks dirty state (whether any field differs from the original).
 * Debounces account name uniqueness checks (300 ms).
 *
 * @param account - The WatermelonDB Account model record to edit
 * @param bankDetails - Optional bank details (bank name, card last 4, SMS sender)
 * @returns Form state, errors, dirty flag, and field update functions
 */
export function useEditAccountForm(
  account: Account,
  bankDetails?: {
    readonly bankName: string;
    readonly cardLast4: string;
    readonly smsSenderName: string;
  }
): UseEditAccountFormResult {
  // Snapshot the original data for dirty tracking.
  // useRef to avoid re-creating on each render.
  const originalData = useRef<OriginalAccountData>({
    name: account.name,
    balance: String(account.balance),
    isDefault: account.isDefault,
    bankName: bankDetails?.bankName ?? "",
    cardLast4: bankDetails?.cardLast4 ?? "",
    smsSenderName: bankDetails?.smsSenderName ?? "",
  });

  const [formData, setFormData] = useState<EditAccountFormData>({
    name: account.name,
    balance: String(account.balance),
    bankName: bankDetails?.bankName ?? "",
    cardLast4: bankDetails?.cardLast4 ?? "",
    smsSenderName: bankDetails?.smsSenderName ?? "",
  });

  const [isDefault, setIsDefault] = useState(account.isDefault);
  const [errors, setErrors] = useState<EditValidationErrors>({});
  const [isTouched, setIsTouched] = useState<
    Partial<Record<keyof EditAccountFormData, boolean>>
  >({});
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);

  // Debounce timer ref for uniqueness check
  const uniquenessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (uniquenessTimerRef.current) {
        clearTimeout(uniquenessTimerRef.current);
      }
    };
  }, []);

  /**
   * Run debounced account name uniqueness check.
   */
  const checkUniqueness = useCallback(
    (name: string): void => {
      // Clear any pending timer
      if (uniquenessTimerRef.current) {
        clearTimeout(uniquenessTimerRef.current);
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        setErrors((prev) => {
          const { name: _removed, ...rest } = prev;
          return rest;
        });
        setIsCheckingUniqueness(false);
        return;
      }

      setIsCheckingUniqueness(true);

      uniquenessTimerRef.current = setTimeout(() => {
        void (async () => {
          const result = await checkAccountNameUniqueness(
            account.userId,
            trimmedName,
            account.currency,
            account.id
          );

          if (result.isUnique && !result.error) {
            // Clear any previous uniqueness error
            setErrors((prev) => {
              const { name: _removed, ...rest } = prev;
              return rest;
            });
          } else if (!result.isUnique && !result.error) {
            setErrors((prev) => ({
              ...prev,
              name: "An account with this name already exists",
            }));
          } else if (result.error) {
            // Don't block the user on uniqueness check errors
            console.warn("Uniqueness check failed:", result.error);
          }

          setIsCheckingUniqueness(false);
        })();
      }, UNIQUENESS_DEBOUNCE_MS);
    },
    [account.userId, account.currency, account.id]
  );

  /**
   * Update a single form field with validation.
   */
  const updateField = useCallback(
    <K extends keyof EditAccountFormData>(
      field: K,
      value: EditAccountFormData[K]
    ): void => {
      setFormData((prev) => {
        const newData = { ...prev, [field]: value };

        // Run field-level validation
        const { errors: newErrors } = validateEditAccountForm(newData);
        setErrors((prevErrors) => ({
          ...prevErrors,
          [field]: newErrors[field],
        }));

        return newData;
      });

      setIsTouched((prev) => ({ ...prev, [field]: true }));

      // Trigger uniqueness check for name field
      if (field === "name") {
        checkUniqueness(value as string);
      }
    },
    [checkUniqueness]
  );

  /**
   * Toggle the isDefault flag.
   */
  const toggleDefault = useCallback((): void => {
    setIsDefault((prev) => !prev);
  }, []);

  /**
   * Run full form validation.
   */
  const validate = useCallback((): boolean => {
    const { isValid, errors: newErrors } = validateEditAccountForm(formData);
    setErrors(newErrors);
    return isValid;
  }, [formData]);

  /**
   * Whether the form passes all validation rules.
   */
  const isValid = useMemo((): boolean => {
    const { isValid: valid } = validateEditAccountForm(formData);
    return valid && !isCheckingUniqueness;
  }, [formData, isCheckingUniqueness]);

  /**
   * Whether any field differs from the original account data.
   */
  const isDirty = useMemo((): boolean => {
    const orig = originalData.current;
    return (
      formData.name !== orig.name ||
      formData.balance !== orig.balance ||
      isDefault !== orig.isDefault ||
      formData.bankName !== orig.bankName ||
      formData.cardLast4 !== orig.cardLast4 ||
      formData.smsSenderName !== orig.smsSenderName
    );
  }, [formData, isDefault]);

  return {
    formData,
    errors,
    isValid,
    isDirty,
    isTouched,
    isCheckingUniqueness,
    accountType: account.type,
    currency: account.currency,
    isDefault,
    originalBalance: account.balance,
    updateField,
    toggleDefault,
    validate,
  };
}
