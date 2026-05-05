/**
 * Auth Callback Route
 *
 * Catch-all route for deep link redirects (`monyvi://auth-callback`).
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

import { useAuth } from "@/context/AuthContext";
import { useDeferredRouterReplace } from "@/hooks/useDeferredRouterReplace";
import { type Href, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

/**
 * Detect whether the current deep link is a password-recovery callback.
 *
 * Supabase password reset deep links typically include `type=recovery`
 * in either the URL fragment or the query parameters.
 */
function isPasswordRecoveryLink(
  params: Record<string, string | string[]>
): boolean {
  // Check query params provided by Expo Router
  if (params.type === "recovery" || params.action === "reset") {
    return true;
  }
  return false;
}

export default function AuthCallbackScreen(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useLocalSearchParams();

  let redirectHref: Href | null = null;
  if (!isLoading) {
    if (!isAuthenticated) {
      redirectHref = "/auth";
    } else if (isPasswordRecoveryLink(params)) {
      // TODO: Create dedicated /reset-password route. For now, send to settings
      // where the user can change their password.
      redirectHref = "/settings";
    } else {
      // index.tsx handles the profile-driven routing decision.
      redirectHref = "/";
    }
  }

  useDeferredRouterReplace({
    enabled: redirectHref !== null,
    href: redirectHref ?? "/",
  });

  // Render nothing while redirecting
  return <View />;
}
