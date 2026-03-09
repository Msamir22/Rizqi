/**
 * Authentication Screen — Unified Sign In / Sign Up
 *
 * Full-screen authentication page shown when user has no valid session.
 * Handles:
 * - Google OAuth sign-in (via SocialLoginButtons)
 * - Email/password sign-up and sign-in (via EmailPasswordForm)
 * - Email verification pending state
 * - Forgot password flow
 *
 * No "Skip" option — authentication is mandatory for this fintech app.
 *
 * Architecture & Design Rationale:
 * - Pattern: Composition — delegates to SocialLoginButtons and EmailPasswordForm
 * - Why: Screen orchestrates auth flows, delegates rendering to subcomponents (SRP)
 * - SOLID: DIP — depends on auth-service abstractions, not Supabase directly
 *
 * @module AuthScreen
 */

import { palette } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { HAS_ONBOARDED_KEY } from "@/constants/storage-keys";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import {
  EmailPasswordForm,
  type AuthMode,
} from "@/components/auth/EmailPasswordForm";
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

interface TrustBadge {
  readonly icon: keyof typeof MaterialCommunityIcons.glyphMap;
  readonly label: string;
}

// =============================================================================
// Constants
// =============================================================================

const TRUST_BADGES: readonly TrustBadge[] = [
  { icon: "lock-outline", label: "Encrypted" },
  { icon: "cloud-check-outline", label: "Backed Up" },
  { icon: "shield-check-outline", label: "Private" },
];

// =============================================================================
// Component
// =============================================================================

