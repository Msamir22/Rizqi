/**
 * Email/Password Authentication Form
 *
 * Renders an email/password form with:
 * - Email input with basic validation
 * - Password input with show/hide toggle
 * - Mode toggle (Sign Up / Sign In)
 * - Submit button with loading state
 * - "Forgot Password?" link (Sign In mode only)
 * - Inline error messages
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component (no business logic)
 * - Why: All auth orchestration lives in the parent screen (auth.tsx).
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
}: EmailPasswordFormProps): React.JSX.Element {
  const { isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = errorMessage ?? localError;

  const validateAndSubmit = async (): Promise<void> => {
    setLocalError(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setLocalError("Please enter your email address.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setLocalError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }

    if (mode === "signUp" && password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    await onSubmit(trimmedEmail, password, mode);
  };

  const toggleMode = (): void => {
    setMode((prev) => (prev === "signIn" ? "signUp" : "signIn"));
    setLocalError(null);
  };

  const handleForgotPassword = (): void => {
    onForgotPassword(email.trim());
  };

  const inputTextColor = isDark ? palette.slate[50] : palette.slate[900];
  const inputBgClass = isDark
    ? "bg-slate-800 border-slate-600"
    : "bg-white border-slate-200";
  const placeholderColor = isDark ? palette.slate[400] : palette.slate[500];

  return (
    <View className="gap-4 w-full">
      {/* Divider */}
      <View className="flex-row items-center gap-3 my-2">
        <View className="flex-1 h-px bg-slate-300 dark:bg-slate-600" />
        <Text className="text-sm text-slate-400 dark:text-slate-500">
          or continue with email
        </Text>
        <View className="flex-1 h-px bg-slate-300 dark:bg-slate-600" />
      </View>

      {/* Email Input */}
      <View>
        <TextInput
          className={`py-4 px-4 rounded-2xl border text-base ${inputBgClass}`}
          placeholder="Email address"
          placeholderTextColor={placeholderColor}
          style={{ color: inputTextColor }}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setLocalError(null);
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
          className={`py-4 px-4 pr-14 rounded-2xl border text-base ${inputBgClass}`}
          placeholder="Password"
          placeholderTextColor={placeholderColor}
          style={{ color: inputTextColor }}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setLocalError(null);
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
          className="absolute right-4 top-4"
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
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
            Forgot Password?
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Submit Button */}
      <TouchableOpacity
        onPress={() => {
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
            {mode === "signIn" ? "Sign In" : "Create Account"}
          </Text>
        )}
      </TouchableOpacity>

      {/* Mode Toggle */}
      <View className="flex-row justify-center items-center gap-1 mt-2">
        <Text className="text-sm text-slate-400 dark:text-slate-500">
          {mode === "signIn"
            ? "Don't have an account?"
            : "Already have an account?"}
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
            {mode === "signIn" ? "Sign Up" : "Sign In"}
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
