import { darkTheme, lightTheme } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { QuickActionFab } from "@/components/fab";
import { CustomBottomTabBar } from "@/components/tab-bar/CustomBottomTabBar";

export default function TabLayout(): React.ReactElement {
  const { isDark } = useTheme();

  return (
    <View className="flex-1">
      <Tabs
        tabBar={(props) => <CustomBottomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: isDark
              ? darkTheme.background
              : lightTheme.background,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: "Accounts",
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: "Transactions",
          }}
        />
        <Tabs.Screen
          name="metals"
          options={{
            title: "Metals",
          }}
        />
      </Tabs>

      <QuickActionFab />
    </View>
  );
}
