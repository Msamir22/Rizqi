import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { withObservables } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import Animated, { FadeInDown } from "react-native-reanimated";
import { database } from "../../providers/DatabaseProvider";
import { Transaction, Account } from "@astik/db";
import { INITIAL_RATES } from "../../constants/rates";
import { CATEGORY_UI } from "../../constants/categories";

const RATES = INITIAL_RATES;

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
}

function Dashboard({ transactions, accounts }: DashboardProps) {
  const [currency, setCurrency] = useState<"EGP" | "USD">("EGP");
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Calculate Total Balance in EGP
  const totalBalanceEGP = accounts.reduce((sum, acc) => {
    if (acc.currency === "EGP") return sum + acc.balance;
    if (acc.currency === "USD") return sum + acc.balance * RATES.USD;
    if (acc.type === "GOLD" && acc.goldKarat) {
      // Assuming balance is in grams for Gold accounts
      // Map karat to rate. defaulting to 21K if unknown
      const rate =
        acc.goldKarat === 24
          ? RATES.GOLD_24K
          : acc.goldKarat === 21
            ? RATES.GOLD_21K
            : RATES.GOLD_18K;
      return sum + acc.balance * rate;
    }
    return sum;
  }, 0);

  const displayBalance =
    currency === "EGP" ? totalBalanceEGP : totalBalanceEGP / RATES.USD;

  const formatAmount = (amount: number): string => {
    if (currency === "EGP") {
      return `EGP ${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `$${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />

      {/* Green Header with curved bottom */}
      <View
        style={{
          backgroundColor: "#065F46",
          paddingTop: insets.top + 12,
          paddingBottom: 80,
          paddingHorizontal: 24,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        {/* Header Row with Settings */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Branding */}
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "300" }}>
            أستيك
          </Text>
          <Text
            style={{
              color: "white",
              fontSize: 32,
              fontWeight: "bold",
              marginTop: 4,
            }}
          >
            Astik
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: -60 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Balance Card - overlapping header */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: "white",
            borderRadius: 20,
            padding: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#6B7280", fontSize: 16 }}>
              Total Balance
            </Text>

            {/* EGP/USD Toggle */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#F1F5F9",
                borderRadius: 20,
                padding: 4,
              }}
            >
              <TouchableOpacity
                onPress={() => setCurrency("EGP")}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor:
                    currency === "EGP" ? "#10B981" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: currency === "EGP" ? "white" : "#6B7280",
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  EGP
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCurrency("USD")}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor:
                    currency === "USD" ? "#10B981" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: currency === "USD" ? "white" : "#6B7280",
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  USD
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text
            style={{
              fontSize: 36,
              fontWeight: "bold",
              color: "#1F2937",
              marginTop: 12,
            }}
          >
            {formatAmount(displayBalance)}
          </Text>

          <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
            ≈{" "}
            {currency === "EGP"
              ? `$${(totalBalanceEGP / RATES.USD).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}`
              : `EGP ${totalBalanceEGP.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}`}
          </Text>
        </View>

        {/* Quick Action */}
        <View style={{ marginHorizontal: 20, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#1F2937",
              marginBottom: 12,
            }}
          >
            Quick Action
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push("/voice-input")}
              style={{
                flex: 1,
                backgroundColor: "#10B981",
                borderRadius: 16,
                paddingVertical: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="mic" size={22} color="white" />
              <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                Voice
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/add-transaction")}
              style={{
                flex: 1,
                backgroundColor: "#065F46",
                borderRadius: 16,
                paddingVertical: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="add" size={22} color="white" />
              <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                Manual
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={{ marginHorizontal: 20, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#1F2937",
              marginBottom: 12,
            }}
          >
            Recent Transactions
          </Text>

          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {transactions.length === 0 ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: "#9CA3AF" }}>No transactions yet</Text>
              </View>
            ) : (
              transactions.map((transaction, index) => {
                const categoryUI =
                  CATEGORY_UI[
                    transaction.category as keyof typeof CATEGORY_UI
                  ] || CATEGORY_UI.Other;

                return (
                  <Animated.View
                    key={transaction.id}
                    entering={FadeInDown.delay(index * 100)
                      .springify()
                      .damping(12)}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        borderBottomWidth:
                          index < transactions.length - 1 ? 1 : 0,
                        borderBottomColor: "#F1F5F9",
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
                        <Ionicons
                          name={categoryUI.icon as any}
                          size={24}
                          color={categoryUI.color} // Using category color
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: "#1F2937",
                          }}
                        >
                          {transaction.merchant || transaction.category}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#9CA3AF",
                            marginTop: 2,
                          }}
                        >
                          {/* Format Date: "Oct 25" */}
                          {transaction.createdAt.toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Text>
                      </View>

                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: transaction.isExpense ? "#EF4444" : "#10B981",
                        }}
                      >
                        {transaction.isExpense ? "- " : "+ "}
                        {Math.abs(transaction.amount).toLocaleString()}{" "}
                        {transaction.currency}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Mic Button */}
      <TouchableOpacity
        onPress={() => router.push("/voice-input")}
        style={{
          position: "absolute",
          bottom: 100,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#10B981",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#10B981",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="mic" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const enhance = withObservables([], () => ({
  transactions: database
    .get<Transaction>("transactions")
    .query(Q.sortBy("created_at", Q.desc), Q.take(5)),
  accounts: database.get<Account>("accounts").query(),
}));

export default enhance(Dashboard);
