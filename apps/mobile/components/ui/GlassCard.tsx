import React from "react";
import { View, type ViewProps } from "react-native";

interface GlassCardProps extends ViewProps {
  readonly children: React.ReactNode;
}

export function GlassCard({
  children,
  className = "",
  ...props
}: GlassCardProps): React.JSX.Element {
  return (
    <View
      className={`rounded-2xl border border-border-glass bg-glass dark:bg-glass-dark ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
