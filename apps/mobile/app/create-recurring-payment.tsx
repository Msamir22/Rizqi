/**
 * Create Recurring Payment Page
 * Form to add a new recurring payment/bill
 */

import { PageHeader } from "@/components/navigation/PageHeader";
import { AccountSelectorModal } from "@/components/modals/AccountSelectorModal";
import { CategorySelectorModal } from "@/components/modals/CategorySelectorModal";
import { StarryBackground } from "@/components/ui/StarryBackground";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { database, RecurringPayment } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

// =============================================================================
// Types
// =============================================================================

type TransactionType = "EXPENSE" | "INCOME";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

interface FormData {
  name: string;
  amount: string;
  type: TransactionType;
  frequency: Frequency;
  startDate: Date;
  accountId: string;
  categoryId: string;
  autoCreate: boolean;
  notes: string;
}

// =============================================================================
// Frequency Options
// =============================================================================

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

// =============================================================================
// Components
// =============================================================================

interface TypeToggleProps {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
}

function TypeToggle({ value, onChange }: TypeToggleProps): React.JSX.Element {
  const { isDark } = useTheme();

  return (
    <View className="flex-row mb-6">
      {/* Expense Button */}
      <TouchableOpacity
        onPress={() => onChange("EXPENSE")}
        className={`flex-1 py-3 rounded-full mr-2 flex-row items-center justify-center border ${
          value === "EXPENSE"
            ? "bg-nileGreen-700/80 border-nileGreen-500"
            : "bg-slate-200 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700"
        }`}
        style={
          value === "EXPENSE"
            ? {
                shadowColor: palette.nileGreen[500],
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 4,
              }
            : {}
        }
      >
        <Ionicons
          name="receipt-outline"
          size={16}
          color={
            value === "EXPENSE"
              ? "white"
              : isDark
                ? palette.slate[400]
                : palette.slate[500]
          }
        />
        <Text
          className={`ml-2 font-semibold text-sm ${
            value === "EXPENSE"
              ? "text-white"
              : "text-slate-400 dark:text-slate-400"
          }`}
        >
          Expense
        </Text>
      </TouchableOpacity>

      {/* Income Button */}
      <TouchableOpacity
        onPress={() => onChange("INCOME")}
        className={`flex-1 py-3 rounded-full flex-row items-center justify-center border ${
          value === "INCOME"
            ? "bg-nileGreen-700/80 border-nileGreen-500"
            : "bg-slate-200 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700"
        }`}
        style={
          value === "INCOME"
            ? {
                shadowColor: palette.nileGreen[500],
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 4,
              }
            : {}
        }
      >
        <Ionicons
          name="cash-outline"
          size={16}
          color={
            value === "INCOME"
              ? "white"
              : isDark
                ? palette.slate[400]
                : palette.slate[500]
          }
        />
        <Text
          className={`ml-2 font-semibold text-sm ${
            value === "INCOME"
              ? "text-white"
              : "text-slate-400 dark:text-slate-400"
          }`}
        >
          Income
        </Text>
      </TouchableOpacity>
    </View>
  );
}

interface FrequencyPickerModalProps {
  visible: boolean;
  selectedFrequency: Frequency;
  onSelect: (freq: Frequency) => void;
  onClose: () => void;
}

