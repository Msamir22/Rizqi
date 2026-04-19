/**
 * Onboarding Screen
 *
 * Multi-phase onboarding flow:
 * 1. Language Picker — user selects their language (mandatory)
 * 2. Carousel — feature tour with 3 slides (skippable: viewing or skipping both advance)
 * 3. CurrencyPickerStep — user selects their currency (mandatory, no skip per FR-009)
 * 4. WalletCreationStep — creates cash account + confirmation message
 *
 * The initial phase is read from the per-user AsyncStorage cursor
 * (`onboarding:<userId>:step`) via the onboarding-cursor-service. On every
 * forward transition we persist the next-unfinished step so a subsequent app
 * launch (same user, same device) resumes where they left off. On completion
 * `completeOnboarding()` flips `profiles.onboarding_completed` first, then
 * clears the AsyncStorage cursor as a best-effort cleanup — the two stores
 * are independent, so the operation is NOT atomic. A stale cursor after a
 * successful DB flag flip is harmless because the router gate reads the DB
 * flag only.
 *
 * See spec FR-004, FR-008, FR-011, data-model.md § 3.
 *
 * @module OnboardingScreen
 */

import { palette } from "@/constants/colors";
import { useToast } from "@/components/ui/Toast";
import { CurrencyPickerStep } from "@/components/onboarding/CurrencyPickerStep";
import { LanguagePickerStep } from "@/components/onboarding/LanguagePickerStep";
import { WalletCreationStep } from "@/components/onboarding/WalletCreationStep";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import {
  readOnboardingStep,
  writeOnboardingStep,
  type OnboardingStep,
} from "@/services/onboarding-cursor-service";
import {
  completeOnboarding,
  setPreferredCurrencyAndCreateCashAccount,
  setPreferredLanguage,
} from "@/services/profile-service";
import { logger } from "@/utils/logger";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import type { CurrencyType, PreferredLanguageCode } from "@rizqi/db";
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
import { useTranslation } from "react-i18next";

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

