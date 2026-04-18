import { QuickActionFab } from "@/components/fab";
import { CustomBottomTabBar } from "@/components/tab-bar/CustomBottomTabBar";
import { VoiceRecordingOverlay } from "@/components/voice/VoiceRecordingOverlay";
import { darkTheme, lightTheme } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useVoiceTransactionFlow } from "@/hooks/useVoiceTransactionFlow";
import { buildCategoryTree } from "@rizqi/logic";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { View } from "react-native";

export default function TabLayout(): React.ReactElement {
  const { isDark } = useTheme();
  const { preferredCurrency } = usePreferredCurrency();
  const { categories: allCategories } = useCategories({ topLevelOnly: false });
  const { accounts } = useAccounts();
  const router = useRouter();

  const categoryTree = useMemo(
    () => buildCategoryTree(allCategories),
    [allCategories]
  );

  const accountInputs = useMemo(
    () =>
      accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
    [accounts]
  );

  const { retry } = useLocalSearchParams<{ retry?: string }>();
  const autoStart = retry === "true";

  useEffect(() => {
    if (autoStart) {
      router.setParams({ retry: undefined });
    }
  }, [autoStart, router]);

  const voiceFlow = useVoiceTransactionFlow({
    preferredCurrency,
    categories: categoryTree,
    accounts: accountInputs,
    categoryRecords: allCategories,
    autoStart,
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
