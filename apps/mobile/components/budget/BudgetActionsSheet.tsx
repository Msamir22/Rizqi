/**
 * BudgetActionsSheet Component
 *
 * Bottom sheet with budget management actions:
 * - Edit Budget
 * - Pause/Resume Budget
 * - Delete Budget (with confirmation)
 *
 * Architecture & Design Rationale:
 * - Pattern: Modal Component with action dispatch
 * - SOLID: SRP — only handles action selection, delegates execution to parent.
 *
 * @module BudgetActionsSheet
 */

import React, { useCallback, useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BudgetAction = "edit" | "pause" | "resume" | "delete";

interface BudgetActionsSheetProps {
  readonly visible: boolean;
  readonly isPaused: boolean;
  readonly onClose: () => void;
  readonly onAction: (action: BudgetAction) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetActionsSheet({
  visible,
  isPaused,
  onClose,
  onAction,
}: BudgetActionsSheetProps): React.JSX.Element {
  const { isDark } = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = useCallback((): void => {
    setShowDeleteConfirm(false);
    onClose();
    onAction("delete");
  }, [onClose, onAction]);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable className="flex-1 bg-black/40" onPress={onClose}>
          <View className="flex-1" />
          <Pressable
            className="bg-white dark:bg-slate-800 rounded-t-3xl px-5 pb-10 pt-6"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <View className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center mb-6" />

            {/* Edit */}
            <TouchableOpacity
              onPress={() => {
                onClose();
                onAction("edit");
              }}
              className="flex-row items-center py-4"
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-slate-100 dark:bg-slate-700 mr-4">
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={isDark ? palette.slate[300] : palette.slate[600]}
                />
              </View>
              <Text className="text-base font-semibold text-slate-800 dark:text-white">
                Edit Budget
              </Text>
            </TouchableOpacity>

            {/* Pause/Resume */}
            <TouchableOpacity
              onPress={() => {
                onClose();
                onAction(isPaused ? "resume" : "pause");
              }}
              className="flex-row items-center py-4"
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-slate-100 dark:bg-slate-700 mr-4">
                <Ionicons
                  name={isPaused ? "play-outline" : "pause-outline"}
                  size={20}
                  color={palette.gold[600]}
                />
              </View>
              <Text className="text-base font-semibold text-slate-800 dark:text-white">
                {isPaused ? "Resume Budget" : "Pause Budget"}
              </Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              onPress={() => {
                onClose();
                setShowDeleteConfirm(true);
              }}
              className="flex-row items-center py-4"
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-red-50 dark:bg-red-900/20 mr-4">
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={palette.red[500]}
                />
              </View>
              <Text className="text-base font-semibold text-red-500">
                Delete Budget
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        visible={showDeleteConfirm}
        title="Delete Budget"
        message="Are you sure you want to delete this budget? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
