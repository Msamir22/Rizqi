/**
 * Sign-Up Banner — Settings Integration
 *
 * Prominent emerald gradient banner shown at the top of Settings for
 * anonymous users. Navigates to the sign-up screen on tap.
 *
 * Architecture & Design Rationale:
 * - Pattern: Composition — self-contained presentational component
 * - Why: The banner is purely UI; navigation is triggered via callback (SRP)
 * - SOLID: OCP — can be reused in other screens without modification
 *
 * @module SignUpBanner
 */

import { palette } from "@/constants/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

// =============================================================================
// Types
// =============================================================================

interface SignUpBannerProps {
  /** Called when the user taps the "Sign Up" button. */
  readonly onPress: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function SignUpBanner({
  onPress,
}: SignUpBannerProps): React.JSX.Element {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="mb-6">
      <LinearGradient
        colors={[palette.nileGreen[700], palette.nileGreen[600]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-2xl p-5 flex-row items-center"
      >
        {/* Shield Icon */}
        <View className="w-12 h-12 rounded-xl bg-white/15 items-center justify-center mr-4">
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={28}
            color={palette.white}
          />
        </View>

        {/* Text Content */}
        <View className="flex-1">
          <Text className="text-white text-base font-bold mb-0.5">
            Secure Your Account
          </Text>
          <Text className="text-white/80 text-xs leading-4">
            Sign up to back up your data and access it from anywhere.
          </Text>
        </View>

        {/* Arrow */}
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color="rgba(255,255,255,0.7)"
        />
      </LinearGradient>
    </TouchableOpacity>
  );
}
