/**
 * OnboardingGuideCard
 *
 * Dashboard card showing a 5-step setup checklist for new users.
 * Each step reactively tracks completion via WatermelonDB observers.
 * Displays progress bar, step states (completed/active/upcoming),
 * and a dismiss action.
 *
 * Mockup reference: Stitch project 13253418811527315493
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
import React, { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";

// =============================================================================
// STEP ITEM SUB-COMPONENTS
// =============================================================================

interface StepItemProps {
  readonly step: OnboardingStep;
  readonly index: number;
  readonly isActive: boolean;
  readonly onPress?: () => void;
}

/**
 * Individual step row in the onboarding checklist.
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
      <View className="flex-row items-center gap-x-3 opacity-85">
        <View className="w-6 h-6 rounded-full items-center justify-center bg-nileGreen-500/20">
          <Ionicons name="checkmark" size={14} color={palette.nileGreen[500]} />
        </View>
        <Text className="text-sm text-slate-400 line-through">
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
        className="flex-row items-center justify-between p-3 -mx-1 rounded-lg border"
        style={{
          backgroundColor: `${palette.nileGreen[500]}1A`,
          borderColor: `${palette.nileGreen[500]}33`,
        }}
      >
        <View className="flex-row items-center gap-x-3 flex-1">
          <View className="w-6 h-6 rounded-full items-center justify-center border-2 border-nileGreen-500">
            <Text className="text-[11px] font-bold text-nileGreen-500">
              {index + 1}
            </Text>
          </View>
          <Text className="text-sm font-semibold text-nileGreen-500">
            {t(step.labelKey)}
          </Text>
        </View>
        <View className="px-3.5 py-1.5 rounded-full bg-nileGreen-500">
          <Text className="text-xs font-bold text-nileGreen-900">
            {t("add")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Upcoming step ──
  return (
    <View className="flex-row items-center gap-x-3 opacity-85">
      <View className="w-6 h-6 rounded-full items-center justify-center border border-slate-300 dark:border-slate-600">
        <Text className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {index + 1}
        </Text>
      </View>
      <View className="flex-row items-center gap-x-2">
        <Text className="text-sm text-slate-500 dark:text-slate-400">
          {t(step.labelKey)}
        </Text>
        {step.isNew ? (
          <View className="px-2 py-0.5 rounded-[10px] bg-nileGreen-500/20">
            <Text className="text-[10px] font-bold tracking-wider text-nileGreen-500">
              {t("new_badge")}
            </Text>
          </View>
        ) : null}
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

  const handleStepPress = useCallback(
    (route?: string): void => {
      if (route) {
        router.push(route as never);
      }
    },
    [router]
  );

  const handleDismiss = useCallback((): void => {
    dismiss().catch((error: unknown) => {
      logger.warn("Failed to persist onboarding guide dismissal", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [dismiss]);

  // Don't render if dismissed, all complete, or still loading
  if (isDismissed || isAllComplete || isLoading) {
    return null;
  }

  const progressPercentage =
    totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <View className="rounded-xl p-5 mt-4 border border-slate-300/25 overflow-hidden bg-slate-100 dark:bg-slate-800">
      {/* Header */}
      <View className="flex-row justify-between items-start mb-4">
        <View>
          <View className="flex-row items-center gap-x-2 mb-1">
            <Ionicons name="rocket" size={20} color={palette.nileGreen[500]} />
            <Text className="text-lg font-semibold text-text-primary">
              {t("setup_guide")}
            </Text>
          </View>
          <Text className="text-sm font-medium text-text-secondary">
            {t("setup_guide_progress", {
              completed: completedCount,
              total: totalSteps,
            })}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View className="h-1.5 rounded-full w-full mb-6 bg-slate-200 dark:bg-slate-900">
        <View
          className="h-full rounded-full bg-nileGreen-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </View>

      {/* Steps Checklist */}
      <View className="gap-4">
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
      <View className="mt-6 flex-row justify-end">
        <TouchableOpacity onPress={handleDismiss} hitSlop={8}>
          <Text className="text-sm font-medium py-2 px-3 text-text-secondary">
            {t("dismiss")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const OnboardingGuideCard = memo(OnboardingGuideCardComponent);
