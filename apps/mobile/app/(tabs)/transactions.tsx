import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FilterType = "All" | "Expenses" | "Income";

// Mock transaction data grouped by date
const mockTransactions = {
  Today: [
    {
      id: "1",
      merchant: "Uber",
      category: "Transport",
      amount: -75,
      currency: "EGP",
    },
    {
      id: "2",
      merchant: "Starbucks",
      category: "Food",
      amount: -85,
      currency: "EGP",
    },
  ],
  Yesterday: [
    {
      id: "3",
      merchant: "Coffee Shop",
      category: "Food",
      amount: -45,
      currency: "EGP",
    },
    {
      id: "4",
      merchant: "Grocery Store",
      category: "Shopping",
      amount: -320,
      currency: "EGP",
    },
  ],
  "Oct 25": [
    {
      id: "5",
      merchant: "Salary",
      category: "Income",
      amount: 12500,
      currency: "EGP",
    },
    {
      id: "6",
      merchant: "Freelance",
      category: "Income",
      amount: 2500,
      currency: "EGP",
    },
  ],
  "Oct 24": [
    {
      id: "7",
      merchant: "Netflix",
      category: "Entertainment",
      amount: -199,
      currency: "EGP",
    },
    {
      id: "8",
      merchant: "Electric Bill",
      category: "Utilities",
      amount: -450,
      currency: "EGP",
    },
  ],
};

const categoryIcons: Record<string, string> = {
  Food: "cafe",
  Transport: "car",
  Shopping: "cart",
  Income: "wallet",
  Entertainment: "game-controller",
  Utilities: "flash",
};

const categoryColors: Record<string, string> = {
  Food: "#F59E0B",
  Transport: "#3B82F6",
  Shopping: "#EC4899",
  Income: "#10B981",
  Entertainment: "#8B5CF6",
  Utilities: "#6366F1",
};

export default function Transactions() {
  const [filter, setFilter] = useState<FilterType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const insets = useSafeAreaInsets();

  const filterTransactions = () => {
    const filtered: Record<string, (typeof mockTransactions)["Today"]> = {};

    Object.entries(mockTransactions).forEach(([date, transactions]) => {
      const filteredTx = transactions.filter((tx) => {
        const matchesFilter =
          filter === "All" ||
          (filter === "Expenses" && tx.amount < 0) ||
          (filter === "Income" && tx.amount > 0);

        const matchesSearch =
          searchQuery === "" ||
          tx.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.category.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesFilter && matchesSearch;
      });

      if (filteredTx.length > 0) {
        filtered[date] = filteredTx;
      }
    });

    return filtered;
  };

  const filteredData = filterTransactions();

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />

      {/* Header */}
      <View
        style={{
          backgroundColor: "#065F46",
          paddingTop: insets.top + 16,
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
      >
        <Text style={{ color: "white", fontSize: 28, fontWeight: "bold" }}>
          Transactions
        </Text>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "white",
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search transactions..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              marginLeft: 12,
              fontSize: 16,
              color: "#1F2937",
            }}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#F1F5F9",
            borderRadius: 12,
            padding: 4,
          }}
        >
          {(["All", "Expenses", "Income"] as FilterType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setFilter(tab)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: filter === tab ? "white" : "transparent",
                shadowColor: filter === tab ? "#000" : "transparent",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: filter === tab ? 0.1 : 0,
                shadowRadius: 4,
                elevation: filter === tab ? 2 : 0,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "600",
                  fontSize: 14,
                  color: filter === tab ? "#065F46" : "#6B7280",
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Transaction List */}
      <ScrollView
        style={{ flex: 1, marginTop: 16 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {Object.entries(filteredData).map(([date, transactions]) => (
          <View key={date} style={{ marginBottom: 24 }}>
            {/* Date Header */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#6B7280",
                marginHorizontal: 20,
                marginBottom: 12,
              }}
            >
              {date}
            </Text>

            {/* Transactions for this date */}
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: "white",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {transactions.map((transaction, index) => (
                <TouchableOpacity
                  key={transaction.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    borderBottomWidth: index < transactions.length - 1 ? 1 : 0,
                    borderBottomColor: "#F1F5F9",
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: `${categoryColors[transaction.category]}15`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={
                        (categoryIcons[transaction.category] as any) ||
                        "ellipsis-horizontal"
                      }
                      size={22}
                      color={categoryColors[transaction.category]}
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
                      {transaction.merchant}
                    </Text>
                    <Text
                      style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {transaction.category}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: transaction.amount > 0 ? "#10B981" : "#EF4444",
                    }}
                  >
                    {transaction.amount > 0 ? "+" : ""}
                    {transaction.amount.toLocaleString()} {transaction.currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Empty State */}
        {Object.keys(filteredData).length === 0 && (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: "#9CA3AF",
                marginTop: 16,
              }}
            >
              No transactions found
            </Text>
            <Text style={{ fontSize: 14, color: "#D1D5DB", marginTop: 4 }}>
              Try adjusting your filters
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
