import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import { LanguageSwitcherPill } from "./LanguageSwitcherPill";

interface PitchSlideProps {
  readonly eyebrow: string;
  readonly headline: string;
  readonly subhead: string;
  /** True only on the last slide — switches Skip → hidden, CTA → "Get Started" with chevrons. */
  readonly isLast: boolean;
  /** True on every slide except the first — enables the "back-to-previous-slide" affordance on the last slide. */
  readonly hasPrevious: boolean;
  readonly onSkip: () => void;
  readonly onPrevious: () => void;
  readonly onAdvance: () => void;
  readonly children: React.ReactNode;
}

/**
 * Per mockups (`01-slide-voice.png`, `02a-slide-sms-android.png`,
 * `02b-slide-offline-ios.png`, `03-slide-live-market.png`):
 *
 * - Top bar: language switcher (start) + Skip (end on slides 1–2 only).
 * - Eyebrow / Headline / Subhead block.
 * - Mock-content card (children).
 * - Bottom CTA — "Continue" on slides 1–2, "Get Started" on the last slide
 *   with a chevron-right icon inside and a circular chevron-left back button
 *   to its left (only on the last slide).
 *
 * The bottom CTA renders on EVERY slide, not just the last one. The previous
 * implementation only rendered the CTA when `isLast === true`, leaving slides
 * 1 and 2 with no advance affordance.
 */
export function PitchSlide({
  eyebrow,
  headline,
  subhead,
  isLast,
  hasPrevious,
  onSkip,
  onPrevious,
  onAdvance,
  children,
}: PitchSlideProps): React.ReactElement {
  const { t } = useTranslation("onboarding");

  return (
    <View className="flex-1 px-6 pt-14">
      {/* Top bar */}
      <View className="flex-row items-center justify-between">
        <LanguageSwitcherPill />
        {!isLast && (
          <Pressable onPress={onSkip} hitSlop={12}>
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pitch_skip")}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Eyebrow */}
      <Text className="mt-8 text-xs font-semibold uppercase tracking-widest text-nileGreen-600 dark:text-nileGreen-400">
        {eyebrow}
      </Text>

      {/* Headline */}
      <Text className="mt-3 text-3xl font-bold leading-tight text-slate-900 dark:text-white">
        {headline}
      </Text>

      {/* Subhead */}
      <Text className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
        {subhead}
      </Text>

      {/* Mock-content card slot */}
      <View className="mt-8 flex-1 items-center justify-center">
        {children}
      </View>

      {/* Bottom CTA row — reserves the same vertical space on every slide
          so the pagination dots above stay vertically stable across swipes. */}
      <View className="mb-8 flex-row items-center" style={{ gap: 12 }}>
        {/* Back-to-previous-slide button — last slide only, per mockup 03 */}
        {isLast && hasPrevious && (
          <Pressable
            onPress={onPrevious}
            accessibilityRole="button"
            accessibilityLabel={t("pitch_back")}
            hitSlop={8}
            className="h-12 w-12 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 dark:bg-slate-800 dark:active:bg-slate-700"
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={palette.slate[600]}
            />
          </Pressable>
        )}

        {/* Primary advance CTA */}
        <Pressable
          onPress={onAdvance}
          accessibilityRole="button"
          accessibilityLabel={
            isLast ? t("pitch_get_started") : t("pitch_continue")
          }
          className="flex-1 flex-row items-center justify-center rounded-2xl bg-nileGreen-500 py-4 active:bg-nileGreen-600 dark:bg-nileGreen-600"
          style={{ gap: 8 }}
        >
          <Text className="text-base font-semibold text-white">
            {isLast ? t("pitch_get_started") : t("pitch_continue")}
          </Text>
          {isLast && (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={palette.slate[25]}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}
