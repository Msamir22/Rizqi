/**
 * SmsTransactionEditModal
 *
 * Inline bottom-sheet modal for editing a parsed SMS transaction directly
 * from the review page. Allows editing: amount, category, account, counterparty,
 * date, and transaction type — without navigating away.
 *
 * Architecture & Design Rationale:
 * - Pattern: Controlled Form (local state mirrors props, diverges on user edits)
 * - Why: Bottom-sheet stays mounted so we manage form state locally
 *   and only emit a diff (TransactionEdits) on save. The parent
 *   (SmsTransactionReview) merges diffs into a Map<index, edits>.
 * - SOLID: SRP — only renders the edit UI and emits TransactionEdits.
 *   The parent handles persistence and state management.
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
import { validateTransactionForm } from "@/validation/transaction-validation";
import type { AccountType, MarketRate, TransactionType } from "@astik/db";
import {
  convertCurrency,
  formatCurrency,
  type ParsedSmsTransaction,
} from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields that can be overridden in the edit modal */
interface TransactionEdits {
  readonly amount?: number;
  readonly counterparty?: string;
  readonly categorySystemName?: string;
  readonly type?: TransactionType;
  readonly accountId?: string;
  readonly accountName?: string;
}

interface SmsTransactionEditModalProps {
  /** Whether the modal is visible */
  readonly visible: boolean;
  /** The transaction being edited */
  readonly transaction: ParsedSmsTransaction;
  /** Currently assigned account name */
  readonly currentAccountName: string;
  /** Currently assigned account ID */
  readonly currentAccountId: string;
  /** Available bank accounts for the account picker */
  readonly accounts: readonly AccountWithBankDetails[];
  /** In-memory pending accounts created this session */
  readonly pendingAccounts: readonly PendingAccount[];
  /** Market rates for currency conversion (optional, from useMarketRates) */
  readonly latestRates: MarketRate | null;
  /** Called with the edits when user saves */
  readonly onSave: (edits: TransactionEdits) => void;
  /** Called when a new PendingAccount is created via "+ New" */
  readonly onCreatePendingAccount: (account: PendingAccount) => void;
  /** Called when modal is dismissed without saving */
  readonly onClose: () => void;
  /** Called when user wants to change the category (opens the category picker) */
  readonly onEditCategory: () => void;
}

