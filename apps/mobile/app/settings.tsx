import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { GradientBackground } from "../components/ui/GradientBackground";
import { useTheme } from "../context/ThemeContext";

export default function SettingsScreen() {
  const { theme, mode, toggleTheme } = useTheme();

  return (
    <GradientBackground className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2.5 mb-5">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-900 dark:text-slate-50">
          Settings
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerClassName="px-5">
        {/* Appearance Section */}
        <View className="mb-8">
          <Text className="text-[13px] font-semibold mb-3 ml-1 uppercase text-slate-500 dark:text-slate-400">
            Appearance
          </Text>

          <View className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800">
            <View className="flex-row items-center gap-3">
              <View
                className="w-8 h-8 rounded-lg justify-center items-center"
                style={{
                  backgroundColor: mode === "dark" ? "#6366f1" : "#fb923c",
                }}
              >
                <Ionicons
                  name={mode === "dark" ? "moon" : "sunny"}
                  size={20}
                  color="#FFF"
                />
              </View>
              <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                Dark Mode
              </Text>
            </View>
            <Switch
              value={mode === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ false: "#767577", true: "#10B981" }}
              thumbColor={mode === "dark" ? "#FFF" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* General Section (Mock) */}
        {/* General Section (Mock) */}
        <View className="mb-8">
          <Text className="text-[13px] font-semibold mb-3 ml-1 uppercase text-slate-500 dark:text-slate-400">
            General
          </Text>

          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800">
            <View className="flex-row items-center gap-3">
              <View
                className="w-8 h-8 rounded-lg justify-center items-center"
                style={{ backgroundColor: "#3b82f6" }}
              >
                <Ionicons name="person" size={20} color="#FFF" />
              </View>
              <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                Profile
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.text.secondary}
            />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 mt-0.5">
            <View className="flex-row items-center gap-3">
              <View
                className="w-8 h-8 rounded-lg justify-center items-center"
                style={{ backgroundColor: "#f43f5e" }}
              >
                <Ionicons name="notifications" size={20} color="#FFF" />
              </View>
              <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
                Notifications
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}
