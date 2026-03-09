/**
 * Onboarding Screen
 *
 * Multi-phase onboarding flow:
 * 1. Carousel — feature tour with 3 slides
 * 2. CurrencyPickerStep — user selects their currency (skippable)
 * 3. WalletCreationStep — creates cash account (only if currency was selected)
 *
 * Architecture & Design Rationale:
 * - Pattern: State Machine (phase-based routing)
 * - Why: Each phase is an independent screen with clear transitions
 * - SOLID: SRP — each phase component handles its own concerns
 *
 * @module OnboardingScreen
 */

import { palette } from "@/constants/colors";
import { HAS_ONBOARDED_KEY } from "@/constants/storage-keys";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { getCurrentUserId } from "@/services/supabase";
import type { CurrencyType } from "@astik/db";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CurrencyPickerStep } from "@/components/onboarding/CurrencyPickerStep";
import { WalletCreationStep } from "@/components/onboarding/WalletCreationStep";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Determines which screen to render during onboarding. */
type OnboardingPhase = "carousel" | "currency-picker" | "wallet-creation";

interface OnboardingSlide {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: (color: string) => React.JSX.Element;
  readonly isSpecial?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = Dimensions.get("window");

const ONBOARDING_DATA: OnboardingSlide[] = [
  {
    id: "1",
    title: "Track Your Net Worth",
    description:
      "Consolidate all your assets—cash, bank accounts, and investments—in one secure dashboard.",
    icon: (color: string) => (
      <FontAwesome5 name="wallet" size={80} color={color} />
    ),
  },
  {
    id: "2",
    title: "Gold & Silver Analytics",
    description:
      "Monitor real-time prices of precious metals and track the value of your physical holdings.",
    icon: (color: string) => (
      <MaterialCommunityIcons name="gold" size={90} color={color} />
    ),
  },
  {
    id: "3",
    title: "Voice-Powered Tracking",
    description:
      "Simply speak to add transactions. AI automatically categorizes and updates your accounts.",
    icon: (color: string) => (
      <View
        className="w-[120px] h-[120px] rounded-full elevation-[10] items-center justify-center shadow-[0_10px_20px]"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.5,
        }}
      >
        <FontAwesome5 name="microphone" size={50} color="white" />
      </View>
    ),
    isSpecial: true,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingScreen(): React.JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const carouselRef = useRef<ICarouselInstance>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Phase state machine
  const [phase, setPhase] = useState<OnboardingPhase>("carousel");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);
  const { isLoading: isAuthLoading } = useAuth();

  /**
   * Navigate to the main app after onboarding.
   * Since unauthenticated users cannot reach onboarding (index.tsx redirects
   * them to /auth), this always goes to /(tabs).
   */
  const navigateAfterOnboarding = useCallback((): void => {
    if (isAuthLoading) return;
    router.replace("/(tabs)");
  }, [router, isAuthLoading]);

  /**
   * When auth finishes loading after onboarding phases that deferred
   * navigation due to isAuthLoading, trigger the deferred navigation.
   */
  const pendingNavigationRef = useRef(false);

  /**
   * Called when the carousel finishes (user taps "Get Started" or "Skip").
   * Always transitions to the currency picker.
   */
  const handleCarouselFinish = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(HAS_ONBOARDED_KEY, "true");

      // Resolve user ID for potential wallet creation
      const uid = await getCurrentUserId();
      if (!uid) {
        // TODO: Replace with structured logging (e.g., Sentry)
        router.replace("/(tabs)");
        return;
      }
      setUserId(uid);

      // Always show currency picker — user makes the choice
      setPhase("currency-picker");
    } catch {
      // TODO: Replace with structured logging (e.g., Sentry)
      router.replace("/(tabs)");
    }
  }, [router]);

  /** Called when user selects a currency and taps "Continue". */
  const handleCurrencySelected = useCallback((currency: CurrencyType): void => {
    setSelectedCurrency(currency);
    setPhase("wallet-creation");
  }, []);

  /** Called when user skips the currency picker — no wallet created. */
  const handleCurrencyPickerSkip = useCallback((): void => {
    if (isAuthLoading) {
      pendingNavigationRef.current = true;
      return;
    }
    navigateAfterOnboarding();
  }, [navigateAfterOnboarding, isAuthLoading]);

  /** Navigate to main app or sign-up (used by both success and error paths). */
  const handleGoToApp = useCallback((): void => {
    if (isAuthLoading) {
      pendingNavigationRef.current = true;
      return;
    }
    navigateAfterOnboarding();
  }, [navigateAfterOnboarding, isAuthLoading]);

  // When auth finishes loading, fire any pending navigation
  useEffect(() => {
    if (!isAuthLoading && pendingNavigationRef.current) {
      pendingNavigationRef.current = false;
      navigateAfterOnboarding();
    }
  }, [isAuthLoading, navigateAfterOnboarding]);

  const handleNext = useCallback((): void => {
    if (currentIndex === ONBOARDING_DATA.length - 1) {
      handleCarouselFinish().catch(console.error);
    } else {
      carouselRef.current?.next();
    }
  }, [currentIndex, handleCarouselFinish]);

  const renderCarouselItem = useCallback(
    ({ item }: { item: OnboardingSlide; index: number }): React.JSX.Element => {
      const iconColor = item.isSpecial
        ? palette.nileGreen[500]
        : isDark
          ? palette.nileGreen[500]
          : palette.nileGreen[600];

      return (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-12 h-[150px] justify-center">
            {item.icon(iconColor)}
          </View>

          <View className="items-center gap-4">
            <Text className="font-bold text-[28px] mb-2 text-center text-text-primary dark:text-text-primary-dark">
              {item.title}
            </Text>
            <Text className="text-center text-text-secondary dark:text-text-secondary-dark text-base max-w-[85%]">
              {item.description}
            </Text>
          </View>
        </View>
      );
    },
    [isDark]
  );

  // Redirect to app if wallet-creation phase reached without userId.
  // Navigation must happen in an effect, not during render.
  useEffect(() => {
    if (phase === "wallet-creation" && selectedCurrency && !userId) {
      // TODO: Replace with structured logging (e.g., Sentry)
      router.replace("/(tabs)");
    }
  }, [phase, selectedCurrency, userId, router]);

  // -----------------------------------------------------------------------
  // Phase: Currency Picker
  // -----------------------------------------------------------------------
  if (phase === "currency-picker") {
    return (
      <CurrencyPickerStep
        onCurrencySelected={handleCurrencySelected}
        onSkip={handleCurrencyPickerSkip}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Phase: Wallet Creation
  // -----------------------------------------------------------------------
  if (phase === "wallet-creation" && selectedCurrency) {
    if (!userId) return null;

    return (
      <WalletCreationStep
        userId={userId}
        currency={selectedCurrency}
        onComplete={handleGoToApp}
        onError={handleGoToApp}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Phase: Carousel (default)
  // -----------------------------------------------------------------------

  return (
    <View className="flex-1">
      {/* Background Gradient for Dark Mode */}
      {isDark && (
        <LinearGradient
          colors={theme.backgroundGradient}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Skip Button */}
      <TouchableOpacity
        className="absolute p-2 right-6 z-10"
        onPress={() => {
          handleCarouselFinish().catch(console.error);
        }}
        style={{ top: insets.top + 16 }}
      >
        <Text className="text-text-secondary dark:text-text-secondary-dark text-base">
          Skip
        </Text>
      </TouchableOpacity>

      {/* Carousel */}
      <Carousel
        ref={carouselRef}
        loop={false}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT * 0.75}
        autoPlay={false}
        data={ONBOARDING_DATA}
        scrollAnimationDuration={500}
        onSnapToItem={(index) => setCurrentIndex(index)}
        renderItem={renderCarouselItem}
        style={{ marginTop: insets.top + 40 }}
      />

      {/* Bottom Section */}
      <View
        className="flex-1 items-center justify-end gap-8 px-8"
        style={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Pagination Dots */}
        <View className="flex-row gap-2">
          {ONBOARDING_DATA.map((_, index) => (
            <View
              className={`h-2 rounded ${
                currentIndex === index
                  ? "w-6 bg-nileGreen-500"
                  : "w-2 bg-black/10 dark:bg-white/20"
              }`}
              key={`dot-${ONBOARDING_DATA[index].id}`}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          className="rounded-2xl py-[18px] bg-nileGreen-500 w-full flex-row items-center justify-center"
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
            {currentIndex === ONBOARDING_DATA.length - 1
              ? "Get Started"
              : "Next"}
          </Text>
          {currentIndex !== ONBOARDING_DATA.length - 1 && (
            <Ionicons
              name="arrow-forward"
              size={20}
              color="white"
              style={{ marginLeft: 8 }}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
