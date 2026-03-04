/**
 * @deprecated This component has been deprecated in favor of CustomBottomTabBar.
 * The floating action bar functionality is now integrated into the custom bottom tab bar
 * with animated quick actions. See components/tab-bar/CustomBottomTabBar.tsx
 *
 * This file is kept for reference and can be safely deleted after verifying
 * that the new CustomBottomTabBar works correctly.
 */
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { TouchableOpacity, View } from "react-native";

const SHADOW_OPACITY_BY_MODE: Readonly<Record<string, number>> = {
  dark: 0.5,
  light: 0.15,
};

export function FloatingActionBar(): React.JSX.Element {
  const { isDark } = useTheme();

  const onVoicePress = (): void => {
    router.push("/voice-input");
  };

  const onAddPress = (): void => {
    router.push("/add-transaction");
  };

  return (
    <View className="absolute bottom-8 self-center">
      <View
        className="rounded-[40px] shadow-lg"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity:
            // eslint-disable-next-line no-restricted-syntax
            SHADOW_OPACITY_BY_MODE[isDark ? "dark" : "light"] ?? 0.15,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        <BlurView
          intensity={isDark ? 60 : 90}
          tint={isDark ? "systemThinMaterialDark" : "light"}
          className="h-16 w-[280px] flex-row items-center justify-between overflow-hidden rounded-[40px] border px-3"
          style={{
            backgroundColor: isDark
              ? "rgba(15, 23, 42, 0.7)"
              : "rgba(255,255,255,0.8)",
            borderColor: isDark
              ? "rgba(255,255,255,0.1)"
              : "rgba(255,255,255,0.8)",
          }}
        >
          {/* Voice Input (Primary Action) */}
          <TouchableOpacity
            className="p-1"
            onPress={onVoicePress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[palette.nileGreen[500], palette.nileGreen[600]]}
              className="h-12 w-12 items-center justify-center rounded-full shadow-md"
              style={{ shadowColor: palette.nileGreen[500] }}
            >
              <FontAwesome5 name="microphone" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Add Transaction */}
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-full"
            onPress={onAddPress}
            activeOpacity={0.6}
          >
            <Ionicons
              name="add"
              size={28}
              color={isDark ? "#FFF" : palette.slate[800]}
            />
          </TouchableOpacity>

          {/* Transfer (Mock) */}
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center"
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={26}
              color={isDark ? "#FFF" : palette.slate[800]}
            />
          </TouchableOpacity>

          {/* Analytics (Mock) */}
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center"
            activeOpacity={0.6}
          >
            <Ionicons
              name="stats-chart"
              size={22}
              color={isDark ? "#FFF" : palette.slate[800]}
            />
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
}
