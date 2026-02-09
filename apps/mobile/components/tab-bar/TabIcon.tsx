import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

export type IconLibrary = "ionicons" | "material" | "material-community";

export interface IconConfig {
  library: IconLibrary;
  name: string;
  outlineName?: string;
}

interface TabIconProps {
  config: IconConfig;
  focused: boolean;
  color: string;
  size: number;
  label: string;
}

const ICON_COMPONENTS = {
  ionicons: Ionicons,
  material: MaterialIcons,
  "material-community": MaterialCommunityIcons,
};

/**
 * TabIcon - Helper component for rendering tab bar icons
 *
 * Supports multiple icon libraries (Ionicons, MaterialIcons, MaterialCommunityIcons).
 * Automatically switches between filled and outline variants based on focus state
 * when an outlineName is provided.
 */
function TabIconComponent({
  config,
  focused,
  color,
  size,
  label,
}: TabIconProps): React.ReactElement {
  const { library, name, outlineName } = config;
  const IconComponent = ICON_COMPONENTS[library];
  const iconName = focused ? name : (outlineName ?? name);

  return (
    <View
      className="items-center justify-center gap-1"
      accessibilityElementsHidden
    >
      <IconComponent name={iconName as never} size={size} color={color} />

      <Text
        className={`text-[10px] ${focused ? "font-medium" : "font-normal"}`}
        style={{ color }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export const TabIcon = React.memo(TabIconComponent);