/** Map the persisted cursor value to an `OnboardingPhase`. */
function cursorToPhase(cursor: OnboardingStep | null): OnboardingPhase {
  switch (cursor) {
    case "slides":
      return "carousel";
    case "currency":
      return "currency-picker";
    case "cash-account":
      return "wallet-creation";
    case "language":
    case null:
    default:
      return "language-picker";
  }
}

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

  // Profile is loaded by the parent gate (index.tsx) before we route here,
  // so `profile` becomes non-null quickly after mount.
  const { profile } = useProfile();
  const userId = profile?.userId ?? null;

  // Phase resolution happens asynchronously (we have to read AsyncStorage).
  // Start as null → render nothing → resolve → render the target phase.
  const [phase, setPhase] = useState<OnboardingPhase | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType | null>(
    null
  );

  const { isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();

  // ---------------------------------------------------------------------
  // Phase resolution from the AsyncStorage cursor
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const resolvePhase = async (): Promise<void> => {
      if (!userId) return;
      try {
        const cursor = await readOnboardingStep(userId);
        if (cancelled) return;
        setPhase(cursorToPhase(cursor));
      } catch (error) {
        logger.warn(
          "onboarding.resumePhase.failed",
          error instanceof Error ? { message: error.message } : { error }
        );
        // Fallback: start from the beginning rather than hanging on null.
        setPhase("language-picker");
      }
    };
    void resolvePhase();
    return (): void => {
      cancelled = true;
    };
  }, [userId]);

  // Seed selectedCurrency for the wallet-creation resume path.
  useEffect(() => {
    // Resume at the wallet-creation confirmation only makes sense if we
    // already know which currency was picked. The profile's
    // preferredCurrency was written atomically alongside account creation
    // in setPreferredCurrencyAndCreateCashAccount. Thanks to migration
    // 042 the column is the `currency_type` Postgres enum, so the field
    // is already narrowed to `CurrencyType` on the client — no runtime
    // guard required.
    if (phase === "wallet-creation" && profile?.preferredCurrency) {
      setSelectedCurrency(profile.preferredCurrency);
    }
  }, [phase, profile?.preferredCurrency]);

  // ---------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------
  const pendingNavigationRef = useRef(false);

  const navigateAfterOnboarding = useCallback((): void => {
    if (isAuthLoading) return;
    router.replace("/(tabs)");
  }, [router, isAuthLoading]);

  useEffect(() => {
    if (!isAuthLoading && pendingNavigationRef.current) {
      pendingNavigationRef.current = false;
      navigateAfterOnboarding();
    }
  }, [isAuthLoading, navigateAfterOnboarding]);

  // ---------------------------------------------------------------------
  // Transition handlers
  // ---------------------------------------------------------------------

  const [isChangingLanguage, setIsChangingLanguage] = useState(false);

  /** Language picked — persist + apply + advance cursor to "slides". */
  const handleLanguageSelected = useCallback(
    async (language: PreferredLanguageCode): Promise<void> => {
      if (!userId) return;
      if (isChangingLanguage) return;
      setIsChangingLanguage(true);
      try {
        // profile-service.setPreferredLanguage writes the DB column AND
        // applies the language to the in-memory i18n state (Principle IV).
        // The screen no longer calls changeLanguage directly.
        await setPreferredLanguage(language);
        // Cursor write is best-effort — per data-model.md § 3, an
        // AsyncStorage failure here is acceptable (next launch resumes
        // from the language step, which is idempotent). Don't let it
        // block the phase transition.
        writeOnboardingStep(userId, "slides").catch((err: unknown) => {
          logger.warn(
            "onboarding.language.cursorWrite.failed",
            err instanceof Error ? { message: err.message } : { error: err }
          );
        });
        setPhase("carousel");
      } catch (error) {
        logger.warn(
          "onboarding.language.failed",
          error instanceof Error ? { message: error.message } : { error }
        );
        showToast({
          type: "error",
          title: tCommon("error"),
          message: tCommon("language_change_failed"),
        });
      } finally {
        setIsChangingLanguage(false);
      }
    },
    [userId, isChangingLanguage, tCommon, showToast]
  );

  /** Carousel finished or skipped — advance cursor to "currency". */
  const handleCarouselFinish = useCallback((): void => {
    if (!userId) return;
    // Cursor write is best-effort — per data-model.md § 3, an AsyncStorage
    // failure here is acceptable (next launch resumes at an earlier but
    // idempotent step). Don't let it block the phase transition.
    writeOnboardingStep(userId, "currency").catch((err: unknown) => {
      logger.warn(
        "onboarding.carousel.cursorWrite.failed",
        err instanceof Error ? { message: err.message } : { error: err }
      );
    });
    setPhase("currency-picker");
  }, [userId]);

  /** Currency picked — persist currency + create cash account, advance cursor. */
  const handleCurrencySelected = useCallback(
    async (currency: CurrencyType): Promise<void> => {
      if (!userId) return;
      try {
        await setPreferredCurrencyAndCreateCashAccount(currency);
        // Cursor write is best-effort — per data-model.md § 3, an
        // AsyncStorage failure here is acceptable (next launch resumes
        // at the currency step, which is idempotent). Don't let it
        // block the phase transition.
        writeOnboardingStep(userId, "cash-account").catch((err: unknown) => {
          logger.warn(
            "onboarding.currency.cursorWrite.failed",
            err instanceof Error ? { message: err.message } : { error: err }
          );
        });
        setSelectedCurrency(currency);
        setPhase("wallet-creation");
      } catch (error) {
        logger.warn(
          "onboarding.currency.failed",
          error instanceof Error ? { message: error.message } : { error }
        );
        showToast({
          type: "error",
          title: tCommon("error"),
          message: tCommon("error_generic"),
        });
      }
    },
    [userId, showToast, tCommon]
  );

  /** Cash-account confirmation dismissed — flip flag, clear cursor, navigate. */
  const handleOnboardingComplete = useCallback(async (): Promise<void> => {
    try {
      await completeOnboarding();
    } catch (error) {
      // The DB flag write failed — do NOT navigate. If we navigated anyway,
      // the user would land on /(tabs) while the routing gate thinks
      // onboarding is still incomplete; on the next launch they'd be
      // bounced back to onboarding with no explanation. Surface a toast
      // and keep them on the wallet-creation screen where tapping
      // "Let's Go!" again will retry. (CodeRabbit review Finding, round 3.)
      logger.warn(
        "onboarding.complete.failed",
        error instanceof Error ? { message: error.message } : { error }
      );
      showToast({
        type: "error",
        title: tCommon("error"),
        message: tCommon("error_generic"),
      });
      return;
    }

    // DB write succeeded — navigate now (or after auth settles).
    if (isAuthLoading) {
      pendingNavigationRef.current = true;
      return;
    }
    navigateAfterOnboarding();
  }, [isAuthLoading, navigateAfterOnboarding, showToast, tCommon]);

  // ---------------------------------------------------------------------
  // Carousel helpers
  // ---------------------------------------------------------------------
  const handleNext = useCallback((): void => {
    if (currentIndex === slides.length - 1) {
      handleCarouselFinish();
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

  // ---------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------

  // Wait for userId + phase resolution before rendering any step.
  if (!userId || phase === null) return null;

  // -----------------------------------------------------------------------
  // Phase: Language Picker
  // -----------------------------------------------------------------------
  if (phase === "language-picker") {
    return (
      <LanguagePickerStep
        onLanguageSelected={(lang): void => {
          void handleLanguageSelected(lang);
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
          void handleCurrencySelected(currency);
        }}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Phase: Wallet Creation / Cash-account confirmation
  // -----------------------------------------------------------------------
  if (phase === "wallet-creation" && selectedCurrency) {
    return (
      <WalletCreationStep
        userId={userId}
        currency={selectedCurrency}
        onComplete={(): void => {
          void handleOnboardingComplete();
        }}
        onError={(): void => {
          // Cash-account creation failed — keep the user on the wallet step
          // so they can retry instead of bouncing them to the dashboard
          // while onboarding_completed is still false (which would bypass
          // the routing gate in app/index.tsx).
          showToast({
            type: "error",
            title: tCommon("error"),
            message: tCommon("error_generic"),
          });
        }}
      />
    );
  }

  // If we reached wallet-creation but selectedCurrency is still null (edge
  // case: resume cursor said "cash-account" but profile.preferredCurrency
  // hasn't loaded yet), render nothing and wait for the effect above.
  if (phase === "wallet-creation") return null;

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
        onPress={handleCarouselFinish}
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
        onSnapToItem={(index): void => setCurrentIndex(index)}
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
