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
import { useTheme } from "@/context/ThemeContext";
import {
  useOnboardingGuide,
  type OnboardingStep,
} from "@/hooks/useOnboardingGuide";
import { logger } from "@/utils/logger";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

// =============================================================================
// STEP ITEM SUB-COMPONENTS
// =============================================================================

interface StepItemProps {
  readonly step: OnboardingStep;
  readonly index: number;
  readonly isActive: boolean;
  readonly isDark: boolean;
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
  isDark,
  onPress,
}: StepItemProps): React.ReactElement {
  const { t } = useTranslation("common");

  // ── Completed step ──
  if (step.isComplete) {
    return (
      <View className="flex-row items-center gap-x-3" style={styles.stepRow}>
        <View
          style={[
            styles.stepCircle,
            { backgroundColor: `${palette.nileGreen[500]}33` },
          ]}
        >
          <Ionicons name="checkmark" size={14} color={palette.nileGreen[500]} />
        </View>
        <Text
          className="text-sm"
          style={{
            color: palette.slate[400],
            textDecorationLine: "line-through",
          }}
        >
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
        style={[
          styles.activeStepContainer,
          {
            backgroundColor: `${palette.nileGreen[500]}1A`,
            borderColor: `${palette.nileGreen[500]}33`,
          },
        ]}
      >
        <View className="flex-row items-center gap-x-3 flex-1">
          <View
            style={[
              styles.stepCircle,
              { borderWidth: 2, borderColor: palette.nileGreen[500] },
            ]}
          >
            <Text
              style={{
                color: palette.nileGreen[500],
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {index + 1}
            </Text>
          </View>
          <Text
            className="text-sm font-semibold"
            style={{ color: palette.nileGreen[500] }}
          >
            {t(step.labelKey)}
          </Text>
        </View>
        <View style={styles.addButton}>
          <Text style={styles.addButtonText}>{t("add")}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Upcoming step ──
  return (
    <View className="flex-row items-center gap-x-3" style={styles.stepRow}>
      <View
        style={[
          styles.stepCircle,
          {
            borderWidth: 1,
            borderColor: isDark ? palette.slate[600] : palette.slate[300],
          },
        ]}
      >
        <Text
          style={{
            color: isDark ? palette.slate[400] : palette.slate[500],
            fontSize: 11,
            fontWeight: "500",
          }}
        >
          {index + 1}
        </Text>
      </View>
      <View className="flex-row items-center gap-x-2">
        <Text
          className="text-sm"
          style={{ color: isDark ? palette.slate[400] : palette.slate[500] }}
        >
          {t(step.labelKey)}
        </Text>
        {step.isNew ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{t("new_badge")}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const StepItem = React.memo(StepItemComponent);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function OnboardingGuideCardComponent(): React.ReactElement | null {
  const { t } = useTranslation("common");
  const { theme, isDark } = useTheme();
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
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? palette.slate[800] : palette.slate[100],
          borderColor: isDark
            ? `${palette.slate[600]}1A`
            : `${palette.slate[300]}40`,
        },
      ]}
    >
      {/* Header */}
      <View className="flex-row justify-between items-start mb-4">
        <View>
          <View className="flex-row items-center gap-x-2 mb-1">
            <Ionicons name="rocket" size={20} color={palette.nileGreen[500]} />
            <Text
              className="text-lg font-semibold"
              style={{ color: theme.text.primary }}
            >
              {t("setup_guide")}
            </Text>
          </View>
          <Text
            className="text-sm font-medium"
            style={{ color: theme.text.secondary }}
          >
            {t("setup_guide_progress", {
              completed: completedCount,
              total: totalSteps,
            })}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View
        style={[
          styles.progressTrack,
          {
            backgroundColor: isDark ? palette.slate[900] : palette.slate[200],
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${progressPercentage}%`,
              backgroundColor: palette.nileGreen[500],
            },
          ]}
        />
      </View>

      {/* Steps Checklist */}
      <View style={styles.stepsList}>
        {steps.map((step, index) => (
          <StepItem
            key={step.key}
            step={step}
            index={index}
            isActive={index === activeStepIndex}
            isDark={isDark}
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
          <Text
            className="text-sm font-medium py-2 px-3"
            style={{ color: theme.text.secondary }}
          >
            {t("dismiss")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const OnboardingGuideCard = React.memo(OnboardingGuideCardComponent);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    marginBottom: 24,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  stepsList: {
    gap: 16,
  },
  stepRow: {
    opacity: 0.85,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeStepContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    marginHorizontal: -4,
    borderRadius: 8,
    borderWidth: 1,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: palette.nileGreen[500],
  },
  addButtonText: {
    color: palette.nileGreen[900],
    fontSize: 12,
    fontWeight: "700",
  },
  newBadge: {
    backgroundColor: `${palette.nileGreen[500]}33`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    color: palette.nileGreen[500],
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
