/**
 * Sign-Up Screen
 *
 * Full-screen sign-up page shown after onboarding or navigated from Settings.
 * Encourages anonymous users to secure their data by linking an OAuth identity.
 *
 * Architecture & Design Rationale:
 * - Pattern: Composition — delegates OAuth to SocialLoginButtons & auth-service
 * - Why: Screen only handles layout, navigation, and toast feedback (SRP)
 * - SOLID: DIP — depends on abstractions (onSuccess/onError callbacks)
 *
 * @module SignUpScreen
 */

import { palette } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SocialLoginButtons } from "@/components/sign-up/SocialLoginButtons";
import { useToast } from "@/components/ui/Toast";

// =============================================================================
// Types
// =============================================================================

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

export default function SignUpScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useTheme();
  const { isAnonymous, isLoading } = useAuth();
  const { showToast } = useToast();
  const { source } = useLocalSearchParams<{ source?: string }>();

  const isFromOnboarding = source === "onboarding";

  // Guard: If user is no longer anonymous (e.g. after successful OAuth link),
  // redirect away from the sign-up screen. Wait for auth to hydrate first
  // to avoid premature navigation on cold start.
  useEffect(() => {
    if (isLoading) return;
    if (!isAnonymous) {
      if (isFromOnboarding) {
        router.replace("/(tabs)");
      } else {
        // Source-based return: go back to where the user came from (e.g., Settings)
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)");
        }
      }
    }
  }, [isAnonymous, isLoading, router, isFromOnboarding]);

  const handleOAuthSuccess = useCallback((): void => {
    showToast({ type: "success", title: "Account secured ✓" });
  }, [showToast]);

  const handleOAuthError = useCallback(
    (errorMessage: string): void => {
      showToast({ type: "error", title: errorMessage });
    },
    [showToast]
  );

  const handleSkip = useCallback((): void => {
    if (isFromOnboarding) {
      router.replace("/(tabs)");
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [router, isFromOnboarding]);

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

      <View
        className="flex-1 px-6 justify-between"
        style={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
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
            Secure Your Financial Data
          </Text>

          {/* Subtitle */}
          <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark max-w-[320px] leading-6">
            Your data is only stored on this device. Sign up to back it up
            securely and access it from anywhere.
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

        {/* Bottom Section: Social buttons + Skip */}
        <View className="gap-4">
          <SocialLoginButtons
            onSuccess={handleOAuthSuccess}
            onError={handleOAuthError}
          />

          {/* Skip / Later button */}
          <TouchableOpacity
            onPress={handleSkip}
            className="py-3 items-center"
            activeOpacity={0.6}
          >
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                {isFromOnboarding ? "I'll do it later" : "Not now"}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={14}
                color={theme.text.secondary}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
