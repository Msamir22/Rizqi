import "dotenv/config";
import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Astik",
  slug: "astik",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "astik",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.astik.app",
    infoPlist: {
      NSSpeechRecognitionUsageDescription:
        "Astik needs speech recognition to convert your voice to transactions",
      NSMicrophoneUsageDescription:
        "Astik needs microphone access for voice input",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0F172A",
    },
    package: "com.msamir22.astikmobile",
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_SMS",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-asset",
    "expo-font",
    "expo-speech-recognition",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0F172A",
        image: "./assets/splash.png",
        imageWidth: 200,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  extra: {
    apiBaseUrl: process.env.API_BASE_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  newArchEnabled: true,
};

export default config;
