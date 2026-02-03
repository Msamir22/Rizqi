/**
 * Toast - Premium animated toast notifications
 *
 * Uses react-native-reanimated for smooth animations
 * Supports success, error, info, and warning variants
 */

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { createContext, useCallback, useContext, useState } from "react";
import { Text, View } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

type ToastType = "success" | "error" | "info" | "warning";

interface ToastConfig {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
}

// =============================================================================
// Context
// =============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// =============================================================================
// Toast Component
// =============================================================================

interface ToastProps {
  config: ToastConfig;
  onHide: () => void;
}

const TOAST_ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "close-circle",
  info: "information-circle",
  warning: "warning",
};

const TOAST_COLORS: Record<
  ToastType,
  { bg: string; icon: string; border: string }
> = {
  success: {
    bg: `${palette.nileGreen[800]}E6`,
    icon: palette.nileGreen[400],
    border: palette.nileGreen[600],
  },
  error: {
    bg: `${palette.red[600]}E6`,
    icon: palette.red[100],
    border: palette.red[500],
  },
  info: {
    bg: `${palette.blue[600]}E6`,
    icon: palette.blue[100],
    border: palette.blue[500],
  },
  warning: {
    bg: `${palette.orange[600]}E6`,
    icon: palette.orange[100],
    border: palette.orange[500],
  },
};

function Toast({ config, onHide }: ToastProps): React.JSX.Element {
  const { isDark } = useTheme();
  const colors = TOAST_COLORS[config.type];
  const icon = TOAST_ICONS[config.type];

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onHide();
    }, config.duration || 3000);

    return () => clearTimeout(timer);
  }, [config.duration, onHide]);

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(15)}
      exiting={SlideOutUp.springify().damping(15)}
      className="absolute top-14 left-5 right-5 z-50"
    >
      <View
        className="flex-row items-center px-4 py-3 rounded-2xl border"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
          // Glassmorphism shadow
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {/* Icon */}
        <View className="mr-3">
          <Ionicons name={icon} size={24} color={colors.icon} />
        </View>

        {/* Text Content */}
        <View className="flex-1">
          <Text className="text-white text-sm font-semibold">
            {config.title}
          </Text>
          {config.message && (
            <Text className="text-white/80 text-xs mt-0.5">
              {config.message}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// =============================================================================
// Provider
// =============================================================================

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({
  children,
}: ToastProviderProps): React.JSX.Element {
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);

  const showToast = useCallback((config: ToastConfig) => {
    setToastConfig(config);
  }, []);

  const hideToast = useCallback(() => {
    setToastConfig(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastConfig && <Toast config={toastConfig} onHide={hideToast} />}
    </ToastContext.Provider>
  );
}
