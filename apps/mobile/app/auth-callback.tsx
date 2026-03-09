/**
 * Auth Callback Route
 *
 * Catch-all route for deep link redirects (`astik://auth-callback`).
 * Handles:
 * 1. OAuth redirects — when openAuthSessionAsync doesn't catch the URL
 * 2. Email verification deep links — confirms email and routes appropriately
 * 3. Password reset deep links — routes to password update flow
 *
 * On any callback, checks auth state and redirects accordingly:
 * - Authenticated + onboarded → /(tabs)
 * - Authenticated + not onboarded → /onboarding
 * - Not authenticated → /auth
 *
 * @module AuthCallbackRoute
 */

import { HAS_ONBOARDED_KEY } from "@/constants/storage-keys";
import { useAuth } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function AuthCallbackScreen(): React.JSX.Element {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Email verification completed but no session yet — go to auth
      router.replace("/auth");
      return;
    }

    // Authenticated — check onboarding status and redirect
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
  }, [router, isAuthenticated, isLoading]);

  // Render nothing while redirecting
  return <View />;
}
