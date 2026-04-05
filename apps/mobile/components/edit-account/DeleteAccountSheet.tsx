/**
 * DeleteAccountSheet Component
 *
 * A confirmation bottom sheet for deleting an account. Shows a warning
 * with the account name, balance, and count of linked records that will
 * be cascade-deleted.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Modal Component (no business logic)
 * - SOLID: SRP — displays delete confirmation UI, delegates action to parent
 * - Follows ConfirmationModal/BalanceChangedSheet pattern for consistency
 *
 * @module DeleteAccountSheet
 */

import type { CurrencyType } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinkedRecordsCounts {
  readonly transactions: number;
  readonly transfers: number;
  readonly debts: number;
  readonly recurringPayments: number;
}

interface DeleteAccountSheetProps {
  /** Whether the sheet is visible */
  readonly visible: boolean;
  /** Fires when the user confirms deletion */
  readonly onConfirm: () => void;
  /** Fires when the user cancels */
  readonly onCancel: () => void;
  /** The account name for display */
  readonly accountName: string;
  /** The account balance for display */
  readonly accountBalance: number;
  /** The account currency code */
  readonly currencyCode: CurrencyType;
  /** Counts of linked records that will be deleted */
  readonly linkedRecords: LinkedRecordsCounts;
  /** Whether a delete operation is in progress */
  readonly isDeleting?: boolean;
}

/**
 * Builds a summary string of linked records that will be deleted.
 */
function buildLinkedSummary(counts: LinkedRecordsCounts): string {
  const parts: string[] = [];
  if (counts.transactions > 0) {
    parts.push(
      `${counts.transactions} transaction${counts.transactions !== 1 ? "s" : ""}`
    );
  }
  if (counts.transfers > 0) {
    parts.push(
      `${counts.transfers} transfer${counts.transfers !== 1 ? "s" : ""}`
    );
  }
  if (counts.debts > 0) {
    parts.push(`${counts.debts} debt${counts.debts !== 1 ? "s" : ""}`);
  }
  if (counts.recurringPayments > 0) {
    parts.push(
      `${counts.recurringPayments} recurring payment${counts.recurringPayments !== 1 ? "s" : ""}`
    );
  }
  return parts.length > 0 ? parts.join(", ") : "No linked records";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeleteAccountSheet({
  visible,
  onConfirm,
  onCancel,
  accountName,
  linkedRecords,
  isDeleting = false,
}: DeleteAccountSheetProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useTranslation("accounts");
  const { t: tCommon } = useTranslation("common");

  const totalLinked =
    linkedRecords.transactions +
    linkedRecords.transfers +
    linkedRecords.debts +
    linkedRecords.recurringPayments;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View className="flex-1 bg-black/70 justify-end">
          <TouchableWithoutFeedback>
            <View className="rounded-t-3xl overflow-hidden border-t border-slate-200/30 dark:border-slate-700/40">
              <BlurView
                intensity={20}
                tint={isDark ? "dark" : "light"}
                className="absolute inset-0"
              />
              <View className="absolute inset-0 bg-white/95 dark:bg-slate-900/95" />

              <View className="px-6 pt-6 pb-10">
                {/* Handle bar */}
                <View className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center mb-6" />

                {/* Warning Header */}
                <View className="items-center mb-6">
                  <View className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/20 justify-center items-center mb-3">
                    <Ionicons
                      name="trash-outline"
                      size={28}
                      color={palette.red[500]}
                    />
                  </View>
                  <Text className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center">
                    {t("delete_account_title")}
                  </Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">
                    {t("action_cannot_be_undone")}
                  </Text>
                </View>

                {/* Account Info Card */}
                <View className="rounded-2xl bg-red-50 dark:bg-red-900/10 p-4 mb-4 border border-red-100 dark:border-red-800/30">
                  <Text className="text-base font-bold text-slate-800 dark:text-white mb-1">
                    {accountName}
                  </Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400">
                    {t("balance_label")}
                  </Text>
                </View>

                {/* Linked Records Warning */}
                {totalLinked > 0 && (
                  <View className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 p-4 mb-6 border border-amber-100 dark:border-amber-800/30">
                    <View className="flex-row items-center mb-2">
                      <Ionicons
                        name="warning-outline"
                        size={18}
                        color={palette.gold[500]}
                      />
                      <Text className="ms-2 text-sm font-bold text-amber-700 dark:text-amber-300">
                        The following will also be deleted:
                      </Text>
                    </View>
                    <Text className="text-sm text-amber-600 dark:text-amber-400 ms-6">
                      {buildLinkedSummary(linkedRecords)}
                    </Text>
                  </View>
                )}

                {totalLinked === 0 && (
                  <View className="mb-6">
                    <Text className="text-sm text-slate-400 dark:text-slate-500 text-center">
                      This account has no linked records.
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 py-3.5 rounded-xl items-center justify-center bg-slate-100 dark:bg-slate-800"
                    onPress={onCancel}
                    disabled={isDeleting}
                  >
                    <Text className="text-base font-semibold text-slate-600 dark:text-slate-300">
                      {tCommon("cancel")}{" "}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-1 py-3.5 rounded-xl items-center justify-center bg-red-500"
                    onPress={onConfirm}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-base font-semibold text-white">
                        Delete
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
