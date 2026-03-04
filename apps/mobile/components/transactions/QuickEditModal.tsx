import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type CalculatorKey,
  CalculatorKeypad,
} from "@/components/add-transaction/CalculatorKeypad";
import { formatAmountInput } from "@astik/logic";
import { CategoryPicker } from "@/components/add-transaction/CategoryPicker";
import { CategorySelectorModal } from "@/components/modals/CategorySelectorModal";
import { palette } from "@/constants/colors";
import { useCategoryLookup } from "@/context/CategoriesContext";
import { useCategories } from "@/hooks/useCategories";
import type { TransactionType } from "@astik/db";

interface QuickEditModalProps {
  readonly visible: boolean;
  readonly type: "CATEGORY" | "AMOUNT";
  readonly transactionType: "INCOME" | "EXPENSE" | "TRANSFER";
  readonly initialCategoryId?: string;
  readonly initialAmount?: number;
  readonly currency?: string;
  readonly amountColor?: string;
  readonly onClose: () => void;
  readonly onSave: (value: string | number) => void;
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
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

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

  // Categories — use global lookup map keyed by ID for correct matching
  const categoryMap = useCategoryLookup();
  const { expenseCategories, incomeCategories } = useCategories();
  const relevantCategories =
    transactionType === "INCOME" ? incomeCategories : expenseCategories;
  const selectedCategory = categoryMap.get(selectedCategoryId) ?? null;
  const categoryModalType: TransactionType =
    transactionType === "INCOME" ? "INCOME" : "EXPENSE";

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
    <>
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
                    {currency} {formatAmountInput(amount, "0")}
                  </Text>
                </View>
                <CalculatorKeypad onKeyPress={handleKeyPress} />
              </View>
            ) : (
              <View className="px-4 pt-4 pb-2">
                <CategoryPicker
                  categories={relevantCategories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(cat) => handleCategorySelect(cat.id)}
                  onOpenPicker={() => setIsCategoryModalOpen(true)}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Full Category Selector (opened from CategoryPicker's "open" action) */}
      <CategorySelectorModal
        visible={isCategoryModalOpen}
        rootCategories={relevantCategories}
        type={categoryModalType}
        selectedId={selectedCategoryId}
        onSelect={(catId) => handleCategorySelect(catId)}
        onClose={() => setIsCategoryModalOpen(false)}
      />
    </>
  );
}
