/**
 * Create Recurring Payment Page
 * Form to add a new recurring payment/bill
 */

import { AccountSelectorModal } from "@/components/modals/AccountSelectorModal";
import { CategorySelectorModal } from "@/components/modals/CategorySelectorModal";
import {
  FrequencyPickerModal,
  getFrequencyLabel,
} from "@/components/modals/FrequencyPickerModal";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StarryBackground } from "@/components/ui/StarryBackground";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { createRecurringPayment } from "@/services/recurring-payment-service";
import {
  RecurringPaymentValidationErrors,
  validateRecurringPaymentForm,
} from "@/validation/recurring-payment-validation";
import { RecurringFrequency, TransactionType } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
// eslint-disable-next-line no-duplicate-imports
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

interface FormData {
  name: string;
  amount: string;
  type: TransactionType;
  frequency: RecurringFrequency;
  startDate: Date;
  accountId: string;
  categoryId: string;
  autoCreate: boolean;
  notes: string;
}

// =============================================================================
// Constants
// =============================================================================

const TYPE_OPTIONS: ReadonlyArray<{
  value: TransactionType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: "EXPENSE", label: "Expense", icon: "receipt-outline" },
  { value: "INCOME", label: "Income", icon: "cash-outline" },
];

const ACTIVE_SHADOW = {
  shadowColor: palette.nileGreen[500],
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 4,
};

// =============================================================================
// Components
// =============================================================================

interface TypeToggleProps {
  readonly value: TransactionType;
  readonly onChange: (type: TransactionType) => void;
}

