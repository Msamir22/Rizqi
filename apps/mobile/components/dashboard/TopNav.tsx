import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { AstikLogo } from "../ui/AstikLogo";

// TODO: Replace with user context when available
const USER_NAME = "Mohamed";

interface TopNavProps {
  onMenuPress?: () => void;
}

export function TopNav({ onMenuPress }: TopNavProps): React.ReactElement {
  const { theme } = useTheme();

  const getGreeting = (): string => {
    const hours = new Date().getHours();
    if (hours < 12) return "Good Morning";
    if (hours < 18) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <SafeAreaView edges={["top"]} className="pb-2">
      <View className=" flex-row items-center mb-5 mt-2">
        {/* Hamburger Menu */}
        {onMenuPress && (
          <TouchableOpacity
            onPress={onMenuPress}
            accessibilityLabel="Open menu"
            accessibilityRole="button"
            className="mr-3"
          >
            <Ionicons
              name="menu-outline"
              size={26}
              color={theme.text.primary}
            />
          </TouchableOpacity>
        )}

        {/* Left Side: Logo & Greeting */}
        <View className="flex-row items-center gap-3 flex-1">
          <AstikLogo width={80} height={25} color={theme.text.primary} />

          {/* Vertical Divider */}
          <View className="h-8 w-[1px] opacity-30 bg-slate-400 dark:bg-slate-200" />

          {/* Greeting Text */}
          <View className="flex-1 justify-center">
            <Text
              numberOfLines={1}
              style={{ color: theme.text.secondary }}
              className="font-medium font-regular text-sm tracking-wider"
            >
              {getGreeting()}
            </Text>

            <Text
              numberOfLines={1}
              style={{ color: theme.text.primary }}
              className="font-bold font-regular text-sm mt-0.5"
            >
              {USER_NAME}
            </Text>
          </View>
        </View>

        {/* Right Side: Actions */}
        <View className="flex-row items-center gap-3">
          {/* Settings Button */}
          <TouchableOpacity
            style={{
              backgroundColor: theme.surfaceHighlight,
            }}
            className="w-10 h-10 rounded-full items-center justify-center"
            onPress={() => router.push("/settings")}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={theme.text.secondary}
            />
          </TouchableOpacity>

          {/* Notification Button */}
          <TouchableOpacity
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            style={{ backgroundColor: theme.surfaceHighlight }}
            className="w-10 h-10 rounded-full items-center justify-center relative"
            onPress={() => console.log("Notifications pressed")}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={theme.text.secondary}
            />
            {/* Notification Badge */}
            <View
              style={{
                borderColor: theme.surface,
              }}
              className="absolute top-2 right-2 w-2 h-2 rounded-full border bg-red-500 dark:bg-red-600"
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
