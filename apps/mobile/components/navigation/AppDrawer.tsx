/**
 * App Drawer Navigation
 *
 * Slide-out drawer with navigation menu sections, theme toggle, and logout.
 * Implements sync-first logout flow with confirmation modal for sync failures.
 *
 * @module AppDrawer
 */

import { palette } from "@/constants/colors";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  getProfileDisplayName,
  getProfileAvatarUrl,
  getProfileInitials,
} from "@/utils/profile-helpers";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDatabase } from "@/providers/DatabaseProvider";
import { performLogout } from "@/services/logout-service";
import { useTranslation } from "react-i18next";

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
        id: "live-rates",
        label: "Live Rates",
        icon: "trending-up-outline",
        route: "/live-rates",
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
  const { user } = useAuth();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");

  // Derive display properties from raw profile using pure helpers
  const displayName = useMemo(
    () => getProfileDisplayName(profile, user?.email),
    [profile, user?.email]
  );
  const avatarUrl = useMemo(() => getProfileAvatarUrl(profile), [profile]);
  const initials = useMemo(
    () => getProfileInitials(profile, user?.email),
    [profile, user?.email]
  );

  const database = useDatabase();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Avatar image loading state
  const [avatarError, setAvatarError] = useState(false);

  // Reset avatar error when URL changes (e.g., user updates their profile photo)
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  // Logout UI state
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
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

  const handleLogoutPress = useCallback(async (): Promise<void> => {
    setIsLoggingOut(true);

    try {
      const result = await performLogout(database);

      if (result.success) {
        onClose();
        return;
      }

      if (result.error === "no_network") {
        return;
      }

      if (result.error === "sync_failed") {
        setShowSyncWarning(true);
      }
    } catch {
      // TODO: Replace with structured logging (e.g., Sentry)
    } finally {
      setIsLoggingOut(false);
    }
  }, [database, onClose]);

  const handleForceLogout = useCallback(async (): Promise<void> => {
    setShowSyncWarning(false);
    setIsLoggingOut(true);

    try {
      const result = await performLogout(database, true);

      if (result.success) {
        onClose();
      }
      // If force logout fails, there's not much we can do in the drawer
      // TODO: Replace with structured logging (e.g., Sentry)
    } catch {
      // TODO: Replace with structured logging (e.g., Sentry)
    } finally {
      setIsLoggingOut(false);
    }
  }, [database, onClose]);

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
            className="flex-1 bg-background dark:bg-background-dark"
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
              {isProfileLoading ? (
                <View className="w-16 h-16 rounded-full bg-nileGreen-500/20 items-center justify-center mb-3 border-2 border-nileGreen-500/30">
                  <ActivityIndicator
                    size="small"
                    color={palette.nileGreen[400]}
                  />
                </View>
              ) : avatarUrl && !avatarError ? (
                <Image
                  source={{ uri: avatarUrl }}
                  className="w-16 h-16 rounded-full mb-3 border-2 border-nileGreen-500/30"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View className="w-16 h-16 rounded-full bg-nileGreen-500/20 items-center justify-center mb-3 border-2 border-nileGreen-500/30">
                  <Text className="text-nileGreen-400 text-xl font-bold">
                    {initials || "?"}
                  </Text>
                </View>
              )}
              {/* User info */}
              {isProfileLoading ? (
                <>
                  <View className="h-5 w-32 rounded bg-slate-700/50 mb-1" />
                  <View className="h-4 w-44 rounded bg-slate-700/30" />
                </>
              ) : (
                <>
                  <Text
                    className="text-white text-lg font-bold"
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {user?.email && displayName !== user.email ? (
                    <Text className="text-slate-400 text-sm" numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                </>
              )}
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
                      <Text className="ms-4 text-base text-slate-800 dark:text-white">
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
                  <Text className="ms-4 text-base text-slate-800 dark:text-white">
                    {t("dark_mode")}
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
                onPress={handleLogoutPress}
                disabled={isLoggingOut}
                className="flex-row items-center py-3"
              >
                {isLoggingOut ? (
                  <ActivityIndicator size={22} color={palette.red[400]} />
                ) : (
                  <Ionicons
                    name="log-out-outline"
                    size={22}
                    color={palette.red[400]}
                  />
                )}
                <Text className="ms-4 text-base text-red-400">
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>

      {/* Sync failure warning modal (FR-013) */}
      <ConfirmationModal
        visible={showSyncWarning}
        variant="warning"
        icon="cloud-offline-outline"
        title={t("sync_failed_title")}
        message={t("sync_failed_message")}
        confirmLabel={t("proceed_anyway")}
        cancelLabel={tCommon("cancel")}
        onConfirm={() => {
          handleForceLogout().catch(() => {
            // TODO: Replace with structured logging (e.g., Sentry)
          });
        }}
        onCancel={() => setShowSyncWarning(false)}
      />
    </Modal>
  );
}

export default AppDrawer;
