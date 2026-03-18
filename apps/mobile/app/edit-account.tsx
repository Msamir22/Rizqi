/**
 * Edit Account Screen
 *
 * Pre-populates form fields from an existing account and allows editing
 * name, balance, bank details, and default account toggle.
 * Account type and currency are displayed as read-only locked dropdowns.
 *
 * Architecture & Design Rationale:
 * - Pattern: Screen Component (route-level, receives ID via URL params)
 * - SOLID: SRP — screen orchestration only, delegates to hooks and services
 * - Follows established edit-transaction.tsx pattern for consistency
 *
 * Phase 3 (US5): Route scaffold with param loading + navigation wiring
 * Phase 4 (US1): Full edit form, save flow, and validation
 */

import type { Account } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BankDetailsSection } from "@/components/add-account/BankDetailsSection";
import { BalanceChangedSheet } from "@/components/edit-account/BalanceChangedSheet";
import { DeleteAccountSheet } from "@/components/edit-account/DeleteAccountSheet";
import { ReadOnlyDropdown } from "@/components/edit-account/ReadOnlyDropdown";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ACCOUNT_TYPES, CURRENCIES } from "@/constants/accounts";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useAccountById } from "@/hooks/useAccountById";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";
import { useEditAccountForm } from "@/hooks/useEditAccountForm";
import { useUpdateAccount } from "@/hooks/useUpdateAccount";
import { useKeyboardVisibility } from "@/hooks";
import type { UpdateAccountData } from "@/services/edit-account-service";

// =============================================================================
// Component
// =============================================================================

