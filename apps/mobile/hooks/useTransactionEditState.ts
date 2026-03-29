import type { AccountOption } from "@/components/transaction-review/edit-modal/AccountSelector";
import {
  getEditFormConfig,
  type EditFormConfig,
} from "@/components/transaction-review/edit-modal/get-edit-form-config";
import type { PendingAccount } from "@/services/pending-account-service";
import type { AccountWithBankDetails } from "@/services/sms-account-matcher";
import {
  buildPendingAccount,
  buildTransactionEdits,
  generatePendingTempId,
  isDuplicateAccount,
  type TransactionEdits,
} from "@/services/sms-edit-modal-service";
import {
  TransactionValidationErrors,
  validateTransactionForm,
} from "@/validation/transaction-validation";
import type { Category, CurrencyType, TransactionType } from "@astik/db";
import { parseAmountInput, type ReviewableTransaction } from "@astik/logic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseTransactionEditStateReturn {
  readonly state: {
    readonly amount: string;
    readonly note: string;
    readonly counterparty: string;
    readonly txType: TransactionType;
    readonly selectedAccountId: string | null;
    readonly selectedAccountName: string;
    readonly isAccountPickerOpen: boolean;
    readonly formErrors: TransactionValidationErrors;
    readonly isCreatingNew: boolean;
    readonly newAccountName: string;
    readonly newAccountError: string | null;
    readonly selectedToAccountId: string | null;
    readonly selectedToAccountName: string;
    readonly newToAccountName: string;
    readonly isToAccountPickerOpen: boolean;
    readonly isCreatingNewToAccount: boolean;
    readonly isCategoryPickerOpen: boolean;
    readonly selectedCategoryId: string;
    readonly selectedCategoryDisplayName: string | null;
    readonly relevantCategories: readonly Category[];
    readonly accountOptions: readonly AccountOption[];
    readonly hasBankAccounts: boolean;
    readonly cashAccountOptions: readonly AccountOption[];
    readonly hasCashAccounts: boolean;
    readonly selectedAccountCurrency: CurrencyType;
    readonly hasCurrencyMismatch: boolean;
    readonly formConfig: EditFormConfig;
  };
  readonly setters: {
    readonly setAmount: React.Dispatch<React.SetStateAction<string>>;
    readonly setNote: React.Dispatch<React.SetStateAction<string>>;
    readonly setCounterparty: React.Dispatch<React.SetStateAction<string>>;
    readonly setTxType: React.Dispatch<React.SetStateAction<TransactionType>>;
    readonly setIsAccountPickerOpen: React.Dispatch<
      React.SetStateAction<boolean>
    >;
    readonly setNewAccountName: React.Dispatch<React.SetStateAction<string>>;
    readonly setIsCategoryPickerOpen: React.Dispatch<
      React.SetStateAction<boolean>
    >;
    readonly setSelectedCategoryId: React.Dispatch<
      React.SetStateAction<string>
    >;
    readonly setSelectedToAccountId: React.Dispatch<
      React.SetStateAction<string | null>
    >;
    readonly setSelectedToAccountName: React.Dispatch<
      React.SetStateAction<string>
    >;
    readonly setIsToAccountPickerOpen: React.Dispatch<
      React.SetStateAction<boolean>
    >;
    readonly setNewToAccountName: React.Dispatch<React.SetStateAction<string>>;
    readonly setFormErrors: React.Dispatch<
      React.SetStateAction<TransactionValidationErrors>
    >;
  };
  readonly accountHandlers: {
    readonly handleStartNew: () => void;
    readonly handleCancelNew: () => void;
    readonly handleStartNewToAccount: () => void;
    readonly handleCancelNewToAccount: () => void;
    readonly handleSave: () => void;
    readonly handleSelectAccount: (opt: AccountOption) => void;
  };
}

