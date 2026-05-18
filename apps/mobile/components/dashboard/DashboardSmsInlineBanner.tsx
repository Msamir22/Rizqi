import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { palette } from "@/constants/colors";

type SmsPermissionResult = "undetermined" | "granted" | "denied" | "blocked";

interface DashboardSmsInlineBannerProps {
  readonly message: string;
  readonly actionLabel: string;
  readonly requestPermission: () => Promise<SmsPermissionResult>;
  readonly onPermissionGranted: () => void;
  readonly onDismiss: () => void;
}

export function DashboardSmsInlineBanner({
  message,
  actionLabel,
  requestPermission,
  onPermissionGranted,
  onDismiss,
}: DashboardSmsInlineBannerProps): React.JSX.Element {
  const handleEnable = useCallback(async (): Promise<void> => {
    const result = await requestPermission();
    if (result === "granted") {
      onPermissionGranted();
      return;
    }

    onDismiss();
  }, [onDismiss, onPermissionGranted, requestPermission]);

  return (
    <View className="mb-3 flex-row items-center rounded-2xl border border-border-card bg-glass px-3 py-3 dark:border-border-card-dark dark:bg-glass-dark">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-action dark:bg-action-dark">
        <Ionicons
          name="chatbubble-ellipses"
          size={20}
          color={palette.paper[25]}
        />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        className="ms-3 flex-1 text-[13px] text-text-primary dark:text-text-primary-dark"
      >
        {message}
      </Text>
      <TouchableOpacity
        testID="dashboard-sms-enable"
        onPress={handleEnable}
        activeOpacity={0.75}
        className="px-1.5 py-1"
      >
        <Text className="text-[13px] font-semibold text-action dark:text-action-dark">
          {actionLabel}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="dashboard-sms-dismiss"
        onPress={onDismiss}
        activeOpacity={0.75}
        className="ms-0.5 p-1"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color={palette.slate[500]} />
      </TouchableOpacity>
    </View>
  );
}
