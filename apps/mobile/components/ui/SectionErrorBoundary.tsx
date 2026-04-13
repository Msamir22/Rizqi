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
import { useCallback, useState, type ErrorInfo, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

// =============================================================================
// Constants
// =============================================================================

/** Maximum retry attempts before disabling the retry button */
const MAX_RETRIES = 3;

// =============================================================================
// Fallback Component
// =============================================================================

interface SectionFallbackProps extends FallbackProps {
  name: string;
  retryCount: number;
  onRetryCountIncrement: () => void;
}

function SectionFallback({
  resetErrorBoundary,
  name,
  retryCount,
  onRetryCountIncrement,
}: SectionFallbackProps): React.JSX.Element {
  const canRetry = retryCount < MAX_RETRIES;

  const handleRetry = useCallback((): void => {
    onRetryCountIncrement();
    resetErrorBoundary();
  }, [resetErrorBoundary, onRetryCountIncrement]);

  return (
    <View className="my-3 px-4 py-5 rounded-2xl border items-center bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      <Ionicons
        name="alert-circle-outline"
        size={28}
        color={palette.slate[400]}
      />
      <Text className="text-sm font-medium mt-2 text-slate-500 dark:text-slate-400">
        {t("common:section_failed_to_load", { name })}
      </Text>
      {canRetry ? (
        <TouchableOpacity
          onPress={handleRetry}
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

// =============================================================================
// Main Component
// =============================================================================

interface SectionErrorBoundaryProps {
  /** Display name used in the error message */
  name: string;
  children: ReactNode;
}

/**
 * Catches rendering errors in a dashboard section and displays a compact
 * fallback with a retry button. Logs the error for debugging.
 */
export function SectionErrorBoundary({
  name,
  children,
}: SectionErrorBoundaryProps): React.JSX.Element {
  const [retryCount, setRetryCount] = useState(0);

  const handleError = useCallback(
    (error: unknown, info: ErrorInfo): void => {
      logger.error(`SectionErrorBoundary: "${name}" crashed`, error, {
        componentStack: info.componentStack,
      });
    },
    [name]
  );

  const incrementRetryCount = useCallback((): void => {
    setRetryCount((prev) => prev + 1);
  }, []);

  const resetRetryCount = useCallback((): void => {
    setRetryCount(0);
  }, []);

  return (
    <ErrorBoundary
      onError={handleError}
      onReset={resetRetryCount}
      fallbackRender={(props) => (
        <SectionFallback
          {...props}
          name={name}
          retryCount={retryCount}
          onRetryCountIncrement={incrementRetryCount}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