export interface UseTransactionEditStateProps {
  readonly transaction: ReviewableTransaction;
  readonly currentAccountName: string | null;
  readonly currentAccountId: string | null;
  readonly accounts: readonly AccountWithBankDetails[];
  readonly pendingAccounts: readonly PendingAccount[];
  readonly categoryMap: ReadonlyMap<string, Category>;
  readonly expenseCategories: readonly Category[];
  readonly incomeCategories: readonly Category[];
  readonly onSave: (edits: TransactionEdits) => void;
  readonly onCreatePendingAccount: (account: PendingAccount) => void;
}

export function useTransactionEditState({
  transaction,
  currentAccountName,
  currentAccountId,
  accounts,
  pendingAccounts,
  categoryMap,
  expenseCategories,
  incomeCategories,
  onSave,
  onCreatePendingAccount,
}: UseTransactionEditStateProps): UseTransactionEditStateReturn {
  // Config
  const formConfig = useMemo(
    () => getEditFormConfig(transaction),
    [transaction]
  );

  const readTransactionNote = (tx: ReviewableTransaction): string => {
    const value = (tx as { note?: unknown }).note;
    return typeof value === "string" ? value : "";
  };

  // Local editable state
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [note, setNote] = useState(readTransactionNote(transaction));

  const [counterparty, setCounterparty] = useState(
    transaction.counterparty || ""
  );
  const [txType, setTxType] = useState<TransactionType>(transaction.type);
  const [selectedAccountId, setSelectedAccountId] = useState(currentAccountId);
  const [selectedAccountName, setSelectedAccountName] = useState(
    currentAccountName ?? ""
  );
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<TransactionValidationErrors>({});

  // "+ New" account creation state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAccountName, setNewAccountName] = useState(transaction.originLabel);
  const [newAccountError, setNewAccountError] = useState<string | null>(null);

  const [selectedToAccountId, setSelectedToAccountId] = useState<string | null>(
    null
  );
  const [selectedToAccountName, setSelectedToAccountName] = useState("");
  const [newToAccountName, setNewToAccountName] = useState("Cash");
  const [isToAccountPickerOpen, setIsToAccountPickerOpen] = useState(false);
  const [isCreatingNewToAccount, setIsCreatingNewToAccount] = useState(false);

  // Category state
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    transaction.categoryId
  );

  const selectedCategoryDisplayName = useMemo((): string | null => {
    const selectedCategory = categoryMap.get(
      selectedCategoryId ?? transaction.categoryId
    );
    return selectedCategory?.displayName ?? null;
  }, [selectedCategoryId, categoryMap, transaction.categoryId]);

  const relevantCategories = useMemo(() => {
    return txType === "EXPENSE" ? expenseCategories : incomeCategories;
  }, [txType, expenseCategories, incomeCategories]);

  // Merge real accounts + pending accounts for the dropdown
  const accountOptions = useMemo<readonly AccountOption[]>(() => {
    const real: AccountOption[] = accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      currency: acc.currency,
      isPending: false,
      type: acc.type,
    }));
    const pending: AccountOption[] = pendingAccounts.map((pa) => ({
      id: pa.tempId,
      name: pa.name,
      currency: pa.currency,
      isPending: true,
      type: "BANK",
    }));
    return [...real, ...pending].filter((o) => o.type === "BANK");
  }, [accounts, pendingAccounts]);

  const hasBankAccounts = accountOptions.length > 0;

  // Cash accounts for ATM withdrawal TO dropdown
  const cashAccountOptions = useMemo<readonly AccountOption[]>(() => {
    return accounts
      .filter((acc) => acc.type === "CASH")
      .map((acc) => ({
        id: acc.id,
        name: acc.name,
        currency: acc.currency,
        isPending: false,
        type: acc.type,
      }));
  }, [accounts]);

  const hasCashAccounts = cashAccountOptions.length > 0;

  // Determine selected account's currency for conversion notice
  const selectedAccountCurrency = useMemo(() => {
    const found = accountOptions.find((opt) => opt.id === selectedAccountId);
    return found?.currency ?? transaction.currency;
  }, [accountOptions, selectedAccountId, transaction.currency]);

  const hasCurrencyMismatch = selectedAccountCurrency !== transaction.currency;

  // Track which transaction identity has been initialized
  const initializedForIdentityRef = useRef<string | null>(null);
  const transactionIdentity =
    transaction.deduplicationHash ??
    `${transaction.counterparty}-${transaction.amount}-${transaction.date.getTime()}`;

  useEffect(() => {
    if (initializedForIdentityRef.current === transactionIdentity) return;
    initializedForIdentityRef.current = transactionIdentity;

    setAmount(transaction.amount.toString());
    setNote(readTransactionNote(transaction));
    setCounterparty(transaction.counterparty || "");
    setTxType(transaction.type);

    const matchedOption = currentAccountId
      ? accountOptions.find((o) => o.id === currentAccountId)
      : undefined;

    if (matchedOption) {
      setSelectedAccountId(matchedOption.id);
      setSelectedAccountName(matchedOption.name);
    } else {
      setSelectedAccountId(null);
      setSelectedAccountName("");
    }

    setIsAccountPickerOpen(false);
    setIsCreatingNew(!hasBankAccounts);
    setNewAccountName(transaction.originLabel);
    setNewAccountError(null);
    setFormErrors({});

    if (formConfig.showToAccount) {
      setIsToAccountPickerOpen(false);
      const hasCash = cashAccountOptions.length > 0;
      setIsCreatingNewToAccount(!hasCash);
      if (hasCash) {
        const currencyMatch = cashAccountOptions.find(
          (o) => o.currency === transaction.currency
        );
        const fallback = cashAccountOptions[0];
        const selected = currencyMatch ?? fallback;
        setSelectedToAccountId(selected.id);
        setSelectedToAccountName(selected.name);
      } else {
        setSelectedToAccountId(null);
        setSelectedToAccountName("");
        setNewToAccountName("Cash");
      }
    }
  }, [
    transactionIdentity,
    transaction,
    currentAccountId,
    currentAccountName,
    accountOptions,
    hasBankAccounts,
    formConfig.showToAccount,
    cashAccountOptions,
  ]);

  const prevTypeRef = useRef(txType);

  useEffect(() => {
    if (relevantCategories.length === 0) return;

    const typeChanged = prevTypeRef.current !== txType;
    prevTypeRef.current = txType;

    if (!selectedCategoryId || typeChanged) {
      setSelectedCategoryId(relevantCategories[0].id);
    }
  }, [relevantCategories, selectedCategoryId, txType]);

  // Handlers

  const handleStartNew = useCallback(() => {
    setIsCreatingNew(true);
    setIsAccountPickerOpen(false);
    setNewAccountName(transaction.originLabel);
  }, [transaction.originLabel]);

  const handleCancelNew = useCallback(() => {
    setIsCreatingNew(false);
    setNewAccountError(null);
  }, []);

  const handleSave = useCallback(() => {
    const isCreatingNewAccount = isCreatingNew || !hasBankAccounts;
    let resolvedAccountId: string | null = null;
    let resolvedAccountName: string | null = null;
    let pendingAccountToCreate: PendingAccount | null = null;

    if (isCreatingNewAccount) {
      const trimmedName = newAccountName.trim();

      if (!trimmedName) {
        setNewAccountError("Account name is required");
        return;
      }

      if (
        isDuplicateAccount(
          trimmedName,
          transaction.currency,
          accounts,
          pendingAccounts
        )
      ) {
        setNewAccountError(
          `An account named "${trimmedName}" in ${transaction.currency} already exists`
        );
        return;
      }

      const tempId = generatePendingTempId();
      pendingAccountToCreate = buildPendingAccount(tempId, {
        name: trimmedName,
        currency: transaction.currency,
        senderDisplayName: transaction.originLabel,
        cardLast4:
          "cardLast4" in transaction
            ? ((transaction as { cardLast4?: string }).cardLast4 ?? undefined)
            : undefined,
      });

      resolvedAccountId = tempId;
      resolvedAccountName = trimmedName;
    } else {
      resolvedAccountId = selectedAccountId;
      resolvedAccountName = selectedAccountName;
    }

    const { isValid, errors } = validateTransactionForm(txType, {
      amount,
      accountId: resolvedAccountId,
      categoryId: selectedCategoryId,
    });

    const requiresToAccount = formConfig.showToAccount;
    const isToAccountValid =
      !requiresToAccount ||
      (isCreatingNewToAccount
        ? newToAccountName.trim().length > 0
        : !!selectedToAccountId);

    if (!isValid || !isToAccountValid) {
      const finalErrors = { ...errors };
      if (!isToAccountValid) {
        finalErrors.toAccountId = isCreatingNewToAccount
          ? "Cash account name is required"
          : "Cash account is required";
      }
      setFormErrors(finalErrors);
      return;
    }

    setFormErrors({});

    if (pendingAccountToCreate) {
      onCreatePendingAccount(pendingAccountToCreate);
    }

    const edits = buildTransactionEdits({
      accountId: resolvedAccountId,
      accountName: resolvedAccountName,
      counterparty,
      type: txType,
      categoryId: selectedCategoryId,
      amount: parseFloat(parseAmountInput(amount)),
      note: note.trim() || undefined,
      toAccountId: formConfig.showToAccount
        ? isCreatingNewToAccount
          ? null
          : selectedToAccountId
        : undefined,
      toAccountName: formConfig.showToAccount
        ? isCreatingNewToAccount
          ? newToAccountName.trim() || "Cash"
          : selectedToAccountName
        : undefined,
    });

    onSave(edits);
  }, [
    amount,
    note,
    counterparty,
    txType,
    selectedAccountId,
    selectedAccountName,
    transaction,
    isCreatingNew,
    hasBankAccounts,
    newAccountName,
    accounts,
    pendingAccounts,
    selectedCategoryId,
    onSave,
    onCreatePendingAccount,
    formConfig.showToAccount,
    selectedToAccountId,
    selectedToAccountName,
    newToAccountName,
    isCreatingNewToAccount,
  ]);

  return {
    state: {
      amount,
      note,
      counterparty,
      txType,
      selectedAccountId,
      selectedAccountName,
      isAccountPickerOpen,
      formErrors,
      isCreatingNew,
      newAccountName,
      newAccountError,
      selectedToAccountId,
      selectedToAccountName,
      newToAccountName,
      isToAccountPickerOpen,
      isCreatingNewToAccount,
      isCategoryPickerOpen,
      selectedCategoryId,
      selectedCategoryDisplayName,
      relevantCategories,
      accountOptions,
      hasBankAccounts,
      cashAccountOptions,
      hasCashAccounts,
      selectedAccountCurrency,
      hasCurrencyMismatch,
      formConfig,
    },
    setters: {
      setAmount,
      setNote,
      setCounterparty,
      setTxType,
      setIsAccountPickerOpen,
      setNewAccountName,
      setIsCategoryPickerOpen,
      setSelectedCategoryId,
      setSelectedToAccountId,
      setSelectedToAccountName,
      setIsToAccountPickerOpen,
      setNewToAccountName,
      setFormErrors,
    },
    accountHandlers: {
      handleStartNew,
      handleCancelNew,
      handleStartNewToAccount: useCallback(() => {
        setIsCreatingNewToAccount(true);
        setIsToAccountPickerOpen(false);
      }, []),
      handleCancelNewToAccount: useCallback(() => {
        setIsCreatingNewToAccount(false);
        setNewToAccountName("Cash");
        setFormErrors((prev) => ({ ...prev, toAccountId: undefined }));
      }, []),
      handleSave,
      handleSelectAccount: useCallback((opt: AccountOption) => {
        setSelectedAccountId(opt.id);
        setSelectedAccountName(opt.name);
        setIsAccountPickerOpen(false);
        setFormErrors((prev) => ({
          ...prev,
          accountId: undefined,
        }));
      }, []),
    },
  };
}
