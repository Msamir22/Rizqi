import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export interface SegmentedControlOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedControlProps<T extends string> {
  readonly value: T;
  readonly options: ReadonlyArray<SegmentedControlOption<T>>;
  readonly onChange: (value: T) => void;
  readonly className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <View
      className={`flex-row overflow-hidden rounded-xl border border-border-card bg-card-muted dark:bg-card-muted-dark ${className}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(option.value)}
            className="flex-1"
          >
            <View
              className={`items-center justify-center px-4 py-2 ${
                isSelected
                  ? "bg-action/10 dark:bg-action-dark/20"
                  : "bg-transparent"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isSelected
                    ? "text-action dark:text-action-dark"
                    : "text-text-secondary dark:text-text-secondary-dark"
                }`}
              >
                {option.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
