import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { palette } from "@/constants/colors";

interface DeleteConfirmationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  count: number;
}

export function DeleteConfirmationModal({
  visible,
  onConfirm,
  onCancel,
  count,
}: DeleteConfirmationModalProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View className="flex-1 bg-black/70 justify-center items-center">
          <TouchableWithoutFeedback>
            <View className="w-[85%] max-w-[340px] rounded-2xl overflow-hidden border border-transparent dark:border-slate-700/40">
              <BlurView
                intensity={20}
                tint={isDark ? "dark" : "light"}
                className="absolute inset-0"
              />
              <View className="absolute inset-0 bg-white/95 dark:bg-slate-900/95" />

              <View className="p-6">
                {/* Icon */}
                <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 justify-center items-center self-center mb-4">
                  <Ionicons
                    name="trash-outline"
                    size={32}
                    color={palette.red[500]}
                  />
                </View>

                {/* Title */}
                <Text className="text-[22px] font-bold text-slate-800 dark:text-slate-100 text-center mb-2">
                  Delete {count > 1 ? "Transactions" : "Transaction"}?
                </Text>

                {/* Message */}
                <Text className="text-[15px] text-slate-500 dark:text-slate-400 text-center leading-[22px] mb-6">
                  {count > 1
                    ? `This will delete ${count} transactions and revert all associated changes to account balances. This action cannot be undone.`
                    : "This will delete the transaction and revert all associated changes to account balances. This action cannot be undone."}
                </Text>

                {/* Actions */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 py-3.5 rounded-xl items-center justify-center bg-slate-100 dark:bg-slate-800"
                    onPress={onCancel}
                  >
                    <Text className="text-base font-semibold text-slate-600 dark:text-slate-300">
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-1 py-3.5 rounded-xl items-center justify-center bg-red-500"
                    onPress={() => {
                      onConfirm();
                      onCancel();
                    }}
                  >
                    <Text className="text-base font-semibold text-white">
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
