import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withObservables } from "@nozbe/watermelondb/react";
import { database } from "../../providers/DatabaseProvider";
import { Account } from "@astik/db";
import { INITIAL_RATES } from "../../constants/rates";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

const RATES = INITIAL_RATES;

interface AccountsProps {
  accounts: Account[];
}

function Accounts({ accounts }: AccountsProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Calculate total net worth in EGP
  const netWorth = accounts.reduce((total, account) => {
    if (account.currency === "EGP") return total + account.balance;
    if (account.currency === "USD") return total + account.balance * RATES.USD;
    if (account.type === "GOLD" && account.goldKarat) {
      // Assuming balance is in grams for Gold accounts
      const rate =
        account.goldKarat === 24
          ? RATES.GOLD_24K
          : account.goldKarat === 21
            ? RATES.GOLD_21K
            : RATES.GOLD_18K;
      return total + account.balance * rate;
    }
    // Fallback if gold karat missing but type is gold?
    if (account.currency === "XAU") {
      return total + account.balance * RATES.GOLD_21K;
    }
    return total;
  }, 0);

  const formatBalance = (account: Account): string => {
    if (account.type === "GOLD") {
      return `${account.balance}g ${account.goldKarat || ""}K`;
    }
    return `${account.currency === "USD" ? "$" : ""}${account.balance.toLocaleString()} ${
      account.currency === "EGP" ? "EGP" : ""
    }`;
  };

  const getAccountSubtitle = (account: Account): string => {
    switch (account.type) {
      case "BANK":
        return account.bankName
          ? `${account.bankName} ${account.cardLast4 ? `****${account.cardLast4}` : ""}`
          : "Bank Account";
      case "GOLD":
        const rate =
          account.goldKarat === 24
            ? RATES.GOLD_24K
            : account.goldKarat === 21
              ? RATES.GOLD_21K
              : RATES.GOLD_18K;
        return `≈ EGP ${(account.balance * rate).toLocaleString()}`;
      // Treating XAU as GOLD type implicitly
      case "ASSET":
        if (account.currency === "USD") {
          return `≈ EGP ${(account.balance * RATES.USD).toLocaleString()}`;
        }
        return "";
      default:
        // For USD Cash
        if (account.currency === "USD") {
          return `≈ EGP ${(account.balance * RATES.USD).toLocaleString()}`;
        }
        // For EGP Cash
        return "Physical money";
    }
  };

  // Helper to get icon/color based on type
  const getAccountStyle = (account: Account) => {
    switch (account.type) {
      case "CASH":
        return { icon: "cash", color: "#10B981" };
      case "BANK":
        return { icon: "business", color: "#3B82F6" };
      case "GOLD":
        return { icon: "trophy", color: "#D97706" }; // trophy or diamond
      default:
        return { icon: "wallet", color: "#8B5CF6" };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />

      {/* Header with Net Worth */}
      <View
        style={{
          backgroundColor: "#065F46",
          paddingTop: insets.top + 16,
          paddingBottom: 32,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <Text style={{ color: "white", fontSize: 28, fontWeight: "bold" }}>
          Accounts
        </Text>

        <View style={{ marginTop: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            Total Net Worth
          </Text>
          <Text
            style={{
              color: "white",
              fontSize: 32,
              fontWeight: "bold",
              marginTop: 4,
            }}
          >
            EGP{" "}
            {netWorth.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      </View>

      {/* Account Cards */}
      <ScrollView
        style={{ flex: 1, marginTop: -16 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      >
        {accounts.map((account, index) => {
          const style = getAccountStyle(account);
          return (
            <Animated.View
              key={account.id}
              entering={FadeInDown.delay(index * 100)
                .springify()
                .damping(12)}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: "white",
                  borderRadius: 20,
                  padding: 20,
                  marginTop: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {/* Icon */}
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: `${style.color}15`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={style.icon as any}
                      size={28}
                      color={style.color}
                    />
                  </View>

                  {/* Account Info */}
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "600",
                        color: "#1F2937",
                      }}
                    >
                      {account.name}
                    </Text>
                    <Text
                      style={{ fontSize: 14, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {getAccountSubtitle(account)}
                    </Text>
                  </View>

                  {/* Balance */}
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "bold",
                        color: "#1F2937",
                      }}
                    >
                      {formatBalance(account)}
                    </Text>
                    {account.type === "GOLD" && (
                      <Text
                        style={{ fontSize: 12, color: "#D97706", marginTop: 2 }}
                      >
                        {account.goldKarat} Karat Gold
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        {/* Add Account Button */}
        <TouchableOpacity
          onPress={() => router.push("/add-account")}
          style={{
            marginTop: 24,
            backgroundColor: "white",
            borderRadius: 20,
            padding: 20,
            borderWidth: 2,
            borderColor: "#E5E7EB",
            borderStyle: "dashed",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={28} color="#6B7280" />
          </View>
          <Text
            style={{
              marginLeft: 12,
              fontSize: 16,
              fontWeight: "600",
              color: "#6B7280",
            }}
          >
            Add New Account
          </Text>
        </TouchableOpacity>
        {/* Info Card */}
        <View
          style={{
            marginTop: 24,
            backgroundColor: "#065F46",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="information-circle" size={24} color="white" />
            <Text
              style={{
                marginLeft: 12,
                color: "white",
                fontWeight: "600",
                fontSize: 16,
              }}
            >
              Multi-Currency Support
            </Text>
          </View>
          <Text
            style={{
              color: "rgba(255,255,255,0.8)",
              marginTop: 8,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            Track your money in EGP, USD, or Gold. Exchange rates are updated
            automatically.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const enhance = withObservables([], () => ({
  accounts: database.get<Account>("accounts").query(),
}));

export default enhance(Accounts);
