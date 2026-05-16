import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
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
  primary: "bg-action dark:bg-action-dark",
  secondary: "bg-card-muted dark:bg-card-muted-dark",
  outline:
    "bg-transparent border border-border-card dark:border-border-card-dark",
  ghost: "bg-transparent",
  danger: "bg-danger dark:bg-danger-dark",
  dashed: "bg-card-muted dark:bg-card-muted-dark",
};

// Text Color for Variants
const textColors = {
  primary: "text-text-inverse dark:text-text-inverse-dark",
  secondary: "text-text-primary dark:text-text-primary-dark",
  outline: "text-text-primary dark:text-text-primary-dark",
  ghost: "text-text-secondary dark:text-text-secondary-dark",
  danger: "text-white",
  dashed: "text-text-secondary dark:text-text-secondary-dark",
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
  const buttonShadow =
    variant === "primary" && !isDisabled
      ? {
          shadowColor: palette.brandGreen[700],
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 2,
        }
      : null;
  const disabledStyle = isDisabled ? { opacity: 0.5 } : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[buttonShadow, disabledStyle, style]}
      className={`flex-row items-center justify-center ${variant === "dashed" ? "rounded-2xl border-2 border-dashed border-border-card dark:border-border-card-dark" : "rounded-full"} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <ActivityIndicator
            size="small"
            color={
              variant === "primary" || variant === "danger"
                ? palette.paper[25]
                : isDark
                  ? palette.paper[300]
                  : palette.slate[500]
            }
            style={title ? { marginEnd: 8 } : undefined}
          />
          {title ? (
            <Text
              className={`${textColors[variant]} ${fontSizes[size]} font-bold ${textClassName}`}
            >
              {title}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={size === "sm" ? 16 : 20}
              color={
                variant === "primary" || variant === "danger"
                  ? palette.paper[25]
                  : isDark
                    ? palette.paper[300]
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
                  ? palette.paper[25]
                  : isDark
                    ? palette.paper[300]
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
