/**
 * Email/Password Authentication Form
 *
 * Renders the email + password input form with sign-in/sign-up mode toggle.
 * Handles client-side validation before delegating to the parent handler.
 *
 * Architecture & Design Rationale:
 * - Pattern: Controlled Component (Constitution III)
 * - Why: Parent (AuthScreen) owns the auth flow; this component only
 *   handles form state and validation. onSubmit delegates to parent.
 *   This component only renders the form and reflects state.
 * - SOLID: SRP — form rendering only. OCP — new fields can be added
 *   without modifying existing validation logic.
 *
 * @module EmailPasswordForm
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";

// =============================================================================
// Types
// =============================================================================

type AuthMode = "signIn" | "signUp";

interface EmailPasswordFormProps {
  /** Called when the user submits the form. */
  readonly onSubmit: (
    email: string,
    password: string,
    mode: AuthMode
  ) => Promise<void>;
  /** Called when the user taps "Forgot Password?". */
  readonly onForgotPassword: (email: string) => void;
  /** Whether the form is currently submitting. */
  readonly isLoading: boolean;
  /** Error message to display below the form. */
  readonly errorMessage: string | null;
  /** Called when user interacts with the form to clear any server-side error. */
  readonly onClearError?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const MIN_PASSWORD_LENGTH = 6;

// =============================================================================
// Component
// =============================================================================

export function EmailPasswordForm({
  onSubmit,
  onForgotPassword,
  isLoading,
  errorMessage,
  onClearError,
}: EmailPasswordFormProps): React.JSX.Element {
  const { isDark } = useTheme();
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = errorMessage ?? localError;

  const clearErrors = (): void => {
    setLocalError(null);
    onClearError?.();
  };

  const validateAndSubmit = async (): Promise<void> => {
    clearErrors();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setLocalError(t("validation_email_required"));
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setLocalError(t("validation_email_invalid"));
      return;
    }

    if (!password) {
      setLocalError(t("validation_password_required"));
      return;
    }

    if (mode === "signUp" && password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(t("validation_password_min", { min: MIN_PASSWORD_LENGTH }));
      return;
    }

    await onSubmit(trimmedEmail, password, mode);
  };

  const toggleMode = (): void => {
    setMode((prev) => (prev === "signIn" ? "signUp" : "signIn"));
    clearErrors();
  };

  const handleForgotPassword = (): void => {
    onForgotPassword(email.trim());
  };

  const inputTextColor = isDark ? palette.slate[50] : palette.slate[900];
  const placeholderColor = isDark ? palette.slate[400] : palette.slate[500];

  return (
    <View className="gap-4 w-full">
      {/* Divider */}
      <View className="flex-row items-center gap-3 my-2">
        <View className="flex-1 h-px bg-slate-300 dark:bg-slate-600" />
        <Text className="text-sm text-slate-400 dark:text-slate-500">
          {t("or_continue_with_email")}
        </Text>
        <View className="flex-1 h-px bg-slate-300 dark:bg-slate-600" />
      </View>

      {/* Email Input */}
      <View>
        <TextInput
          className="py-4 px-4 rounded-2xl border text-base bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600"
          placeholder={t("email_address_placeholder")}
          placeholderTextColor={placeholderColor}
          style={{ color: inputTextColor }}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            clearErrors();
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          editable={!isLoading}
          accessibilityLabel="Email address"
          accessibilityHint="Enter your email address"
        />
      </View>

      {/* Password Input */}
      <View className="relative">
        <TextInput
          className="py-4 px-4 pe-14 rounded-2xl border text-base bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600"
          placeholder={t("password_placeholder_label")}
          placeholderTextColor={placeholderColor}
          style={{ color: inputTextColor }}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            clearErrors();
          }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={mode === "signUp" ? "newPassword" : "password"}
          editable={!isLoading}
          accessibilityLabel="Password"
          accessibilityHint="Enter your password"
        />
        <TouchableOpacity
          onPress={() => setShowPassword((prev) => !prev)}
          className="absolute end-4 top-4"
          accessibilityLabel={
            showPassword ? t("hide_password") : t("show_password")
          }
          accessibilityRole="button"
        >
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={22}
            color={placeholderColor}
          />
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {displayError ? (
        <Text className="text-red-400 text-sm px-1" accessibilityRole="alert">
          {displayError}
        </Text>
      ) : null}

      {/* Forgot Password (Sign In mode only) */}
      {mode === "signIn" ? (
        <TouchableOpacity
          onPress={handleForgotPassword}
          disabled={isLoading}
          className="self-end"
          accessibilityLabel="Forgot password"
          accessibilityRole="link"
        >
          <Text className="text-sm text-nileGreen-400 font-medium">
            {t("forgot_password")}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Submit Button */}
      <TouchableOpacity
        onPress={() => {
          // Errors are handled internally via setLocalError; catch prevents unhandled rejection
          validateAndSubmit().catch(() => {});
        }}
        disabled={isLoading}
        className="py-4 px-6 rounded-2xl bg-nileGreen-500 items-center justify-center"
        activeOpacity={0.8}
        style={{ opacity: isLoading ? 0.6 : 1 }}
        accessibilityLabel={mode === "signIn" ? "Sign in" : "Create account"}
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={palette.slate[25]} />
        ) : (
          <Text className="text-base font-semibold text-white">
            {mode === "signIn" ? t("sign_in") : t("create_account")}
          </Text>
        )}
      </TouchableOpacity>

      {/* Mode Toggle */}
      <View className="flex-row justify-center items-center gap-1 mt-2">
        <Text className="text-sm text-slate-400 dark:text-slate-500">
          {mode === "signIn"
            ? t("dont_have_account")
            : t("already_have_account")}
        </Text>
        <TouchableOpacity
          onPress={toggleMode}
          disabled={isLoading}
          accessibilityLabel={
            mode === "signIn" ? "Switch to sign up" : "Switch to sign in"
          }
          accessibilityRole="button"
        >
          <Text className="text-sm font-semibold text-nileGreen-400">
            {mode === "signIn" ? t("sign_up") : t("sign_in")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Basic email validation — checks for presence of @ and a dot in domain.
 * Not exhaustive, as server-side validation will catch edge cases.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export type { AuthMode };
