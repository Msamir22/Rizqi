/**
 * App Navigation Drawer
 * Slide-out navigation menu with profile header and sectioned menu
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

// =============================================================================
// Types
// =============================================================================

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  onPress?: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const DRAWER_WIDTH = Dimensions.get("window").width * 0.8;

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "MAIN",
    items: [
      { id: "home", label: "Home", icon: "home-outline", route: "/" },
      {
        id: "accounts",
        label: "Accounts",
        icon: "wallet-outline",
        route: "/accounts",
      },
      {
        id: "transactions",
        label: "Transactions",
        icon: "swap-horizontal-outline",
        route: "/transactions",
      },
    ],
  },
  {
    title: "ASSETS",
    items: [
      {
        id: "metals",
        label: "Metals",
        icon: "diamond-outline",
        route: "/metals",
      },
      {
        id: "stats",
        label: "Stats",
        icon: "stats-chart-outline",
        route: "/stats",
      },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      {
        id: "bills",
        label: "Bills",
        icon: "receipt-outline",
        route: "/recurring-payments",
      },
      {
        id: "budgets",
        label: "Budgets",
        icon: "pie-chart-outline",
        route: "/budgets",
      },
    ],
  },
];

// =============================================================================
// Component
// =============================================================================

export function AppDrawer({
  visible,
  onClose,
}: AppDrawerProps): React.JSX.Element {
  const { isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const handleNavigation = (route: string): void => {
    onClose();
    setTimeout(() => {
      router.push(route as never);
    }, 100);
  };

  const handleLogout = async (): Promise<void> => {
    onClose();
    await signOut();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        {/* Drawer */}
        <Animated.View
          style={{
            width: DRAWER_WIDTH,
            height: "100%",
            transform: [{ translateX: slideAnim }],
          }}
        >
          <Pressable
            className="flex-1 bg-white dark:bg-slate-900"
            style={{ paddingTop: insets.top }}
          >
            {/* Header with gradient */}
            <LinearGradient
              colors={[palette.nileGreen[700], palette.slate[900]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-5 pb-6"
            >
              {/* Avatar */}
              <View className="w-16 h-16 rounded-full bg-nileGreen-500/20 items-center justify-center mb-3 border-2 border-nileGreen-500/30">
                <Ionicons
                  name="person"
                  size={28}
                  color={palette.nileGreen[400]}
                />
              </View>
              {/* User info */}
              <Text className="text-white text-lg font-bold">User</Text>
              <Text className="text-slate-400 text-sm">user@email.com</Text>
            </LinearGradient>

            {/* Menu sections */}
            <View className="flex-1 p-4">
              {MENU_SECTIONS.map((section) => (
                <View key={section.title} className="mb-4">
                  <Text className="text-xs font-semibold mb-2 text-slate-400 dark:text-slate-500">
                    {section.title}
                  </Text>
                  {section.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => item.route && handleNavigation(item.route)}
                      className="flex-row items-center py-3"
                    >
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={isDark ? palette.slate[300] : palette.slate[600]}
                      />
                      <Text className="ml-4 text-base text-slate-800 dark:text-white">
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            {/* Settings section */}
            <View
              className="border-t p-4 border-slate-200 dark:border-slate-800"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              {/* Dark mode toggle */}
              <View className="flex-row items-center justify-between py-3">
                <View className="flex-row items-center">
                  <Ionicons
                    name="moon-outline"
                    size={22}
                    color={isDark ? palette.slate[300] : palette.slate[600]}
                  />
                  <Text className="ml-4 text-base text-slate-800 dark:text-white">
                    Dark Mode
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{
                    false: palette.slate[300],
                    true: palette.nileGreen[500],
                  }}
                  thumbColor="white"
                />
              </View>

              {/* Logout */}
              <TouchableOpacity
                onPress={handleLogout}
                className="flex-row items-center py-3"
              >
                <Ionicons
                  name="log-out-outline"
                  size={22}
                  color={palette.red[400]}
                />
                <Text className="ml-4 text-base text-red-400">Logout</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default AppDrawer;
