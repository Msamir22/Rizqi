import { darkTheme, lightTheme } from "@/constants/colors";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  NotoSansArabic_400Regular,
  NotoSansArabic_500Medium,
  NotoSansArabic_600SemiBold,
  NotoSansArabic_700Bold,
} from "@expo-google-fonts/noto-sans-arabic";
import { useFonts } from "expo-font";
import { I18nextProvider } from "react-i18next";
import { router, Stack, useRootNavigation, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { LocaleProvider } from "../context/LocaleContext";
import i18n, { initI18n } from "../i18n";

import "../global.css";

import { ToastProvider } from "../components/ui/Toast";
import { InitialSyncOverlay } from "../components/ui/InitialSyncOverlay";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { CategoriesProvider } from "../context/CategoriesContext";

import { SmsScanProvider } from "../context/SmsScanContext";
import { DatabaseProvider } from "../providers/DatabaseProvider";
import { QueryProvider } from "../providers/QueryProvider";
import { MarketRatesRealtimeProvider } from "../providers/MarketRatesRealtimeProvider";
import { SyncProvider } from "../providers/SyncProvider";
import { initializeNotifications } from "../services/notification-service";
import {
  handleDetectedSms,
  initializeDetectionActionHandler,
  isLiveDetectionEnabled,
} from "../services/sms-live-detection-handler";
import {
  onTransactionDetected,
  startSmsListener,
  stopSmsListener,
} from "../services/sms-live-listener-service";

// Prevent splash screen from auto-hiding until fonts are loaded
// TODO: Replace with structured logging (e.g., Sentry)
SplashScreen.preventAutoHideAsync().catch(console.error);

export default function RootLayout(): React.ReactNode {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    NotoSansArabic_400Regular,
    NotoSansArabic_500Medium,
    NotoSansArabic_600SemiBold,
    NotoSansArabic_700Bold,
  });

  const [i18nInitialized, setI18nInitialized] = useState(false);

  // Initialize i18n on mount
  useEffect(() => {
    initI18n()
      .then(() => setI18nInitialized(true))
      .catch((error) => {
        // TODO: Replace with structured logging (e.g., Sentry)
        console.error("Failed to initialize i18n:", error);
        setI18nInitialized(true); // Continue even if i18n fails
      });
  }, []);

  // Hide splash screen once fonts and i18n are loaded
  useEffect(() => {
    if ((fontsLoaded || fontError) && i18nInitialized) {
      // TODO: Replace with structured logging (e.g., Sentry)
      SplashScreen.hideAsync().catch(console.error);
    }
  }, [fontsLoaded, fontError, i18nInitialized]);

  // Initialize notifications and live detection lifecycle
  const cleanupRef = useRef<(() => void) | null>(null);

  const startDetectionIfEnabled = useCallback(async (): Promise<void> => {
    if (Platform.OS !== "android") {
      return;
    }
    const enabled = await isLiveDetectionEnabled();
    if (enabled) {
      startSmsListener();
    }
  }, []);

  useEffect(() => {
    // Initialize notifications channel and action handler
    // TODO: Replace with structured logging (e.g., Sentry)
    initializeNotifications().catch(console.error);
    const cleanupActions = initializeDetectionActionHandler();

    // Subscribe to detected transactions from Tier 1 listener
    const cleanupDetection = onTransactionDetected((parsed) => {
      // TODO: Replace with structured logging (e.g., Sentry)
      handleDetectedSms(parsed).catch(console.error);
    });

    // Start listener if preference enabled
    // TODO: Replace with structured logging (e.g., Sentry)
    startDetectionIfEnabled().catch(console.error);

    // Listen for app state changes to restart listener
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          // TODO: Replace with structured logging (e.g., Sentry)
          startDetectionIfEnabled().catch(console.error);
        }
      }
    );

    cleanupRef.current = () => {
      cleanupActions();
      cleanupDetection();
      stopSmsListener();
      appStateSubscription.remove();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, [startDetectionIfEnabled]);

  // Don't render until fonts and i18n are loaded
  if ((!fontsLoaded && !fontError) || !i18nInitialized) {
    return null;
  }

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <GestureHandlerRootView
          className="flex-1"
          accessibilityLanguage={i18n.language === "ar" ? "ar" : "en"}
        >
          <QueryProvider>
            <DatabaseProvider>
              <AuthProvider>
                <SyncProvider>
                  <MarketRatesRealtimeProvider>
                    <CategoriesProvider>
                      <SmsScanProvider>
                        <LocaleProvider>
                          <ThemeProvider>
                            <SafeAreaProvider>
                              <ToastProvider>
                                <AuthGuard>
                                  <RootLayoutNav />
                                  <InitialSyncOverlay />
                                </AuthGuard>
                              </ToastProvider>
                            </SafeAreaProvider>
                          </ThemeProvider>
                        </LocaleProvider>
                      </SmsScanProvider>
                    </CategoriesProvider>
                  </MarketRatesRealtimeProvider>
                </SyncProvider>
              </AuthProvider>
            </DatabaseProvider>
          </QueryProvider>
        </GestureHandlerRootView>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

/**
 * Auth Guard — blocks access to all app routes when not authenticated.
 * Uses useEffect + router.replace for reliable redirection even when
 * the navigation stack already has active screens.
 *
 * Public routes that don't require authentication:
 * - "auth" — the main authentication screen
 * - "auth-callback" — deep link handler for OAuth/email verification redirects
 */
const PUBLIC_ROUTES = new Set(["auth", "auth-callback"]);

function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const rootNavigation = useRootNavigation();
  const isPublicRoute = PUBLIC_ROUTES.has(segments[0] ?? "");

  useEffect(() => {
    // Wait until auth is resolved AND the navigator is mounted
    if (isLoading || !rootNavigation?.isReady()) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/auth");
    }
  }, [isAuthenticated, isLoading, isPublicRoute, rootNavigation]);

  if (isLoading) {
    return null;
  }

  // Always render children so the Stack navigator stays mounted.
  // The useEffect above handles the redirect once navigation is ready.
  return <>{children}</>;
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
          headerShown: false,
          contentStyle: {
            backgroundColor: isDark
              ? darkTheme.background
              : lightTheme.background,
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-account"
          options={{
            presentation: "modal",
          }}
        />
        <Stack.Screen name="voice-review" />
        <Stack.Screen
          name="add-transaction"
          options={{
            title: "Add Transaction",
          }}
        />
        <Stack.Screen
          name="edit-transaction"
          options={{
            title: "Edit Transaction",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Settings",
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
          }}
        />
        <Stack.Screen name="create-budget" />
        <Stack.Screen name="budget-detail" />
        <Stack.Screen name="sms-scan" />
        <Stack.Screen name="sms-review" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth-callback" />
      </Stack>
    </>
  );
}
