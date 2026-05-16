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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DropdownItem<T> {
  value: T;
  label: string;
  icon?: string;
  iconType?: "emoji" | "ionicons";
  description?: string;
}

interface DropdownBaseProps<T> {
  label: string;
  items: ReadonlyArray<DropdownItem<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

interface DropdownInlineProps<T> extends DropdownBaseProps<T> {
  /** When false or omitted, renders as an inline expandable dropdown */
  useModal?: false;
  isOpen: boolean;
  onToggle: () => void;
}

interface DropdownModalProps<T> extends DropdownBaseProps<T> {
  /** When true, renders items in a bottom-sheet modal */
  useModal: true;
  isOpen: boolean;
  onToggle: () => void;
}

type DropdownProps<T> = DropdownInlineProps<T> | DropdownModalProps<T>;

// ---------------------------------------------------------------------------
// Shared Sub-components
// ---------------------------------------------------------------------------

interface DropdownItemRowProps<T> {
  item: DropdownItem<T>;
  isSelected: boolean;
  isLast: boolean;
  isDark: boolean;
  onPress: () => void;
}

function DropdownItemRow<T extends string | number>({
  item,
  isSelected,
  isLast,
  isDark,
  onPress,
}: DropdownItemRowProps<T>): React.JSX.Element {
  const selectedStyle = isSelected
    ? {
        backgroundColor: isDark
          ? `${palette.brandGreen[500]}1A`
          : `${palette.brandGreen[500]}14`,
      }
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={selectedStyle}
      className={`flex-row items-center p-4 ${
        !isLast
          ? "border-b border-border-subtle dark:border-border-subtle-dark"
          : ""
      }`}
    >
      {item.icon && (
        <View className="me-3 w-8 items-center">
          {item.iconType === "ionicons" ? (
            <Ionicons
              name={item.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color={
                isSelected
                  ? palette.brandGreen[600]
                  : isDark
                    ? palette.slate[300]
                    : palette.slate[500]
              }
            />
          ) : (
            <Text className="text-xl">{item.icon}</Text>
          )}
        </View>
      )}
      <View className="flex-1">
        <Text
          className={`text-base ${
            isSelected
              ? "font-bold text-action dark:text-action-dark"
              : "text-text-primary dark:text-text-primary-dark"
          }`}
        >
          {item.label}
        </Text>
        {item.description && (
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
            {item.description}
          </Text>
        )}
      </View>
      {isSelected && (
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={palette.brandGreen[600]}
        />
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Modal Variant
// ---------------------------------------------------------------------------

interface DropdownModalViewProps<T> {
  label: string;
  items: ReadonlyArray<DropdownItem<T>>;
  value: T;
  isOpen: boolean;
  isDark: boolean;
  onChange: (value: T) => void;
  onToggle: () => void;
}

function DropdownModalView<T extends string | number>({
  label,
  items,
  value,
  isOpen,
  isDark,
  onChange,
  onToggle,
}: DropdownModalViewProps<T>): React.JSX.Element {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onToggle}
    >
      <TouchableWithoutFeedback onPress={onToggle}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="rounded-t-3xl overflow-hidden max-h-[70%] bg-card dark:bg-card-dark">
            <BlurView
              intensity={40}
              tint={isDark ? "dark" : "light"}
              className="absolute inset-0"
            />
            <View className="absolute inset-0 bg-glass dark:bg-glass-dark" />

            <View>
              {/* Header */}
              <View className="flex-row justify-between items-center px-6 py-5 border-b border-border-card dark:border-border-card-dark">
                <Text className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                  {label}
                </Text>
                <TouchableOpacity onPress={onToggle} className="p-1">
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? palette.slate[300] : palette.slate[500]}
                  />
                </TouchableOpacity>
              </View>

              {/* Items */}
              <ScrollView
                className="max-h-80"
                showsVerticalScrollIndicator={false}
              >
                {items.map((item, index) => (
                  <DropdownItemRow
                    key={String(item.value)}
                    item={item}
                    isSelected={item.value === value}
                    isLast={index === items.length - 1}
                    isDark={isDark}
                    onPress={() => {
                      onChange(item.value);
                      onToggle();
                    }}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * A generic, reusable dropdown component with support for icons and descriptions.
 * Follows the project's premium design language.
 *
 * Supports two modes:
 * - **Inline** (default): Expands items below the trigger.
 * - **Modal**: Shows items in a bottom-sheet modal (set `useModal={true}`).
 */
export function Dropdown<T extends string | number>({
  label,
  items,
  value,
  onChange,
  isOpen,
  onToggle,
  className = "",
  placeholder = "Select...",
  useModal = false,
  disabled = false,
}: DropdownProps<T>): React.JSX.Element {
  const { isDark } = useTheme();
  const selectedItem = items.find((item) => item.value === value);

  return (
    <View className={`mb-3 ${className} ${disabled ? "opacity-50" : ""}`}>
      <Text className="input-label mb-2">{label}</Text>

      <View className="rounded-2xl border border-border-card bg-card dark:border-border-card-dark dark:bg-card-dark overflow-hidden">
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.7}
          disabled={disabled}
          className="p-4"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              {selectedItem?.icon && (
                <View className="me-3 w-8 items-center">
                  {selectedItem.iconType === "ionicons" ? (
                    <Ionicons
                      name={selectedItem.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={
                        isDark
                          ? palette.brandGreen[400]
                          : palette.brandGreen[600]
                      }
                    />
                  ) : (
                    <Text className="text-xl">{selectedItem.icon}</Text>
                  )}
                </View>
              )}
              <Text className="text-base font-medium text-text-primary dark:text-text-primary-dark">
                {selectedItem?.label || placeholder}
              </Text>
            </View>
            <Ionicons
              name={!useModal && isOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={isDark ? palette.slate[400] : palette.slate[500]}
            />
          </View>
        </TouchableOpacity>

        {/* Inline expansion (non-modal mode) */}
        {!useModal && isOpen && (
          <View className="border-t border-border-subtle dark:border-border-subtle-dark max-h-60">
            {items.map((item, index) => (
              <DropdownItemRow
                key={String(item.value)}
                item={item}
                isSelected={item.value === value}
                isLast={index === items.length - 1}
                isDark={isDark}
                onPress={() => {
                  onChange(item.value);
                  onToggle();
                }}
              />
            ))}
          </View>
        )}
      </View>

      {/* Modal expansion */}
      {useModal && (
        <DropdownModalView
          label={label}
          items={items}
          value={value}
          isOpen={isOpen}
          isDark={isDark}
          onChange={onChange}
          onToggle={onToggle}
        />
      )}
    </View>
  );
}