/** Account display item — either a real account or a pending one */
interface AccountOption {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly isPending: boolean;
  readonly type?: AccountType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clean category system name for display */
function formatCategoryName(systemName: string): string {
  return systemName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Format a Date as a readable string */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-EG", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Check if an account with the same name AND currency already exists (case-insensitive) */
function isDuplicateAccount(
  name: string,
  currency: string,
  accounts: readonly AccountWithBankDetails[],
  pendingAccounts: readonly PendingAccount[]
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  const existsInAccounts = accounts.some(
    (acc) => acc.name.toLowerCase() === normalized && acc.currency === currency
  );
  const existsInPending = pendingAccounts.some(
    (pa) => pa.name.toLowerCase() === normalized && pa.currency === currency
  );
  return existsInAccounts || existsInPending;
}

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
  onSave,
  onCreatePendingAccount,
  onClose,
  onEditCategory,
}: SmsTransactionEditModalProps): React.JSX.Element {
  // Local editable state
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [counterparty, setCounterparty] = useState(
    transaction.counterparty || ""
  );
  const [txType, setTxType] = useState<TransactionType>(transaction.type);
  const [selectedAccountId, setSelectedAccountId] = useState(currentAccountId);
  const [selectedAccountName, setSelectedAccountName] =
    useState(currentAccountName);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // "+ New" account creation state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAccountName, setNewAccountName] = useState(
    transaction.senderDisplayName
  );
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
    return [...real, ...pending];
  }, [accounts, pendingAccounts]);

  const bankAccountOptions = useMemo(
    () => accountOptions.filter((o) => o.type !== "CASH"),
    [accountOptions]
  );

  // Determine if we should show text input (no bank accounts exist)
  const hasBankAccounts = bankAccountOptions.length > 0;

  const existingCashAccountName = useMemo(() => {
    const cashAcc = accounts.find(
      (a) => a.type === "CASH" && a.currency === transaction.currency
    );
    return cashAcc?.name;
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

  // Reset local state when transaction changes
  useEffect(() => {
    setAmount(transaction.amount.toString());
    setCounterparty(transaction.counterparty || "");
    setTxType(transaction.type);

    // Auto-select first bank account if no match was provided
    if (currentAccountId && currentAccountName) {
      setSelectedAccountId(currentAccountId);
      setSelectedAccountName(currentAccountName);
    } else if (bankAccountOptions.length > 0) {
      setSelectedAccountId(bankAccountOptions[0].id);
      setSelectedAccountName(bankAccountOptions[0].name);
    } else {
      setSelectedAccountId("");
      setSelectedAccountName("");
    }

    setIsAccountPickerOpen(false);
    setIsCreatingNew(false);
    setNewAccountName(transaction.senderDisplayName);
    setNewAccountError(null);
    setValidationError(null);
  }, [transaction, currentAccountId, currentAccountName, bankAccountOptions]);

  // ── "+ New" handlers ──────────────────────────────────────────────

  const handleStartNew = useCallback(() => {
    setIsCreatingNew(true);
    setIsAccountPickerOpen(false);
    setNewAccountName(transaction.senderDisplayName);
    setNewAccountError(null);
  }, [transaction.senderDisplayName]);

  const handleCancelNew = useCallback(() => {
    setIsCreatingNew(false);
    setNewAccountError(null);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const parsedAmount = parseFloat(amount);

    // If creating a new account or no accounts, handle pending account first
    if (isCreatingNew || !hasBankAccounts) {
      // Validate amount early — this path skips validateTransactionForm
      if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
        setValidationError("Please enter a valid amount.");
        return;
      }

      const trimmedName = (
        isCreatingNew ? newAccountName : newAccountName
      ).trim();

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

      // Create pending account
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const pending: PendingAccount = {
        tempId,
        name: trimmedName,
        currency: transaction.currency,
        type: "BANK",
        senderAddress: transaction.senderAddress,
        cardLast4: transaction.cardLast4 ?? undefined,
      };
      onCreatePendingAccount(pending);

      // Use the pending account's tempId + name for the edits
      const edits: Record<string, unknown> = {
        accountId: tempId,
        accountName: trimmedName,
      };

      if (parsedAmount !== transaction.amount) {
        edits.amount = parsedAmount;
      }
      if (counterparty !== (transaction.counterparty || "")) {
        edits.counterparty = counterparty;
      }
      if (txType !== transaction.type) {
        edits.type = txType;
      }

      onSave(edits as TransactionEdits);
      return;
    }

    // Standard validation for dropdown mode
    const { isValid, errors } = validateTransactionForm(txType, {
      amount,
      accountId: selectedAccountId,
      categoryId: transaction.categorySystemName,
    });

    if (!isValid) {
      const firstError = Object.values(errors).find(Boolean);
      setValidationError(firstError ?? "Please fix the form errors.");
      return;
    }

    setValidationError(null);

    const edits: Record<string, unknown> = {};

    if (parsedAmount !== transaction.amount) {
      edits.amount = parsedAmount;
    }
    if (counterparty !== (transaction.counterparty || "")) {
      edits.counterparty = counterparty;
    }
    if (txType !== transaction.type) {
      edits.type = txType;
    }
    if (selectedAccountId !== currentAccountId) {
      edits.accountId = selectedAccountId;
      edits.accountName = selectedAccountName;
    }

    onSave(edits as TransactionEdits);
  }, [
    amount,
    counterparty,
    txType,
    selectedAccountId,
    selectedAccountName,
    transaction,
    currentAccountId,
    isCreatingNew,
    hasBankAccounts,
    newAccountName,
    accounts,
    pendingAccounts,
    onSave,
    onCreatePendingAccount,
  ]);

  const handleSelectAccount = useCallback((opt: AccountOption) => {
    setSelectedAccountId(opt.id);
    setSelectedAccountName(opt.name);
    setIsAccountPickerOpen(false);
    setValidationError(null);
  }, []);

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
          <View className="flex-row items-center justify-between px-5 pb-4">
            <Text className="text-lg font-bold text-white">
              Edit Transaction
            </Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text className="text-sm font-semibold text-slate-400">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.7}
                className="bg-emerald-500 px-4 py-1.5 rounded-lg"
              >
                <Text className="text-sm font-bold text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Validation error */}
          {validationError && (
            <View className="mx-5 mb-3 p-3 bg-red-500/15 rounded-xl border border-red-500/30">
              <Text className="text-xs text-red-400 font-medium">
                {validationError}
              </Text>
            </View>
          )}

          <ScrollView
            className="px-5 pb-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Sender info (read-only) */}
            <View className="mb-4 bg-slate-800/60 rounded-xl px-4 py-3 flex-row items-center border border-slate-700/50">
              <View className="w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center mr-3">
                <Ionicons
                  name="business"
                  size={20}
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
                  {formatDate(transaction.date)}
                </Text>
              </View>
            </View>

            {/* Type toggle — hidden for cash withdrawals (always Transfer) */}
            {!isAtmWithdrawal && (
              <View className="mb-4">
                <Text className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                  Type
                </Text>
                <View className="flex-row gap-2">
                  {(["EXPENSE", "INCOME"] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setTxType(type)}
                      activeOpacity={0.7}
                      className={`flex-1 py-2.5 rounded-xl items-center border ${
                        txType === type
                          ? type === "EXPENSE"
                            ? "bg-red-500/20 border-red-500/40"
                            : "bg-emerald-500/20 border-emerald-500/40"
                          : "bg-slate-800/60 border-slate-700/50"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          txType === type
                            ? type === "EXPENSE"
                              ? "text-red-400"
                              : "text-emerald-400"
                            : "text-slate-500"
                        }`}
                      >
                        {type === "EXPENSE" ? "Expense" : "Income"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
              <Text className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                Amount ({transaction.currency})
              </Text>
              <TextInput
                value={amount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, "");
                  setAmount(cleaned);
                }}
                keyboardType="numeric"
                className="bg-slate-800/60 rounded-xl px-4 py-3 text-white text-base font-semibold border border-slate-700/50"
                placeholderTextColor={palette.slate[600]}
                placeholder="0.00"
              />
            </View>

            {/* Currency conversion notice (T034-T036) */}
            {hasCurrencyMismatch && (
              <View className="mb-4 bg-blue-500/10 rounded-xl p-3 border border-blue-500/25">
                <View className="flex-row items-center">
                  <Ionicons
                    name="swap-horizontal"
                    size={16}
                    color={palette.blue[500]}
                  />
                  <Text className="text-xs text-blue-400 font-medium ml-2 flex-shrink">
                    {latestRates
                      ? `≈ ${formatCurrency({
                          amount: convertCurrency(
                            parseFloat(amount) || 0,
                            transaction.currency,
                            selectedAccountCurrency as Parameters<
                              typeof convertCurrency
                            >[2],
                            latestRates
                          ),
                          currency: selectedAccountCurrency as Parameters<
                            typeof formatCurrency
                          >[0]["currency"],
                        })} at rate ${latestRates
                          .getRate(
                            transaction.currency,
                            selectedAccountCurrency as Parameters<
                              typeof convertCurrency
                            >[2]
                          )
                          .toFixed(4)}`
                      : "Exchange rate unavailable"}
                  </Text>
                </View>
              </View>
            )}

            {/* Counterparty */}
            <View className="mb-4">
              <Text className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                Counterparty / Merchant
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
                onPress={onEditCategory}
                activeOpacity={0.7}
                className="bg-slate-800/60 rounded-xl px-4 py-3 flex-row items-center justify-between border border-slate-700/50"
              >
                <Text className="text-base text-white font-semibold">
                  {formatCategoryName(transaction.categorySystemName)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.slate[500]}
                />
              </TouchableOpacity>
            </View>

            {/* ── Account Section ──────────────────────────────────── */}
            <View className="mb-6">
              {/* Account label + "+ New" / "✕ Cancel" pill */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {isAtmWithdrawal ? "From Account" : "Account"}
                </Text>
                {hasBankAccounts && !isCreatingNew && !isAtmWithdrawal && (
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

              {/* Mode: Text input (no accounts OR creating new) */}
              {!isAtmWithdrawal && (!hasBankAccounts || isCreatingNew) ? (
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
                    <Text className="text-[10px] text-emerald-400 font-bold uppercase ml-2 flex-1 leading-4 pt-0.5">
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
                    onPress={() => setIsAccountPickerOpen(!isAccountPickerOpen)}
                    activeOpacity={0.7}
                    className="bg-slate-800/60 rounded-xl px-4 py-3 flex-row items-center justify-between border border-slate-700/50"
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

                  {/* Inline account picker */}
                  {isAccountPickerOpen && (
                    <View className="mt-2 bg-slate-800/80 rounded-xl overflow-hidden border border-slate-700/40">
                      {(isAtmWithdrawal
                        ? bankAccountOptions
                        : accountOptions
                      ).map((opt) => (
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

                  {/* Cash Withdrawal TO field (read-only) */}
                  {isAtmWithdrawal && (
                    <View className="mt-4">
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
              )}
            </View>

            {/* Bottom spacing */}
            <View className="h-8" />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type { SmsTransactionEditModalProps, TransactionEdits };
