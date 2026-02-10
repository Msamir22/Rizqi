import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Category } from "@astik/db";
import { CategoryIcon, IconLibrary } from "@/components/common/CategoryIcon";

interface CategorySelectorModalProps {
  visible: boolean;
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function CategorySelectorModal({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
}: CategorySelectorModalProps): React.JSX.Element {
  const { isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="rounded-t-3xl overflow-hidden max-h-[80%] bg-white dark:bg-slate-900 z-50">
            <BlurView
              intensity={40}
              tint={isDark ? "dark" : "light"}
              className="absolute inset-0"
            />
            <View className="absolute inset-0 bg-white/95 dark:bg-slate-900/95" />

            <View>
              {/* Header */}
              <View className="flex-row justify-between items-center px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                <Text className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  Select Category
                </Text>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? palette.slate[300] : palette.slate[500]}
                  />
                </TouchableOpacity>
              </View>

              {/* Category Grid */}
              <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-3 pb-10">
                  {categories.map((category) => {
                    const isSelected = category.systemName === selectedId;
                    
                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={{ width: "30%" }}
                        className="items-center mb-4"
                        onPress={() => {
                          onSelect(category.systemName);
                          onClose();
                        }}
                      >
                        <View
                          className={`w-16 h-16 rounded-3xl items-center justify-center mb-2 border-2 ${
                            isSelected
                              ? "border-nileGreen-500"
                              : "border-transparent bg-slate-50 dark:bg-slate-800/50"
                          }`}
                          style={{
                            backgroundColor: isSelected 
                              ? `${category.color}20` 
                              : undefined
                          }}
                        >
                          <CategoryIcon
                            iconName={category.icon}
                            iconLibrary={category.iconLibrary as IconLibrary}
                            size={28}
                            color={category.color}
                          />
                          {isSelected && (
                            <View className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 rounded-full">
                              <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color={palette.nileGreen[600]}
                              />
                            </View>
                          )}
                        </View>
                        <Text
                          numberOfLines={1}
                          className={`text-xs text-center font-medium ${
                            isSelected
                              ? "text-nileGreen-700 dark:text-nileGreen-300 font-bold"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {category.displayName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
