/**
 * SectionHeader — Reusable header row for dashboard sections.
 *
 * Displays a title on the left and an optional "See All" action on the right.
 * Extracted from AccountsSection, UpcomingPayments, and RecentTransactions
 * to eliminate duplicated header markup (DRY — E1).
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { palette } from "@/constants/colors";

interface SectionHeaderProps {
  /** Section title text */
  title: string;
  /** Callback when "See All" is pressed. If omitted, the action is hidden. */
  onSeeAll?: () => void;
  /** Override the default "See All" label */
  seeAllLabel?: string;
  /** Whether to show the forward arrow icon next to the label. Default: true */
  showArrow?: boolean;
}

/**
 * Renders a section header row with a bold title and an optional "See All" action.
 *
 * @example
 * <SectionHeader title={t("accounts")} onSeeAll={() => router.push('/accounts')} />
 */
function SectionHeaderComponent({
  title,
  onSeeAll,
  seeAllLabel,
  showArrow = true,
}: SectionHeaderProps): React.ReactElement {
  const { t } = useTranslation("common");

  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-lg font-bold text-slate-800 dark:text-slate-50">
        {title}
      </Text>
      {onSeeAll && (
        <TouchableOpacity
          onPress={onSeeAll}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="flex-row items-center"
        >
          <Text className="text-sm font-semibold text-nileGreen-500">
            {seeAllLabel ?? t("see_all")}
          </Text>
          {showArrow && (
            <Ionicons
              name="arrow-forward"
              size={14}
              color={palette.nileGreen[500]}
              className="ms-1"
            />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export const SectionHeader = React.memo(SectionHeaderComponent);
