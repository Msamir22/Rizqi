/**
 * Authentication Screen \u2014 Unified Sign In / Sign Up
 *
 * Full-screen authentication page shown when user has no valid session.
 * Handles:
 * - Google OAuth sign-in (via SocialLoginButtons)
 * - Email/password sign-up and sign-in (via EmailPasswordForm)
 * - Email verification pending state
 * - Forgot password flow
 *
 * No "Skip" option \u2014 authentication is mandatory for this fintech app.
 *
 * Architecture & Design Rationale:
 * - Pattern: Composition \u2014 delegates to SocialLoginButtons and EmailPasswordForm
 * - Why: Screen orchestrates auth flows, delegates rendering to subcomponents (SRP)
 * - SOLID: DIP \u2014 depends on auth-service abstractions, not Supabase directly
 *
 * @module AuthScreen
 */

import { palette } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { useRootNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormView } from "@/components/auth/FormView";
import { VerificationPendingView } from "@/components/auth/VerificationPendingView";
import { ResetSentView } from "@/components/auth/ResetSentView";
import { type AuthMode } from "@/components/auth/EmailPasswordForm";
import { useToast } from "@/components/ui/Toast";
import {
  signInWithOAuth,
  signUpWithEmail,
  signInWithEmail,
  requestPasswordReset,
} from "@/services/auth-service";
import {
  resendVerificationEmail,
  type OAuthProvider,
} from "@/services/supabase";

// =============================================================================
// Types
// =============================================================================

type ScreenState = "form" | "verificationPending" | "resetSent";

// =============================================================================
// Component
// =============================================================================

export default function AuthScreen(): React.JSX.Element {
  const router = useRouter();
  const rootNavigation = useRootNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation("auth");
  const { t: tCommon } = useTranslation("common");

  const [screenState, setScreenState] = useState<ScreenState>("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Guard: If user becomes authenticated, navigate to the routing gate
  useEffect(() => {
    if (isAuthLoading || !rootNavigation?.isReady()) return;
    if (isAuthenticated) {
      // index.tsx handles the profile-driven routing decision
      router.replace("/");
    }
  }, [isAuthenticated, isAuthLoading, rootNavigation, router]);

  // \u2500\u2500\u2500 OAuth Handler \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const handleOAuth = useCallback(
    async (provider: OAuthProvider): Promise<void> => {
      setOauthLoading(provider);
      setNetworkError(null);

      try {
        const result = await signInWithOAuth(provider);

        if (!result.success) {
          if (result.errorCode === "cancelled") {
            // User cancelled \u2014 silent, no error shown
          } else if (result.errorCode === "network") {
            setNetworkError(result.error);
          } else {
            showToast({ type: "error", title: result.error });
          }
        }
      } finally {
        setOauthLoading(null);
      }
    },
    [showToast]
  );

  // \u2500\u2500\u2500 Email/Password Handler \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const handleEmailSubmit = useCallback(
    async (email: string, password: string, mode: AuthMode): Promise<void> => {
      setEmailLoading(true);
      setEmailError(null);
      setNetworkError(null);

      try {
        if (mode === "signUp") {
          const result = await signUpWithEmail(email, password);

          if (result.error) {
            setEmailError(result.error.message);
            return;
          }

          if (result.needsVerification) {
            setPendingEmail(email);
            setScreenState("verificationPending");
            return;
          }

          // Rare: email already verified (shouldn't happen normally)
          showToast({ type: "success", title: t("account_created") });
        } else {
          const result = await signInWithEmail(email, password);

          if (result.error) {
            setEmailError(result.error.message);
            return;
          }

          showToast({ type: "success", title: t("signed_in_success") });
        }
      } catch {
        setEmailError(tCommon("error_generic"));
      } finally {
        setEmailLoading(false);
      }
    },
    [showToast, t, tCommon]
  );

  // \u2500\u2500\u2500 Forgot Password Handler \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const handleForgotPassword = useCallback(
    (email: string): void => {
      if (!email) {
        showToast({
          type: "info",
          title: t("forgot_password_hint"),
        });
        return;
      }

      requestPasswordReset(email)
        .then((result) => {
          if (result.error) {
            showToast({ type: "error", title: result.error.message });
            return;
          }
          setPendingEmail(email);
          setScreenState("resetSent");
        })
        .catch(() => {
          showToast({
            type: "error",
            title: t("reset_email_failed"),
          });
        });
    },
    [showToast, t]
  );

  // \u2500\u2500\u2500 Resend Verification \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const handleResendVerification = useCallback(async (): Promise<void> => {
    try {
      const result = await resendVerificationEmail(pendingEmail);
      if (result.error) {
        showToast({ type: "error", title: result.error.message });
      } else {
        showToast({ type: "success", title: t("verification_email_sent") });
      }
    } catch {
      showToast({
        type: "error",
        title: t("resend_verification_failed"),
      });
    }
  }, [pendingEmail, showToast, t]);

  // \u2500\u2500\u2500 Back to Form \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const handleBackToForm = useCallback((): void => {
    setScreenState("form");
    setEmailError(null);
    setNetworkError(null);
  }, []);

  // \u2500\u2500\u2500 Render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  return (
    // Background uses the same `bg-background dark:bg-background-dark`
    // tokens used by every other authenticated screen (dashboard,
    // add-account, edit-account, etc). Pre-2026-04-26 the auth screen
    // rendered a custom green-tinted LinearGradient in dark mode which
    // looked off compared to the rest of the app — user direction:
    // standardize to the solid app-wide dark background. The light-mode
    // gradient is kept since it was working there, but moved to a
    // tokenized class so the auth screen also follows the system theme
    // when users have a system-level dark/light preference.
    <View className="flex-1 bg-background dark:bg-background-dark">
      {!isDark && (
        <LinearGradient
          // Use the project's `slate[25]` token instead of a raw hex
          // literal — keeps the gradient's "near-white" terminus tied
          // to the same single source of truth used by every other
          // light-mode background in the app.
          colors={[palette.nileGreen[50], palette.slate[25]]}
          style={StyleSheet.absoluteFill}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          // eslint-disable-next-line react-native/no-inline-styles
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "space-between",
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {screenState === "form" ? (
            <FormView
              isDark={isDark}
              oauthLoading={oauthLoading}
              emailLoading={emailLoading}
              emailError={emailError}
              networkError={networkError}
              onOAuth={handleOAuth}
              onEmailSubmit={handleEmailSubmit}
              onForgotPassword={handleForgotPassword}
              onClearError={() => setEmailError(null)}
              onRetry={() => setNetworkError(null)}
            />
          ) : screenState === "verificationPending" ? (
            <VerificationPendingView
              email={pendingEmail}
              isDark={isDark}
              onResend={handleResendVerification}
              onBack={handleBackToForm}
            />
          ) : (
            <ResetSentView
              email={pendingEmail}
              isDark={isDark}
              onBack={handleBackToForm}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
