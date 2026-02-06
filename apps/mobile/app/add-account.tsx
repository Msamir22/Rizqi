import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Dropdown } from "@/components/ui/Dropdown";
import { BankDetailsSection } from "@/components/add-account/BankDetailsSection";
import { palette } from "@/constants/colors";
import { ACCOUNT_TYPES, CURRENCIES } from "@/constants/accounts";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAccountForm,
  useCreateAccount,
  useKeyboardVisibility,
} from "@/hooks";

export default function AddAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const isKeyboardVisible = useKeyboardVisibility();

  // Custom hooks for form state and business logic
  const { formData, errors, updateField, validate } = useAccountForm();

  const { createAccount, isSubmitting } = useCreateAccount();

  // Local UI state
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [isBankDetailsExpanded, setIsBankDetailsExpanded] = useState(false);

  /**
   * Handles the save action by validating the form and calling the creation hook.
   */
  const handleSave = async () => {
    if (validate()) {
      await createAccount(formData);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background dark:bg-background-dark"
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-center px-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-4 p-1"
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={isDark ? palette.slate[400] : palette.slate[600]}
            />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-slate-900 dark:text-white">
            New Account
          </Text>
        </View>

        {/* Hero Illustration Section */}
        <View className="mb-6 items-center px-4">
          <LinearGradient
            colors={
              isDark
                ? ["rgba(6, 95, 70, 0.15)", "rgba(16, 185, 129, 0.08)"]
                : [palette.nileGreen[50], palette.nileGreen[100]]
            }
            style={{
              width: "100%",
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 32,
              paddingHorizontal: 24,
            }}
          >
            <View className="mb-4">
              <Ionicons
                name="wallet"
                size={64}
                color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
              />
            </View>
            <Text className="mb-2 text-center text-xl font-bold text-slate-900 dark:text-white">
              Where's your money?
            </Text>
            <Text className="text-center text-sm text-slate-500 dark:text-slate-400">
              Add an account to start tracking
            </Text>
          </LinearGradient>
        </View>

        {/* Account Type Pills */}
        <View className="mb-8 flex-row justify-center gap-2 px-4 flex-wrap">
          {ACCOUNT_TYPES.map((type) => {
            const isSelected = formData.accountType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => updateField("accountType", type.id)}
                activeOpacity={0.8}
                className={`flex-row items-center rounded-full px-5 py-3 ${
                  isSelected
                    ? "bg-nileGreen-600"
                    : isDark
                      ? "bg-slate-800"
                      : "bg-slate-100"
                }`}
                style={
                  isSelected
                    ? {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2,
                      }
                    : undefined
                }
              >
                <Ionicons
                  name={type.icon}
                  size={18}
                  color={isSelected ? "#FFF" : isDark ? "#94A3B8" : "#64748B"}
                  className="mr-2"
                />
                <Text
                  className={`text-sm font-bold ${
                    isSelected
                      ? "text-white"
                      : isDark
                        ? "text-slate-400"
                        : "text-slate-600"
                  }`}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Form Container */}
        <View className="px-4">
          {/* Account Name */}
          <TextField
            label="Account Name"
            placeholder={
              formData.accountType === "BANK"
                ? "e.g., CIB Checking"
                : formData.accountType === "DIGITAL_WALLET"
                  ? "e.g., Vodafone Cash"
                  : "e.g., My Wallet"
            }
            value={formData.name}
            onChangeText={(text) => updateField("name", text)}
            error={errors.name}
            maxLength={50}
          />

          {/* Currency Selector */}
          <Dropdown
            label="Currency"
            items={CURRENCIES}
            value={formData.currency}
            onChange={(val) => updateField("currency", val)}
            isOpen={isCurrencyOpen}
            onToggle={() => setIsCurrencyOpen(!isCurrencyOpen)}
            className="mt-2"
          />

          {/* Initial Balance */}
          <TextField
            label="Initial Balance"
            placeholder="0"
            value={formData.balance}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9.]/g, "");
              updateField("balance", cleaned);
            }}
            error={errors.balance}
            keyboardType="numeric"
          />

          {/* Conditional Bank Details Section */}
          {formData.accountType === "BANK" && (
            <BankDetailsSection
              expanded={isBankDetailsExpanded}
              onToggleExpand={() =>
                setIsBankDetailsExpanded(!isBankDetailsExpanded)
              }
              bankName={formData.bankName || ""}
              cardLast4={formData.cardLast4 || ""}
              cardLast4Error={errors.cardLast4}
              onBankNameChange={(val) => updateField("bankName", val)}
              onCardLast4Change={(val) => {
                const cleaned = val.replace(/\D/g, "").slice(0, 4);
                updateField("cardLast4", cleaned);
              }}
            />
          )}
        </View>
      </ScrollView>

      {/* Fixed Bottom Button - Hidden when keyboard is visible to prevent covering screen */}
      {!isKeyboardVisible && (
        <View
          className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-background/80 dark:bg-background-dark/80"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Button
            title={isSubmitting ? "Creating..." : "Add Account"}
            onPress={handleSave}
            isLoading={isSubmitting}
            variant="primary"
            size="lg"
            className="shadow-xl shadow-nileGreen-600/20"
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
