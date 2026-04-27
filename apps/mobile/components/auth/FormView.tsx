/**
 * FormView -- Default Auth Screen Form
 *
 * Renders the welcome messaging, value-prop pill grid, and authentication
 * controls (social login + email/password form) on the auth screen.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: Extracted from auth.tsx to enforce SRP -- auth.tsx orchestrates
 *   screen state, this component handles the form layout and trust UI.
 *
 * @module FormView
 */

import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import { LanguageSwitcherPill } from "@/components/onboarding/LanguageSwitcherPill";
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

/**
 * Discriminated union over the icon-set field.
 *
 * The earlier design used a single `interface` with a flat
 * `icon: "microphone" | ... | "diamond-stone"` plus an `iconSet`
 * discriminator and `as keyof typeof <set>.glyphMap` casts in
 * `PillIcon`. That type didn't actually verify each name belonged in
 * its assigned library — which is exactly the failure mode that bit
 * the `trending-up` glyph (FontAwesome5 Pro-only on the free font →
 * runtime "not a valid icon name" warning, user-reported 2026-04-26).
 *
 * As a discriminated union the compiler narrows `pill.icon` by
 * `iconSet` branch, so the same regression is impossible at the type
 * level and the `as keyof typeof ... .glyphMap` casts can go away.
 *
 * Note: project style normally prefers `interface` over `type`, but
 * discriminated unions are the idiomatic shape here and the win in
 * type-safety justifies the exception.
 */
type ValuePill =
  | {
      readonly translationKey: string;
      readonly iconSet: "FontAwesome5";
      readonly icon: keyof typeof FontAwesome5.glyphMap;
    }
  | {
      readonly translationKey: string;
      readonly iconSet: "MaterialCommunityIcons";
      readonly icon: keyof typeof MaterialCommunityIcons.glyphMap;
    };

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

const VALUE_PILLS: readonly ValuePill[] = [
  { translationKey: "pill_voice", icon: "microphone", iconSet: "FontAwesome5" },
  {
    translationKey: "pill_bank_sms",
    icon: "message-text",
    iconSet: "MaterialCommunityIcons",
  },
  {
    translationKey: "pill_live_rates",
    icon: "trending-up",
    iconSet: "MaterialCommunityIcons",
  },
  {
    translationKey: "pill_gold_silver",
    icon: "diamond-stone",
    iconSet: "MaterialCommunityIcons",
  },
];

// =============================================================================
// Sub-components
// =============================================================================

interface PillIconProps {
  readonly pill: ValuePill;
  readonly size: number;
  readonly color: string;
}

function PillIcon({ pill, size, color }: PillIconProps): React.JSX.Element {
  // The discriminated union narrows `pill.icon` to the correct glyph
  // map per branch, so we no longer need the `as keyof typeof
  // ...glyphMap` casts the previous design required.
  if (pill.iconSet === "FontAwesome5") {
    return <FontAwesome5 name={pill.icon} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={pill.icon} size={size} color={color} />;
}

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

  const pillIconColor = isDark
    ? palette.nileGreen[400]
    : palette.nileGreen[600];
  const trustIconColor = isDark ? palette.slate[400] : palette.slate[500];

  return (
    <>
      {/* Language Switcher — top-start corner per mockup
          `specs/026-onboarding-restructure/mockups/04-auth-light.png`.
          `self-start` aligns to the leading edge (left in LTR / right in
          RTL); the previous `self-end` was a regression that placed it on
          the trailing edge. */}
      <View className="self-start mb-4">
        <LanguageSwitcherPill />
      </View>

      {/* Welcome Section */}
      <View className="items-center gap-2 mb-6">
        <Text className="text-[28px] font-bold text-center text-text-primary dark:text-text-primary-dark">
          {t("welcome_title")}
        </Text>
        <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark max-w-[320px] leading-6">
          {t("welcome_tagline")}
        </Text>
      </View>

      {/* 2×2 Value-Prop Pill Grid (per mockup 04-auth-light.png).
          Explicit two-row layout with `flex-1` per pill so the grid is always
          2-up regardless of phone width. The previous `flex-wrap` approach
          allowed 3 of the 4 pills to fit on a single row at common widths
          (~360-400dp), producing a 3+1 layout that did not match the mockup. */}
      <View className="gap-2.5 mb-8">
        {[0, 2].map((rowStart) => (
          <View key={rowStart} className="flex-row" style={{ gap: 10 }}>
            {VALUE_PILLS.slice(rowStart, rowStart + 2).map((pill) => (
              <View
                key={pill.translationKey}
                className="flex-1 flex-row items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-3.5 py-2"
                style={{ gap: 6 }}
              >
                <PillIcon pill={pill} size={14} color={pillIconColor} />
                <Text className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
                  {t(pill.translationKey)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Auth Controls */}
      <View className="gap-4">
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
              accessibilityLabel={t("retry")}
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

        {/* Email/Password Form (includes its own "or" divider) */}
        <EmailPasswordForm
          onSubmit={onEmailSubmit}
          onForgotPassword={onForgotPassword}
          isLoading={emailLoading}
          errorMessage={emailError}
          onClearError={onClearError}
        />
      </View>

      {/* Trust Microbar Footer */}
      <View className="flex-row justify-center items-center gap-5 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <MaterialCommunityIcons
            name="lock-outline"
            size={14}
            color={trustIconColor}
          />
          <Text className="text-xs text-text-muted dark:text-text-muted-dark">
            {t("trust_encrypted")}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={14}
            color={trustIconColor}
          />
          <Text className="text-xs text-text-muted dark:text-text-muted-dark">
            {t("trust_private")}
          </Text>
        </View>
      </View>
    </>
  );
}
