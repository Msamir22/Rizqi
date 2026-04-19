import * as Localization from "expo-localization";
import { I18nManager, Platform } from "react-native";
import * as Updates from "expo-updates";

/**
 * Apply RTL layout and reload the app bundle.
 *
 * This function updates the I18nManager RTL setting and triggers a JS bundle reload
 * via Expo Updates. The reload is required for Yoga layout engine to mirror all
 * flex-direction row layouts.
 *
 * @param isArabic - Whether to enable RTL (Arabic) or LTR (English)
 *
 * NOTE: This causes a brief (~1-2s) loading screen. This is expected behavior
 * and aligns with platform limitations. Cannot be avoided for proper RTL support.
 */
export async function applyRTL(isArabic: boolean): Promise<void> {
  const shouldForceRTL = isArabic;

  // Only reload if RTL state actually changed
  if (I18nManager.isRTL !== shouldForceRTL) {
    I18nManager.forceRTL(shouldForceRTL);

    // Reload the JS bundle to apply RTL changes
    // On development builds, this uses expo-updates
    // In production, this still uses expo-updates for OTA updates
    if (Platform.OS === "web") {
      // On web, just reload the page
      window.location.reload();
    } else {
      // On native, reload via expo-updates
      await Updates.reloadAsync();
    }
  }
}

/**
 * Get the device's default language code.
 *
 * @returns ISO 639-1 language code (e.g., "en", "ar")
 */
export function getDeviceLanguage(): string {
  return Localization.getLocales()[0]?.languageCode ?? "en";
}

/**
 * Check if the device language is Arabic.
 *
 * @returns true if device language is Arabic
 */
export function isDeviceLanguageArabic(): boolean {
  return getDeviceLanguage() === "ar";
}
