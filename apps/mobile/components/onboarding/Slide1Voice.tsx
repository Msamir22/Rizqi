import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import { PitchMockCard } from "./PitchMockCard";

/**
 * Mock card for the Voice pitch slide.
 *
 * Mirrors `specs/026-onboarding-restructure/mockups/01-slide-voice.png`:
 *  - Centered mic icon in a green-tinted circle.
 *  - "Listening…" label below the icon.
 *  - Italic transcript bubble.
 *  - Amount row with the parsed total + category chip.
 *  - Account row.
 *  - Footer: "Saved automatically" with a green check + "Just now" timestamp.
 *
 * Numeric values ("200 EGP") are baked into the mock illustration and not
 * translated — see `// i18n-ignore` comments at the call sites.
 */
export function Slide1Voice(): React.ReactElement {
  const { t } = useTranslation("onboarding");

  return (
    <PitchMockCard>
      {/* Mic icon header */}
      <View className="items-center">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-nileGreen-500/15">
          <FontAwesome5
            name="microphone"
            size={20}
            color={palette.nileGreen[600]}
          />
        </View>
        <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {t("pitch_slide_voice_listening")}
        </Text>
      </View>

      {/* Transcript bubble */}
      <Text className="mt-4 text-center text-sm italic leading-relaxed text-slate-600 dark:text-slate-300">
        &ldquo;{t("pitch_slide_voice_transcript")}&rdquo;
      </Text>

      {/* Amount + category chip */}
      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-slate-900 dark:text-white">
          {/* i18n-ignore: numeric mock value baked into the marketing illustration */}
          200{" "}
          <Text className="text-base font-normal text-slate-500 dark:text-slate-400">
            {/* i18n-ignore: ISO currency code, not translatable */}
            EGP
          </Text>
        </Text>
        <View className="rounded-full bg-orange-100 px-3 py-1 dark:bg-orange-900/30">
          <Text className="text-xs font-medium text-orange-700 dark:text-orange-300">
            {t("pitch_slide_voice_category_food")}
          </Text>
        </View>
      </View>

      {/* Account row */}
      <View className="mt-3 flex-row items-center" style={{ gap: 6 }}>
        <MaterialCommunityIcons
          name="bank-outline"
          size={14}
          color={palette.slate[400]}
        />
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          {t("pitch_slide_voice_account")}
        </Text>
      </View>

      {/* Footer status */}
      <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={palette.nileGreen[500]}
          />
          <Text className="text-xs font-medium text-nileGreen-700 dark:text-nileGreen-300">
            {t("pitch_slide_voice_status_saved")}
          </Text>
        </View>
        <Text className="text-xs text-slate-400">
          {t("pitch_slide_voice_status_just_now")}
        </Text>
      </View>
    </PitchMockCard>
  );
}
