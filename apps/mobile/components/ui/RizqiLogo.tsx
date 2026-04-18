import React from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";

interface RizqiLogoProps {
  width: number;
  height: number;
}

/**
 * Rizqi Wordmark
 *
 * Renders the brand wordmark. Picks:
 * - Language (en ↔ ar): "RIZQI" in Inter Bold, or "رزقــي" in Readex Pro Bold
 * - Theme (dark ↔ light): white text on dark, brand-green on light
 *
 * Arabic uses a TATWEEL (ـ, U+0640) between ق and ي to extend the letter
 * connection — the Unicode-correct way to stretch the word without breaking
 * letter joins.
 *
 * Implementation note: we render <Text> directly (no wrapping View with a
 * fixed height). Android clips deep Arabic descenders (the two dots under ي)
 * when the Text sits inside a fixed-height View, regardless of overflow:visible.
 * Letting the Text size itself to its natural vertical extent keeps the
 * descenders visible, while `width` still pins horizontal sizing.
 *
 * Usage:
 * <RizqiLogo width={100} height={25} />
 */
export function RizqiLogo({
  width,
  height,
}: RizqiLogoProps): React.ReactElement {
  const { isDark } = useTheme();
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");

  const color = isDark ? "#f5f5f7" : "#155e46";
  const fontFamily = isArabic ? "ReadexPro_700Bold" : "Inter_700Bold";
  const text = isArabic ? "رزقــــي" : "RIZQI";
  const fontSize = Math.round(height * (isArabic ? 0.85 : 0.85));
  const letterSpacing = isArabic ? 0 : 3;

  return (
    <Text
      style={{
        width,
        color,
        fontSize,
        fontFamily,
        letterSpacing,
        // Let Android's natural font metrics handle descender space for Arabic.
        // Stripping the padding (as we do for Latin) would clip the two dots
        // under ي and the tail of ق.
        includeFontPadding: isArabic,
        // Align to the start (left in LTR, right in RTL) so the wordmark sits
        // next to the hamburger menu regardless of writing direction.
        textAlign: "left",
      }}
    >
      {text}
    </Text>
  );
}
