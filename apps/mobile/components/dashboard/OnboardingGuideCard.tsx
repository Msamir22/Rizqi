/**
 * OnboardingGuideCard
 *
 * Compact, expandable dashboard card showing a 5-step setup checklist
 * for new users. Collapsed by default — shows progress pill + next step.
 * Expands to reveal all steps with completion state.
 *
 * Mockup reference: Stitch project 13253418811527315493, Mockup 4
 *
 * @module OnboardingGuideCard
 */

import { palette } from "@/constants/colors";
import {
  useOnboardingGuide,
  type OnboardingStep,
} from "@/hooks/useOnboardingGuide";
import { logger } from "@/utils/logger";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";

// =============================================================================
// STEP ITEM (EXPANDED VIEW)
// =============================================================================

interface StepItemProps {
  readonly step: OnboardingStep;
  readonly index: number;
  readonly isActive: boolean;
  readonly onPress?: () => void;
}

/**
 * Individual step row in the expanded checklist.
 * Three visual states: completed, active, upcoming.
 */
function StepItemComponent({
  step,
  index,
  isActive,
  onPress,
}: StepItemProps): React.ReactElement {
  const { t } = useTranslation("common");

  // ── Completed step ──
  if (step.isComplete) {
    return (
      <View className="flex-row items-center gap-x-3">
        <View className="w-5 h-5 rounded-full items-center justify-center bg-nileGreen-500">
          <Ionicons name="checkmark" size={12} color={palette.slate[25]} />
        </View>
        <Text className="text-[13px] text-slate-400 line-through">
          {t(step.labelKey)}
        </Text>
      </View>
    );
  }

  // ── Active step (first incomplete) ──
  if (isActive) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-x-3 flex-1">
          <View className="w-5 h-5 rounded-full items-center justify-center border-2 border-nileGreen-500">
            <Text className="text-[10px] font-bold text-nileGreen-500">
              {index + 1}
            </Text>
          </View>
          <Text className="text-[13px] font-semibold text-nileGreen-500">
            {t(step.labelKey)}
          </Text>
        </View>
        <View className="px-3 py-1 rounded-full bg-nileGreen-500">
          <Text className="text-[10px] font-bold uppercase text-slate-25">
            {t("go")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Upcoming step ──
  return (
    <View className="flex-row items-center gap-x-3 opacity-50">
      <View className="w-5 h-5 rounded-full items-center justify-center border border-slate-400">
        <Text className="text-[10px] font-bold text-slate-400">
          {index + 1}
        </Text>
      </View>
      <View className="flex-row items-center gap-x-2">
        <Text className="text-[13px] text-slate-400">{t(step.labelKey)}</Text>
        {step.isNew && (
          <View className="px-2 py-0.5 rounded-full bg-nileGreen-500/20">
            <Text className="text-[10px] font-bold tracking-wider text-nileGreen-500">
              {t("new_badge")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const StepItem = memo(StepItemComponent);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function OnboardingGuideCardComponent(): React.ReactElement | null {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    steps,
    completedCount,
    totalSteps,
    isDismissed,
    isLoading,
    isAllComplete,
    dismiss,
  } = useOnboardingGuide();

  // Find the first incomplete step (active step)
  const activeStepIndex = useMemo(
    () => steps.findIndex((s) => !s.isComplete),
    [steps]
  );

  const activeStep = activeStepIndex >= 0 ? steps[activeStepIndex] : undefined;

  const handleStepPress = useCallback(
    (route?: string): void => {
      if (route) {
        router.push(route as never);
      }
    },
    [router]
  );

  const handleNextStepPress = useCallback((): void => {
    if (activeStep?.route) {
      router.push(activeStep.route as never);
    }
  }, [activeStep, router]);

  const handleDismiss = useCallback((): void => {
    dismiss().catch((error: unknown) => {
      logger.warn("Failed to persist onboarding guide dismissal", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [dismiss]);

  const handleToggleExpand = useCallback((): void => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Don't render if dismissed, all complete, or still loading.
  // NOTE: `useOnboardingGuide` deliberately defaults `isDismissed` to `true`
  // while the profile observation is in flight, so `isLoading` returning
  // null here avoids flashing any content for returning users who have
  // already dismissed the card. Showing a skeleton in this window caused
  // exactly the flash we want to prevent.
  if (isDismissed || isAllComplete || isLoading) {
    return null;
  }

  const progressPercentage =
    totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <View className="rounded-xl my-4 overflow-hidden bg-slate-100 dark:bg-slate-800">
      {/* ── Header Row ── */}
      <TouchableOpacity
        onPress={handleToggleExpand}
        activeOpacity={0.7}
        className="flex-row items-center justify-between px-4 pt-3.5"
      >
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="rocket" size={18} color={palette.nileGreen[500]} />
          <Text className="text-[14px] font-semibold text-slate-800 dark:text-slate-25">
            {t("setup_guide")}
          </Text>
          <View className="px-2 py-0.5 rounded-full bg-nileGreen-100 dark:bg-slate-900">
            <Text className="text-[11px] font-bold text-nileGreen-700 dark:text-nileGreen-500">
              {completedCount}/{totalSteps}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-x-2">
          {/* Dismiss X button (visible in collapsed state) */}
          {!isExpanded && (
            <TouchableOpacity
              onPress={handleDismiss}
              hitSlop={8}
              activeOpacity={0.6}
            >
              <Ionicons name="close" size={16} color={palette.slate[400]} />
            </TouchableOpacity>
          )}
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={palette.slate[400]}
          />
        </View>
      </TouchableOpacity>

      {/* ── Progress Bar ── */}
      <View className="mx-4 mt-3 h-1 rounded-full bg-slate-200 dark:bg-slate-900">
        <View
          className="h-full rounded-full bg-nileGreen-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </View>

      {/* ── Collapsed: Next Step Row ── */}
      {!isExpanded && (
        <TouchableOpacity
          onPress={handleNextStepPress}
          activeOpacity={0.7}
          className="flex-row items-center justify-between px-4 pt-3 pb-3.5"
        >
          <Text className="text-[13px] text-slate-600 dark:text-slate-300">
            <Text className="font-medium">{t("next")}: </Text>
            {activeStep ? t(activeStep.labelKey) : ""}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={palette.nileGreen[500]}
          />
        </TouchableOpacity>
      )}

      {/* ── Expanded: Full Step List ── */}
      {isExpanded && (
        <View className="px-4 pt-4 pb-3.5">
          <View className="gap-3">
            {steps.map((step, index) => (
              <StepItem
                key={step.key}
                step={step}
                index={index}
                isActive={index === activeStepIndex}
                onPress={
                  index === activeStepIndex
                    ? () => handleStepPress(step.route)
                    : undefined
                }
              />
            ))}
          </View>

          {/* Dismiss */}
          <View className="mt-4 flex-row justify-end">
            <TouchableOpacity onPress={handleDismiss} hitSlop={8}>
              <Text className="text-[12px] font-medium text-slate-400 dark:text-slate-500">
                {t("dismiss")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export const OnboardingGuideCard = memo(OnboardingGuideCardComponent);
