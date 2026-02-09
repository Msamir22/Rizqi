import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";

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
  ...props
}: TextFieldProps) {
  const { isDark } = useTheme();

  return (
    <View style={containerStyle}>
      <Text className="input-label">{label}</Text>
      <TextInput
        placeholderTextColor={isDark ? palette.slate[500] : palette.slate[400]}
        className={`input-field ${
          error ? "border-red-500" : ""
        } ${className || ""}`}
        {...props}
      />
      {error && <Text className="mt-1 px-1 text-xs text-red-500">{error}</Text>}
    </View>
  );
}
