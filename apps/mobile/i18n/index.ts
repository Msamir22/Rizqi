import i18next, { type InitOptions, type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import { validateTranslationResources } from "./translation-schemas";

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
import enDrawer from "../locales/en/drawer.json";

import arCommon from "../locales/ar/common.json";
import arTransactions from "../locales/ar/transactions.json";
import arAccounts from "../locales/ar/accounts.json";
import arBudgets from "../locales/ar/budgets.json";
import arSettings from "../locales/ar/settings.json";
import arOnboarding from "../locales/ar/onboarding.json";
import arAuth from "../locales/ar/auth.json";
import arMetals from "../locales/ar/metals.json";
import arCategories from "../locales/ar/categories.json";
import arDrawer from "../locales/ar/drawer.json";

/**
 * Translation resources organized by language and namespace.
 *
 * This structure enables:
 * - Namespace-based translation loading (e.g., useTranslation('transactions'))
 * - Type-safe translation keys via TypeScript module augmentation
 * - Fallback to English for missing keys
 */
const resources: Resource = {
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
    drawer: enDrawer,
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
    drawer: arDrawer,
  },
};

/**
 * Detect the initial language from the device locale.
 *
 * NOTE (feature 024, 2026-04-18): the legacy AsyncStorage-backed
 * LANGUAGE_KEY is gone — language is now stored on
 * `profiles.preferred_language` in WatermelonDB and read after the initial
 * pull-sync completes. At app-launch time we can't reach the DB yet, so we
 * fall back to the device locale. Once the profile is loaded, the splash
 * coordinator in `_layout.tsx` syncs i18n to `profile.preferredLanguage`
 * before hiding the splash, so any mismatch between device locale and
 * stored preference is invisible to the user.
 */
function detectInitialLanguage(): "en" | "ar" {
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
  // Runtime contract check — fail loud on translation drift before i18next
  // silently falls back to English for missing keys.
  validateTranslationResources(
    resources as { en: Record<string, unknown>; ar: Record<string, unknown> }
  );

  const language = detectInitialLanguage();

  i18next.use(initReactI18next);

  const options: InitOptions = {
    resources,
    lng: language,
    fallbackLng: "en",
    compatibilityJSON: "v4",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense (we await initI18n before rendering)
    },
  };

  await i18next.init(options);
}

/**
 * Export i18next instance for direct access (e.g., language change, event listeners).
 * Most components should use useTranslation() hook instead.
 */
export default i18next;
