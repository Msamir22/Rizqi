import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withObservables } from "@nozbe/watermelondb/react";
import { database } from "../providers/DatabaseProvider";
import { Account } from "@astik/db";
import { Category } from "@astik/logic";
import { createTransaction } from "../utils/transactions";
import { CATEGORY_LIST } from "../constants/categories";

type TransactionType = "expense" | "income";

interface AddTransactionProps {
  accounts: Account[];
}

function AddTransaction({ accounts }: AddTransactionProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("Food");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      // Prefer cash account as default, otherwise first available
      const cashAccount = accounts.find((a) => a.type === "CASH");
      setSelectedAccount(cashAccount ? cashAccount.id : accounts[0].id);
    }
  }, [accounts]);

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert("Invalid Amount", "Please enter a valid number");
      return;
    }

    if (!selectedAccount) {
      Alert.alert("No Account", "Please create an account first");
      return;
    }

    setIsSubmitting(true);
    try {
      await createTransaction({
        amount: parseFloat(amount),
        currency: selectedAccountDetails?.currency || "EGP",
        category: selectedCategory,
        merchant: merchant.trim(),
        accountId: selectedAccount,
        note: note.trim(),
        isExpense: type === "expense",
      });
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAccountDetails = accounts.find((a) => a.id === selectedAccount);

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
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "600" }}>
          Add Transaction
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={isSubmitting}>
          <Text
            style={{
              color: isSubmitting ? "#6EE7B7" : "#10B981",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {/* Type Toggle */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#F1F5F9",
            borderRadius: 12,
            padding: 4,
            marginBottom: 24,
          }}
        >
          <TouchableOpacity
            onPress={() => setType("expense")}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: type === "expense" ? "#EF4444" : "transparent",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "600",
                color: type === "expense" ? "white" : "#6B7280",
              }}
            >
              Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setType("income")}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: type === "income" ? "#10B981" : "transparent",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "600",
                color: type === "income" ? "white" : "#6B7280",
              }}
            >
              Income
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#6B7280",
              marginBottom: 8,
            }}
          >
            Amount
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "white",
              borderRadius: 16,
              padding: 16,
              borderWidth: 2,
              borderColor: "#E5E7EB",
            }}
          >
            <Text style={{ fontSize: 24, color: "#6B7280", marginRight: 8 }}>
              {selectedAccountDetails?.currency || "EGP"}
            </Text>
            <TextInput
              placeholder="0.00"
              placeholderTextColor="#D1D5DB"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={{
                flex: 1,
                fontSize: 32,
                fontWeight: "bold",
                color: type === "expense" ? "#EF4444" : "#10B981",
              }}
            />
          </View>
        </View>

        {/* Category Selection */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#6B7280",
              marginBottom: 12,
            }}
          >
            Category
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {CATEGORY_LIST.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={{
                  width: "30%",
                  aspectRatio: 1,
                  backgroundColor:
                    selectedCategory === cat.id ? cat.color : "white",
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor:
                    selectedCategory === cat.id ? cat.color : "#E5E7EB",
                }}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={28}
                  color={selectedCategory === cat.id ? "white" : cat.color}
                />
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: "600",
                    color: selectedCategory === cat.id ? "white" : "#6B7280",
                  }}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Account Selection */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#6B7280",
              marginBottom: 12,
            }}
          >
            Account
          </Text>
          <View style={{ gap: 8 }}>
            {accounts.map((acc) => (
              <TouchableOpacity
                key={acc.id}
                onPress={() => setSelectedAccount(acc.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 2,
                  borderColor:
                    selectedAccount === acc.id ? "#10B981" : "#E5E7EB",
                }}
              >
                <Ionicons
                  name={
                    acc.type === "CASH"
                      ? "cash"
                      : acc.type === "GOLD"
                        ? "trophy" // Changed from diamond to trophy/something generic if needed, or pass correct enum
                        : "card"
                  }
                  size={24}
                  color={selectedAccount === acc.id ? "#10B981" : "#6B7280"}
                />
                <Text
                  style={{
                    marginLeft: 12,
                    fontSize: 16,
                    fontWeight: "500",
                    color: "#1F2937",
                  }}
                >
                  {acc.name}
                </Text>
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 14,
                    color: "#9CA3AF",
                  }}
                >
                  ({acc.currency})
                </Text>
                {selectedAccount === acc.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color="#10B981"
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Merchant Input */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#6B7280",
              marginBottom: 8,
            }}
          >
            Merchant (Optional)
          </Text>
          <TextInput
            placeholder="e.g., Starbucks, Uber, etc."
            placeholderTextColor="#D1D5DB"
            value={merchant}
            onChangeText={setMerchant}
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              color: "#1F2937",
              borderWidth: 2,
              borderColor: "#E5E7EB",
            }}
          />
        </View>

        {/* Note Input */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#6B7280",
              marginBottom: 8,
            }}
          >
            Note (Optional)
          </Text>
          <TextInput
            placeholder="Add a note..."
            placeholderTextColor="#D1D5DB"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              color: "#1F2937",
              borderWidth: 2,
              borderColor: "#E5E7EB",
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSubmitting}
          style={{
            backgroundColor: isSubmitting ? "#6EE7B7" : "#10B981",
            borderRadius: 16,
            paddingVertical: 18,
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "600" }}>
            {isSubmitting ? "Saving..." : "Save Transaction"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// Enhance component with WatermelonDB observables
const enhance = withObservables([], () => ({
  accounts: database.get<Account>("accounts").query(),
}));

export default enhance(AddTransaction);
