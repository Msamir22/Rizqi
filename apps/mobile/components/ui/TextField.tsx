import { useCallback, useEffect, useRef, useState } from "react";
import { Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { palette } from "@/constants/colors";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function TextField({
  label,
  error,
  containerStyle,
  className,
  value,
  onChangeText,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps): React.JSX.Element {
  const externalValue = value ?? "";
  const [draftValue, setDraftValue] = useState(externalValue);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraftValue(externalValue);
    }
  }, [externalValue]);

  const handleChangeText = useCallback(
    (text: string): void => {
      setDraftValue(text);
      onChangeText?.(text);
    },
    [onChangeText]
  );

  const handleFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
    (event) => {
      isFocusedRef.current = true;
      onFocus?.(event);
    },
    [onFocus]
  );

  const handleBlur = useCallback<NonNullable<TextInputProps["onBlur"]>>(
    (event) => {
      isFocusedRef.current = false;
      onBlur?.(event);
    },
    [onBlur]
  );

  return (
    <View style={containerStyle} className="mb-4">
      <Text className="input-label">{label}</Text>
      <TextInput
        placeholderTextColor={palette.slate[400]}
        className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border ${
          error ? "border-red-500" : "border-slate-200 dark:border-slate-700"
        } text-base font-semibold text-slate-900 dark:text-white ${className || ""}`}
        {...props}
        value={draftValue}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {error && <Text className="input-error">{error}</Text>}
    </View>
  );
}
