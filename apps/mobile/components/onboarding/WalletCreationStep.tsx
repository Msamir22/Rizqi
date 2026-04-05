/**
 * WalletCreationStep Component
 *
 * Final onboarding step that shows wallet creation progress and success.
 * Calls ensureCashAccount with the selected currency and displays
 * loading → success → error states with animated transitions.
 *
 * Architecture & Design Rationale:
 * - Pattern: Container Component (manages async side effect)
 * - Why: Encapsulates the wallet creation call + state machine
 * - SOLID: SRP — only handles the wallet creation step UI
 *
 * Mockup reference:
 * - Dark: wallet_created_dark_mode_1772405063538.png
 * - Light: wallet_created_light_mode_1772405071248.png
 *
 * @module WalletCreationStep
 */

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { ensureCashAccount } from "@/services/account-service";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import type { CurrencyType } from "@astik/db";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WalletCreationStepProps {
  /** The authenticated user's ID. */
  readonly userId: string;
  /** The currency to create the wallet in. */
  readonly currency: CurrencyType;
  /** Called when wallet creation succeeds and user taps "Let's Go!" */
  readonly onComplete: () => void;
  /** Called when wallet creation fails and user taps "Let's Go!" */
  readonly onError: () => void;
}

type WalletCreationPhase = "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOADING_MESSAGE =
  "Getting your wallet ready…\nEven pharaohs kept track of their gold!";
const SUCCESS_TITLE = "✨ Wallet Created — You're All Set!";
const ERROR_TITLE = "Couldn't create your wallet";
const ERROR_SUBTITLE =
  "Don't worry — we'll set it up automatically next time you open the app.";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WalletCreationStep({
  userId,
  currency,
  onComplete,
  onError,
}: WalletCreationStepProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [phase, setPhase] = useState<WalletCreationPhase>("loading");

  const { setPreferredCurrency } = usePreferredCurrency();

  useEffect(() => {
    let isMounted = true;

    const createWallet = async (): Promise<void> => {
      const result = await ensureCashAccount(userId, currency);

      if (!isMounted) return;

      if (result.error) {
        setPhase("error");
      } else {
        // Persist the selected currency as the user's preferred currency.
        // Non-critical — wallet was created, so we still show success.
        try {
          await setPreferredCurrency(currency);
        } catch (e) {
          console.error("Failed to set preferred currency:", e);
        }
        if (!isMounted) return;
        setPhase("success");
      }
    };

    createWallet().catch(console.error);

    return (): void => {
      isMounted = false;
    };
    // setPreferredCurrency is not wrapped in useCallback (returns a new ref
    // each render). Including it would re-trigger wallet creation on every
    // render. Safe to omit — the function identity doesn't affect behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currency]);

  const handleContinue = useCallback((): void => {
    if (phase === "error") {
      onError();
    } else {
      onComplete();
    }
  }, [phase, onComplete, onError]);

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {/* Background Gradient for Dark Mode */}
      {isDark && (
        <LinearGradient
          colors={theme.backgroundGradient}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Content */}
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ paddingTop: insets.top }}
      >
        {/* Loading State */}
        {phase === "loading" && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="items-center"
          >
            {/* Wallet icon */}
            <View
              className="w-24 h-24 rounded-2xl items-center justify-center mb-8"
              style={{ backgroundColor: palette.nileGreen[500] }}
            >
              <MaterialCommunityIcons name="wallet" size={48} color="white" />
            </View>

            <ActivityIndicator
              size="large"
              color={palette.nileGreen[500]}
              className="mb-6"
            />

            <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark leading-6">
              {LOADING_MESSAGE}
            </Text>
          </Animated.View>
        )}

        {/* Success State */}
        {phase === "success" && (
          <Animated.View
            entering={ZoomIn.duration(400).springify()}
            className="items-center"
          >
            {/* Wallet icon with checkmark badge */}
            <View className="mb-8">
              <View
                className="w-24 h-24 rounded-2xl items-center justify-center"
                style={{ backgroundColor: palette.nileGreen[500] }}
              >
                <MaterialCommunityIcons name="wallet" size={48} color="white" />
              </View>
              {/* Checkmark badge */}
              <View
                className="absolute -bottom-2 -end-2 w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: palette.nileGreen[500] }}
              >
                <Ionicons name="checkmark" size={20} color="white" />
              </View>
            </View>

            <Text className="text-2xl font-bold text-center text-text-primary dark:text-text-primary-dark mb-3">
              {SUCCESS_TITLE}
            </Text>

            <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark">
              Your Cash wallet has been created in {currency}.
            </Text>

            <Text
              className="text-sm text-center mt-2 italic"
              style={{ color: palette.nileGreen[400] }}
            >
              You&apos;re ready to start tracking like royalty 👑
            </Text>
          </Animated.View>
        )}

        {/* Error State */}
        {phase === "error" && (
          <Animated.View
            entering={FadeIn.duration(300)}
            className="items-center"
          >
            {/* Error icon */}
            <View className="w-24 h-24 rounded-2xl items-center justify-center mb-8 bg-red-500/10 dark:bg-red-500/[0.15]">
              <Ionicons
                name="alert-circle"
                size={48}
                color={palette.red[400]}
              />
            </View>

            <Text className="text-2xl font-bold text-center text-text-primary dark:text-text-primary-dark mb-3">
              {ERROR_TITLE}
            </Text>

            <Text className="text-base text-center text-text-secondary dark:text-text-secondary-dark">
              {ERROR_SUBTITLE}
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Action button — only shown after loading completes */}
      {phase !== "loading" && (
        <Animated.View
          entering={FadeIn.duration(300).delay(200)}
          className="px-6"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <TouchableOpacity
            onPress={handleContinue}
            className="rounded-2xl py-[18px] bg-nileGreen-500 items-center justify-center"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              elevation: 4,
              shadowColor: palette.nileGreen[500],
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-lg">
              Let&apos;s Go!
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}
