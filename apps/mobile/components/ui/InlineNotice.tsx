import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { palette } from "@/constants/colors";

interface InlineNoticeProps {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onActionPress?: () => void;
  readonly className?: string;
}

export function InlineNotice({
  icon,
  message,
  actionLabel,
  onActionPress,
  className = "",
}: InlineNoticeProps): React.JSX.Element {
  return (
    <View
      className={`flex-row items-center rounded-2xl border border-border-card bg-card-muted dark:bg-card-muted-dark px-4 py-3 ${className}`}
    >
      <Ionicons name={icon} size={22} color={palette.brandGreen[600]} />
      <Text className="ms-3 flex-1 text-sm text-text-primary dark:text-text-primary-dark">
        {message}
      </Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity onPress={onActionPress} className="ps-3 py-1">
          <Text className="text-sm font-bold text-action dark:text-action-dark">
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
