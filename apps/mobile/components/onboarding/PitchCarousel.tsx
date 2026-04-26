import React, { useCallback, useRef, useState } from "react";
import { BackHandler, Platform, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useRouter } from "expo-router";
import Carousel, {
  type ICarouselInstance,
} from "react-native-reanimated-carousel";
import { markIntroSeen } from "@/services/intro-flag-service";
import { logger } from "@/utils/logger";
import { PitchSlide } from "./PitchSlide";
import { Slide1Voice } from "./Slide1Voice";
import { Slide2SMS } from "./Slide2SMS";
import { Slide2Offline } from "./Slide2Offline";
import { Slide3LiveMarket } from "./Slide3LiveMarket";

interface SlideDef {
  readonly key: string;
  readonly component: React.ComponentType;
}

const SLIDES: readonly SlideDef[] = [
  { key: "voice", component: Slide1Voice },
  {
    key: Platform.OS === "android" ? "sms" : "offline",
    component: Platform.OS === "android" ? Slide2SMS : Slide2Offline,
  },
  { key: "live_market", component: Slide3LiveMarket },
];

export function PitchCarousel(): React.ReactElement {
  const { t } = useTranslation("onboarding");
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef<ICarouselInstance>(null);
  const totalSlides = SLIDES.length;

  /**
   * Skip / Get-Started handler — used by the top-right Skip on slides 1–2 and
   * by the "Get Started" CTA on the last slide.
   *
   * Navigation MUST always run — even if `markIntroSeen` rejects. The flag is
   * a best-effort AsyncStorage write (the service already logs + swallows
   * internally), and blocking navigation on the write would leave the user
   * stuck on the pitch with a frozen CTA if a transient storage error
   * happened to occur right at this moment.
   */
  const handleComplete = useCallback(async (): Promise<void> => {
    try {
      await markIntroSeen();
    } catch (error: unknown) {
      logger.error("pitch: failed to mark intro seen", error);
    }
    router.push("/auth");
  }, [router]);

  const goToSlide = useCallback((index: number): void => {
    carouselRef.current?.scrollTo({ index, animated: true });
    setCurrentSlide(index);
  }, []);

  /**
   * Per-slide advance handler:
   *  - On slides 1 and 2 → scroll forward to the next slide.
   *  - On the last slide → mark intro seen + navigate to /auth.
   */
  const handleAdvance = useCallback((): void => {
    if (currentSlide < totalSlides - 1) {
      goToSlide(currentSlide + 1);
      return;
    }
    void handleComplete();
  }, [currentSlide, totalSlides, goToSlide, handleComplete]);

  /** Last-slide back-to-previous handler. */
  const handlePrevious = useCallback((): void => {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  }, [currentSlide, goToSlide]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        (): boolean => {
          if (currentSlide === 0) return false;
          goToSlide(currentSlide - 1);
          return true;
        }
      );
      return () => subscription.remove();
    }, [currentSlide, goToSlide])
  );

  return (
    // Root inherits the system color scheme via the `bg-background` token
    // pair so the slides aren't locked to one mode pre-auth.
    <View className="flex-1 bg-background dark:bg-background-dark">
      <Carousel
        ref={carouselRef}
        width={screenWidth}
        height={screenHeight}
        data={[...SLIDES]}
        defaultIndex={0}
        // `react-native-reanimated-carousel` defaults to `loop={true}`,
        // which wraps slide 1 ←→ slide 3 when the user swipes off either
        // end (user-reported 2026-04-26: "sliding left from the first slide
        // to the last one is not allowed"). Pre-auth pitch is a strictly
        // sequential narrative — keep navigation one-way and let the
        // explicit top-left back-arrow on slides 2-3 handle backtracking.
        loop={false}
        onScrollEnd={(index: number): void => setCurrentSlide(index)}
        renderItem={({ item, index }): React.ReactElement => {
          const SlideComponent = item.component;
          return (
            <PitchSlide
              headline={t(`pitch_slide_${item.key}_headline`)}
              subhead={t(`pitch_slide_${item.key}_subhead`)}
              isLast={index === totalSlides - 1}
              hasPrevious={index > 0}
              slideIndex={index}
              totalSlides={totalSlides}
              onSkip={() => {
                void handleComplete();
              }}
              onPrevious={handlePrevious}
              onAdvance={handleAdvance}
            >
              <SlideComponent />
            </PitchSlide>
          );
        }}
      />
      {/* Pagination dots are rendered INSIDE each slide (PitchSlide) as
          part of the layout flow rather than as an absolute overlay here.
          The previous absolute `bottom: 104` calculation was off on devices
          with bottom safe-area insets / Arabic font metrics and the dots
          ended up overlapping the Continue/Get Started button (user-
          reported 2026-04-26). In-flow positioning makes the gap
          deterministic. */}
    </View>
  );
}
