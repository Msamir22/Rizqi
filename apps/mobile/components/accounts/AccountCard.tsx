import { palette } from "@/constants/colors";
import { Account, MarketRate } from "@astik/db";
import { convertToEGP, formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface AccountCardProps {
  account: Account;
  latestRates: MarketRate | null;
  onPress?: () => void;
}

export function AccountCard({
  account,
  latestRates,
  onPress,
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
    if (account.currency !== "EGP" && latestRates) {
      const egpValue = convertToEGP(
        account.balance,
        account.currency,
        latestRates
      );
      return `≈ ${formatCurrency({
        amount: egpValue,
        currency: "EGP",
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
          className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
          style={{ backgroundColor: `${config.color}15` }}
        >
          <Ionicons name={config.icon} size={24} color={config.color} />
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="text-base font-bold text-slate-800 dark:text-white">
            {account.name}
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
