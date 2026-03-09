/**
 * Auth Callback Route
 *
 * Catch-all route for deep link redirects (`astik://auth-callback`).
 * Handles:
 * 1. OAuth redirects \u2014 when openAuthSessionAsync doesn't catch the URL
 * 2. Email verification deep links \u2014 confirms email and routes appropriately
 * 3. Password reset deep links \u2014 routes to password update flow
 *
 * On any callback, checks auth state and redirects accordingly:
 * - Recovery deep link + authenticated \u2192 /settings (TODO: add /reset-password route)
 * - Authenticated + onboarded \u2192 /(tabs)
 * - Authenticated + not onboarded \u2192 /onboarding
 * - Not authenticated \u2192 /auth
 *
 * @module AuthCallbackRoute
 */

import { HAS_ONBOARDED_KEY } from "@/constants/storage-keys";
import { useAuth } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

/**
 * Detect whether the current deep link is a password-recovery callback.
 *
 * Supabase password reset deep links typically include `type=recovery`
 * in either the URL fragment or the query parameters.
 */
function isPasswordRecoveryLink(params: Record<string, string | string[]>): boolean {
  // Check query params provided by Expo Router
  if (params.type === "recovery" || params.action === "reset") {
    return true;
  }
  return false;
}

export default function AuthCallbackScreen(): React.JSX.Element {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const params = useLocalSearchParams<Record<string, string>>();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Email verification completed but no session yet \u2014 go to auth
      router.replace("/auth");
      return;
    }

    // Check for password-recovery deep link before normal routing
    if (isPasswordRecoveryLink(params)) {
      // TODO: Create dedicated /reset-password route. For now, send to settings
      // where the user can change their password.
      router.replace("/settings" as never);
      return;
    }

    // Authenticated \u2014 check onboarding status and redirect
    AsyncStorage.getItem(HAS_ONBOARDED_KEY)
      .then((value) => {
        if (value === "true") {
          router.replace("/(tabs)");
        } else {
          router.replace("/onboarding");
        }
      })
      .catch(() => {
        router.replace("/(tabs)");
      });
  }, [router, isAuthenticated, isLoading, params]);

  // Render nothing while redirecting
  return <View />;
}
