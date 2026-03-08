/**
 * Social Login Buttons — Reusable OAuth Button Group
 *
 * Renders platform-appropriate social login buttons:
 * - Google + Facebook on all platforms
 * - Apple additionally on iOS only (App Store requirement)
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component (Constitution IV)
 * - Why: All OAuth orchestration logic has been extracted to
 *   useOAuthLink hook. This component is purely UI.
 * - SOLID: SRP — renders buttons and spinners only.
 *   OCP — adding a new provider = adding one PROVIDER_CONFIGS entry.
 *
 * @module SocialLoginButtons
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

import { useOAuthLink } from "@/hooks/useOAuthLink";
import type { OAuthProvider } from "@/services/supabase";

// =============================================================================
// Types
// =============================================================================

interface SocialLoginButtonsProps {
  /** Called when OAuth completes successfully. */
  readonly onSuccess: () => void;
  /** Called when OAuth fails. Receives a user-friendly error message. */
  readonly onError: (errorMessage: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

interface ProviderConfig {
  readonly provider: OAuthProvider;
  readonly label: string;
  readonly iconName: keyof typeof Ionicons.glyphMap;
  readonly bgClass: string;
  readonly platformFilter?: typeof Platform.OS;
}

const PROVIDER_CONFIGS: readonly ProviderConfig[] = [
  {
    provider: "google",
    label: "Continue with Google",
    iconName: "logo-google",
    bgClass:
      "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600",
  },
  {
    provider: "facebook",
    label: "Continue with Facebook",
    iconName: "logo-facebook",
    bgClass: "bg-[#1877F2]",
  },
  {
    provider: "apple",
    label: "Continue with Apple",
    iconName: "logo-apple",
    bgClass: "bg-black dark:bg-white",
    platformFilter: "ios",
  },
];

/** Platform-filtered provider list (computed once at module level). */
const VISIBLE_PROVIDERS = PROVIDER_CONFIGS.filter(
  (config) => !config.platformFilter || config.platformFilter === Platform.OS
);

// =============================================================================
// Component
// =============================================================================

export function SocialLoginButtons({
  onSuccess,
  onError,
}: SocialLoginButtonsProps): React.JSX.Element {
  const { handleOAuthPress, loadingProvider } = useOAuthLink({
    onSuccess,
    onError,
  });

  return (
    <View className="gap-3 w-full">
      {VISIBLE_PROVIDERS.map((config) => (
        <SocialButton
          key={config.provider}
          config={config}
          isLoading={loadingProvider === config.provider}
          isDisabled={loadingProvider !== null}
          onPress={handleOAuthPress}
        />
      ))}
    </View>
  );
}

// =============================================================================
// Sub-component
// =============================================================================

interface SocialButtonProps {
  readonly config: ProviderConfig;
  readonly isLoading: boolean;
  readonly isDisabled: boolean;
  readonly onPress: (provider: OAuthProvider) => Promise<void>;
}

function SocialButton({
  config,
  isLoading,
  isDisabled,
  onPress,
}: SocialButtonProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const isApple = config.provider === "apple";
  const isFacebook = config.provider === "facebook";

  // Apple button: dark bg + white text in light mode, white bg + black text in dark mode
  const appleTextColor = isDark ? "text-black" : "text-white";
  const appleIconColor = isDark ? "#000000" : "#FFFFFF";

  const textColor = isApple
    ? appleTextColor
    : isFacebook
      ? "text-white"
      : "text-slate-900 dark:text-slate-50";
  const iconColor = isApple
    ? appleIconColor
    : isFacebook
      ? "#FFFFFF"
      : "#4285F4";

  return (
    <TouchableOpacity
      onPress={() => {
        onPress(config.provider).catch(() => {});
      }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center py-4 px-6 rounded-2xl ${config.bgClass} ${isDisabled ? "opacity-60" : ""}`}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <>
          <Ionicons
            name={config.iconName}
            size={22}
            color={iconColor}
            style={{ marginRight: 12 }}
          />
          <Text className={`text-base font-semibold ${textColor}`}>
            {config.label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
