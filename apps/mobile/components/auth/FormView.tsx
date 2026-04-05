/**
 * FormView — Default Auth Screen Form
 *
 * Renders the trust messaging header and authentication controls
 * (social login + email/password form) on the auth screen.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: Extracted from auth.tsx to enforce SRP — auth.tsx orchestrates
 *   screen state, this component handles the form layout and trust UI.
 *
 * @module FormView
 */

import { palette } from "@/constants/colors";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  EmailPasswordForm,
  type AuthMode,
} from "@/components/auth/EmailPasswordForm";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import type { OAuthProvider } from "@/services/supabase";

// =============================================================================
// Types
// =============================================================================

interface TrustBadge {
  readonly icon: keyof typeof MaterialCommunityIcons.glyphMap;
  readonly translationKey: string;
}

export interface FormViewProps {
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
  readonly onClearError: () => void;
  readonly onRetry: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const TRUST_BADGES: readonly TrustBadge[] = [
  { icon: "lock-outline", translationKey: "trust_encrypted" },
  { icon: "cloud-check-outline", translationKey: "trust_backed_up" },
  { icon: "shield-check-outline", translationKey: "trust_private" },
];

// =============================================================================
// Component
// =============================================================================

export function FormView({
  isDark,
  oauthLoading,
  emailLoading,
  emailError,
  networkError,
  onOAuth,
  onEmailSubmit,
  onForgotPassword,
  onClearError,
  onRetry,
}: FormViewProps): React.JSX.Element {
  const { t } = useTranslation("auth");
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
          {t("welcome_title")}
        </Text>

        {/* Subtitle */}
        <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark max-w-[320px] leading-6">
          {t("welcome_subtitle")}
        </Text>

        {/* Trust Badges */}
        <View className="flex-row justify-center gap-6 mt-2">
          {TRUST_BADGES.map((badge) => (
            <View key={badge.translationKey} className="items-center gap-2">
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
                {t(badge.translationKey)}
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
          onClearError={onClearError}
        />
      </View>
    </>
  );
}
