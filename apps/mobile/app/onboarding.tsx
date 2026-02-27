import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { ensureCashAccount } from "@/services/account-service";
import { getCurrentUserId } from "@/services/supabase";

import { SHOW_CASH_TOAST_KEY } from "@/constants/storage-keys";

const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = Dimensions.get("window");

const ONBOARDING_DATA = [
  {
    id: "1",
    title: "Track Your Net Worth",
    description:
      "Consolidate all your assets—cash, bank accounts, and investments—in one secure dashboard.",
    icon: (color: string) => (
      <FontAwesome5 name="wallet" size={80} color={color} />
    ),
  },
  {
    id: "2",
    title: "Gold & Silver Analytics",
    description:
      "Monitor real-time prices of precious metals and track the value of your physical holdings.",
    icon: (color: string) => (
      <MaterialCommunityIcons name="gold" size={90} color={color} />
    ),
  },
  {
    id: "3",
    title: "Voice-Powered Tracking",
    description:
      "Simply speak to add transactions. AI automatically categorizes and updates your accounts.",
    icon: (color: string) => (
      <View
        className="w-[120px] h-[120px] rounded-full elevation-[10] items-center justify-center shadow-[0_10px_20px]"
        style={{
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.5,
        }}
      >
        <FontAwesome5 name="microphone" size={50} color="#FFF" />
      </View>
    ),
    isSpecial: true,
  },
];

export default function OnboardingScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const carouselRef = useRef<ICarouselInstance>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleFinish = async (): Promise<void> => {
    try {
      await AsyncStorage.setItem("hasOnboarded", "true");

      // Fire-and-forget: create Cash account for the new user.
      // Errors are swallowed — index.tsx retries on next launch (FR-005).
      const userId = await getCurrentUserId();
      if (userId) {
        ensureCashAccount(userId)
          .then((result) => {
            if (result.created) {
              AsyncStorage.setItem(SHOW_CASH_TOAST_KEY, "true").catch(
                console.error
              );
            }
          })
          .catch(console.error);
      }

      router.replace("/(tabs)");
    } catch (error) {
      console.error("Failed to save onboarding status", error);
    }
  };

  const handleNext = (): void => {
    if (currentIndex === ONBOARDING_DATA.length - 1) {
      handleFinish();
    } else {
      carouselRef.current?.next();
    }
  };

  const renderItem = ({
    item,
  }: {
    item: (typeof ONBOARDING_DATA)[number];
    index: number;
  }): React.JSX.Element => {
    const iconColor = item.isSpecial
      ? palette.nileGreen[500]
      : isDark
        ? palette.nileGreen[500]
        : palette.nileGreen[600];

    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-12 h-[150px] justify-center">
          {item.icon(iconColor)}
        </View>

        <View className="items-center gap-4">
          <Text className="font-bold text-[28px] mb-2 text-center text-text-primary dark:text-text-primary-dark">
            {item.title}
          </Text>
          <Text className="text-center text-text-secondary dark:text-text-secondary-dark text-base max-w-[85%]">
            {item.description}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1">
      {/* Background Gradient for Dark Mode */}
      {isDark && (
        <LinearGradient
          colors={theme.backgroundGradient}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Skip Button */}
      <TouchableOpacity
        className="absolute p-2 right-6 z-10"
        onPress={handleFinish}
        style={{ top: insets.top + 16 }}
      >
        <Text className="text-text-secondary dark:text-text-secondary-dark text-base">
          Skip
        </Text>
      </TouchableOpacity>

      {/* Carousel */}
      <Carousel
        ref={carouselRef}
        loop={false}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT * 0.75}
        autoPlay={false}
        data={ONBOARDING_DATA}
        scrollAnimationDuration={500}
        onSnapToItem={(index) => setCurrentIndex(index)}
        renderItem={renderItem}
        style={{ marginTop: insets.top + 40 }}
      />

      {/* Bottom Section */}
      <View
        className="flex-1 items-center justify-end gap-8 px-8"
        style={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Pagination Dots */}
        <View className="flex-row gap-2">
          {ONBOARDING_DATA.map((_, index) => (
            <View
              className="h-2 rounded"
              key={index}
              style={{
                backgroundColor:
                  currentIndex === index
                    ? palette.nileGreen[500]
                    : isDark
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(0,0,0,0.1)",
                width: currentIndex === index ? 24 : 8,
              }}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          className="rounded-2xl py-[18px] elevation-[4] shadow-[0_4px_8px_#10B981] bg-nileGreen-500 w-full flex-row items-center justify-center"
          style={{ shadowOpacity: 0.3 }}
        >
          <Text className="text-white font-semibold text-lg">
            {currentIndex === ONBOARDING_DATA.length - 1
              ? "Get Started"
              : "Next"}
          </Text>
          {currentIndex !== ONBOARDING_DATA.length - 1 && (
            <Ionicons
              className="ml-2"
              name="arrow-forward"
              size={20}
              color="white"
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
