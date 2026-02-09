/**
 * Create Recurring Payment Page
 * Form to add a new recurring payment/bill
 * Design: Option B - Sectioned form with icons
 */

import { StarryBackground } from "@/components/ui/StarryBackground";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { database, RecurringPayment, Category } from "@astik/db";
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
  const { isDark } = useTheme();

  return (
    <View className="flex-row mb-6">
      {/* Expense Button */}
      <TouchableOpacity
        onPress={() => onChange("EXPENSE")}
        className={`flex-1 py-3 rounded-full mr-2 flex-row items-center justify-center ${
          value === "EXPENSE"
            ? "bg-nileGreen-700/80 border border-nileGreen-500"
            : isDark
              ? "bg-slate-800/50 border border-slate-700"
              : "bg-slate-200 border border-slate-300"
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
              : isDark
                ? "text-slate-400"
                : "text-slate-500"
          }`}
        >
          Expense
        </Text>
      </TouchableOpacity>

      {/* Income Button */}
      <TouchableOpacity
        onPress={() => onChange("INCOME")}
        className={`flex-1 py-3 rounded-full flex-row items-center justify-center ${
          value === "INCOME"
            ? "bg-nileGreen-700/80 border border-nileGreen-500"
            : isDark
              ? "bg-slate-800/50 border border-slate-700"
              : "bg-slate-200 border border-slate-300"
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
              : isDark
                ? "text-slate-400"
                : "text-slate-500"
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
  const { isDark } = useTheme();
  const frequencies: Frequency[] = ["WEEKLY", "MONTHLY", "YEARLY"];

  return (
    <View className="flex-row gap-2 mb-4">
      {frequencies.map((freq) => (
        <TouchableOpacity
          key={freq}
          onPress={() => onChange(freq)}
          className={`flex-1 py-2.5 rounded-full items-center ${
            value === freq
              ? "bg-nileGreen-700/80 border border-nileGreen-500"
              : isDark
                ? "bg-slate-800/80 border border-slate-700"
                : "bg-slate-200 border border-slate-300"
          }`}
          style={
            value === freq
              ? {
                  shadowColor: palette.nileGreen[500],
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 3,
                }
              : {}
          }
        >
          <Text
            className={`text-sm font-medium ${
              value === freq
                ? "text-white"
                : isDark
                  ? "text-slate-400"
                  : "text-slate-500"
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
  const { isDark } = useTheme();
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
              className={`w-14 h-14 rounded-full items-center justify-center mb-1 ${
                isSelected
                  ? "bg-nileGreen-500/30 border-2 border-nileGreen-500"
                  : isDark
                    ? "bg-slate-700/80 border border-slate-600"
                    : "bg-slate-200 border border-slate-300"
              }`}
              style={
                isSelected
                  ? {
                      shadowColor: palette.nileGreen[500],
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      elevation: 5,
                    }
                  : {}
              }
            >
              <Ionicons
                name={getCategoryIcon(cat.displayName)}
                size={24}
                color={
                  isSelected
                    ? palette.nileGreen[500]
                    : isDark
                      ? palette.slate[400]
                      : palette.slate[500]
                }
              />
            </View>
            <Text
              className={`text-xs ${
                isSelected
                  ? "text-nileGreen-500 font-medium"
                  : isDark
                    ? "text-slate-400"
                    : "text-slate-500"
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
        <View
          className={`w-14 h-14 rounded-full items-center justify-center mb-1 ${
            isDark
              ? "bg-slate-700/80 border border-slate-600"
              : "bg-slate-200 border border-slate-300"
          }`}
        >
          <Ionicons
            name="add-outline"
            size={24}
            color={isDark ? palette.slate[400] : palette.slate[500]}
          />
        </View>
        <Text
          className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Add
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// =============================================================================
// Main Screen
// =============================================================================

export default function CreateRecurringPaymentScreen(): React.JSX.Element {
  const { isDark } = useTheme();
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

  const inputBg = isDark ? "bg-slate-800/80" : "bg-slate-100";
  const inputBorder = isDark ? "border-slate-700" : "border-slate-200";
  const textColor = isDark ? "text-white" : "text-slate-800";
  const labelColor = isDark ? "text-slate-400" : "text-slate-500";

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
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 20,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons
                name="close"
                size={28}
                color={isDark ? "white" : palette.slate[800]}
              />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text className={`text-3xl font-bold mb-6 ${textColor}`}>
            New Bill
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {/* Type Toggle */}
            <TypeToggle
              value={formData.type}
              onChange={(type) => setFormData({ ...formData, type })}
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
                  placeholderTextColor={
                    isDark ? palette.slate[500] : palette.slate[400]
                  }
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
                    placeholderTextColor={
                      isDark ? palette.slate[500] : palette.slate[400]
                    }
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
            <Text className={`text-xs mb-2 ${labelColor}`}>Frequency</Text>
            <FrequencyPicker
              value={formData.frequency}
              onChange={(frequency) => setFormData({ ...formData, frequency })}
            />
            {/* Start Date */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className={`flex-row items-center justify-between px-4 py-3.5 rounded-xl border mb-6 ${inputBg} ${inputBorder}`}
            >
              <Text className={formData.startDate ? textColor : labelColor}>
                {formData.startDate
                  ? formatDate(formData.startDate)
                  : "Start Date"}
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
              className={`flex-row items-center justify-between px-4 py-3 rounded-xl border mb-6 ${inputBg} ${inputBorder}`}
            >
              <View className="flex-row items-center">
                <View
                  className={`w-10 h-10 rounded-lg items-center justify-center mr-3 ${
                    isDark ? "bg-slate-700" : "bg-slate-200"
                  }`}
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
                      {selectedAccount.balance.toLocaleString()}{" "}
                      {selectedAccount.currency}
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
