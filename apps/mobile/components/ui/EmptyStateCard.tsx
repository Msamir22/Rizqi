import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";

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
  const { isDark } = useTheme();
  const isCompact = height <= 64;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[{ height, borderRadius }, style]}
      className={`border-2 border-dashed px-4 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 ${
        isCompact ? "flex-row items-center" : "items-center justify-center"
      } ${className}`}
    >
      <Ionicons
        name={icon}
        size={isCompact ? 20 : 32}
        color={isDark ? palette.slate[500] : palette.slate[400]}
      />
      {isCompact ? (
        <View className="ms-2 flex-1">
          <Text
            numberOfLines={1}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400"
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            className="text-[10px] text-slate-400 dark:text-slate-500"
          >
            {description}
          </Text>
        </View>
      ) : (
        <>
          <Text className="text-sm font-semibold mt-2 text-slate-500 dark:text-slate-400">
            {title}
          </Text>
          <Text className="text-xs mt-1 text-slate-400 dark:text-slate-500">
            {description}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
