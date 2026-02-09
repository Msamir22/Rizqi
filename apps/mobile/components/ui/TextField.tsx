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
      <Text className="text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2 px-1 uppercase tracking-widest">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={palette.slate[400]}
        className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border ${
          error ? "border-red-500" : "border-slate-200 dark:border-slate-700"
        } text-base font-semibold text-slate-900 dark:text-white ${className || ""}`}
        {...props}
      />
      {error && (
        <Text className="mt-1.5 px-2 text-xs font-bold text-red-500">
          {error}
        </Text>
      )}
    </View>
  );
}