function FrequencyPickerModal({
  visible,
  selectedFrequency,
  onSelect,
  onClose,
}: FrequencyPickerModalProps): React.JSX.Element {
  const { isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="rounded-t-3xl overflow-hidden max-h-[70%] bg-white dark:bg-slate-900">
            <BlurView
              intensity={40}
              tint={isDark ? "dark" : "light"}
              className="absolute inset-0"
            />
            <View className="absolute inset-0 bg-white/95 dark:bg-slate-900/95" />

            <View>
              {/* Header */}
              <View className="flex-row justify-between items-center px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                <Text className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  Select Frequency
                </Text>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? palette.slate[300] : palette.slate[500]}
                  />
                </TouchableOpacity>
              </View>

              {/* Options */}
              <View className="p-4">
                <View className="flex-row flex-wrap gap-3">
                  {FREQUENCY_OPTIONS.map((option) => {
                    const isSelected = selectedFrequency === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        className={`flex-row items-center justify-center px-4 py-3 rounded-xl border ${
                          isSelected
                            ? "bg-nileGreen-100 dark:bg-nileGreen-900/40 border-nileGreen-500 dark:border-nileGreen-600"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}
                        style={{ width: "48%" }}
                        onPress={() => {
                          onSelect(option.value);
                          onClose();
                        }}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={
                              isDark
                                ? palette.nileGreen[400]
                                : palette.nileGreen[600]
                            }
                            style={{ marginRight: 6 }}
                          />
                        )}
                        <Text
                          className={`text-sm font-medium ${
                            isSelected
                              ? "text-nileGreen-700 dark:text-nileGreen-300 font-semibold"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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

  const [formData, setFormData] = useState<FormData>({
    name: "",
    amount: "",
    type: "EXPENSE",
    frequency: "MONTHLY",
    startDate: new Date(),
    accountId: accounts[0]?.id || "",
    categoryId: "",
    autoCreate: false,
    notes: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputBg = "bg-slate-100 dark:bg-slate-800/80";
  const inputBorder = "border-slate-200 dark:border-slate-700";
  const textColor = "text-slate-800 dark:text-white";
  const labelColor = "text-slate-500 dark:text-slate-400";

  const selectedAccount = accounts.find((a) => a.id === formData.accountId);
  const rootCategories =
    formData.type === "EXPENSE" ? expenseCategories : incomeCategories;
  const selectedCategory = rootCategories.find(
    (c) => c.id === formData.categoryId
  );

  const handleDateChange = (event: unknown, selectedDate?: Date): void => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setFormData({ ...formData, startDate: selectedDate });
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getFrequencyLabel = (freq: Frequency): string => {
    return FREQUENCY_OPTIONS.find((o) => o.value === freq)?.label || freq;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!formData.name || !formData.amount || !formData.accountId) {
      return;
    }

    setIsSubmitting(true);
    try {
      await database.write(async () => {
        await database
          .get<RecurringPayment>("recurring_payments")
          .create((payment) => {
            payment.name = formData.name;
            payment.amount = parseFloat(formData.amount);
            payment.type = formData.type;
            payment.frequency = formData.frequency;
            payment.startDate = formData.startDate;
            payment.nextDueDate = formData.startDate;
            payment.accountId = formData.accountId;
            payment.categoryId = formData.categoryId || rootCategories[0]?.id;
            payment.action = formData.autoCreate ? "AUTO_CREATE" : "NOTIFY";
            payment.status = "ACTIVE";
            payment.notes = formData.notes || null;
          });
      });
      router.back();
    } catch (error) {
      console.error("Error creating recurring payment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StarryBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <PageHeader title="New Recurring Payment" showBackButton backIcon="close" />

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
              onChange={(type) => setFormData({ ...formData, type, categoryId: "" })}
            />

            {/* Payment Details Section */}
            <Text className={`text-base font-semibold mb-3 ${textColor}`}>
              Payment Details
            </Text>
            <View className="flex-row gap-3 mb-6">
              {/* Name Input */}
              <View className="flex-1">
                <Text className={`text-xs mb-1.5 ${labelColor}`}>Name</Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(name) => setFormData({ ...formData, name })}
                  placeholder="Netflix, Spotify..."
                  placeholderTextColor={palette.slate[400]}
                  className={`px-4 py-3.5 rounded-xl border ${inputBg} ${inputBorder} ${textColor}`}
                />
              </View>
              {/* Amount Input */}
              <View style={{ width: 110 }}>
                <Text className={`text-xs mb-1.5 ${labelColor}`}>Amount</Text>
                <View className="flex-row items-center">
                  <TextInput
                    value={formData.amount}
                    onChangeText={(amount) =>
                      setFormData({ ...formData, amount })
                    }
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={palette.slate[400]}
                    className={`flex-1 px-3 py-3.5 rounded-l-xl border-l border-t border-b ${inputBg} ${inputBorder} ${textColor} text-base`}
                  />
                  <View
                    className={`px-3 py-3.5 rounded-r-xl border ${inputBg} ${inputBorder} justify-center`}
                  >
                    <Text className={labelColor}>$</Text>
                  </View>
                </View>
              </View>
            </View>

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
              <Text className={textColor}>{getFrequencyLabel(formData.frequency)}</Text>
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
              className={`flex-row items-center justify-between px-4 py-3 rounded-xl border mb-6 ${inputBg} ${inputBorder}`}
            >
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-slate-200 dark:bg-slate-700"
                >
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

            {/* Category Section */}
            <Text className={`text-base font-semibold mb-3 ${textColor}`}>
              Category
            </Text>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(true)}
              className={`flex-row items-center justify-between px-4 py-3 rounded-xl border mb-6 ${inputBg} ${inputBorder}`}
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

            {/* Optional Notes */}
            <Text className={`text-base font-semibold mb-3 ${textColor}`}>
              Notes (Optional)
            </Text>
            <TextInput
              value={formData.notes}
              onChangeText={(notes) => setFormData({ ...formData, notes })}
              placeholder="Add notes..."
              placeholderTextColor={palette.slate[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className={`px-4 py-3 rounded-xl border ${inputBg} ${inputBorder} ${textColor} mb-6`}
            />
          </ScrollView>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || !formData.name || !formData.amount}
            className={`py-4 rounded-2xl items-center mt-4 ${
              !formData.name || !formData.amount
                ? "bg-slate-600/50"
                : "bg-nileGreen-500"
            }`}
            style={
              formData.name && formData.amount
                ? {
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
          onSelect={(frequency) => setFormData({ ...formData, frequency })}
          onClose={() => setShowFrequencyModal(false)}
        />

        <AccountSelectorModal
          visible={showAccountModal}
          accounts={accounts}
          selectedId={formData.accountId}
          onSelect={(accountId) => setFormData({ ...formData, accountId })}
          onClose={() => setShowAccountModal(false)}
        />

        <CategorySelectorModal
          visible={showCategoryModal}
          rootCategories={rootCategories}
          selectedId={formData.categoryId}
          type={formData.type}
          onSelect={(categoryId) => setFormData({ ...formData, categoryId })}
          onClose={() => setShowCategoryModal(false)}
        />
      </KeyboardAvoidingView>
    </StarryBackground>
  );
}
