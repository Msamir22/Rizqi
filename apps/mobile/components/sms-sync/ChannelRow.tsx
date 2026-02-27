/**
 * ChannelRow
 *
 * A single payment channel → account mapping row for the SMS setup wizard.
 * Displays channel name with a dropdown to assign it to an account.
 *
 * @module ChannelRow
 */

import { Dropdown } from "@/components/ui/Dropdown";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, View } from "react-native";
import type { ChannelMapping } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelRowProps {
  readonly channel: ChannelMapping;
  readonly accountOptions: ReadonlyArray<{ value: string; label: string }>;
  readonly onUpdate: (accountKey: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChannelRow({
  channel,
  accountOptions,
  onUpdate,
}: ChannelRowProps): React.JSX.Element {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View className="mx-4 mb-3 flex-row items-center gap-2">
      <Text className="text-sm font-bold text-slate-600 dark:text-slate-300 w-24">
        {channel.displayName}
      </Text>
      <Ionicons
        name="arrow-forward"
        size={16}
        color={isDark ? palette.slate[400] : palette.slate[500]}
      />
      <View className="flex-1">
        <Dropdown
          label=""
          items={accountOptions as Array<{ value: string; label: string }>}
          value={channel.assignedAccountKey ?? ""}
          onChange={onUpdate}
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
          placeholder="Assign to..."
        />
      </View>
    </View>
  );
}
