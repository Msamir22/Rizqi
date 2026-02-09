import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
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
import { BankDetailsSection } from "@/components/add-account/BankDetailsSection";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { TextField } from "@/components/ui/TextField";
import { ACCOUNT_TYPES, CURRENCIES } from "@/constants/accounts";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import {
  useAccountForm,
  useCreateAccount,
  useKeyboardVisibility,
} from "@/hooks";

export default function AddAccount(): React.ReactNode {
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardVisibility();
  const { isDark } = useTheme();

  // Custom hooks for form state and business logic
  const { formData, errors, updateField, validate } = useAccountForm();

  const { createAccount, isSubmitting } = useCreateAccount();

  // Local UI state
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [isBankDetailsExpanded, setIsBankDetailsExpanded] = useState(false);

  /**
   * Handles the save action by validating the form and calling the creation hook.
   */
  const handleSave = async (): Promise<void> => {
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
      <PageHeader
        title="New Account"
        showBackButton={true}
        backIcon="arrow"
        rightAction={{
          label: "Save",
          onPress: handleSave,
          loading: isSubmitting,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Illustration Section */}
        <View className="mb-6 items-center px-4">
          <View className="w-full rounded-[40px] items-center justify-center py-8 px-6 bg-nileGreen-50 dark:bg-nileGreen-900/30 border border-nileGreen-100 dark:border-nileGreen-800/50">
            <View className="mb-4 w-20 h-20 rounded-3xl bg-nileGreen-500/10 items-center justify-center">
              <Ionicons
                name="wallet"
                size={50}
                color={palette.nileGreen[500]}
              />
            </View>
            <Text className="mb-2 text-center text-xl font-black text-slate-900 dark:text-white">
              Where&apos;s your money?
            </Text>
            <Text className="text-center text-sm font-bold text-slate-500 dark:text-slate-400">
              Add an account to start tracking
            </Text>
          </View>
        </View>

        {/* Account Type Pills */}
        <View className="mb-8 flex-row justify-center gap-2.5 px-6 flex-wrap">
          {ACCOUNT_TYPES.map((type) => {
            const isSelected = formData.accountType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => updateField("accountType", type.id)}
                activeOpacity={0.8}
                className={`flex-row items-center rounded-2xl px-5 py-3.5 border ${
                  isSelected
                    ? "bg-nileGreen-600 border-nileGreen-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}
                style={
                  isSelected
                    ? {
                        shadowColor: "rgb(5 150 105 / 0.2)",
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
                  color={
                    isSelected
                      ? "#FFF"
                      : isDark
                        ? palette.slate[400]
                        : palette.slate[600]
                  }
                  className="mr-2"
                />
                <Text
                  className={`text-xs font-extrabold tracking-widest uppercase ${
                    isSelected
                      ? "text-white"
                      : "text-slate-500 dark:text-slate-400"
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
          className="absolute bottom-0 left-0 right-0 px-6 pt-6 pb-10 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800"
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
