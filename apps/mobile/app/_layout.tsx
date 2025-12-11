import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DatabaseProvider } from "../providers/DatabaseProvider";
import { colors } from "@astik/ui";

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.primary.main} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.primary.main,
            },
            headerTintColor: colors.text.inverse,
            headerTitleStyle: {
              fontWeight: "bold",
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="voice-input"
            options={{
              presentation: "modal",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="add-transaction"
            options={{
              presentation: "modal",
              title: "Add Transaction",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: "Settings",
              headerShown: false,
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </DatabaseProvider>
  );
}
