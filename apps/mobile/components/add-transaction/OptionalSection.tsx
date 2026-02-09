import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Keyboard,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// Will use DatePicker modal later, simplified for now
import DateTimePicker from "@react-native-community/datetimepicker";
import { TextField } from "../ui/TextField";

interface OptionalFields {
  merchant?: string;
  note?: string;
  date: Date;
  isRecurring: boolean;
  recurringName?: string;
  recurringFrequency?: string;
  recurringAutoCreate?: boolean;
}

interface OptionalSectionProps {
  fields: OptionalFields;
  onChange: (fields: Partial<OptionalFields>) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function OptionalSection({
  fields,
  onChange,
  expanded,
  onToggleExpand,
}: OptionalSectionProps) {
  const { isDark } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);

  if (!expanded) {
    return (
      <TouchableOpacity
        onPress={onToggleExpand}
        className="flex-row items-center justify-center py-4"
      >
        <Ionicons
          name="create-outline"
          size={18}
          color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
        />
        <Text className="ml-2 text-sm font-semibold text-nileGreen-600 dark:text-nileGreen-400">
          Add more details
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4 pb-8">
      <TouchableOpacity
        onPress={onToggleExpand}
        className="flex-row items-center justify-center mb-6"
      >
        <Text className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          Hide Details
        </Text>
        <Ionicons
          name="chevron-up"
          size={14}
          color={isDark ? "#94A3B8" : "#94A3B8"}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      <View className="gap-5">
        {/* Merchant */}
        <TextField
          label="MERCHANT / PAYEE"
          placeholder="e.g. Starbucks, Carrefour"
          value={fields.merchant}
          onChangeText={(t) => onChange({ merchant: t })}
        />

        {/* Note */}
        <TextField
          label="NOTE"
          placeholder="Add a note..."
          value={fields.note}
          onChangeText={(t) => onChange({ note: t })}
          multiline
          numberOfLines={2}
          style={{ textAlignVertical: "top" }}
        />

        {/* Date */}
        <View>
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-1">
            DATE
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={isDark ? "#A0AEC0" : "#64748B"}
              style={{ marginRight: 10 }}
            />
            <Text className="text-base font-medium text-slate-900 dark:text-white">
              {fields.date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={fields.date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  onChange({ date: selectedDate });
                }
              }}
            />
          )}
        </View>

        {/* Recurring Toggle */}
        <View className="flex-row items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center mr-3">
              <Ionicons name="repeat" size={16} color={palette.orange[500]} />
            </View>
            <View>
              <Text className="text-base font-semibold text-slate-900 dark:text-white">
                Recurring Payment
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                {fields.isRecurring ? "Enabled" : "Disabled"}
              </Text>
            </View>
          </View>
          <Switch
            value={fields.isRecurring}
            onValueChange={(v) => onChange({ isRecurring: v })}
            trackColor={{ false: "#E2E8F0", true: palette.nileGreen[500] }}
            thumbColor={"#FFF"}
          />
        </View>

        {/* Recurring Details (Only if enabled) */}
        {fields.isRecurring && (
          <View className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 gap-4">
            {/* Recurring logic will be implemented here later or simply show basic name/frequency for now as placeholders */}
            <TextField
              label="NAME"
              placeholder="Recurring Name"
              value={fields.recurringName}
              onChangeText={(t) => onChange({ recurringName: t })}
            />

            <View>
              {/* Auto-create Toggle */}
              <View className="flex-row items-center ml-1 justify-between mt-2">
                <View className="flex-1 mr-4">
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white">
                    Auto-create transaction
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {fields.recurringAutoCreate
                      ? "Transaction will be created automatically on due date"
                      : "You will receive a reminder notification only"}
                  </Text>
                </View>
                <Switch
                  value={fields.recurringAutoCreate}
                  onValueChange={(v) => onChange({ recurringAutoCreate: v })}
                  trackColor={{ false: "#E2E8F0", true: palette.blue[500] }}
                  thumbColor={"#FFF"}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
