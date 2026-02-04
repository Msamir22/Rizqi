import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "../../context/DrawerContext";
import { useTheme } from "../../context/ThemeContext";
import { DrawerActions, useNavigation } from "@react-navigation/native";

interface ScreenHeaderProps {
  title?: string;
  showBack?: boolean;
}

export function ScreenHeader({ title, showBack = true }: ScreenHeaderProps) {
  const { theme } = useTheme();
  const { toggleDrawer } = useDrawer();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Use navigation state to determine if we can go back
  const canGoBack = navigation.canGoBack();

  return (
    <View
      style={{
        backgroundColor: theme.background,
        paddingTop: insets.top,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.surfaceHighlight,
      }}
      className="flex-row items-center justify-between"
    >
      <View className="flex-row items-center gap-4">
        {/* Menu or Back Button */}
        {showBack && canGoBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={toggleDrawer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu-outline" size={28} color={theme.text.primary} />
          </TouchableOpacity>
        )}

        {/* Title */}
        <Text
          style={{ color: theme.text.primary }}
          className="text-lg font-bold"
        >
          {title}
        </Text>
      </View>

      {/* Right Actions (Optional - can be extended) */}
      <View className="w-8" /> 
    </View>
  );
}
