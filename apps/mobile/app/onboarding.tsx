/**
 * Onboarding Screen
 *
 * Multi-phase onboarding flow:
 * 1. Language Picker — user selects their language (mandatory)
 * 2. Carousel — feature tour with 3 slides (skippable)
 * 3. CurrencyPickerStep — user selects their currency (mandatory, no skip)
 * 4. WalletCreationStep — creates cash account + confirmation message
 *
 * The initial phase is determined by the user's profile state (resume-aware).
 * Each step persists its output to the profile via profile-service,
 * replacing all AsyncStorage usage.
 *
 * @module OnboardingScreen
 */

import { palette } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { changeLanguage } from "@/i18n/changeLanguage";
import { useProfile } from "@/hooks/useProfile";
import {
  setPreferredLanguage,
  markSlidesViewed,
  setPreferredCurrencyAndCreateCashAccount,
} from "@/services/profile-service";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";
import type { CurrencyType } from "@rizqi/db";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/components/ui/Toast";
import { CurrencyPickerStep } from "@/components/onboarding/CurrencyPickerStep";
import { LanguagePickerStep } from "@/components/onboarding/LanguagePickerStep";
import { WalletCreationStep } from "@/components/onboarding/WalletCreationStep";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingPhase =
  | "language-picker"
  | "carousel"
  | "currency-picker"
  | "wallet-creation";

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

