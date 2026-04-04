import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { I18nManager } from "react-native";
import i18n from "../i18n";
import { getLocaleFontFamily } from "../constants/typography";

/**
 * Supported languages in the app
 */
export type SupportedLanguage = "en" | "ar";

/**
 * Locale context state
 */
interface LocaleContextType {
  /** Current language code */
  language: SupportedLanguage;
  /** Whether the app is in RTL mode */
  isRTL: boolean;
  /** Locale-appropriate font family based on current language */
  fontFamily: Readonly<{
    regular: string;
    medium: string;
    semiBold: string;
    bold: string;
  }>;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

/**
 * Helper to get current language from i18n instance
 */
function getCurrentI18nLanguage(): SupportedLanguage {
  const instance = i18n as unknown as { language: string };
  const lang = instance.language;
  return lang === "ar" ? "ar" : "en";
}

/**
 * LocaleProvider component that provides locale information to the app.
 *
 * This context exposes the current language, RTL state, and locale-appropriate
 * font family. It reads from the i18next instance and I18nManager to ensure
 * consistency across the app.
 */
export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentLanguage, setCurrentLanguage] = useState<"en" | "ar">(() =>
    getCurrentI18nLanguage()
  );

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (): void => {
      setCurrentLanguage(getCurrentI18nLanguage());
    };

    // i18next doesn't have a built-in event for language changes,
    // so we use a polling approach or manual updates
    const interval = setInterval(handleLanguageChange, 1000);
    return () => clearInterval(interval);
  }, []);

  const value = useMemo<LocaleContextType>(
    () => ({
      language: currentLanguage,
      isRTL: I18nManager.isRTL,
      fontFamily: getLocaleFontFamily(),
    }),
    [currentLanguage]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
};

/**
 * Custom hook to use the locale context.
 *
 * Provides access to:
 * - `language`: Current language code ("en" or "ar")
 * - `isRTL`: Whether the app is in RTL mode
 * - `fontFamily`: Locale-appropriate font family for inline styles
 *
 * @example
 * ```tsx
 * const { language, isRTL, fontFamily } = useLocale();
 *
 * // Use in inline styles (not NativeWind className)
 * <Text style={{ fontFamily: fontFamily.bold }}>Title</Text>
 *
 * // Check RTL for conditional logic
 * if (isRTL) {
 *   // Apply RTL-specific logic
 * }
 * ```
 */
export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
