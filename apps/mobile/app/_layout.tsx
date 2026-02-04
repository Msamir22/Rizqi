import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import "../global.css";
import { DatabaseProvider } from "../providers/DatabaseProvider";

import { darkTheme, lightTheme } from "@/constants/colors";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ToastProvider } from "../components/ui/Toast";
import { QueryProvider } from "../providers/QueryProvider";
import { SyncProvider } from "../providers/SyncProvider";
import { ServerStatusProvider } from "../context/ServerStatusContext";
import { ServiceUnavailableBanner } from "../components/common/ServiceUnavailableBanner";
import { DrawerProvider } from "../context/DrawerContext";
import { useEffect } from "react";

// Prevent splash screen from auto-hiding until fonts are loaded
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Don't render until fonts are loaded
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryProvider>
          <DatabaseProvider>
            <AuthProvider>
              <SyncProvider>
                <ThemeProvider>
                  <SafeAreaProvider>
                    <DrawerProvider>
                      <ServerStatusProvider>
                        <ToastProvider>
                          <RootLayoutNav />
                          <ServiceUnavailableBanner />
                        </ToastProvider>
                      </ServerStatusProvider>
                    </DrawerProvider>
                  </SafeAreaProvider>
                </ThemeProvider>
              </SyncProvider>
            </AuthProvider>
          </DatabaseProvider>
        </QueryProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  const { colorScheme, isDark } = useTheme();

  return (
    <>
      <StatusBar
        style={colorScheme}
        backgroundColor={isDark ? lightTheme.background : darkTheme.background}
      />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-account"
          options={{
            headerShown: false,
            presentation: "modal",
          }}
        />
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
        <Stack.Screen
          name="recurring-payments"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="create-recurring-payment"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
