import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { AppDrawer } from "./AppDrawer";

interface PageHeaderProps {
  title: string;
  showDrawer?: boolean;
  showBackButton?: boolean;
  selectionMode?: {
    count: number;
    totalCount: number;
    onClear: () => void;
    onSelectAll?: () => void;
    onDelete?: () => void;
  };
  backIcon?: "close" | "arrow";
  rightAction?: {
    icon?: keyof typeof Ionicons.glyphMap;
    label?: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  children?: React.ReactNode;
}

function ActiveSelection({
  selectionMode,
  isDark,
}: {
  selectionMode: {
    count: number;
    totalCount: number;
    onClear: () => void;
    onSelectAll?: () => void;
  };
  isDark: boolean;
}): React.ReactElement {
  const isAllSelected =
    selectionMode.count === selectionMode.totalCount &&
    selectionMode.totalCount > 0;

  return (
    <>
      <TouchableOpacity onPress={selectionMode.onClear} className="mr-3 p-1">
        <Ionicons
          name="close-outline"
          size={28}
          className="text-slate-800 dark:text-white"
          color={isDark ? palette.slate[50] : palette.slate[800]}
        />
      </TouchableOpacity>
      <Text className="text-xl font-bold text-slate-800 dark:text-white flex-1">
        {selectionMode.count} Selected
      </Text>
      {selectionMode.onSelectAll && (
        <TouchableOpacity onPress={selectionMode.onSelectAll} className="mr-4">
          <Text className="text-sm font-bold text-nileGreen-600 dark:text-nileGreen-400">
            {isAllSelected ? "Deselect All" : "Select All"}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

function BackButton({
  backIcon,
  isDark,
}: {
  backIcon: "close" | "arrow";
  isDark: boolean;
}): React.ReactElement {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.back()} className="mr-2 p-1">
      <Ionicons
        name={backIcon === "close" ? "close-outline" : "arrow-back-outline"}
        size={28}
        className="text-slate-800 dark:text-white"
        color={isDark ? palette.slate[50] : palette.slate[800]}
      />
    </TouchableOpacity>
  );
}

function HamburgerButton({
  isDark,
  setIsDrawerOpen,
}: {
  isDark: boolean;
  setIsDrawerOpen: (open: boolean) => void;
}): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={() => setIsDrawerOpen(true)}
      activeOpacity={0.7}
      className="mr-3 p-1"
    >
      <Ionicons
        name="menu-outline"
        size={32}
        color={isDark ? "white" : palette.slate[800]}
      />
    </TouchableOpacity>
  );
}

function RightAction({
  rightAction,
  isDark,
}: {
  rightAction: {
    icon?: keyof typeof Ionicons.glyphMap;
    label?: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  isDark: boolean;
}): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={rightAction.onPress}
      activeOpacity={0.7}
      disabled={rightAction.disabled || rightAction.loading}
      className={`rounded-full items-center justify-center ${
        rightAction.icon
          ? "w-14 h-10 bg-white dark:bg-slate-800 shadow-sm"
          : "px-4 py-2"
      } ${rightAction.disabled ? "opacity-50" : ""}`}
      style={rightAction.icon ? { elevation: 2 } : {}}
    >
      {rightAction.loading ? (
        <ActivityIndicator size="small" color={palette.nileGreen[500]} />
      ) : rightAction.icon ? (
        <Ionicons
          name={rightAction.icon}
          size={24}
          color={isDark ? palette.slate[50] : palette.slate[800]}
        />
      ) : (
        <Text className="text-base font-bold text-nileGreen-600 dark:text-nileGreen-400">
          {rightAction.label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function PageHeader({
  title,
  showDrawer = true,
  showBackButton = false,
  selectionMode,
  backIcon = "arrow",
  rightAction,
  children,
}: PageHeaderProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const shouldShowSelectionMode = selectionMode && selectionMode.count > 0;
  const shouldShowRightAction = rightAction && !shouldShowSelectionMode;
  const shouldShowDrawerButton = showDrawer && !showBackButton;

  return (
    <>
      <View
        className="px-5 pb-4 mt-2 bg-slate-50 dark:bg-slate-900"
        style={{
          paddingTop: insets.top + 10,
        }}
      >
        {/* Top Navigation Row */}
        <View className="flex-row items-center justify-between h-10 mb-4">
          <View className="flex-row items-center flex-1">
            {shouldShowSelectionMode ? (
              <ActiveSelection selectionMode={selectionMode} isDark={isDark} />
            ) : (
              <>
                {showBackButton && (
                  <BackButton backIcon={backIcon} isDark={isDark} />
                )}
                {shouldShowDrawerButton && (
                  <HamburgerButton
                    isDark={isDark}
                    setIsDrawerOpen={setIsDrawerOpen}
                  />
                )}
                <Text
                  className="text-2xl font-bold text-slate-800 dark:text-white flex-1"
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </>
            )}
          </View>

          {shouldShowRightAction && (
            <RightAction rightAction={rightAction} isDark={isDark} />
          )}

          {shouldShowSelectionMode && selectionMode.onDelete && (
            <TouchableOpacity
              onPress={selectionMode.onDelete}
              className="w-10 h-10 rounded-full items-center justify-center bg-red-50 dark:bg-red-900/20"
            >
              <Ionicons
                name="trash-outline"
                size={24}
                color={palette.red[500]}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Customizable Children Content (e.g., Total Balance Card) */}
        {children}
      </View>

      <AppDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
