/**
 * Create Recurring Payment Page
 * Form to add a new recurring payment/bill
 * Design: Option B - Sectioned form with icons
 */

import { Category, database, RecurringPayment } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StarryBackground } from "@/components/ui/StarryBackground";
import { palette } from "@/constants/colors";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";

// =============================================================================
// Types
// =============================================================================

type TransactionType = "EXPENSE" | "INCOME";
type Frequency = "WEEKLY" | "MONTHLY" | "YEARLY";

interface FormData {
  name: string;
  amount: string;
  type: TransactionType;
  frequency: Frequency;
  startDate: Date;
  accountId: string;
  categoryId: string;
  autoCreate: boolean;
}

// =============================================================================
// Helper: Get category icon
// =============================================================================

function getCategoryIcon(name: string): keyof typeof Ionicons.glyphMap {
  const n = name.toLowerCase();
  if (n.includes("shopping") || n.includes("shop")) return "cart-outline";
  if (n.includes("rent") || n.includes("home") || n.includes("house"))
    return "home-outline";
  if (
    n.includes("entertainment") ||
    n.includes("stream") ||
    n.includes("netflix")
  )
    return "play-circle-outline";
  if (n.includes("food") || n.includes("restaurant") || n.includes("dining"))
    return "restaurant-outline";
  if (n.includes("transport") || n.includes("car") || n.includes("uber"))
    return "car-outline";
  if (n.includes("health") || n.includes("medical") || n.includes("gym"))
    return "fitness-outline";
  if (n.includes("utility") || n.includes("electric") || n.includes("water"))
    return "flash-outline";
  if (n.includes("subscription")) return "card-outline";
  if (n.includes("salary") || n.includes("income")) return "cash-outline";
  return "add-outline";
}

// =============================================================================
// Components
// =============================================================================

interface TypeToggleProps {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
}

