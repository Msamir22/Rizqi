import { CustomBottomTabBar } from "@/components/tab-bar/CustomBottomTabBar";
import { QuickActionFab } from "@/components/fab";
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function TabLayout(): React.ReactElement {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <CustomBottomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
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
