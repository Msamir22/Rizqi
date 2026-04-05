import { TextStyle, I18nManager } from "react-native";

/**
 * Inter Font Family Configuration (using @expo-google-fonts/inter)
 *
 * Usage:
 * - fontFamily.regular: Body text, descriptions
 * - fontFamily.medium: Emphasized text, buttons, amounts
 * - fontFamily.semiBold: Subheadings, labels
 * - fontFamily.bold: Headings, important values, user names
 */
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

/**
 * Noto Sans Arabic Font Family Configuration (using @expo-google-fonts/noto-sans-arabic)
 *
 * Usage: Same weight categories as Inter, but for Arabic text
 */
export const arabicFontFamily = {
  regular: "NotoSansArabic_400Regular",
  medium: "NotoSansArabic_500Medium",
  semiBold: "NotoSansArabic_600SemiBold",
  bold: "NotoSansArabic_700Bold",
} as const;

/**
 * Shared font family shape for locale-specific font selection.
 */
export interface FontFamily {
  readonly regular: string;
  readonly medium: string;
  readonly semiBold: string;
  readonly bold: string;
}

/**
 * Get locale-appropriate font family based on current RTL state.
 *
 * This function automatically returns the correct font family (Inter for LTR,
 * Noto Sans Arabic for RTL) based on the current I18nManager state.
 *
 * @returns Font family object for the current locale
 */
export function getLocaleFontFamily(): FontFamily {
  return I18nManager.isRTL ? arabicFontFamily : fontFamily;
}

/**
 * Font Weights mapped to Inter font family names
 * Use these when you need to specify fontFamily based on weight
 */
export const fontWeightToFamily: Record<string, string> = {
  "400": fontFamily.regular,
  "500": fontFamily.medium,
  "600": fontFamily.semiBold,
  "700": fontFamily.bold,
  normal: fontFamily.regular,
  bold: fontFamily.bold,
};

/**
 * Predefined Text Styles
 * Use these for consistent typography across the app
 */
export const textStyles: Record<string, TextStyle> = {
  // Headings
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
  },

  h2: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
  },

  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },

  h4: {
    fontFamily: fontFamily.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },

  // Body text
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
  },

  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
  },

  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  // Labels
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
  },

  labelSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
  },

  // Captions
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },

  captionSmall: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    lineHeight: 14,
  },

  // Special styles
  amount: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
  },

  amountLarge: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 40,
  },

  button: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    lineHeight: 20,
  },

  // Brand
  logo: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 24,
  },
} as const;
