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
  ...props
}: TextFieldProps): React.JSX.Element {
  return (
    <View style={containerStyle} className="mb-1">
      <Text className="input-label">{label}</Text>
      <TextInput
        placeholderTextColor={palette.slate[400]}
        className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border ${
          error ? "border-red-500" : "border-slate-200 dark:border-slate-700"
        } text-base font-semibold text-slate-900 dark:text-white ${className || ""}`}
        {...props}
      />
      {error && <Text className="input-error">{error}</Text>}
    </View>
  );
}
