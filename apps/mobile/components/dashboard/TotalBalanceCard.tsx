import { palette } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

interface Props {
  totalEgp: number;
  totalUsd: number;
}

export function TotalBalanceCard({ totalEgp, totalUsd }: Props) {
  const formatCurrency = (amount: number, currency: string) => {
    return (
      new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount) + (currency ? ` ${currency}` : "")
    );
  };

  return (
    <LinearGradient
      // Gradient from Dark Green (800) to slightly lighter Green (600) for depth
      colors={[palette.nileGreen[800], palette.nileGreen[600]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="my-2 min-h-[180px] items-center rounded-2xl p-6 shadow-lg border border-white/10 overflow-hidden relative"
    >
      {/* Geometric Background Pattern ("Shadow Boxes") */}
      <View className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden rounded-[24px]">
        {/* Large diagonal shape */}
        <View className="absolute -right-10 -bottom-20 w-64 h-64 bg-white/5 rotate-45 transform" />
        {/* Smaller intersecting shapes */}
        <View className="absolute -right-4 bottom-10 w-32 h-32 bg-white/5 rotate-12 transform" />
        <View className="absolute right-20 -bottom-10 w-32 h-32 bg-white/5 -rotate-12 transform" />
      </View>

      <View className="items-center gap-1 z-10">
        {/* Label */}
        <Text className="text-slate-300 text-sm font-medium tracking-wide opacity-90">
          Total Net Worth
        </Text>

        {/* Main Amount (EGP) */}
        <Text className="text-white text-[42px] font-extrabold tracking-tight mt-1">
          EGP {formatCurrency(totalEgp, "")}
        </Text>

        {/* Secondary Amount (USD) */}
        <Text className="text-slate-100 text-base font-medium opacity-80">
          ≈ ${formatCurrency(totalUsd, "USD")}
        </Text>

        {/* Monthly Percentage Change */}
        <View className="flex-row items-center gap-1 mt-2 bg-white/10 px-3 py-1 rounded-full">
          <Ionicons
            name="arrow-up"
            style={{ transform: [{ rotate: "40deg" }] }}
            size={12}
            color={palette.nileGreen[400]}
          />

          {/* TODO : show arrow down dynamically */}
          {/* <Ionicons
            name="arrow-down"
            style={{ transform: [{ rotate: "40deg" }] }}
            size={12}
            color={palette.nileGreen[400]}
          /> */}

          <Text className="text-nileGreen-50 text-xs font-bold">
            +2.5% Month
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}
