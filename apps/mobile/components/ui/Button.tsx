import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "dashed";

export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  textClassName?: string;
}

// Variant Styles
const variants = {
  primary: "bg-nileGreen-600",
  secondary: "bg-slate-100 dark:bg-slate-800",
  outline: "bg-transparent border border-slate-200 dark:border-slate-700",
  ghost: "bg-transparent",
  danger: "bg-red-500 dark:bg-red-600",
  dashed: "bg-slate-50 dark:bg-slate-800/40",
};

// Text Color for Variants
const textColors = {
  primary: "text-white",
  secondary: "text-slate-800 dark:text-slate-100",
  outline: "text-slate-700 dark:text-slate-200",
  ghost: "text-slate-600 dark:text-slate-400",
  danger: "text-white",
  dashed: "text-slate-500 dark:text-slate-400",
};

// Size Styles
const sizes = {
  sm: "py-2 px-4",
  md: "py-3.5 px-8",
  lg: "py-4 px-10",
};

// Font Size for Sizes
const fontSizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  className = "",
  textClassName = "",
  onPress,
  children,
  style,
  ...props
}: ButtonProps): ReactNode {
  const { isDark } = useTheme();

  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[variant === "primary" && !isDisabled && styles.shadow, style]}
      className={`flex-row items-center justify-center ${variant === "dashed" ? "rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700" : "rounded-full"} ${variants[variant]} ${sizes[size]} ${isDisabled ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary" || variant === "danger"
              ? "#FFFFFF"
              : isDark
                ? palette.slate[400]
                : palette.slate[500]
          }
        />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={size === "sm" ? 16 : 20}
              color={
                variant === "primary" || variant === "danger"
                  ? "#FFFFFF"
                  : isDark
                    ? palette.slate[300]
                    : palette.slate[700]
              }
              style={{ marginEnd: 8 }}
            />
          )}

          {title ? (
            <Text
              className={`${textColors[variant]} ${fontSizes[size]} font-bold ${textClassName}`}
            >
              {title}
            </Text>
          ) : (
            children
          )}

          {icon && iconPosition === "right" && (
            <Ionicons
              name={icon}
              size={size === "sm" ? 16 : 20}
              color={
                variant === "primary" || variant === "danger"
                  ? "#FFFFFF"
                  : isDark
                    ? palette.slate[300]
                    : palette.slate[700]
              }
              style={{ marginStart: 8 }}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shadow: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
