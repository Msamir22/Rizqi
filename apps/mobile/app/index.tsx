import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { palette } from "@/constants/colors";
import { ensureCashAccount } from "@/services/account-service";
import { ensureAuthenticated, getCurrentUserId } from "@/services/supabase";

import { SHOW_CASH_TOAST_KEY } from "@/constants/storage-keys";

export default function Index(): React.ReactNode {
  const [isReady, setIsReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async (): Promise<void> => {
    try {
      // 1. Ensure user is authenticated (anonymous or real)
      await ensureAuthenticated();

      // 2. Check onboarding status
      const value = await AsyncStorage.getItem("hasOnboarded");
      if (value === "true") {
        setHasOnboarded(true);

        // 3. Retry fallback: ensure Cash account exists (FR-005/FR-008).
        // Runs silently on every launch for onboarded users — idempotent.
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
      }
    } catch (e) {
      console.error("App initialization error:", e);
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-900">
        <ActivityIndicator size="large" color={palette.nileGreen[500]} />
      </View>
    );
  }

  // Redirect based on status
  if (hasOnboarded) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/onboarding" />;
  }
}
