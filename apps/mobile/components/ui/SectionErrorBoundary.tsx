/**
 * SectionErrorBoundary — Error boundary for individual dashboard sections.
 *
 * Prevents one buggy section from crashing the entire dashboard.
 * Shows a compact error fallback with retry option instead of a full-screen crash.
 *
 * Usage:
 * ```tsx
 * <SectionErrorBoundary name="LiveRates">
 *   <LiveRates ... />
 * </SectionErrorBoundary>
 * ```
 */

import { palette } from "@/constants/colors";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { t } from "i18next";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";

// =============================================================================
// Types
// =============================================================================

interface SectionErrorBoundaryProps {
  /** Display name used in the error message */
  name: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  retryCount: number;
}

/** Maximum retry attempts before disabling the retry button */
const MAX_RETRIES = 3;

// =============================================================================
// Component (Class-based — required for error boundaries)
// =============================================================================

/**
 * Catches rendering errors in a dashboard section and displays a compact
 * fallback with a retry button. Logs the error for debugging.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(): Partial<SectionErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error(`SectionErrorBoundary: "${this.props.name}" crashed`, error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      retryCount: prev.retryCount + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < MAX_RETRIES;

      return (
        <View className="my-3 px-4 py-5 rounded-2xl border items-center bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <Ionicons
            name="alert-circle-outline"
            size={28}
            color={palette.slate[400]}
          />
          <Text className="text-sm font-medium mt-2 text-slate-500 dark:text-slate-400">
            {t("common:section_failed_to_load", {
              name: this.props.name,
            })}
          </Text>
          {canRetry ? (
            <TouchableOpacity
              onPress={this.handleRetry}
              className="mt-3 px-4 py-2 rounded-lg bg-nileGreen-500"
            >
              <Text className="text-xs font-semibold text-white">
                {t("common:retry")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    return this.props.children;
  }
}
