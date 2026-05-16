import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { palette } from "@/constants/colors";
import { AppCard } from "./AppCard";

interface MetricCardProps {
  readonly title: string;
  readonly amount: string;
  readonly subtitle?: string;
  readonly trend?: string;
  readonly icon?: keyof typeof Ionicons.glyphMap;
  readonly className?: string;
}

export function MetricCard({
  title,
  amount,
  subtitle,
  trend,
  icon,
  className = "",
}: MetricCardProps): React.JSX.Element {
  return (
    <AppCard className={`p-5 ${className}`}>
      <View className="flex-row items-center gap-2">
        <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
          {title}
        </Text>
        {icon ? (
          <Ionicons name={icon} size={18} color={palette.slate[500]} />
        ) : null}
      </View>
      <Text className="mt-3 text-4xl font-black text-text-primary dark:text-text-primary-dark">
        {amount}
      </Text>
      {subtitle ? (
        <Text className="mt-2 text-base text-text-secondary dark:text-text-secondary-dark">
          {subtitle}
        </Text>
      ) : null}
      {trend ? (
        <Text className="mt-4 text-base font-bold text-success dark:text-success-dark">
          {trend}
        </Text>
      ) : null}
    </AppCard>
  );
}