export default function EditAccount(): React.ReactNode {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isKeyboardVisible = useKeyboardVisibility();

  // ---------------------------------------------------------------------------
  // Data Hooks
  // ---------------------------------------------------------------------------
  const { account, bankDetails, isLoading } = useAccountById(id ?? "");

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={palette.nileGreen[500]} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Not Found State
  // ---------------------------------------------------------------------------
  if (!account) {
    return (
      <View className="flex-1 items-center justify-center px-6 bg-background dark:bg-background-dark">
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={palette.slate[400]}
        />
        <Text className="mt-4 text-lg font-semibold text-slate-500 dark:text-slate-400 text-center">
          Account not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 rounded-xl bg-nileGreen-500"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — Account Loaded
  // ---------------------------------------------------------------------------
  return (
    <EditAccountForm
      account={account}
      bankDetails={bankDetails}
      isDark={isDark}
      isKeyboardVisible={isKeyboardVisible}
      bottomInset={insets.bottom}
    />
  );
}

// =============================================================================
// EditAccountForm — extracted to allow hooks after conditional returns
// =============================================================================

interface EditAccountFormProps {
  readonly account: Account;
  readonly bankDetails: {
    readonly bankName: string;
    readonly cardLast4: string;
    readonly smsSenderName: string;
  } | null;
  readonly isDark: boolean;
  readonly isKeyboardVisible: boolean;
  readonly bottomInset: number;
}

function EditAccountForm({
  account,
  bankDetails,
  isDark,
  isKeyboardVisible,
  bottomInset,
}: EditAccountFormProps): React.JSX.Element {
  const {
    formData,
    errors,
    isValid,
    isDirty,
    isCheckingUniqueness,
    accountType,
    currency,
    isDefault,
    originalBalance,
    updateField,
    toggleDefault,
    validate,
  } = useEditAccountForm(account, bankDetails ?? undefined);

  const [isBankDetailsExpanded, setIsBankDetailsExpanded] = useState(
    Boolean(bankDetails)
  );
  const [showBalanceSheet, setShowBalanceSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  const { performUpdate, isSubmitting } = useUpdateAccount();
  const { performDelete, isDeleting, linkedCounts } = useDeleteAccount(
    account.id
  );

  // Look up display values for read-only fields
  const accountTypeLabel = useMemo(() => {
    const found = ACCOUNT_TYPES.find((t) => t.id === accountType);
    return found?.label ?? accountType;
  }, [accountType]);

  const accountTypeIcon = useMemo((): string => {
    const emojiMap: Record<string, string> = {
      CASH: "💵",
      BANK: "🏦",
      DIGITAL_WALLET: "📱",
    };
    return emojiMap[accountType] ?? "💰";
  }, [accountType]);

  const currencyLabel = useMemo(() => {
    const found = CURRENCIES.find((c) => c.value === currency);
    return found?.label ?? currency;
  }, [currency]);

  const currencyIcon = useMemo(() => {
    const found = CURRENCIES.find((c) => c.value === currency);
    return found?.icon ?? "💵";
  }, [currency]);

  /** Build the update data payload. */
  const buildUpdateData = useCallback((): UpdateAccountData | null => {
    const parsedBalance = parseFloat(formData.balance);
    if (isNaN(parsedBalance)) return null;

    return {
      name: formData.name,
      balance: parsedBalance,
      isDefault,
      bankName: formData.bankName,
      cardLast4: formData.cardLast4,
      smsSenderName: formData.smsSenderName,
    };
  }, [formData, isDefault]);

  /**
   * Handle save — validates form, checks for balance change,
   * and either saves directly or shows the BalanceChangedSheet.
   */
  const handleSave = useCallback((): void => {
    if (isSubmitting || !isDirty) return;
    if (!validate()) return;

    const data = buildUpdateData();
    if (!data) return;

    // Check if balance has actually changed
    const balanceChanged = data.balance !== originalBalance;

    if (balanceChanged) {
      // Show the balance change sheet for user to decide
      setShowBalanceSheet(true);
    } else {
      // No balance change, save directly
      performUpdate(account.id, data).catch((err: unknown) =>
        console.error("[EditAccount] Save failed:", err)
      );
    }
  }, [
    isSubmitting,
    isDirty,
    validate,
    buildUpdateData,
    originalBalance,
    account.id,
    performUpdate,
  ]);

  /**
   * Handle the user's choice from the BalanceChangedSheet.
   */
  const handleBalanceSheetConfirm = useCallback(
    (option: "silent" | "tracked"): void => {
      setShowBalanceSheet(false);

      const data = buildUpdateData();
      if (!data) return;

      const balanceAdjustment =
        option === "tracked"
          ? {
              trackAsTransaction: true as const,
              previousBalance: originalBalance,
              currency,
            }
          : undefined;

      performUpdate(account.id, data, balanceAdjustment).catch((err: unknown) =>
        console.error("[EditAccount] Save failed:", err)
      );
    },
    [buildUpdateData, originalBalance, currency, account.id, performUpdate]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background dark:bg-background-dark"
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
      />
      <PageHeader
        title="Edit Account"
        showBackButton={true}
        backIcon="arrow"
        rightAction={{
          label: "Save",
          onPress: () => {
            handleSave();
          },
          loading: isSubmitting,
          disabled: !isDirty || !isValid || isCheckingUniqueness,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: bottomInset + 120,
        }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Section with Account Avatar */}
        <View className="mb-6 items-center px-4">
          <View className="w-full rounded-[40px] items-center justify-center py-8 px-6 bg-nileGreen-50 dark:bg-nileGreen-900/30 border border-nileGreen-100 dark:border-nileGreen-800/50">
            <View className="mb-4 w-20 h-20 rounded-3xl bg-nileGreen-500/10 items-center justify-center">
              <Ionicons
                name={
                  accountType === "BANK"
                    ? "business"
                    : accountType === "DIGITAL_WALLET"
                      ? "phone-portrait"
                      : "cash"
                }
                size={50}
                color={palette.nileGreen[500]}
              />
            </View>
            <Text className="mb-2 text-center text-xl font-black text-slate-900 dark:text-white">
              {account.name}
            </Text>
            <Text className="text-center text-sm font-bold text-slate-500 dark:text-slate-400">
              {accountTypeLabel} • {currency}
            </Text>
          </View>
        </View>

        {/* Form Container */}
        <View className="px-4">
          {/* Account Type (Read-Only) */}
          <ReadOnlyDropdown
            label="Account Type"
            displayValue={accountTypeLabel}
            icon={accountTypeIcon}
          />

          {/* Currency (Read-Only) */}
          <ReadOnlyDropdown
            label="Currency"
            displayValue={currencyLabel}
            icon={currencyIcon}
          />

          {/* Account Name */}
          <TextField
            label="Account Name"
            placeholder="e.g., CIB Checking"
            value={formData.name}
            onChangeText={(text) => updateField("name", text)}
            error={errors.name}
            maxLength={50}
          />

          {/* Balance */}
          <TextField
            label="Balance"
            placeholder="0"
            value={formData.balance}
            onChangeText={(text) => {
              // Allow negative values (overdrafts) for editing
              const cleaned = text.replace(/[^0-9.-]/g, "");
              updateField("balance", cleaned);
            }}
            error={errors.balance}
            keyboardType="numeric"
          />

          {/* Default Account Toggle */}
          <TouchableOpacity
            onPress={toggleDefault}
            activeOpacity={0.7}
            className="flex-row items-center justify-between py-4 px-1 mb-3"
          >
            <View className="flex-row items-center flex-1">
              <Ionicons
                name={isDefault ? "star" : "star-outline"}
                size={22}
                color={
                  isDefault
                    ? palette.nileGreen[500]
                    : isDark
                      ? palette.slate[400]
                      : palette.slate[500]
                }
              />
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-slate-800 dark:text-white">
                  Default Account
                </Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Used as the pre-selected account for new transactions
                </Text>
              </View>
            </View>
            <View
              className={`w-12 h-7 rounded-full justify-center px-0.5 ${
                isDefault
                  ? "bg-nileGreen-500"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              <View
                className={`w-6 h-6 rounded-full bg-white ${
                  isDefault ? "self-end" : "self-start"
                }`}
                // eslint-disable-next-line react-native/no-inline-styles
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              />
            </View>
          </TouchableOpacity>

          {/* Conditional Bank Details Section */}
          {accountType === "BANK" && (
            <BankDetailsSection
              expanded={isBankDetailsExpanded}
              onToggleExpand={() =>
                setIsBankDetailsExpanded(!isBankDetailsExpanded)
              }
              bankName={formData.bankName ?? ""}
              cardLast4={formData.cardLast4 ?? ""}
              cardLast4Error={errors.cardLast4}
              smsSenderName={formData.smsSenderName ?? ""}
              onBankNameChange={(val) => updateField("bankName", val)}
              onCardLast4Change={(val) => {
                const cleaned = val.replace(/\D/g, "").slice(0, 4);
                updateField("cardLast4", cleaned);
              }}
              onSmsSenderNameChange={(val) => updateField("smsSenderName", val)}
            />
          )}

          {/* Danger Zone */}
          <View className="mt-8 rounded-2xl border border-red-200 dark:border-red-800/30 bg-red-50/50 dark:bg-red-900/10 p-4">
            <Text className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
              Danger Zone
            </Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Deleting this account will remove all associated transactions,
              transfers, debts, and recurring payments.
            </Text>
            <TouchableOpacity
              onPress={() => setShowDeleteSheet(true)}
              activeOpacity={0.7}
              className="flex-row items-center justify-center py-3 rounded-xl border border-red-300 dark:border-red-700"
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={palette.red[500]}
              />
              <Text className="ml-2 text-base font-semibold text-red-500">
                Delete Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Save Button */}
      {!isKeyboardVisible && (
        <View
          className="absolute bottom-0 left-0 right-0 px-6 pt-6 pb-10 bg-white dark:bg-background-dark border-t border-slate-200 dark:border-slate-800"
          style={{ paddingBottom: bottomInset + 16 }}
        >
          <Button
            title={isSubmitting ? "Saving..." : "Save Changes"}
            onPress={() => {
              handleSave();
            }}
            isLoading={isSubmitting}
            disabled={!isDirty || !isValid || isCheckingUniqueness}
            variant="primary"
            size="lg"
            className="shadow-xl shadow-nileGreen-600/20"
          />
        </View>
      )}
      {/* Balance Changed Sheet */}
      <BalanceChangedSheet
        visible={showBalanceSheet}
        onConfirm={handleBalanceSheetConfirm}
        onCancel={() => setShowBalanceSheet(false)}
        previousBalance={originalBalance}
        newBalance={parseFloat(formData.balance) || 0}
        currencyCode={currency}
        isSubmitting={isSubmitting}
      />
      {/* Delete Account Sheet */}
      <DeleteAccountSheet
        visible={showDeleteSheet}
        onConfirm={() => {
          performDelete(account.id).catch((err: unknown) =>
            console.error("[EditAccount] Delete failed:", err)
          );
        }}
        onCancel={() => setShowDeleteSheet(false)}
        accountName={account.name}
        accountBalance={account.balance}
        currencyCode={currency}
        linkedRecords={linkedCounts}
        isDeleting={isDeleting}
      />
    </KeyboardAvoidingView>
  );
}
