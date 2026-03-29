import { darkTheme, lightTheme } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Tabs, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { View } from "react-native";
import { QuickActionFab } from "@/components/fab";
import { CustomBottomTabBar } from "@/components/tab-bar/CustomBottomTabBar";
import { VoiceRecordingOverlay } from "@/components/voice/VoiceRecordingOverlay";
import { useVoiceTransactionFlow } from "@/hooks/useVoiceTransactionFlow";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { buildCategoryTree } from "@astik/logic";

export default function TabLayout(): React.ReactElement {
  const { isDark } = useTheme();
  const { preferredCurrency } = usePreferredCurrency();
  const { categories: allCategories } = useCategories({ topLevelOnly: false });
  const { accounts } = useAccounts();

  const categoryTree = useMemo(
    () => buildCategoryTree(allCategories),
    [allCategories]
  );

  const accountInputs = useMemo(
    () => accounts.map((a) => ({ id: a.id, name: a.name })),
    [accounts]
  );

  const { retry } = useLocalSearchParams<{ retry?: string }>();

  const voiceFlow = useVoiceTransactionFlow({
    preferredCurrency,
    categories: categoryTree,
    accounts: accountInputs,
    categoryRecords: allCategories,
    autoStart: retry === "true",
  });

  return (
    <View className="flex-1">
      <Tabs
        tabBar={(props) => (
          <CustomBottomTabBar
            {...props}
            onMicPress={() => void voiceFlow.startFlow()}
            isRecording={
              voiceFlow.flowStatus === "recording" ||
              voiceFlow.flowStatus === "paused"
            }
          />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: isDark
              ? darkTheme.background
              : lightTheme.background,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: "Accounts",
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: "Transactions",
          }}
        />
        <Tabs.Screen
          name="metals"
          options={{
            title: "Metals",
          }}
        />
      </Tabs>

      <QuickActionFab isRecordingActive={voiceFlow.flowStatus !== "idle"} />

      {/* Voice Recording Overlay — renders above tab bar */}
      <VoiceRecordingOverlay
        visible={voiceFlow.isOverlayVisible}
        status={voiceFlow.flowStatus}
        durationMs={voiceFlow.durationMs}
        errorMessage={voiceFlow.errorMessage ?? undefined}
        onSubmit={voiceFlow.submitRecording}
        onDiscard={voiceFlow.discardRecording}
        onPause={voiceFlow.pauseRecording}
        onResume={voiceFlow.resumeRecording}
        onRetry={voiceFlow.retryRecording}
      />
    </View>
  );
}
