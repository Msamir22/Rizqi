import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, ViewStyle } from "react-native";

interface EmptyStateCardProps {
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  height?: number;
  borderRadius?: number;
  className?: string;
  style?: ViewStyle;
}

export function EmptyStateCard({
  onPress,
  icon,
  title,
  description,
  height = 100,
  borderRadius = 16,
  className = "",
  style,
}: EmptyStateCardProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[{ height, borderRadius }, style]}
      className={`border-2 border-dashed items-center justify-center px-4 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 ${className}`}
    >
      <Ionicons
        name={icon}
        size={32}
        className="text-slate-400 dark:text-slate-500"
      />
      <Text className="text-sm font-semibold mt-2 text-slate-500 dark:text-slate-400">
        {title}
      </Text>
      <Text className="text-xs mt-1 text-slate-400 dark:text-slate-500">
        {description}
      </Text>
    </TouchableOpacity>
  );
}
