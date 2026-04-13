import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ErrorBoundary as REB } from "react-error-boundary";
import i18next from "i18next";
import { logger } from "@/utils/logger";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Fallback component rendered when an error occurs.
 * Displays error information for debugging.
 */
function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}): React.JSX.Element {
  return (
    <View className="flex-1 bg-red-100 p-5 justify-center items-center">
      <Text className="text-2xl font-bold text-red-600 mb-5 mt-[50px]">
        {i18next.t("common:error_boundary_message")}
      </Text>
      <ScrollView className="w-full max-h-[500px]">
        <Text
          className="text-base text-red-700 mb-5"
          style={{ fontFamily: "monospace" }}
        >
          {error instanceof Error ? error.toString() : String(error)}
        </Text>
      </ScrollView>
      <TouchableOpacity
        onPress={resetErrorBoundary}
        className="mt-4 px-6 py-3 rounded-xl bg-red-600"
      >
        <Text className="text-base font-semibold text-white">
          {i18next.t("common:retry")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the
 * child component tree, logs those errors, and displays a fallback UI.
 *
 * Uses react-error-boundary library for robust error handling.
 *
 * @component
 */
export function ErrorBoundary({
  children,
}: ErrorBoundaryProps): React.JSX.Element {
  const handleError = (error: unknown, errorInfo: React.ErrorInfo): void => {
    logger.error("Uncaught error", error, {
      componentStack: errorInfo.componentStack,
    });
  };

  return (
    <REB FallbackComponent={ErrorFallback} onError={handleError}>
      {children}
    </REB>
  );
}