function TypeToggle({ value, onChange }: TypeToggleProps): React.JSX.Element {
  const { isDark } = useTheme();

  return (
    <View className="flex-row mb-6">
      {TYPE_OPTIONS.map((option, index) => {
        const isSelected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`flex-1 py-3 rounded-full flex-row items-center justify-center border ${
              index === 0 ? "mr-2" : ""
            } ${
              isSelected
                ? "bg-nileGreen-700/80 border-nileGreen-500"
                : "bg-slate-200 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700"
            }`}
            style={isSelected ? ACTIVE_SHADOW : {}}
          >
            <Ionicons
              name={option.icon}
              size={16}
              color={
                isSelected
                  ? "white"
                  : isDark
                    ? palette.slate[400]
                    : palette.slate[500]
              }
            />
            <Text
              className={`ml-2 font-semibold text-sm ${
                isSelected ? "text-white" : "text-slate-400 dark:text-slate-400"
              }`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// =============================================================================
// Main Screen
// =============================================================================

export default function CreateRecurringPaymentScreen(): React.JSX.Element {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { accounts } = useAccounts();
  const { expenseCategories, incomeCategories } = useCategories();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    amount: "",
    type: "EXPENSE",
    frequency: "MONTHLY",
    startDate: new Date(),
    accountId: accounts[0]?.id,
    categoryId: "",
    autoCreate: false,
    notes: "",
  });
  const [formErrors, setFormErrors] =
    useState<RecurringPaymentValidationErrors>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textColor = "text-slate-800 dark:text-white";
  const labelColor = "text-slate-500 dark:text-slate-400";

  const selectedAccount = accounts.find((a) => a.id === formData.accountId);
  const rootCategories =
    formData.type === "EXPENSE" ? expenseCategories : incomeCategories;
  const selectedCategory = rootCategories.find(
    (c) => c.id === formData.categoryId
  );

  // ---------------------------------------------------------------------------
  // Field update helper — clears the error for the field being updated
  // ---------------------------------------------------------------------------

  const updateField = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (field in formErrors) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ): void => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      updateField("startDate", selectedDate);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSubmit = async (): Promise<void> => {
    const { isValid, errors } = validateRecurringPaymentForm({
      name: formData.name,
      amount: formData.amount,
      accountId: formData.accountId,
      categoryId: formData.categoryId,
    });

    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (!selectedAccount) {
        showToast({
          title: "Error",
          message: "Account not found",
          type: "error",
        });
        return;
      }
      await createRecurringPayment({
        name: formData.name,
        amount: parseFloat(formData.amount),
        currency: selectedAccount.currency,
        type: formData.type,
        frequency: formData.frequency,
        startDate: formData.startDate,
        accountId: formData.accountId,
        categoryId: formData.categoryId,
        action: formData.autoCreate ? "AUTO_CREATE" : "NOTIFY",
        notes: formData.notes || undefined,
      });
      router.back();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      showToast({
        type: "error",
        title: "Failed to create payment",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const inputBg = "bg-slate-100 dark:bg-slate-800/80";
  const inputBorder = "border-slate-200 dark:border-slate-700";

  return (
    <StarryBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <PageHeader
          title="New Recurring Payment"
          showBackButton
          backIcon="close"
        />

        <View
          className="flex-1 px-5"
          style={{
            paddingBottom: insets.bottom + 20,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {/* Type Toggle */}
            <TypeToggle
              value={formData.type}
              onChange={(type) => {
                updateField("type", type);
                updateField("categoryId", "");
              }}
            />

            {/* Payment Details Section */}
            <Text className={`text-base font-semibold mb-3 ${textColor}`}>
              Payment Details
            </Text>
            <View className="flex-row gap-3 mb-2">
              {/* Name Input */}
              <View className="flex-1">
                <TextField
                  label="Name"
                  value={formData.name}
                  onChangeText={(name) => updateField("name", name)}
                  placeholder="Netflix, Spotify..."
                  error={formErrors.name}
                />
              </View>
              {/* Amount Input */}
              <View className="w-[130px]">
                <TextField
                  label="Amount"
                  value={formData.amount}
                  onChangeText={(amount) => updateField("amount", amount)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  error={formErrors.amount}
                />
              </View>
            </View>

            {/* Currency indicator */}
            {selectedAccount && (
              <Text className={`text-xs mb-4 ${labelColor}`}>
                Currency: {selectedAccount.currency}
              </Text>
            )}

            {/* Schedule Section */}
            <Text className={`text-base font-semibold mb-3 ${textColor}`}>
              Schedule
            </Text>

            {/* Frequency Dropdown */}
            <Text className={`text-xs mb-2 ${labelColor}`}>Frequency</Text>
            <TouchableOpacity
              onPress={() => setShowFrequencyModal(true)}
              className={`flex-row items-center justify-between px-4 py-3.5 rounded-xl border mb-4 ${inputBg} ${inputBorder}`}
            >
              <Text className={textColor}>
                {getFrequencyLabel(formData.frequency)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={isDark ? palette.slate[400] : palette.slate[500]}
              />
            </TouchableOpacity>

            {/* Start Date */}
            <Text className={`text-xs mb-2 ${labelColor}`}>Start Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className={`flex-row items-center justify-between px-4 py-3.5 rounded-xl border mb-6 ${inputBg} ${inputBorder}`}
            >
              <Text className={textColor}>
                {formatDate(formData.startDate)}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={isDark ? palette.slate[400] : palette.slate[500]}
              />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={formData.startDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            {/* Linked Account Section */}
            <Text className={`text-base font-semibold mb-3 ${textColor}`}>
              Linked Account
            </Text>
            <TouchableOpacity
              onPress={() => setShowAccountModal(true)}
              className={`flex-row items-center justify-between px-4 py-3 rounded-xl border mb-1 ${inputBg} ${inputBorder} ${
                formErrors.accountId ? "border-red-500" : ""
              }`}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-slate-200 dark:bg-slate-700">
                  <Ionicons
                    name="card-outline"
                    size={20}
                    color={isDark ? palette.slate[300] : palette.slate[600]}
                  />
                </View>
                <View>
                  <Text className={`text-sm font-medium ${textColor}`}>
                    {selectedAccount?.name || "Select Account"}
                  </Text>
                  {selectedAccount && (
                    <Text className={`text-xs ${labelColor}`}>
                      {selectedAccount.formattedBalance}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color={isDark ? palette.slate[400] : palette.slate[500]}
              />
            </TouchableOpacity>
            {formErrors.accountId && (
              <Text className="text-red-500 text-xs mb-4 ml-1">
                {formErrors.accountId}
              </Text>
            )}
            {!formErrors.accountId && <View className="mb-6" />}

            {/* Category Section */}
            <Text className={`text-base font-semibold mb-3 ${textColor}`}>
              Category
            </Text>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(true)}
              className={`flex-row items-center justify-between px-4 py-3 rounded-xl border mb-1 ${inputBg} ${inputBorder} ${
                formErrors.categoryId ? "border-red-500" : ""
              }`}
            >
              <Text className={textColor}>
                {selectedCategory?.displayName || "Select Category"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={isDark ? palette.slate[400] : palette.slate[500]}
              />
            </TouchableOpacity>
            {formErrors.categoryId && (
              <Text className="text-red-500 text-xs mb-4 ml-1">
                {formErrors.categoryId}
              </Text>
            )}
            {!formErrors.categoryId && <View className="mb-6" />}

            {/* Optional Notes */}
            <TextField
              label="Notes (Optional)"
              value={formData.notes}
              onChangeText={(notes) => updateField("notes", notes)}
              placeholder="Add notes..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`py-4 rounded-2xl items-center mt-4 ${
              isSubmitting ? "bg-slate-600/50" : "bg-nileGreen-500"
            }`}
            style={
              !isSubmitting
                ? // eslint-disable-next-line react-native/no-inline-styles
                  {
                    shadowColor: palette.nileGreen[500],
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5,
                  }
                : {}
            }
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-base font-bold">
                Add Recurring Payment
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Modals */}
        <FrequencyPickerModal
          visible={showFrequencyModal}
          selectedFrequency={formData.frequency}
          onSelect={(frequency) => updateField("frequency", frequency)}
          onClose={() => setShowFrequencyModal(false)}
        />

        <AccountSelectorModal
          visible={showAccountModal}
          accounts={accounts}
          selectedId={formData.accountId}
          onSelect={(accountId) => updateField("accountId", accountId)}
          onClose={() => setShowAccountModal(false)}
        />

        <CategorySelectorModal
          visible={showCategoryModal}
          rootCategories={rootCategories}
          selectedId={formData.categoryId}
          type={formData.type}
          onSelect={(categoryId) => updateField("categoryId", categoryId)}
          onClose={() => setShowCategoryModal(false)}
        />
      </KeyboardAvoidingView>
    </StarryBackground>
  );
}
