/**
 * SmsTransactionEditModal
 *
 * Inline bottom-sheet modal for editing a parsed SMS transaction directly
 * from the review page. Allows editing: amount, category, account, counterparty,
 * date, and transaction type — without navigating away.
 *
 * Account modes:
 * 1. Dropdown (default) — when bank accounts exist, shows tappable list
 * 2. Text input — when no accounts exist OR user taps "+ New"
 * 3. "+ New" toggle — creates a PendingAccount on save
 *
 * @module SmsTransactionEditModal
 */

import { palette } from "@/constants/colors";
import type { PendingAccount } from "@/services/pending-account-service";
import type { AccountWithBankDetails } from "@/services/sms-account-matcher";
import {
  buildPendingAccount,
  buildTransactionEdits,
  generatePendingTempId,
  isDuplicateAccount,
  type TransactionEdits,
} from "@/services/sms-edit-modal-service";
import { formatToLocalDateString } from "@/utils/dateHelpers";
import {
  TransactionValidationErrors,
  validateTransactionForm,
} from "@/validation/transaction-validation";
import type {
  AccountType,
  Category,
  CurrencyType,
  MarketRate,
  TransactionType,
} from "@astik/db";
import {
  formatConversionPreview,
  formatAmountInput,
  parseAmountInput,
  type ParsedSmsTransaction,
} from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CategorySelectorModal } from "../modals/CategorySelectorModal";
import { TypeTabs } from "../add-transaction/TypeTabs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmsTransactionEditModalProps {
  /** Whether the modal is visible */
  readonly visible: boolean;
  /** The transaction being edited */
  readonly transaction: ParsedSmsTransaction;
  /** Currently assigned account name */
  readonly currentAccountName: string | null;
  /** Currently assigned account ID */
  readonly currentAccountId: string | null;
  /** Available bank accounts for the account picker */
  readonly accounts: readonly AccountWithBankDetails[];
  /** In-memory pending accounts created this session */
  readonly pendingAccounts: readonly PendingAccount[];
  /** Market rates for currency conversion (optional, from useMarketRates) */
  readonly latestRates: MarketRate | null;
  /** Map of category IDs to categories */
  readonly categoryMap: ReadonlyMap<string, Category>;
  /** Expense categories for the category picker */
  readonly expenseCategories: readonly Category[];
  /** Income categories for the category picker */
  readonly incomeCategories: readonly Category[];
  /** Called with the edits when user saves */
  readonly onSave: (edits: TransactionEdits) => void;
  /** Called when a new PendingAccount is created via "+ New" */
  readonly onCreatePendingAccount: (account: PendingAccount) => void;
  /** Called when modal is dismissed without saving */
  readonly onClose: () => void;
}