function TypeToggle({ value, onChange }: TypeToggleProps): React.JSX.Element {
  return (
    <View className="flex-row mb-6">
      {/* Expense Button */}
      <TouchableOpacity
        onPress={() => onChange("EXPENSE")}
        className={`flex-1 py-3 rounded-full mr-2 flex-row items-center justify-center border ${
          value === "EXPENSE"
            ? "bg-nileGreen-700/80 border-nileGreen-500 shadow-md shadow-nileGreen-500/40"
            : "bg-slate-200 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700"
        }`}
      >
        <Ionicons
          name="receipt-outline"
          size={16}
          className={
            value === "EXPENSE"
              ? "text-white"
              : "text-slate-500 dark:text-slate-400"
          }
        />
        <Text
          className={`ml-2 font-semibold text-sm ${
            value === "EXPENSE"
              ? "text-white"
              : "text-slate-500 dark:text-slate-400"
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
            ? "bg-nileGreen-700/80 border-nileGreen-500 shadow-md shadow-nileGreen-500/40"
            : "bg-slate-200 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700"
        }`}
      >
        <Ionicons
          name="cash-outline"
          size={16}
          className={
            value === "INCOME"
              ? "text-white"
              : "text-slate-500 dark:text-slate-400"
          }
        />
        <Text
          className={`ml-2 font-semibold text-sm ${
            value === "INCOME"
              ? "text-white"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Income
        </Text>
      </TouchableOpacity>
    </View>
  );
}

interface FrequencyPickerProps {
  value: Frequency;
  onChange: (freq: Frequency) => void;
}

function FrequencyPicker({
  value,
  onChange,
}: FrequencyPickerProps): React.JSX.Element {
  const frequencies: Frequency[] = ["WEEKLY", "MONTHLY", "YEARLY"];

  return (
    <View className="flex-row gap-2 mb-4">
      {frequencies.map((freq) => (
        <TouchableOpacity
          key={freq}
          onPress={() => onChange(freq)}
          className={`flex-1 py-2.5 rounded-full items-center border ${
            value === freq
              ? "bg-nileGreen-700/80 border-nileGreen-500 shadow-md shadow-nileGreen-500/30"
              : "bg-slate-200 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              value === freq
                ? "text-white"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {freq.charAt(0) + freq.slice(1).toLowerCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface CategoryPickerProps {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function CategoryPicker({
  categories,
  selectedId,
  onSelect,
}: CategoryPickerProps): React.JSX.Element {
  // Get only L1 categories for selection
  const l1Categories = categories.filter((c) => c.level === 1).slice(0, 6);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="py-2"
    >
      {l1Categories.map((cat) => {
        const isSelected = selectedId === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            className="items-center mr-4"
          >
            <View
              className={`w-14 h-14 rounded-full items-center justify-center mb-1 border ${
                isSelected
                  ? "bg-nileGreen-500/30 border-nileGreen-500 shadow-md shadow-nileGreen-500/50"
                  : "bg-slate-200 dark:bg-slate-700/80 border-slate-300 dark:border-slate-600"
              }`}
            >
              <Ionicons
                name={getCategoryIcon(cat.displayName)}
                size={24}
                className={
                  isSelected
                    ? "text-nileGreen-500"
                    : "text-slate-500 dark:text-slate-400"
                }
              />
            </View>
            <Text
              className={`text-xs ${
                isSelected
                  ? "text-nileGreen-500 font-medium"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              numberOfLines={1}
            >
              {cat.displayName}
            </Text>
          </TouchableOpacity>
        );
      })}
      {/* Add new category option */}
      <TouchableOpacity className="items-center mr-4">
        <View className="w-14 h-14 rounded-full items-center justify-center mb-1 border bg-slate-200 dark:bg-slate-700/80 border-slate-300 dark:border-slate-600">
          <Ionicons
            name="add-outline"
            size={24}
            className="text-slate-500 dark:text-slate-400"
          />
        </View>
        <Text className="text-xs text-slate-500 dark:text-slate-400">Add</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// =============================================================================
// Main Screen
// =============================================================================

export default function CreateRecurringPaymentScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    amount: "",
    type: "EXPENSE",
    frequency: "MONTHLY",
    startDate: new Date(),
    accountId: accounts[0]?.id || "",
    categoryId: "",
    autoCreate: false,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === formData.accountId);

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
            payment.categoryId = formData.categoryId;
            payment.action = formData.autoCreate ? "AUTO_CREATE" : "NOTIFY";
            payment.status = "ACTIVE";
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
        <View
          className="flex-1 px-5"
          style={{
            paddingBottom: insets.bottom + 20,
          }}
        >
          <PageHeader title="New Bill" showBackButton={true} backIcon="close" />

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {/* Type Toggle */}
            <TypeToggle
              value={formData.type}
              onChange={(type) => setFormData({ ...formData, type })}
            />

            {/* Payment Details Section */}
            <Text className="text-base font-semibold mb-3 text-slate-800 dark:text-white">
              Payment Details
            </Text>
            <View className="flex-row gap-3 mb-6">
              {/* Name Input */}
              <View className="flex-1">
                <Text className="text-xs mb-1.5 text-slate-500 dark:text-slate-400">
                  Name
                </Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(name) => setFormData({ ...formData, name })}
                  placeholder="Netflix, Spotify..."
                  placeholderTextColor={palette.slate[400]}
                  className="px-4 py-3.5 rounded-xl border bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                />
              </View>
              {/* Amount Input */}
              <View style={{ width: 110 }}>
                <Text className="text-xs mb-1.5 text-slate-500 dark:text-slate-400">
                  Amount
                </Text>
                <View className="flex-row items-center">
                  <TextInput
                    value={formData.amount}
                    onChangeText={(amount) =>
                      setFormData({ ...formData, amount })
                    }
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={palette.slate[400]}
                    className="flex-1 px-3 py-3.5 rounded-l-xl border-l border-t border-b bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-base"
                  />
                  <View className="px-3 py-3.5 rounded-r-xl border bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 justify-center">
                    <Text className="text-slate-500 dark:text-slate-400">
                      $
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Schedule Section */}
            <Text className="text-base font-semibold mb-3 text-slate-800 dark:text-white">
              Schedule
            </Text>
            <Text className="text-xs mb-2 text-slate-500 dark:text-slate-400">
              Frequency
            </Text>
            <FrequencyPicker
              value={formData.frequency}
              onChange={(frequency) => setFormData({ ...formData, frequency })}
            />
            {/* Start Date */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center justify-between px-4 py-3.5 rounded-xl border mb-6 bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
            >
              <Text
                className={
                  formData.startDate
                    ? "text-slate-800 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                }
              >
                {formData.startDate
                  ? formatDate(formData.startDate)
                  : "Start Date"}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={20}
                className="text-slate-500 dark:text-slate-400"
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
            <Text className="text-base font-semibold mb-3 text-slate-800 dark:text-white">
              Linked Account
            </Text>
            <TouchableOpacity className="flex-row items-center justify-between px-4 py-3 rounded-xl border mb-6 bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-slate-200 dark:bg-slate-700">
                  <Ionicons
                    name="card-outline"
                    size={20}
                    className="text-slate-600 dark:text-slate-300"
                  />
                </View>
                <View>
                  <Text className="text-sm font-medium text-slate-800 dark:text-white">
                    {selectedAccount?.name || "Select Account"}
                  </Text>
                  {selectedAccount && (
                    <Text className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedAccount.balance.toLocaleString()}{" "}
                      {selectedAccount.currency}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                className="text-slate-500 dark:text-slate-400"
              />
            </TouchableOpacity>

            {/* Category Section */}
            <Text className="text-base font-semibold mb-3 text-slate-800 dark:text-white">
              Category
            </Text>
            <CategoryPicker
              categories={categories}
              selectedId={formData.categoryId}
              onSelect={(id) => setFormData({ ...formData, categoryId: id })}
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
              <Text className="text-white text-base font-bold">Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </StarryBackground>
  );
}
