import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useServerStatus } from "../../context/ServerStatusContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export const ServiceUnavailableBanner: React.FC = () => {
  const { isServiceUnavailable, checkStatus } = useServerStatus();
  const insets = useSafeAreaInsets();

  if (!isServiceUnavailable) return null;

  return (
    <View
      className="absolute top-0 left-0 right-0 z-[9999] bg-red-600 elevation-[5] px-4 pb-3 shadow-[0_2px_3.84px_#000_0.25]"
      style={{ paddingTop: insets.top + 10, shadowOpacity: 0.25 }}
    >
      <View className="flex-row items-center justify-between">
        <MaterialCommunityIcons
          name="cloud-off-outline"
          size={24}
          color="#fff"
        />
        <View className="flex-1 ml-3 mr-2">
          <Text className="text-sm font-bold text-white">
            Service Unavailable
          </Text>
          <Text className="text-xs text-white/90">
            We're having trouble connecting to the server. Some data may be
            outdated.
          </Text>
        </View>
        <TouchableOpacity
          className="rounded-md bg-white/20 px-3 py-1.5"
          onPress={checkStatus}
          activeOpacity={0.8}
        >
          <Text className="text-xs font-semibold text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
