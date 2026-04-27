import { palette } from "@/constants/colors";
import { Account, MarketRate } from "@rizqi/db";
import { convertCurrency, formatCurrency } from "@rizqi/logic";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface AccountCardProps {
  account: Account;
  latestRates: MarketRate | null;
  onPress?: () => void;
  /**
   * Resolved display name (per `account-display.ts`). Parents that render
   * a list SHOULD compute the map once via `buildAccountDisplayNames` /
   * `useAccountDisplayNames` and pass the resolved string down to avoid
   * duplicate-name confusion (e.g. two "Cash" accounts in EGP and USD).
   * Falls back to the raw `account.name` when omitted.
   */
  displayName?: string;
}

/**
 * Render a tappable account summary card showing an icon, account name, contextual subtitle, and formatted balance.
 *
 * The subtitle shows an approximate USD value when the account currency is not USD and `latestRates` is provided; otherwise it shows a type-based label (e.g., "Bank Account", "Digital Wallet", "Physical money").
 *
 * @param account - The account to display (provides name, type, currency, balance, and formattedBalance).
 * @param latestRates - Market rates used to convert the account balance to USD for the approximate subtitle; may be null to disable conversion.
 * @param onPress - Optional press handler invoked when the card is tapped.
 * @returns A JSX element representing the account card.
 */
export function AccountCard({
  account,
  latestRates,
  onPress,
  displayName,
}: AccountCardProps): React.JSX.Element {
  const config: { icon: keyof typeof Ionicons.glyphMap; color: string } =
    useMemo(() => {
      switch (account.type) {
        case "CASH":
          return { icon: "cash", color: palette.nileGreen[500] };
        case "BANK":
          return { icon: "business", color: palette.blue[500] };
        case "DIGITAL_WALLET":
          return { icon: "phone-portrait", color: palette.violet[500] };
        default:
          return { icon: "wallet", color: palette.nileGreen[500] };
      }
    }, [account.type]);

  const subtitle = useMemo(() => {
    if (account.currency !== "USD" && latestRates) {
      const usdValue = convertCurrency(
        account.balance,
        account.currency,
        "USD",
        latestRates
      );
      return `≈ ${formatCurrency({
        amount: usdValue,
        currency: "USD",
      })}`;
    }

    switch (account.type) {
      case "BANK":
        return "Bank Account";
      case "DIGITAL_WALLET":
        return "Digital Wallet";
      case "CASH":
        return "Physical money";
      default:
        return "";
    }
  }, [account.currency, account.balance, account.type, latestRates]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mb-3 mx-5 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border-l-[4px] border-slate-100 dark:border-slate-700"
      // shadow-* classes moved to inline style to avoid NativeWind v4
      // race condition with React Navigation context (known bug)
      style={{
        borderLeftColor: config.color,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View className="flex-row items-center p-4">
        {/* Icon Container with subtle background */}
        <View
          className="w-12 h-12 rounded-2xl items-center justify-center me-4"
          style={{ backgroundColor: `${config.color}15` }}
        >
          <Ionicons name={config.icon} size={24} color={config.color} />
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="text-base font-bold text-slate-800 dark:text-white">
            {displayName ?? account.name}
          </Text>
          <Text className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">
            {subtitle}
          </Text>
        </View>

        {/* Balance Display */}
        <View className="items-end">
          <Text className="text-lg font-black text-slate-900 dark:text-white">
            {account.formattedBalance}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
