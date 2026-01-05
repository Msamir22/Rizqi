import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const value = await AsyncStorage.getItem("hasOnboarded");
      if (value === "true") {
        setHasOnboarded(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0F172A", // Use dark background before theme loads
        }}
      >
        <ActivityIndicator size="large" color="#10B981" />
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
