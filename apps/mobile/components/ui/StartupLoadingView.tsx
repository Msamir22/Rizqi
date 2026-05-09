import { MonyviLogo } from "@/components/ui/MonyviLogo";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const INITIAL_TOP_INSET = initialWindowMetrics?.insets.top ?? 0;
const PROGRESS_TRACK_WIDTH = 176;
const PROGRESS_SEGMENT_WIDTH = 56;
const PROGRESS_TRAVEL_DISTANCE = PROGRESS_TRACK_WIDTH - PROGRESS_SEGMENT_WIDTH;

/**
 * Account/startup loading surface shown while auth routing waits for the
 * current user's local profile or initial pull sync.
 */
export function StartupLoadingView(): React.JSX.Element {
  const { t } = useTranslation("common");
  const runtimeInsets = useSafeAreaInsets();
  const topInset = Math.max(INITIAL_TOP_INSET, runtimeInsets.top);
  const isRTL = I18nManager.isRTL;
  const progressStartX = isRTL ? PROGRESS_TRAVEL_DISTANCE : 0;
  const progressDirection = isRTL ? -1 : 1;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      false
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  const progressStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          progressStartX +
          progress.value * progressDirection * PROGRESS_TRAVEL_DISTANCE,
      },
    ],
  }));

  return (
    <View
      testID="account-loading-screen"
      className="flex-1 bg-slate-25 dark:bg-slate-950"
      style={{ paddingTop: topInset }}
    >
      <DarkModeStars />
      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center">
          <MonyviLogo width={128} height={36} />
          <Text className="mt-10 text-center text-xl font-semibold text-slate-900 dark:text-slate-25">
            {t("account_loading_title")}
          </Text>
          <Text className="mt-3 text-center text-sm leading-5 text-text-secondary">
            {t("account_loading_description")}
          </Text>

          <View
            className="mt-8 h-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-800"
            style={{ direction: "ltr", width: PROGRESS_TRACK_WIDTH }}
          >
            <Animated.View
              className="h-1 rounded bg-nileGreen-500"
              style={[{ width: PROGRESS_SEGMENT_WIDTH }, progressStyle]}
            />
          </View>
        </View>
      </View>
      <Text className="mb-10 px-8 text-center text-xs font-medium text-text-muted">
        {t("account_loading_footer")}
      </Text>
    </View>
  );
}

export function getStartupProgressTranslateX(
  progress: number,
  isRTL: boolean
): number {
  const startX = isRTL ? PROGRESS_TRAVEL_DISTANCE : 0;
  const direction = isRTL ? -1 : 1;

  return startX + progress * direction * PROGRESS_TRAVEL_DISTANCE;
}

function DarkModeStars(): React.JSX.Element {
  return (
    <>
      <View className="absolute left-[14%] top-[18%] hidden h-1 w-1 rounded-full bg-nileGreen-400 dark:flex" />
      <View className="absolute right-[18%] top-[22%] hidden h-1.5 w-1.5 rounded-full bg-gold-400 dark:flex" />
      <View className="absolute left-[22%] bottom-[20%] hidden h-1.5 w-1.5 rounded-full bg-nileGreen-500 dark:flex" />
      <View className="absolute right-[12%] bottom-[24%] hidden h-1 w-1 rounded-full bg-slate-500 dark:flex" />
    </>
  );
}