/** Account display item — either a real account or a pending one */
interface AccountOption {
  readonly id: string;
  readonly name: string;
  readonly currency: CurrencyType;
  readonly isPending: boolean;
  readonly type?: AccountType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmsTransactionEditModal({
  visible,
  transaction,
  currentAccountName,
  currentAccountId,
  accounts,
  pendingAccounts,
  latestRates,
  categoryMap,
  expenseCategories,
  incomeCategories,
  onSave,
  onCreatePendingAccount,
  onClose,
}: SmsTransactionEditModalProps): React.JSX.Element {
  // Local editable state
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [counterparty, setCounterparty] = useState(transaction.counterparty);
  const [txType, setTxType] = useState<TransactionType>(transaction.type);
  const [selectedAccountId, setSelectedAccountId] = useState(currentAccountId);
  const [selectedAccountName, setSelectedAccountName] =
    useState(currentAccountName);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<TransactionValidationErrors>({});

  // "+ New" account creation state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAccountName, setNewAccountName] = useState(
    transaction.senderDisplayName
  );

  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    transaction.categoryId
  );

  const selectedCategoryDisplayName = useMemo((): string | null => {
    const selectedCategory = categoryMap.get(
      // fallback to the original category if no category is selected
      selectedCategoryId ?? transaction.categoryId
    );
    return selectedCategory?.displayName ?? null;
  }, [selectedCategoryId, categoryMap, transaction.categoryId]);

  const relevantCategories = useMemo(() => {
    return txType === "EXPENSE" ? expenseCategories : incomeCategories;
  }, [txType, expenseCategories, incomeCategories]);

  const [newAccountError, setNewAccountError] = useState<string | null>(null);

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
      type: "BANK", // pending accounts are always bank accounts in this flow
    }));
    return [...real, ...pending].filter((o) => o.type === "BANK");
  }, [accounts, pendingAccounts]);

  // Determine if we should show text input (no bank accounts exist)
  const hasBankAccounts = accountOptions.length > 0;

  const existingCashAccountName = useMemo(() => {
    const cashAccounts = accounts.find(
      (a) => a.type === "CASH" && a.currency === transaction.currency
    );
    return cashAccounts?.name;
  }, [accounts, transaction.currency]);

  // Determine selected account's currency for conversion notice
  const selectedAccountCurrency = useMemo(() => {
    const found = accountOptions.find((opt) => opt.id === selectedAccountId);
    return found?.currency ?? "";
  }, [accountOptions, selectedAccountId]);

  // Check if currencies differ (for conversion notice)
  const hasCurrencyMismatch =
    selectedAccountCurrency !== "" &&
    selectedAccountCurrency !== transaction.currency;

  // Cash withdrawal mode
  const isAtmWithdrawal = transaction.isAtmWithdrawal === true;

  // Use a ref to prevent re-initialization when accountOptions recalculates
  // (e.g. after creating a pending account)
  const hasInitializedRef = useRef(false);

  // Reset local state when a DIFFERENT transaction is opened or the external
  // account match changes.
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    setAmount(transaction.amount.toString());
    setCounterparty(transaction.counterparty || "");
    setTxType(transaction.type);

    // Validate that the matched account exists in the BANK-only dropdown
    const matchedOption = currentAccountId
      ? accountOptions.find((o) => o.id === currentAccountId)
      : undefined;

    if (matchedOption) {
      setSelectedAccountId(matchedOption.id);
      setSelectedAccountName(matchedOption.name);
    } else {
      setSelectedAccountId("");
      setSelectedAccountName("");
    }

    setIsAccountPickerOpen(false);
    // Auto-switch to text input when no bank accounts exist
    setIsCreatingNew(!hasBankAccounts);
    setNewAccountName(transaction.senderDisplayName);
    setNewAccountError(null);
    setFormErrors({});
  }, [
    transaction,
    currentAccountId,
    currentAccountName,
    accountOptions,
    hasBankAccounts,
  ]);

  // Reset flag when transaction changes
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [transaction.smsBodyHash]);

  // TODO(tech-debt): Extract to useAutoCategorySelection hook shared with add-transaction.tsx
  // Issue: #TODO

  // Track the previous type to only auto-reset category on type change.
  // Without this, selecting L2/L3 categories resets to L1 because
  // the effect would validate against the L1-only relevantCategories.
  const prevTypeRef = useRef(txType);

  useEffect(() => {
    if (relevantCategories.length === 0) return;

    const typeChanged = prevTypeRef.current !== txType;
    prevTypeRef.current = txType;

    // Auto-select first category when: no selection yet, or type just changed
    if (!selectedCategoryId || typeChanged) {
      setSelectedCategoryId(relevantCategories[0].id);
    }
  }, [relevantCategories, selectedCategoryId, txType]);

  // ── "+ New" handlers ──────────────────────────────────────────────

  const handleStartNew = useCallback<() => void>(() => {
    setIsCreatingNew(true);
    setIsAccountPickerOpen(false);
    setNewAccountName(transaction.senderDisplayName);
    setNewAccountError(null);
  }, [transaction.senderDisplayName]);

  const handleCancelNew = useCallback<() => void>(() => {
    setIsCreatingNew(false);
    setNewAccountError(null);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────

  const handleSave = useCallback<() => void>(() => {
    const isCreatingNewAccount = isCreatingNew || !hasBankAccounts;
    let resolvedAccountId: string | null;
    let resolvedAccountName: string | null;
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
        senderDisplayName: transaction.senderDisplayName,
        cardLast4: transaction.cardLast4 ?? undefined,
      });

      resolvedAccountId = tempId;
      resolvedAccountName = trimmedName;
    } else {
      resolvedAccountId = selectedAccountId;
      resolvedAccountName = selectedAccountName;
    }

    // Standard validation
    const { isValid, errors } = validateTransactionForm(txType, {
      amount,
      accountId: resolvedAccountId ?? "",
      categoryId: selectedCategoryId,
    });

    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    // Only add pending account after validation passes
    if (pendingAccountToCreate) {
      onCreatePendingAccount(pendingAccountToCreate);
    }

    const edits = buildTransactionEdits({
      accountId: resolvedAccountId,
      accountName: resolvedAccountName,
      counterparty,
      type: txType,
      categoryId: selectedCategoryId,
      amount: parseFloat(amount),
    });

    onSave(edits);
  }, [
    amount,
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
  ]);

  const onEditCategory = useCallback<() => void>(() => {
    setIsCategoryPickerOpen(true);
  }, []);

  const handleSelectAccount = useCallback<(opt: AccountOption) => void>(
    (opt) => {
      setSelectedAccountId(opt.id);
      setSelectedAccountName(opt.name);
      setIsAccountPickerOpen(false);
      setFormErrors({});
    },
    []
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
      >
        {/* Backdrop */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="flex-1 bg-black/50"
        />

        {/* Modal content */}
        <View className="bg-slate-900 rounded-t-3xl max-h-[85%]">
          {/* Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 rounded-full bg-slate-700" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-700/50 mb-6">
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text className="text-slate-400 text-base font-bold">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-white text-lg font-bold">
              Edit Transaction
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.7}
              className="bg-nileGreen-500 px-5 py-1.5 rounded-full"
            >
              <Text className="text-slate-900 text-sm font-semibold">Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            className="px-7"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Sender info (read-only) */}
            <View className="mb-4 bg-slate-800/60 rounded-2xl gap-3 px-4 py-3 flex-row items-center border border-slate-700/50">
              <View className="w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center mr-3">
                <Ionicons
                  name="business-outline"
                  size={25}
                  color={palette.nileGreen[400]}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">
                  From
                </Text>
                <Text
                  className="text-sm text-white font-semibold flex-shrink"
                  numberOfLines={1}
                >
                  {transaction.senderDisplayName}
                </Text>
                <Text className="text-[10px] text-slate-400 mt-0.5">
                  {formatToLocalDateString(transaction.date)}
                </Text>
              </View>
            </View>

            {/* Type toggle — hidden for cash withdrawals (always Transfer) */}
            {!isAtmWithdrawal && (
              <View className="mb-2">
                <TypeTabs
                  selectedType={txType}
                  onSelect={(type) => {
                    if (type === "EXPENSE" || type === "INCOME") {
                      setTxType(type);
                    }
                  }}
                  hideTransfer={true}
                  containerClassName="mx-0"
                />
              </View>
            )}

            {/* Cash Withdrawal badge (read-only) */}
            {isAtmWithdrawal && (
              <View className="mb-4 bg-amber-500/15 rounded-xl p-3 border border-amber-500/30">
                <View className="flex-row items-center">
                  <Ionicons
                    name="cash-outline"
                    size={18}
                    color={palette.gold[500]}
                  />
                  <Text className="text-sm font-bold text-amber-400 ml-2">
                    Cash Withdrawal (Transfer)
                  </Text>
                </View>
              </View>
            )}

            {/* Amount */}

            <View className="mb-4">
              <Text className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">
                Amount
              </Text>
              <View
                className={`w-full bg-slate-800/60 border rounded-xl py-4 px-4 flex-row items-center ${
                  formErrors.amount
                    ? "border-red-500/60"
                    : "border-slate-700/50"
                }`}
              >
                <Text className="text-white font-bold text-base mr-3">
                  {transaction.currency}
                </Text>
                <TextInput
                  value={formatAmountInput(amount)}
                  onChangeText={(text) => {
                    setAmount(parseAmountInput(text));
                    if (formErrors.amount) {
                      setFormErrors((prev) => ({ ...prev, amount: undefined }));
                    }
                  }}
                  keyboardType="numeric"
                  className="flex-1 text-white text-xl font-bold m-0 p-0"
                  placeholderTextColor={palette.slate[600]}
                  placeholder="0.00"
                />
              </View>
              {formErrors.amount && (
                <Text className="text-xs text-red-400 mt-1.5 ml-1">
                  {formErrors.amount}
                </Text>
              )}
            </View>

            {/* Currency conversion notice  */}
            {hasCurrencyMismatch && (
              <View className="mb-4 bg-blue-500/10 rounded-xl p-3 border border-blue-500/25">
                <View className="flex-row items-center">
                  <Ionicons
                    name="swap-horizontal"
                    size={16}
                    color={palette.blue[500]}
                  />
                  <Text className="text-xs text-blue-400 font-medium ml-2 flex-shrink">
                    {formatConversionPreview(
                      amount,
                      transaction.currency,
                      selectedAccountCurrency,
                      latestRates
                    )}
                  </Text>
                </View>
              </View>
            )}

            {/* Counterparty & Category are hidden for ATM Withdrawals */}
            {!isAtmWithdrawal && (
              <>
                {/* Counterparty */}
                <View className="mb-4">
                  <Text className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                    {txType === "EXPENSE" ? "Merchant" : "Payee"}
                  </Text>
                  <TextInput
                    value={counterparty}
                    onChangeText={setCounterparty}
                    className="bg-slate-800/60 rounded-xl px-4 py-3 text-white text-base font-semibold border border-slate-700/50"
                    placeholderTextColor={palette.slate[600]}
                    placeholder="e.g., Carrefour, Amazon"
                  />
                </View>

                {/* Category (tap to open picker) */}
                <View className="mb-4">
                  <Text className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                    Category
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (formErrors.categoryId) {
                        setFormErrors((prev) => ({
                          ...prev,
                          categoryId: undefined,
                        }));
                      }
                      onEditCategory();
                    }}
                    activeOpacity={0.7}
                    className={`bg-slate-800/60 rounded-xl px-4 py-3 flex-row items-center justify-between border ${!selectedCategoryId || formErrors.categoryId ? "border-red-500/60" : "border-slate-700/50"}`}
                  >
                    <Text
                      className={`text-base font-semibold ${!selectedCategoryId ? "text-slate-500" : "text-white"}`}
                      numberOfLines={1}
                    >
                      {selectedCategoryDisplayName ?? "Select Category"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={palette.slate[400]}
                    />
                  </TouchableOpacity>
                  {formErrors.categoryId && (
                    <Text className="text-xs text-red-400 mt-1.5 ml-1">
                      {formErrors.categoryId}
                    </Text>
                  )}
                </View>
              </>
            )}

            {/* ── Account Section ──────────────────────────────────── */}
            <View className="mb-6">
              {/* Account label + "+ New" / "✕ Cancel" pill */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {isAtmWithdrawal ? "From Account" : "Account"}
                </Text>
                {!isCreatingNew && hasBankAccounts && (
                  <TouchableOpacity
                    onPress={handleStartNew}
                    activeOpacity={0.7}
                    className="flex-row items-center bg-emerald-500/15 px-2.5 py-1 rounded-full"
                  >
                    <Ionicons
                      name="add"
                      size={14}
                      color={palette.nileGreen[400]}
                    />
                    <Text className="text-xs text-emerald-400 font-semibold ml-0.5">
                      New
                    </Text>
                  </TouchableOpacity>
                )}
                {isCreatingNew && (
                  <TouchableOpacity
                    onPress={handleCancelNew}
                    activeOpacity={0.7}
                    className="flex-row items-center bg-red-500/15 px-2.5 py-1 rounded-full"
                  >
                    <Ionicons name="close" size={14} color={palette.red[400]} />
                    <Text className="text-xs text-red-400 font-semibold ml-0.5">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Mode: Text input (creating new) */}
              {isCreatingNew || !hasBankAccounts ? (
                <View>
                  <TextInput
                    value={newAccountName}
                    onChangeText={(text) => {
                      setNewAccountName(text);
                      setNewAccountError(null);
                    }}
                    className={`bg-slate-800/60 rounded-xl px-4 py-3 text-white text-base font-semibold border ${
                      isCreatingNew
                        ? "border-emerald-500/60"
                        : "border-slate-700/50"
                    }`}
                    placeholderTextColor={palette.slate[600]}
                    placeholder="Account name"
                    autoFocus={isCreatingNew}
                  />
                  {newAccountError && (
                    <Text className="text-xs text-red-400 mt-1.5 ml-1">
                      {newAccountError}
                    </Text>
                  )}
                  <View className="flex-row items-start bg-emerald-500/10 p-3 rounded-xl mt-3 border border-emerald-500/20">
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={palette.nileGreen[400]}
                    />
                    <Text className="text-[10px] text-emerald-400 font-bold  ml-2 flex-1 leading-4 pt-0.5">
                      {`We'll create an account named '${
                        newAccountName.trim() || "New Account"
                      }' in ${transaction.currency}.`}
                    </Text>
                  </View>
                </View>
              ) : (
                /* Mode: Dropdown (accounts exist, not creating) */
                <View>
                  <TouchableOpacity
                    onPress={() => {
                      if (formErrors.accountId) {
                        setFormErrors((prev) => ({
                          ...prev,
                          accountId: undefined,
                        }));
                      }
                      setIsAccountPickerOpen(!isAccountPickerOpen);
                    }}
                    activeOpacity={0.7}
                    className={`bg-slate-800/60 rounded-xl px-4 py-3 flex-row items-center justify-between border ${formErrors.accountId ? "border-red-500/60" : "border-slate-700/50"}`}
                  >
                    <Text
                      className="text-base text-white font-semibold flex-1"
                      numberOfLines={1}
                    >
                      {selectedAccountName ||
                        (isAtmWithdrawal
                          ? "Select source bank account"
                          : "Select an account")}
                    </Text>
                    <Ionicons
                      name={isAccountPickerOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={palette.slate[500]}
                    />
                  </TouchableOpacity>
                  {formErrors.accountId && (
                    <Text className="text-xs text-red-400 mt-1.5 ml-1">
                      {formErrors.accountId}
                    </Text>
                  )}

                  {/* Inline account picker */}
                  {isAccountPickerOpen && (
                    <View className="mt-2 bg-slate-800/80 rounded-xl overflow-hidden border border-slate-700/40">
                      {accountOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => handleSelectAccount(opt)}
                          activeOpacity={0.7}
                          className={`px-4 py-3 flex-row items-center justify-between border-b border-slate-700/30 ${
                            opt.id === selectedAccountId
                              ? "bg-emerald-500/10"
                              : ""
                          }`}
                        >
                          <View className="flex-row items-center flex-1">
                            <Text
                              className={`text-sm font-semibold flex-shrink ${
                                opt.id === selectedAccountId
                                  ? "text-emerald-400"
                                  : "text-slate-300"
                              }`}
                              numberOfLines={1}
                            >
                              {opt.name} ({opt.currency})
                            </Text>
                            {opt.isPending && (
                              <View className="bg-amber-500/20 px-1.5 py-0.5 rounded ml-2">
                                <Text className="text-[10px] font-bold text-amber-400">
                                  NEW
                                </Text>
                              </View>
                            )}
                          </View>
                          {opt.id === selectedAccountId && (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color={palette.nileGreen[400]}
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Cash Withdrawal TO field (read-only) */}
              {isAtmWithdrawal && (
                <View className={`${hasBankAccounts ? "mt-4" : "mt-5"}`}>
                  {/* Down arrow indicator */}
                  <View className="items-center -my-3 z-10 relative">
                    <View className="bg-slate-900 border border-slate-700/50 rounded-full w-8 h-8 items-center justify-center">
                      <Ionicons
                        name="arrow-down"
                        size={16}
                        color={palette.slate[400]}
                      />
                    </View>
                  </View>

                  {/* To Account block */}
                  <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 mt-2">
                    To Account
                  </Text>

                  <View className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50 flex-row items-center">
                    <View className="w-6 h-6 rounded-full bg-amber-500/20 items-center justify-center mr-2">
                      <Ionicons
                        name="cash"
                        size={12}
                        color={palette.gold[400]}
                      />
                    </View>
                    <Text className="text-white text-base font-semibold">
                      {existingCashAccountName || "Cash"}
                    </Text>
                  </View>

                  {!existingCashAccountName && (
                    <View className="flex-row items-start bg-amber-500/10 p-3 rounded-xl mt-3 border border-amber-500/20">
                      <Ionicons
                        name="information-circle"
                        size={16}
                        color={palette.gold[400]}
                      />
                      <Text className="text-[10px] text-amber-500 font-bold uppercase ml-2 flex-1 leading-4 pt-0.5">
                        {`A new cash account will be created automatically in ${transaction.currency}.`}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Bottom spacing */}
            <View className="h-8" />
          </ScrollView>
        </View>

        {/* ── Category selector modal ─────────────────────────────── */}

        <CategorySelectorModal
          visible={isCategoryPickerOpen}
          rootCategories={relevantCategories}
          selectedId={selectedCategoryId}
          type={txType}
          onSelect={(id) => setSelectedCategoryId(id)}
          onClose={() => setIsCategoryPickerOpen(false)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type { SmsTransactionEditModalProps, TransactionEdits };