export default function AuthScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useTheme();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();

  const [screenState, setScreenState] = useState<ScreenState>("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Guard: If user becomes authenticated, navigate away
  useEffect(() => {
    if (isAuthLoading) return;
    if (isAuthenticated) {
      // Check if user has onboarded
      AsyncStorage.getItem(HAS_ONBOARDED_KEY)
        .then((value) => {
          if (value === "true") {
            router.replace("/(tabs)");
          } else {
            router.replace("/onboarding");
          }
        })
        .catch(() => {
          router.replace("/onboarding");
        });
    }
  }, [isAuthenticated, isAuthLoading, router]);

  // ─── OAuth Handler ──────────────────────────────────────────────────────

  const handleOAuth = useCallback(
    async (provider: OAuthProvider): Promise<void> => {
      setOauthLoading(provider);
      setNetworkError(null);

      try {
        const result = await signInWithOAuth(provider);

        if (!result.success) {
          if (result.errorCode === "cancelled") {
            // User cancelled — silent, no error shown
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

  // ─── Email/Password Handler ─────────────────────────────────────────────

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
          showToast({ type: "success", title: "Account created!" });
        } else {
          const result = await signInWithEmail(email, password);

          if (result.error) {
            setEmailError(result.error.message);
            return;
          }

          showToast({ type: "success", title: "Signed in successfully!" });
        }
      } catch {
        setEmailError("Something went wrong. Please try again.");
      } finally {
        setEmailLoading(false);
      }
    },
    [showToast]
  );

  // ─── Forgot Password Handler ───────────────────────────────────────────

  const handleForgotPassword = useCallback(
    (email: string): void => {
      if (!email) {
        showToast({
          type: "info",
          title: "Enter your email first, then tap Forgot Password.",
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
            title: "Failed to send reset email. Please try again.",
          });
        });
    },
    [showToast]
  );

  // ─── Resend Verification ───────────────────────────────────────────────

  const handleResendVerification = useCallback(async (): Promise<void> => {
    try {
      const result = await resendVerificationEmail(pendingEmail);
      if (result.error) {
        showToast({ type: "error", title: result.error.message });
      } else {
        showToast({ type: "success", title: "Verification email sent!" });
      }
    } catch {
      showToast({
        type: "error",
        title: "Failed to resend verification email. Please try again.",
      });
    }
  }, [pendingEmail, showToast]);

  // ─── Back to Form ─────────────────────────────────────────────────────

  const handleBackToForm = useCallback((): void => {
    setScreenState("form");
    setEmailError(null);
    setNetworkError(null);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <View className="flex-1">
      {/* Background Gradient */}
      <LinearGradient
        colors={
          isDark
            ? [theme.background, palette.nileGreen[900]]
            : [palette.nileGreen[50], "#FFFFFF"]
        }
        style={StyleSheet.absoluteFill}
      />

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

// =============================================================================
// Form View (default state)
// =============================================================================

interface FormViewProps {
  readonly isDark: boolean;
  readonly oauthLoading: OAuthProvider | null;
  readonly emailLoading: boolean;
  readonly emailError: string | null;
  readonly networkError: string | null;
  readonly onOAuth: (provider: OAuthProvider) => Promise<void>;
  readonly onEmailSubmit: (
    email: string,
    password: string,
    mode: AuthMode
  ) => Promise<void>;
  readonly onForgotPassword: (email: string) => void;
  readonly onRetry: () => void;
}

function FormView({
  isDark,
  oauthLoading,
  emailLoading,
  emailError,
  networkError,
  onOAuth,
  onEmailSubmit,
  onForgotPassword,
  onRetry,
}: FormViewProps): React.JSX.Element {
  return (
    <>
      {/* Top Section: Trust messaging */}
      <View className="items-center gap-6 mt-8">
        {/* Shield Icon */}
        <View className="w-20 h-20 rounded-full bg-nileGreen-500/15 items-center justify-center">
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={44}
            color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
          />
        </View>

        {/* Title */}
        <Text className="text-[28px] font-bold text-center text-text-primary dark:text-text-primary-dark">
          Welcome to Astik
        </Text>

        {/* Subtitle */}
        <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark max-w-[320px] leading-6">
          Your financial companion. Sign in or create an account to get started.
        </Text>

        {/* Trust Badges */}
        <View className="flex-row justify-center gap-6 mt-2">
          {TRUST_BADGES.map((badge) => (
            <View key={badge.label} className="items-center gap-2">
              <View className="w-12 h-12 rounded-xl bg-nileGreen-500/10 items-center justify-center">
                <MaterialCommunityIcons
                  name={badge.icon}
                  size={24}
                  color={
                    isDark ? palette.nileGreen[400] : palette.nileGreen[600]
                  }
                />
              </View>
              <Text className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom Section: Auth Controls */}
      <View className="gap-4 mt-8">
        {/* Network Error Banner */}
        {networkError ? (
          <View className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4 flex-row items-center gap-3">
            <Ionicons
              name="cloud-offline-outline"
              size={22}
              color={palette.slate[400]}
            />
            <View className="flex-1">
              <Text className="text-sm text-red-400 font-medium">
                {networkError}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onRetry}
              accessibilityLabel="Retry"
              accessibilityRole="button"
            >
              <Ionicons
                name="refresh-outline"
                size={22}
                color={palette.nileGreen[400]}
              />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Google OAuth */}
        <SocialLoginButtons loadingProvider={oauthLoading} onPress={onOAuth} />

        {/* Email/Password Form */}
        <EmailPasswordForm
          onSubmit={onEmailSubmit}
          onForgotPassword={onForgotPassword}
          isLoading={emailLoading}
          errorMessage={emailError}
        />
      </View>
    </>
  );
}

// =============================================================================
// Verification Pending View
// =============================================================================

interface VerificationPendingViewProps {
  readonly email: string;
  readonly isDark: boolean;
  readonly onResend: () => Promise<void>;
  readonly onBack: () => void;
}

function VerificationPendingView({
  email,
  isDark,
  onResend,
  onBack,
}: VerificationPendingViewProps): React.JSX.Element {
  return (
    <>
      <View className="flex-1 items-center justify-center gap-6 px-4">
        {/* Mail Icon */}
        <View className="w-24 h-24 rounded-full bg-nileGreen-500/15 items-center justify-center">
          <Ionicons
            name="mail-outline"
            size={48}
            color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
          />
        </View>

        <Text className="text-2xl font-bold text-center text-text-primary dark:text-text-primary-dark">
          Check Your Inbox
        </Text>

        <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark max-w-[300px] leading-6">
          We sent a verification email to{" "}
          <Text className="font-semibold text-text-primary dark:text-text-primary-dark">
            {email}
          </Text>
          . Tap the link to verify your account.
        </Text>

        {/* Resend Button */}
        <TouchableOpacity
          onPress={() => {
            onResend().catch(() => {});
          }}
          className="py-3 px-6 rounded-2xl border border-nileGreen-500"
          activeOpacity={0.8}
          accessibilityLabel="Resend verification email"
          accessibilityRole="button"
        >
          <Text className="text-sm font-semibold text-nileGreen-400">
            Resend Email
          </Text>
        </TouchableOpacity>
      </View>

      {/* Back to Sign In */}
      <TouchableOpacity
        onPress={onBack}
        className="py-3 items-center"
        activeOpacity={0.6}
        accessibilityLabel="Back to sign in"
        accessibilityRole="button"
      >
        <View className="flex-row items-center gap-1">
          <Ionicons
            name="arrow-back"
            size={14}
            color={isDark ? palette.slate[400] : palette.slate[500]}
          />
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
            Back to Sign In
          </Text>
        </View>
      </TouchableOpacity>
    </>
  );
}

// =============================================================================
// Reset Sent View
// =============================================================================

interface ResetSentViewProps {
  readonly email: string;
  readonly isDark: boolean;
  readonly onBack: () => void;
}

function ResetSentView({
  email,
  isDark,
  onBack,
}: ResetSentViewProps): React.JSX.Element {
  return (
    <>
      <View className="flex-1 items-center justify-center gap-6 px-4">
        {/* Mail Icon */}
        <View className="w-24 h-24 rounded-full bg-nileGreen-500/15 items-center justify-center">
          <Ionicons
            name="key-outline"
            size={48}
            color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
          />
        </View>

        <Text className="text-2xl font-bold text-center text-text-primary dark:text-text-primary-dark">
          Reset Link Sent
        </Text>

        <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark max-w-[300px] leading-6">
          We sent a password reset link to{" "}
          <Text className="font-semibold text-text-primary dark:text-text-primary-dark">
            {email}
          </Text>
          . Check your inbox and follow the link to reset your password.
        </Text>
      </View>

      {/* Back to Sign In */}
      <TouchableOpacity
        onPress={onBack}
        className="py-3 items-center"
        activeOpacity={0.6}
        accessibilityLabel="Back to sign in"
        accessibilityRole="button"
      >
        <View className="flex-row items-center gap-1">
          <Ionicons
            name="arrow-back"
            size={14}
            color={isDark ? palette.slate[400] : palette.slate[500]}
          />
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
            Back to Sign In
          </Text>
        </View>
      </TouchableOpacity>
    </>
  );
}
