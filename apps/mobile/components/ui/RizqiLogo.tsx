import React from "react";
import RizqiDarkLogoSvg from "../../assets/rizqi-dark-logo.svg";
import RizqiLightLogoSvg from "../../assets/rizqi-light-logo.svg";
import { useTheme } from "../../context/ThemeContext";

interface RizqiLogoProps {
  width: number;
  height: number;
}

/**
 * Rizqi Logo Component
 *
 * Renders the Rizqi wordmark using imported SVG files (viewBox-cropped to text only).
 * Switches between white-text (dark mode) and dark-text (light mode) versions.
 *
 * Usage:
 * <RizqiLogo width={80} height={25} />
 */
export function RizqiLogo({
  width,
  height,
}: RizqiLogoProps): React.ReactElement {
  const { isDark } = useTheme();

  if (isDark) {
    return <RizqiDarkLogoSvg width={width} height={height} />;
  }

  return <RizqiLightLogoSvg width={width} height={height} />;
}
