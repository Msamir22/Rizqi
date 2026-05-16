import React from "react";
import { View, type ViewProps } from "react-native";

interface AppCardProps extends ViewProps {
  readonly children: React.ReactNode;
  readonly elevated?: boolean;
}

export function AppCard({
  children,
  className = "",
  elevated = false,
  ...props
}: AppCardProps): React.JSX.Element {
  return (
    <View
      className={`rounded-2xl border border-border-card bg-card dark:bg-card-dark ${elevated ? "bg-card dark:bg-card-dark" : ""} ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
