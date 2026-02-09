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

// interface TabIconProps {
//   config: IconConfig;
//   focused: boolean;
//   color: string;
//   size: number;
//   label: string;
// }

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
import { cssInterop } from "react-native-css-interop";

cssInterop(Ionicons, {
  className: {
    target: "style",
    nativeStyleToProp: { color: true },
  },
});
cssInterop(MaterialIcons, {
  className: {
    target: "style",
    nativeStyleToProp: { color: true },
  },
});
cssInterop(MaterialCommunityIcons, {
  className: {
    target: "style",
    nativeStyleToProp: { color: true },
  },
});

function TabIconComponent({
  config,
  focused,
  size,
  label,
}: {
  config: IconConfig;
  focused: boolean;
  size: number;
  label: string;
}): React.ReactElement {
  const { library, name, outlineName } = config;
  const IconComponent = ICON_COMPONENTS[library] || Ionicons;
  const iconName = focused ? name : (outlineName ?? name);

  return (
    <View
      className="items-center justify-center gap-1"
      accessibilityElementsHidden
    >
      <IconComponent
        name={iconName}
        size={size}
        className={
          focused ? "text-nileGreen-500" : "text-slate-500 dark:text-slate-400"
        }
      />

      <Text
        className={`text-[10px] ${focused ? "font-bold text-nileGreen-500" : "font-medium text-slate-500 dark:text-slate-400"}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export const TabIcon = React.memo(TabIconComponent);
