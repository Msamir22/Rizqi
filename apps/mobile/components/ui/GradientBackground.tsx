import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  className?: string;
}

export function GradientBackground({
  children,
  style,
  className,
}: Props): JSX.Element {
  const { theme, isDark } = useTheme();

  if (isDark && theme.backgroundGradient) {
    return (
      <LinearGradient
        colors={theme.backgroundGradient as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={style}
        className={`flex-1 ${className || ""}`}
      >
        <SafeAreaView className="flex-1" edges={["top"]}>
          {children}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <View
      style={[{ backgroundColor: theme.background }, style]}
      className={`flex-1 ${className || ""}`}
    >
      <SafeAreaView className="flex-1" edges={["top"]}>
        {children}
      </SafeAreaView>
    </View>
  );
}
