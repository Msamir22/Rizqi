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
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { database } from "../providers/DatabaseProvider";
import { Account } from "@astik/db";

type AccountType = "CASH" | "BANK" | "GOLD" | "ASSET";

export default function AddAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [type, setType] = useState<AccountType>("CASH");
  const [currency, setCurrency] = useState<"EGP" | "USD" | "XAU">("EGP");

  // Gold specific
  const [goldKarat, setGoldKarat] = useState<"24" | "21" | "18">("21");

  // Bank specific
  const [bankName, setBankName] = useState("");
  const [cardLast4, setCardLast4] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter account name");
      return;
    }
    if (!balance || isNaN(parseFloat(balance))) {
      Alert.alert("Required", "Please enter valid balance");
      return;
    }

    setIsSubmitting(true);

    try {
      await database.write(async () => {
        await database.get<Account>("accounts").create((account) => {
          account.name = name.trim();
          account.type = type;
          account.balance = parseFloat(balance);
          account.isLiquid = type === "CASH" || type === "BANK";

          if (type === "GOLD") {
            account.currency = "XAU";
            account.goldKarat = parseInt(goldKarat);
          } else if (type === "ASSET" && currency === "USD") {
            // Simplified logic
            account.currency = "USD";
          } else {
            account.currency = currency;
          }

          if (type === "BANK") {
            account.bankName = bankName;
            account.cardLast4 = cardLast4;
          }
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
          Add Account
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        {/* Type Selection */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#6B7280",
            marginBottom: 12,
          }}
        >
          Account Type
        </Text>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
          {(["CASH", "BANK", "GOLD", "ASSET"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => {
                setType(t);
                if (t === "GOLD") setCurrency("XAU");
                else if (currency === "XAU") setCurrency("EGP");
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                backgroundColor: type === t ? "#10B981" : "white",
                borderRadius: 12,
                borderWidth: type === t ? 0 : 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text
                style={{
                  color: type === t ? "white" : "#374151",
                  fontWeight: "600",
                }}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Basic Fields */}
        <View style={{ gap: 16 }}>
          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#6B7280",
                marginBottom: 8,
              }}
            >
              Account Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Wallet, CIB, Gold Stash"
              style={{
                backgroundColor: "white",
                padding: 16,
                borderRadius: 12,
                fontSize: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            />
          </View>

          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#6B7280",
                marginBottom: 8,
              }}
            >
              Current Balance
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TextInput
                value={balance}
                onChangeText={setBalance}
                keyboardType="numeric"
                placeholder="0.00"
                style={{
                  flex: 1,
                  backgroundColor: "white",
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              />
              {type !== "GOLD" && (
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: "white",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    overflow: "hidden",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setCurrency("EGP")}
                    style={{
                      padding: 16,
                      backgroundColor:
                        currency === "EGP" ? "#E5E7EB" : "transparent",
                    }}
                  >
                    <Text>EGP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCurrency("USD")}
                    style={{
                      padding: 16,
                      backgroundColor:
                        currency === "USD" ? "#E5E7EB" : "transparent",
                    }}
                  >
                    <Text>USD</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Type Specific Fields */}
        {type === "GOLD" && (
          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#6B7280",
                marginBottom: 8,
              }}
            >
              Gold Karat
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {(["18", "21", "24"] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  onPress={() => setGoldKarat(k)}
                  style={{
                    flex: 1,
                    padding: 16,
                    backgroundColor: goldKarat === k ? "#D97706" : "white",
                    borderRadius: 12,
                    borderWidth: goldKarat === k ? 0 : 1,
                    borderColor: "#E5E7EB",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: goldKarat === k ? "white" : "#374151",
                      fontWeight: "bold",
                    }}
                  >
                    {k}K
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {type === "BANK" && (
          <View style={{ marginTop: 24, gap: 16 }}>
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#6B7280",
                  marginBottom: 8,
                }}
              >
                Bank Name
              </Text>
              <TextInput
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. CIB, NBE"
                style={{
                  backgroundColor: "white",
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              />
            </View>
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#6B7280",
                  marginBottom: 8,
                }}
              >
                Last 4 Digits (Optional)
              </Text>
              <TextInput
                value={cardLast4}
                onChangeText={setCardLast4}
                placeholder="1234"
                maxLength={4}
                keyboardType="numeric"
                style={{
                  backgroundColor: "white",
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
