import { darkTheme, lightTheme } from "@/constants/colors";
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
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ServiceUnavailableBanner } from "../components/common/ServiceUnavailableBanner";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import "../global.css";

import { ToastProvider } from "../components/ui/Toast";
import { AuthProvider } from "../context/AuthContext";
import { CategoriesProvider } from "../context/CategoriesContext";
import { ServerStatusProvider } from "../context/ServerStatusContext";
import { DatabaseProvider } from "../providers/DatabaseProvider";
import { QueryProvider } from "../providers/QueryProvider";
import { SyncProvider } from "../providers/SyncProvider";

// Prevent splash screen from auto-hiding until fonts are loaded
SplashScreen.preventAutoHideAsync().catch(console.error);

export default function RootLayout(): React.ReactNode {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(console.error);
    }
  }, [fontsLoaded, fontError]);

  // Don't render until fonts are loaded
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView className="flex-1">
        <QueryProvider>
          <DatabaseProvider>
            <AuthProvider>
              <SyncProvider>
                <CategoriesProvider>
                  <ThemeProvider>
                    <SafeAreaProvider>
                      <ServerStatusProvider>
                        <ToastProvider>
                          <RootLayoutNav />
                          <ServiceUnavailableBanner />
                        </ToastProvider>
                      </ServerStatusProvider>
                    </SafeAreaProvider>
                  </ThemeProvider>
                </CategoriesProvider>
              </SyncProvider>
            </AuthProvider>
          </DatabaseProvider>
        </QueryProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootLayoutNav(): React.ReactNode {
  const { colorScheme, isDark } = useTheme();

  return (
    <>
      <StatusBar
        style={colorScheme}
        backgroundColor={isDark ? lightTheme.background : darkTheme.background}
      />
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: isDark
              ? darkTheme.background
              : lightTheme.background,
          },
        }}
      >
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
