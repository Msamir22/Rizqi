import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Account, AccountType, database } from "@astik/db";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCurrentUserId } from "../services/supabase";

export default function AddAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const isDark = mode === "dark";

  // New schema: CASH, BANK, DIGITAL_WALLET
  const [accountType, setAccountType] = useState<AccountType>("BANK");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<"EGP" | "USD" | "EUR">("EGP");
  const [balance, setBalance] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter account name");
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      Alert.alert("Error", "You must be signed in to create an account");
      return;
    }

    setIsSubmitting(true);
    try {
      await database.write(async () => {
        await database.get<Account>("accounts").create((account) => {
          account.userId = userId;
          account.name = name.trim();
          account.type = accountType;
          account.balance = parseFloat(balance) || 0;
          account.currency = currency;
          account.deleted = false;
        });
      });
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to create account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccountTypeStyle = (type: AccountType) => {
    const isSelected = accountType === type;

    const colors: Record<AccountType, { selected: string; icon: string }> = {
      BANK: { selected: "blue", icon: "university" },
      CASH: { selected: "green", icon: "wallet" },
      DIGITAL_WALLET: { selected: "purple", icon: "mobile-alt" },
    };

    const color = colors[type];

    if (type === "BANK") {
      return {
        container: `flex-1 items-center rounded-2xl border-2 p-5 ${
          isSelected
            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500"
            : "border-border bg-surface dark:border-white/10 dark:bg-white/5"
        }`,
        iconBg: isSelected
          ? "bg-blue-100 dark:bg-blue-500/20"
          : "bg-slate-100 dark:bg-white/10",
        iconColor: isSelected
          ? palette.blue[500]
          : isDark
            ? palette.slate[400]
            : palette.slate[500],
        textColor: isSelected
          ? "text-blue-500"
          : "text-text-secondary dark:text-text-muted",
      };
    } else if (type === "CASH") {
      return {
        container: `flex-1 items-center rounded-2xl border-2 p-5 ${
          isSelected
            ? "border-action bg-action-light/20 dark:bg-action/10 dark:border-action"
            : "border-border bg-surface dark:border-white/10 dark:bg-white/5"
        }`,
        iconBg: isSelected
          ? "bg-action-light/30 dark:bg-action/20"
          : "bg-slate-100 dark:bg-white/10",
        iconColor: isSelected
          ? palette.nileGreen[600]
          : isDark
            ? palette.slate[400]
            : palette.slate[500],
        textColor: isSelected
          ? "text-action"
          : "text-text-secondary dark:text-text-muted",
      };
    } else {
      // DIGITAL_WALLET
      return {
        container: `flex-1 items-center rounded-2xl border-2 p-5 ${
          isSelected
            ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10 dark:border-purple-500"
            : "border-border bg-surface dark:border-white/10 dark:bg-white/5"
        }`,
        iconBg: isSelected
          ? "bg-purple-100 dark:bg-purple-500/20"
          : "bg-slate-100 dark:bg-white/10",
        iconColor: isSelected
          ? "#8B5CF6"
          : isDark
            ? palette.slate[400]
            : palette.slate[500],
        textColor: isSelected
          ? "text-purple-500"
          : "text-text-secondary dark:text-text-muted",
      };
    }
  };

  const bankStyle = getAccountTypeStyle("BANK");
  const cashStyle = getAccountTypeStyle("CASH");
  const walletStyle = getAccountTypeStyle("DIGITAL_WALLET");

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-background dark:bg-background-dark">
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
        />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 24,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-8 flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()} className="p-1">
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDark ? "#FFF" : palette.slate[900]}
              />
            </TouchableOpacity>
            <Text className="text-xl font-semibold text-text-primary dark:text-white">
              Add Account
            </Text>
            <View className="w-8" />
          </View>

          {/* Account Type Selection - 3 types now */}
          <View className="mb-7">
            <View className="flex-row gap-3">
              {/* Bank Card */}
              <TouchableOpacity
                onPress={() => setAccountType("BANK")}
                className={bankStyle.container}
              >
                {accountType === "BANK" && (
                  <View className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  </View>
                )}
                <View
                  className={`mb-3 h-12 w-12 items-center justify-center rounded-xl ${bankStyle.iconBg}`}
                >
                  <FontAwesome5
                    name="university"
                    size={20}
                    color={bankStyle.iconColor}
                  />
                </View>
                <Text
                  className={`text-xs font-semibold ${bankStyle.textColor}`}
                >
                  Bank
                </Text>
              </TouchableOpacity>

              {/* Cash Card */}
              <TouchableOpacity
                onPress={() => setAccountType("CASH")}
                className={cashStyle.container}
              >
                {accountType === "CASH" && (
                  <View className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-action">
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  </View>
                )}
                <View
                  className={`mb-3 h-12 w-12 items-center justify-center rounded-xl ${cashStyle.iconBg}`}
                >
                  <FontAwesome5
                    name="wallet"
                    size={20}
                    color={cashStyle.iconColor}
                  />
                </View>
                <Text
                  className={`text-xs font-semibold ${cashStyle.textColor}`}
                >
                  Cash
                </Text>
              </TouchableOpacity>

              {/* Digital Wallet Card */}
              <TouchableOpacity
                onPress={() => setAccountType("DIGITAL_WALLET")}
                className={walletStyle.container}
              >
                {accountType === "DIGITAL_WALLET" && (
                  <View className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-purple-500">
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  </View>
                )}
                <View
                  className={`mb-3 h-12 w-12 items-center justify-center rounded-xl ${walletStyle.iconBg}`}
                >
                  <FontAwesome5
                    name="mobile-alt"
                    size={20}
                    color={walletStyle.iconColor}
                  />
                </View>
                <Text
                  className={`text-xs font-semibold ${walletStyle.textColor}`}
                >
                  E-Wallet
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Account Name */}
          <View className="mb-5">
            <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-muted">
              Account Name
            </Text>
            <TextInput
              placeholder={
                accountType === "BANK"
                  ? "e.g. CIB Salary"
                  : accountType === "DIGITAL_WALLET"
                    ? "e.g. Vodafone Cash"
                    : "e.g. My Wallet"
              }
              placeholderTextColor={
                isDark ? palette.slate[500] : palette.slate[400]
              }
              value={name}
              onChangeText={setName}
              className="rounded-2xl border border-border bg-surface p-4 text-base font-semibold text-text-primary dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </View>

          {/* Currency & Open Balance */}
          <View className="mb-5 flex-row gap-4">
            {/* Currency */}
            <View className="flex-1">
              <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-muted">
                Currency
              </Text>
              <View className="overflow-hidden rounded-2xl border border-border bg-surface dark:border-white/10 dark:bg-white/5">
                <View className="flex-row">
                  {(["EGP", "USD", "EUR"] as const).map((curr) => (
                    <TouchableOpacity
                      key={curr}
                      onPress={() => setCurrency(curr)}
                      className={`flex-1 items-center py-4 ${
                        currency === curr
                          ? "bg-slate-800 dark:bg-white"
                          : "bg-transparent"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          currency === curr
                            ? "text-white dark:text-black"
                            : "text-text-secondary dark:text-text-muted"
                        }`}
                      >
                        {curr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Balance */}
            <View className="flex-1">
              <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-muted">
                Initial Balance
              </Text>
              <TextInput
                placeholder="0.00"
                placeholderTextColor={
                  isDark ? palette.slate[500] : palette.slate[400]
                }
                value={balance}
                onChangeText={setBalance}
                keyboardType="numeric"
                className="rounded-2xl border border-border bg-surface p-4 text-base font-bold text-text-primary dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSubmitting}
            className="mt-4 overflow-hidden rounded-2xl"
          >
            <LinearGradient
              colors={[palette.slate[800], palette.slate[900]]}
              className="items-center py-4"
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Text className="text-lg font-bold text-white">
                {isSubmitting ? "Creating..." : "Create Account"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}
