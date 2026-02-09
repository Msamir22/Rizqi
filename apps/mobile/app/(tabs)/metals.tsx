import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ReactElement, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "@/components/navigation/PageHeader";
import { palette } from "@/constants/colors";
import { useMarketRates } from "@/hooks/useMarketRates";

// 1. Total Value Card
const MetalsValueCard = (): ReactElement => {
  const totalEGP = 32450;
  const totalUSD = 649;

  return (
    <View className="mb-8 rounded-3xl overflow-hidden bg-white dark:bg-slate-800 border border-gold/10 dark:border-white/10 shadow-md dark:shadow-none">
      <LinearGradient
        colors={[palette.slate[50], palette.slate[100]]}
        className="hidden dark:flex absolute inset-0"
        // In dark mode we use a specific gradient but Tailwind handles most of it
      />
      <View className="items-center py-8 gap-2">
        <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Total Metals Value
        </Text>
        <Text className="text-4xl font-bold text-slate-800 dark:text-white">
          EGP {totalEGP.toLocaleString()}
        </Text>
        <Text className="text-base text-slate-500 dark:text-white/50">
          ≈ ${totalUSD} USD
        </Text>
      </View>
    </View>
  );
};

// 2. Holding Item Row
const HoldingItem = ({
  badge,
  weight,
  value,
  isGold,
}: {
  badge: string;
  weight: string;
  value: string;
  isGold: boolean;
}): ReactElement => {
  return (
    <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-4 shadow-sm dark:shadow-none">
      <View className="flex-row items-center gap-4">
        {/* Badge */}
        <View
          className={`min-w-[60px] items-center rounded-full px-3 py-1.5 ${
            isGold
              ? "bg-amber-100 dark:bg-amber-700"
              : "bg-slate-100 dark:bg-slate-600"
          }`}
        >
          <Text
            className={`text-[13px] font-bold ${
              isGold
                ? "text-amber-800 dark:text-white"
                : "text-slate-600 dark:text-white"
            }`}
          >
            {badge}
          </Text>
        </View>

        {/* Weight */}
        <Text className="text-base font-semibold text-slate-800 dark:text-white">
          {weight}
        </Text>
      </View>

      <View className="flex-row items-center gap-3">
        <Text className="text-base text-slate-800 dark:text-white">
          {value}
        </Text>
        <TouchableOpacity>
          <MaterialCommunityIcons
            name="pencil-outline"
            size={20}
            className="text-slate-400 dark:text-slate-500"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// 3. Add Button (Outline)
const AddSectionButton = ({
  label,
  onPress,
  isGold,
}: {
  label: string;
  onPress: () => void;
  isGold: boolean;
}): ReactElement => (
  <TouchableOpacity
    onPress={onPress}
    className={`mt-1 flex-row items-center justify-center gap-2 rounded-xl border py-3.5 ${
      isGold
        ? "border-amber-500/50 dark:border-amber-500/30"
        : "border-slate-200 dark:border-slate-700"
    }`}
  >
    <Ionicons
      name="add"
      size={20}
      color={isGold ? palette.gold[600] : palette.slate[500]}
    />
    <Text
      className={`text-base font-semibold ${
        isGold ? "text-amber-600 dark:text-amber-500" : "text-slate-500"
      }`}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default function MyMetalsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const { latestRates } = useMarketRates();
  const [modalVisible, setModalVisible] = useState(false);
  const [addType, setAddType] = useState<"gold" | "silver">("gold");

  // Calculate prices based on latestRates
  // goldEgpPerGram -> USD per ounce
  // USD price = (EGP per gram / usdEgp) * 31.1035
  const usdEgp = latestRates?.usdEgp || 50;
  const GoldPrice = latestRates
    ? (latestRates.goldEgpPerGram / usdEgp) * 31.1035
    : 0;
  const SilverPrice = latestRates ? latestRates.silverEgpPerGram / usdEgp : 0; // Silver usually shown per gram or ounce, here ticker says per gram for silver?
  // Wait, original ticker: Silver: ${SilverPrice.toFixed(2)}/g

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-900">
      <PageHeader title="My Metals" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      >
        <MetalsValueCard />

        {/* Gold Holdings */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center">
            <FontAwesome5
              name="coins"
              size={20}
              color={palette.gold[600]}
              style={{ marginRight: 10 }}
            />
            <Text className="text-lg font-bold text-slate-800 dark:text-white">
              Gold Holdings
            </Text>
          </View>

          <HoldingItem
            badge="24K"
            weight="15.5g"
            value="= EGP 65,875"
            isGold={true}
          />
          <HoldingItem
            badge="21K"
            weight="8.2g"
            value="= EGP 28,740"
            isGold={true}
          />

          <AddSectionButton
            label="+ Add Gold"
            isGold={true}
            onPress={() => {
              setAddType("gold");
              setModalVisible(true);
            }}
          />
        </View>

        {/* Silver Holdings */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center">
            <View className="mr-2.5 h-6 w-6 items-center justify-center rounded-full bg-slate-300">
              <View className="h-4 w-4 rounded-full bg-slate-400" />
            </View>
            <Text className="text-lg font-bold text-slate-800 dark:text-white">
              Silver Holdings
            </Text>
          </View>

          <HoldingItem
            badge="Pure"
            weight="120g"
            value="= EGP 6,240"
            isGold={false}
          />

          <AddSectionButton
            label="+ Add Silver"
            isGold={false}
            onPress={() => {
              setAddType("silver");
              setModalVisible(true);
            }}
          />
        </View>
      </ScrollView>

      {/* Live Ticker */}
      <View
        className="absolute bottom-5 left-5 right-5 flex-row items-center justify-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-3 shadow-sm"
        style={{ bottom: insets.bottom + 10 }}
      >
        <View className="flex-row items-center gap-1">
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            Gold 24K:
          </Text>
          <Text className="text-xs font-bold text-slate-800 dark:text-white">
            ${GoldPrice.toFixed(0)}/oz
          </Text>
          <Ionicons name="arrow-up" size={12} color={palette.nileGreen[500]} />
        </View>
        <View className="h-4 w-[1px] bg-slate-200 dark:bg-white/20" />
        <View className="flex-row items-center gap-1">
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            Silver:
          </Text>
          <Text className="text-xs font-bold text-slate-800 dark:text-white">
            ${SilverPrice.toFixed(2)}/g
          </Text>
          <Ionicons name="arrow-forward" size={12} color={palette.slate[400]} />
        </View>
      </View>

      {/* Add Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View className="flex-1 justify-end bg-black/50">
            <TouchableWithoutFeedback onPress={() => {}}>
              <View
                className="rounded-t-[32px] bg-white dark:bg-slate-800 p-6"
                style={{ paddingBottom: insets.bottom + 24 }}
              >
                {/* Handle */}
                <View className="mb-6 h-1 w-10 self-center rounded-full bg-slate-200 dark:bg-white/20" />

                <Text className="mb-6 self-center text-2xl font-bold text-slate-800 dark:text-white">
                  Add New Holding
                </Text>

                {/* Type Toggle */}
                <View className="mb-6 flex-row rounded-2xl bg-slate-100 dark:bg-slate-700 p-1">
                  {(["gold", "silver"] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setAddType(t)}
                      className={`flex-1 items-center rounded-xl py-3 ${
                        addType === t ? "" : "bg-transparent"
                      }`}
                      style={{
                        backgroundColor:
                          addType === t
                            ? t === "gold"
                              ? palette.gold[600]
                              : palette.slate[400]
                            : undefined,
                      }}
                    >
                      <Text
                        className={`font-semibold capitalize ${
                          addType === t
                            ? "text-white"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Karat Selection (Gold Only) */}
                {addType === "gold" && (
                  <View className="mb-6 flex-row gap-3">
                    {["24K", "21K", "18K"].map((k, i) => (
                      <TouchableOpacity
                        key={k}
                        className={`flex-1 items-center rounded-3xl border py-3 ${
                          i === 0
                            ? "border-gold bg-gold-bg dark:bg-gold-dark/20"
                            : "border-border bg-transparent"
                        }`}
                        style={{
                          borderColor: i === 0 ? palette.gold[600] : undefined,
                        }}
                      >
                        <Text
                          className={`font-semibold ${
                            i === 0
                              ? "text-amber-600 dark:text-amber-500"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {k}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Weight Input */}
                <View className="mb-8 flex-row items-center border-b border-slate-200 dark:border-white/20 pb-2">
                  <Text className="mr-2 text-2xl font-bold text-slate-800 dark:text-white">
                    0.0 g
                  </Text>
                  <TextInput
                    placeholder="Enter weight in grams"
                    placeholderTextColor={palette.slate[400]}
                    className="flex-1 text-right text-base text-slate-800 dark:text-white"
                    keyboardType="numeric"
                  />
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  className="items-center rounded-2xl bg-gold py-4 shadow-md"
                  style={{
                    backgroundColor: palette.gold[600],
                    shadowColor: palette.gold[600],
                    shadowOpacity: 0.3,
                  }}
                  onPress={() => setModalVisible(false)}
                >
                  <Text className="text-lg font-bold text-white">
                    Add to Savings
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <PageHeader title="My Metals" />
    </View>
  );
}