function getOnboardingSlides(t: (key: string) => string): OnboardingSlide[] {
  return [
    {
      id: "1",
      title: t("slide_1_title"),
      description: t("slide_1_description"),
      icon: (color: string) => (
        <FontAwesome5 name="wallet" size={80} color={color} />
      ),
    },
    {
      id: "2",
      title: t("slide_2_title"),
      description: t("slide_2_description"),
      icon: (color: string) => (
        <MaterialCommunityIcons name="gold" size={90} color={color} />
      ),
    },
    {
      id: "3",
      title: t("slide_3_title"),
      description: t("slide_3_description"),
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingScreen(): React.JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t: tOnboarding, i18n } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");
  const carouselRef = useRef<ICarouselInstance>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const slides = useMemo(() => getOnboardingSlides(tOnboarding), [tOnboarding]);

  // Derive initial phase from profile (resume-aware)
  const { profile } = useProfile();

  const getInitialPhase = useCallback((): OnboardingPhase => {
    if (!profile) return "language-picker";
    if (profile.onboardingCompleted) return "wallet-creation"; // safety fallback
    if (!profile.preferredLanguage) return "language-picker";
    if (!profile.slidesViewed) return "carousel";
    // User has language + slides but no cash account → currency step
    // (hasCashAccount is checked by index.tsx; if it routes here with
    //  cash-account-confirmation outcome, the profile has a cash account
    //  but the flag is false. Pre-seed selectedCurrency so wallet-creation
    //  can show the confirmation directly.)
    if (profile.preferredCurrency) {
      setSelectedCurrency(profile.preferredCurrency as CurrencyType);
      if (profile.userId) setUserId(profile.userId);
      return "wallet-creation";
    }
    return "currency-picker";
  }, [profile]);

  const [phase, setPhase] = useState<OnboardingPhase>(getInitialPhase);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);
  const { isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();

  // Re-evaluate phase when profile loads
  useEffect(() => {
    if (profile) {
      setPhase(getInitialPhase());
      if (profile.userId) setUserId(profile.userId);
    }
  }, [profile, getInitialPhase]);

  const navigateAfterOnboarding = useCallback((): void => {
    if (isAuthLoading) return;
    router.replace("/(tabs)");
  }, [router, isAuthLoading]);

  const pendingNavigationRef = useRef(false);

  /** Carousel finish — mark slides viewed, move to currency picker. */
  const handleCarouselFinish = useCallback(async (): Promise<void> => {
    try {
      await markSlidesViewed();
      setPhase("currency-picker");
    } catch {
      router.replace("/(tabs)");
    }
  }, [router]);

  /** Currency selected — persist + create cash account, then show confirmation. */
  const handleCurrencySelected = useCallback(
    async (currency: CurrencyType): Promise<void> => {
      try {
        const { accountId: _accountId } =
          await setPreferredCurrencyAndCreateCashAccount(currency);
        setSelectedCurrency(currency);
        setPhase("wallet-creation");
      } catch {
        showToast({
          type: "error",
          title: tCommon("error"),
          message: tCommon("error_generic"),
        });
      }
    },
    [showToast, tCommon]
  );

  /** Navigate to main app (from wallet creation or error fallback). */
  const handleGoToApp = useCallback((): void => {
    if (isAuthLoading) {
      pendingNavigationRef.current = true;
      return;
    }
    navigateAfterOnboarding();
  }, [navigateAfterOnboarding, isAuthLoading]);

  useEffect(() => {
    if (!isAuthLoading && pendingNavigationRef.current) {
      pendingNavigationRef.current = false;
      navigateAfterOnboarding();
    }
  }, [isAuthLoading, navigateAfterOnboarding]);

  /** Language selected — persist + change i18n, then show carousel. */
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);

  const handleLanguageSelected = useCallback(
    async (language: "en" | "ar"): Promise<void> => {
      if (isChangingLanguage) return;
      setIsChangingLanguage(true);
      try {
        await changeLanguage(language);
        await setPreferredLanguage(language);
        setPhase("carousel");
      } catch {
        showToast({
          type: "error",
          title: tCommon("error"),
          message: tCommon("language_change_failed"),
        });
      } finally {
        setIsChangingLanguage(false);
      }
    },
    [isChangingLanguage, tCommon, showToast]
  );

  const handleNext = useCallback((): void => {
    if (currentIndex === slides.length - 1) {
      void handleCarouselFinish().catch(() => {});
    } else {
      carouselRef.current?.next();
    }
  }, [currentIndex, slides.length, handleCarouselFinish]);

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

  // Redirect fallback if wallet-creation reached without prerequisites
  useEffect(() => {
    if (phase === "wallet-creation" && selectedCurrency && !userId) {
      router.replace("/(tabs)");
    }
  }, [phase, selectedCurrency, userId, router]);

  // -----------------------------------------------------------------------
  // Phase: Language Picker
  // -----------------------------------------------------------------------
  if (phase === "language-picker") {
    return (
      <LanguagePickerStep
        onLanguageSelected={(lang): void => {
          handleLanguageSelected(lang).catch(() => {});
        }}
        isLoading={isChangingLanguage}
        initialLanguage={i18n.language === "ar" ? "ar" : "en"}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Phase: Currency Picker (mandatory — no skip per FR-009)
  // -----------------------------------------------------------------------
  if (phase === "currency-picker") {
    return (
      <CurrencyPickerStep
        onCurrencySelected={(currency): void => {
          handleCurrencySelected(currency).catch(() => {});
        }}
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
      {isDark && (
        <LinearGradient
          colors={theme.backgroundGradient}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Skip Button */}
      <TouchableOpacity
        className="absolute p-2 end-6 z-10"
        onPress={(): void => {
          void handleCarouselFinish().catch(() => {});
        }}
        style={{ top: insets.top + 16 }}
      >
        <Text className="text-text-secondary dark:text-text-secondary-dark text-base">
          {tOnboarding("skip")}
        </Text>
      </TouchableOpacity>

      {/* Carousel */}
      <Carousel
        ref={carouselRef}
        loop={false}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT * 0.75}
        autoPlay={false}
        data={slides}
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
          {slides.map((_, index) => (
            <View
              className={`h-2 rounded ${
                currentIndex === index
                  ? "w-6 bg-nileGreen-500"
                  : "w-2 bg-black/10 dark:bg-white/20"
              }`}
              key={`dot-${slides[index].id}`}
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
            {currentIndex === slides.length - 1
              ? tOnboarding("get_started")
              : tCommon("next")}
          </Text>
          {currentIndex !== slides.length - 1 && (
            <Ionicons
              name="arrow-forward"
              size={20}
              color="white"
              style={{ marginStart: 8 }}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
