import { Account, AccountType } from "@astik/db";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { palette } from "@/constants/colors";
import { EmptyStateCard } from "../ui/EmptyStateCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================================
// Constants
// =============================================================================

const CARD_GAP = 10;
const CARD_HEIGHT = 100;
const CARD_BORDER_RADIUS = 16;
const ICON_CONTAINER_SIZE = 32;

// =============================================================================
// Types
// =============================================================================

interface AccountsSectionProps {
  accounts: Account[];
  isLoading: boolean;
}

interface AccountCardData {
  id: string;
  name: string;
  balance: string;
  type: AccountType;
  gradient: readonly [string, string];
  iconName: string;
}

interface AccountCardProps {
  data: AccountCardData;
  width: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getAccountTypeConfig(type: AccountType): {
  gradient: readonly [string, string];
  iconName: string;
} {
  switch (type) {
    case "BANK":
      return {
        gradient: [palette.blue[600], palette.blue[900]] as const,
        iconName: "university",
      };
    case "DIGITAL_WALLET":
      return {
        gradient: [palette.violet[700], palette.violet[800]] as const,
        iconName: "mobile-alt",
      };
    case "CASH":
    default:
      return {
        gradient: [palette.nileGreen[600], palette.nileGreen[800]] as const,
        iconName: "money-bill-wave",
      };
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

function AccountCard({ data, width }: AccountCardProps): React.JSX.Element {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/edit-account?id=${data.id}`)}
      style={{ width }}
    >
      <LinearGradient
        colors={data.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width,
          height: CARD_HEIGHT,
          borderRadius: CARD_BORDER_RADIUS,
        }}
        className="p-3 justify-between border border-white/10"
      >
        {/* Icon Container */}
        <View
          style={{
            width: ICON_CONTAINER_SIZE,
            height: ICON_CONTAINER_SIZE,
            borderRadius: ICON_CONTAINER_SIZE / 2,
          }}
          className="bg-white/20 items-center justify-center"
        >
          <FontAwesome5 name={data.iconName} size={14} color="#FFFFFF" />
        </View>

        {/* Account Name */}
        <Text
          className="text-[11px] font-medium text-white/70 mt-1"
          numberOfLines={1}
        >
          {data.name}
        </Text>

        {/* Balance */}
        <Text className="text-sm font-bold text-white" numberOfLines={1}>
          {data.balance}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View
      style={{ height: CARD_HEIGHT }}
      className="items-center justify-center"
    >
      <ActivityIndicator size="small" color={palette.nileGreen[500]} />
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AccountsSection({
  accounts,
  isLoading,
}: AccountsSectionProps): React.JSX.Element {
  const { t } = useTranslation("accounts");
  const { t: tc } = useTranslation("common");

  // Transform accounts to card data (top 3)
  const cardData: AccountCardData[] = useMemo(() => {
    return accounts.slice(0, 3).map((account) => {
      const config = getAccountTypeConfig(account.type);
      return {
        id: account.id,
        name: account.name,
        balance: account.formattedBalance,
        type: account.type,
        gradient: config.gradient,
        iconName: config.iconName,
      };
    });
  }, [accounts]);

  const handleSeeAll = (): void => {
    router.push("/accounts");
  };

  return (
    <View className="my-3">
      {/* Header Row */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-slate-800 dark:text-slate-50">
          {tc("accounts")}
        </Text>
        <TouchableOpacity
          onPress={handleSeeAll}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="flex-row items-center"
        >
          <Text className="text-sm font-semibold text-nileGreen-500">
            {tc("see_all")}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={palette.nileGreen[500]}
            className="ms-1"
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <LoadingState />
      ) : cardData.length === 0 ? (
        <EmptyStateCard
          onPress={() => router.push("/add-account")}
          icon="wallet-outline"
          title={t("no_accounts_title")}
          description={tc("tap_to_add")}
          height={CARD_HEIGHT}
          borderRadius={CARD_BORDER_RADIUS}
        />
      ) : (
        <View className="flex-row" style={{ gap: CARD_GAP }}>
          {cardData.map((card) => {
            const count = cardData.length;
            const width = (SCREEN_WIDTH - 40 - CARD_GAP * (count - 1)) / count;

            return <AccountCard key={card.id} data={card} width={width} />;
          })}
        </View>
      )}
    </View>
  );
}
