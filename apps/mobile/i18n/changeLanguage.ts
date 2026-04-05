import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "./index";

import { LANGUAGE_KEY } from "@/constants/storage-keys";
import { applyRTL } from "@/utils/rtl";

export type { SupportedLanguage } from "./translation-schema";
import type { SupportedLanguage } from "./translation-schema";

/**
 * Change the app language and apply RTL if needed.
 *
 * This function:
 * 1. Saves the language preference to AsyncStorage
 * 2. Updates the i18next language
 * 3. Applies RTL layout changes (triggers reload for Arabic)
 *
 * NOTE: When switching to/from Arabic, the app will reload (1-2s loading screen).
 * This is a platform limitation and expected behavior.
 *
 * @param lang - Language code ("en" or "ar")
 */
export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  // Save to AsyncStorage for persistence
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);

  // Update i18next language
  await i18n.changeLanguage(lang);

  // Apply RTL layout (will trigger reload if changing to/from Arabic)
  await applyRTL(lang === "ar");
}

/**
 * Get the current app language from i18next.
 *
 * @returns Current language code ("en" or "ar")
 */
export function getCurrentLanguage(): SupportedLanguage {
  return i18n.language === "ar" ? "ar" : "en";
}

/**
 * Check if the current language is Arabic.
 *
 * @returns true if current language is Arabic
 */
export function isArabic(): boolean {
  return getCurrentLanguage() === "ar";
}
