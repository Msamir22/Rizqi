import { AppDrawer } from "@/components/navigation/AppDrawer";
import { useNetWorth } from "@/hooks/useNetWorth";
import { Account, AccountType, database } from "@astik/db";
import { convertToEGP } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { Q } from "@nozbe/watermelondb";
import { withObservables } from "@nozbe/watermelondb/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMarketRates } from "../../hooks/useMarketRates";

interface AccountsProps {
  accounts: Account[];
}

function Accounts({ accounts }: AccountsProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { latestRates } = useMarketRates();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Calculate total net worth in EGP
  const { netWorthData } = useNetWorth();
  const totalNetWorth = netWorthData?.totalNetWorth;
  const formatBalance = (account: Account): string => {
    const currencySymbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      EGP: "",
    };
    const symbol = currencySymbols[account.currency] || "";
    const suffix = account.currency === "EGP" ? " EGP" : "";
    return `${symbol}${account.balance.toLocaleString()}${suffix}`;
  };

  const getAccountSubtitle = (account: Account): string => {
    // For non-EGP accounts, show EGP equivalent
    if (account.currency !== "EGP" && latestRates) {
      const egpValue = convertToEGP(
        account.balance,
        account.currency,
        latestRates
      );
      return `≈ EGP ${egpValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }

    // Default subtitles by type
    switch (account.type) {
      case "BANK":
        return "Bank Account";
      case "DIGITAL_WALLET":
        return "Digital Wallet";
      case "CASH":
        return "Physical money";
      default:
        return "";
    }
  };

  // Helper to get icon/color based on type
  const getAccountStyle = (
    type: AccountType
  ): { icon: string; color: string } => {
    switch (type) {
      case "CASH":
        return { icon: "cash", color: "#10B981" };
      case "BANK":
        return { icon: "business", color: "#3B82F6" };
      case "DIGITAL_WALLET":
        return { icon: "phone-portrait", color: "#8B5CF6" };
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
          borderBottomRightRadius: 32,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => setIsDrawerOpen(true)}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="menu-outline" size={32} color="white" />
          </TouchableOpacity>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "bold" }}>
            Accounts
          </Text>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            Total Balance
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
            {totalNetWorth?.toLocaleString("en-US", {
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
        {accounts.length === 0 && (
          <View
            style={{
              marginTop: 40,
              alignItems: "center",
              padding: 24,
            }}
          >
            <Ionicons name="wallet-outline" size={64} color="#9CA3AF" />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: "#6B7280",
                marginTop: 16,
              }}
            >
              No accounts yet
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#9CA3AF",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Add your first account to start tracking your finances
            </Text>
          </View>
        )}

        {accounts.map((account, index) => {
          const style = getAccountStyle(account.type);
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
                      name={style.icon as keyof typeof Ionicons.glyphMap}
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
            Track your money in EGP, USD, or EUR. Exchange rates are updated
            automatically.
          </Text>
        </View>
      </ScrollView>

      <AppDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </View>
  );
}

const enhance = withObservables([], () => ({
  accounts: database.get<Account>("accounts").query(Q.where("deleted", false)),
}));

export default enhance(Accounts);
