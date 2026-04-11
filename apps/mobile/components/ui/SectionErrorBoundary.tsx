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

import { Ionicons } from "@expo/vector-icons";
import i18next from "i18next";
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { palette } from "@/constants/colors";
import { logger } from "@/utils/logger";

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
}

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
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error(`SectionErrorBoundary: "${this.props.name}" crashed`, error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View className="my-3 px-4 py-5 rounded-2xl border items-center bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <Ionicons
            name="alert-circle-outline"
            size={28}
            color={palette.slate[400]}
          />
          <Text className="text-sm font-medium mt-2 text-slate-500 dark:text-slate-400">
            {i18next.t("common:section_failed_to_load", {
              name: this.props.name,
            })}
          </Text>
          <TouchableOpacity
            onPress={this.handleRetry}
            className="mt-3 px-4 py-2 rounded-lg bg-nileGreen-500"
          >
            <Text className="text-xs font-semibold text-white">
              {i18next.t("common:retry")}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
