/**
 * SmsTransactionEditModal
 *
 * Inline bottom-sheet modal for editing a parsed SMS transaction directly
 * from the review page. Allows editing: amount, category, account, counterparty,
 * date, and transaction type — without navigating away.
 *
 * Architecture & Design Rationale:
 * - Pattern: Controlled Modal (parent owns state; modal reports changes via callback)
 * - Why: Keeps the review page as the single source of truth for overrides.
 *   The modal only emits deltas, not full state.
 * - SOLID: SRP — only handles editing display + user input, delegates persistence
 *   to the parent via onSave callback.
 *
 * @module SmsTransactionEditModal
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import type { ParsedSmsTransaction } from "@astik/logic";
import type { TransactionType } from "@astik/db";
import type { AccountWithBankDetails } from "@/services/sms-account-matcher";

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
  /** Available accounts for the account picker */
  readonly accounts: readonly AccountWithBankDetails[];
  /** Called with the edits when user saves */
  readonly onSave: (edits: TransactionEdits) => void;
  /** Called when modal is dismissed without saving */
  readonly onClose: () => void;
  /** Called when user wants to change the category (opens the category picker) */
  readonly onEditCategory: () => void;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmsTransactionEditModal({
  visible,
  transaction,
  currentAccountName,
  currentAccountId,
  accounts,
  onSave,
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

  // Reset local state when transaction changes
  useEffect(() => {
    setAmount(transaction.amount.toString());
    setCounterparty(transaction.counterparty || "");
    setTxType(transaction.type);
    setSelectedAccountId(currentAccountId);
    setSelectedAccountName(currentAccountName);
    setIsAccountPickerOpen(false);
  }, [transaction, currentAccountId, currentAccountName]);

  const handleSave = useCallback(() => {
    const parsedAmount = parseFloat(amount);
    const edits: Record<string, unknown> = {};

    if (!isNaN(parsedAmount) && parsedAmount !== transaction.amount) {
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
    onSave,
  ]);

  const handleSelectAccount = useCallback((acc: AccountWithBankDetails) => {
    setSelectedAccountId(acc.id);
    setSelectedAccountName(acc.name);
    setIsAccountPickerOpen(false);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
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

          <ScrollView
            className="px-5 pb-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Sender info (read-only) */}
            <View className="mb-4 bg-slate-800/60 rounded-xl p-3">
              <Text className="text-xs text-slate-500 mb-1 font-medium">
                From
              </Text>
              <Text className="text-sm text-white font-semibold">
                {transaction.senderDisplayName}
              </Text>
              <Text className="text-xs text-slate-400 mt-1">
                {formatDate(transaction.date)}
              </Text>
            </View>

            {/* Type toggle */}
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

            {/* Account */}
            <View className="mb-6">
              <Text className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                Account
              </Text>
              <TouchableOpacity
                onPress={() => setIsAccountPickerOpen(!isAccountPickerOpen)}
                activeOpacity={0.7}
                className="bg-slate-800/60 rounded-xl px-4 py-3 flex-row items-center justify-between border border-slate-700/50"
              >
                <Text className="text-base text-white font-semibold">
                  {selectedAccountName || "No account matched"}
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
                  {accounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => handleSelectAccount(acc)}
                      activeOpacity={0.7}
                      className={`px-4 py-3 flex-row items-center justify-between border-b border-slate-700/30 ${
                        acc.id === selectedAccountId ? "bg-emerald-500/10" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          acc.id === selectedAccountId
                            ? "text-emerald-400"
                            : "text-slate-300"
                        }`}
                      >
                        {acc.name}
                      </Text>
                      {acc.id === selectedAccountId && (
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

            {/* Bottom spacing */}
            <View className="h-8" />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type { TransactionEdits, SmsTransactionEditModalProps };
