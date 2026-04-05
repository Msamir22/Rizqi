/* eslint-disable import/no-named-as-default-member */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import { LANGUAGE_KEY } from "@/constants/storage-keys";
import type { TranslationResources } from "./translation-schema";

// Import translation files
import enCommon from "../locales/en/common.json";
import enTransactions from "../locales/en/transactions.json";
import enAccounts from "../locales/en/accounts.json";
import enBudgets from "../locales/en/budgets.json";
import enSettings from "../locales/en/settings.json";
import enOnboarding from "../locales/en/onboarding.json";
import enAuth from "../locales/en/auth.json";
import enMetals from "../locales/en/metals.json";
import enCategories from "../locales/en/categories.json";

import arCommon from "../locales/ar/common.json";
import arTransactions from "../locales/ar/transactions.json";
import arAccounts from "../locales/ar/accounts.json";
import arBudgets from "../locales/ar/budgets.json";
import arSettings from "../locales/ar/settings.json";
import arOnboarding from "../locales/ar/onboarding.json";
import arAuth from "../locales/ar/auth.json";
import arMetals from "../locales/ar/metals.json";
import arCategories from "../locales/ar/categories.json";

/**
 * Translation resources organized by language and namespace.
 *
 * This structure enables:
 * - Namespace-based translation loading (e.g., useTranslation('transactions'))
 * - Type-safe translation keys via TypeScript module augmentation
 * - Fallback to English for missing keys
 */
const resources: Record<"en" | "ar", TranslationResources> = {
  en: {
    common: enCommon,
    transactions: enTransactions,
    accounts: enAccounts,
    budgets: enBudgets,
    settings: enSettings,
    onboarding: enOnboarding,
    auth: enAuth,
    metals: enMetals,
    categories: enCategories,
  },
  ar: {
    common: arCommon,
    transactions: arTransactions,
    accounts: arAccounts,
    budgets: arBudgets,
    settings: arSettings,
    onboarding: arOnboarding,
    auth: arAuth,
    metals: arMetals,
    categories: arCategories,
  },
};

/**
 * Detect the initial language from AsyncStorage or device locale.
 *
 * Priority:
 * 1. Stored preference in AsyncStorage (LANGUAGE_KEY)
 * 2. Device locale (via expo-localization)
 * 3. Default to English
 */
async function detectInitialLanguage(): Promise<"en" | "ar"> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored === "en" || stored === "ar") {
      return stored;
    }
  } catch {
    // TODO: Replace with structured logging (e.g., Sentry)
    // Silently fall through to device locale detection
  }

  // Fallback to device locale
  const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? "en";
  return deviceLanguage === "ar" ? "ar" : "en";
}

/**
 * Initialize i18next with configuration and detected language.
 *
 * This must be called before rendering the app. Call this in _layout.tsx
 * before the root component renders.
 */
export async function initI18n(): Promise<void> {
  const language = await detectInitialLanguage();

  await i18next.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: "en",
    compatibilityJSON: "v3", // Use i18next v4 format
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense (we await initI18n before rendering)
    },
  });
}

/**
 * Export i18next instance for direct access (e.g., language change, event listeners).
 * Most components should use useTranslation() hook instead.
 */
export default i18next;
