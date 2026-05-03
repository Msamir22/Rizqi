import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "../../constants/colors";
import { useTheme } from "../../context/ThemeContext";
import {
  MONYVI_LOGO_ACCENT_PATH,
  MONYVI_LOGO_MAIN_PATH,
  MONYVI_LOGO_VIEW_BOX,
} from "./monyvi-logo-paths";

interface MonyviLogoProps {
  width: number;
  height: number;
}

export function MonyviLogo({
  width,
  height,
}: MonyviLogoProps): React.ReactElement {
  const { isDark } = useTheme();
  const mainFill = isDark ? palette.nileGreen[50] : palette.slate[800];

  return (
    <Svg
      accessibilityLabel="Monyvi"
      accessibilityRole="image"
      height={height}
      viewBox={MONYVI_LOGO_VIEW_BOX}
      width={width}
    >
      <Path d={MONYVI_LOGO_MAIN_PATH} fill={mainFill} fillRule="evenodd" />
      <Path
        d={MONYVI_LOGO_ACCENT_PATH}
        fill={palette.nileGreen[500]}
        fillRule="evenodd"
      />
    </Svg>
  );
}
