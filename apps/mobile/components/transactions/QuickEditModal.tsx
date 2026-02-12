import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalculatorKey,
  CalculatorKeypad,
} from "@/components/add-transaction/CalculatorKeypad";
import { formatWithCommas } from "@/components/add-transaction/AmountDisplay";
import { CategoryPicker } from "@/components/add-transaction/CategoryPicker";
import { palette } from "@/constants/colors";
import { useCategories } from "@/hooks/useCategories";

interface QuickEditModalProps {
  visible: boolean;
  type: "CATEGORY" | "AMOUNT";
  transactionType: "INCOME" | "EXPENSE" | "TRANSFER";
  initialCategoryId?: string;
  initialAmount?: number;
  currency?: string;
  amountColor?: string;
  onClose: () => void;
  onSave: (value: string | number) => void;
}

export function QuickEditModal({
  visible,
  type,
  transactionType,
  initialCategoryId,
  initialAmount,
  currency = "EGP",
  amountColor,
  onClose,
  onSave,
}: QuickEditModalProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();

  // State
  const [amount, setAmount] = useState(initialAmount?.toString() || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialCategoryId || ""
  );

  // Reset state on open
  useEffect(() => {
    if (visible) {
      if (type === "AMOUNT") {
        setAmount(initialAmount?.toString() || "");
      } else {
        setSelectedCategoryId(initialCategoryId || "");
      }
    }
  }, [visible, type, initialAmount, initialCategoryId]);

  // Categories
  const { categories, expenseCategories, incomeCategories } = useCategories();
  const relevantCategories =
    transactionType === "INCOME" ? incomeCategories : expenseCategories;
  const currentCategory =
    categories.find((c) => c.systemName === selectedCategoryId) || null;

  // Handlers
  const handleKeyPress = (key: CalculatorKey): void => {
    if (key === "DONE") {
      const val = parseFloat(amount);
      if (!isNaN(val) && val > 0) {
        onSave(val);
      }
      onClose();
      return;
    }
    if (key === "=") {
      try {
        if (/^[0-9+\-*/.]+$/.test(amount)) {
          // eslint-disable-next-line no-eval
          const result = eval(amount) as number;
          setAmount(parseFloat(result.toFixed(10)).toString());
        }
      } catch {
        // invalid expression, ignore
      }
      return;
    }
    if (key === "DEL") {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }
    setAmount((prev) => {
      if (key === "." && prev.includes(".")) return prev;
      return prev + key;
    });
  };

  const handleCategorySelect = (catId: string): void => {
    setSelectedCategoryId(catId);
    onSave(catId);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="bg-white dark:bg-slate-900 rounded-t-3xl overflow-hidden"
          style={{ paddingBottom: insets.bottom }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <Text className="text-lg font-bold text-slate-900 dark:text-white">
              {type === "AMOUNT" ? "Edit Amount" : "Edit Category"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close-circle"
                size={28}
                color={palette.slate[400]}
              />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {type === "AMOUNT" ? (
            <View>
              <View className="items-center justify-center py-8">
                <Text
                  className="text-4xl font-bold text-slate-900 dark:text-slate-25"
                  style={amountColor ? { color: amountColor } : {}}
                >
                  {currency} {formatWithCommas(amount) || "0"}
                </Text>
              </View>
              <CalculatorKeypad onKeyPress={handleKeyPress} />
            </View>
          ) : (
            <View className="h-[400px]">
              <CategoryPicker
                categories={relevantCategories}
                selectedCategory={currentCategory}
                onSelectCategory={(cat) => handleCategorySelect(cat.systemName)}
                onOpenPicker={() => {}}
              />
              <View className="flex-row flex-wrap p-4 justify-between">
                {relevantCategories.slice(0, 12).map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    className={`w-[30%] items-center mb-6 p-2 rounded-xl border ${selectedCategoryId === cat.systemName ? "border-nileGreen-500 bg-nileGreen-50 dark:bg-nileGreen-900/20" : "border-transparent"}`}
                    onPress={() => handleCategorySelect(cat.systemName)}
                  >
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center mb-2"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <Ionicons
                        name={cat.icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color={cat.color || palette.nileGreen[500]}
                      />
                    </View>
                    <Text
                      className="text-xs text-center font-medium text-slate-700 dark:text-slate-300"
                      numberOfLines={1}
                    >
                      {cat.displayName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
