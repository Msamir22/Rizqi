import { AppDrawer } from "@/components/navigation/AppDrawer";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { getMetalPrices, MetalPrices } from "@/utils/api";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 1. Total Value Card
const MetalsValueCard = ({ mode }: { mode: string }) => {
  const isDark = mode === "dark";
  const totalEGP = 32450;
  const totalUSD = 649;

  const Content = () => (
    <View className="items-center gap-2">
      <Text className="text-sm font-medium text-text-secondary dark:text-white/70">
        Total Metals Value
      </Text>
      <Text className="font-[System] text-4xl font-bold text-text-primary dark:text-white">
        EGP {totalEGP.toLocaleString()}
      </Text>
      <Text className="text-base text-text-secondary dark:text-white/50">
        ≈ ${totalUSD} USD
      </Text>
    </View>
  );

  if (isDark) {
    return (
      <LinearGradient
        colors={["rgba(217, 119, 6, 0.4)", "rgba(0,0,0,0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        className="mb-8 rounded-3xl p-[1px]"
      >
        <LinearGradient
          colors={["#1C1917", "#000000"]}
          className="items-center rounded-[23px] py-8"
        >
          <Content />
        </LinearGradient>
      </LinearGradient>
    );
  }

  return (
    <View
      className="mb-8 items-center rounded-3xl border border-gold/10 bg-white py-8 shadow-md"
      style={{ shadowColor: palette.gold[600], shadowOpacity: 0.15 }}
    >
      <Content />
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
}) => {
  const { mode } = useTheme();
  const isDark = mode === "dark";

  // Dynamic styles that are hard to do with just classes
  const badgeBg = isGold
    ? isDark
      ? "#B45309"
      : "#FDE68A"
    : isDark
      ? "#4B5563"
      : "#E2E8F0";

  const badgeText = isGold
    ? isDark
      ? "#FFF"
      : "#92400E"
    : isDark
      ? "#FFF"
      : "#475569";

  return (
    <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1C1917] dark:shadow-none">
      <View className="flex-row items-center gap-4">
        {/* Badge */}
        <View
          className="min-w-[60px] items-center rounded-full px-3 py-1.5"
          style={{ backgroundColor: badgeBg }}
        >
          <Text className="text-[13px] font-bold" style={{ color: badgeText }}>
            {badge}
          </Text>
        </View>

        {/* Weight */}
        <Text className="text-base font-semibold text-text-primary dark:text-white">
          {weight}
        </Text>
      </View>

      <View className="flex-row items-center gap-3">
        <Text className="text-base text-text-primary dark:text-white">
          {value}
        </Text>
        <TouchableOpacity>
          <MaterialCommunityIcons
            name="pencil-outline"
            size={20}
            color={isDark ? palette.slate[400] : palette.slate[600]}
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
}) => (
  <TouchableOpacity
    onPress={onPress}
    className={`mt-1 flex-row items-center justify-center gap-2 rounded-xl border py-3.5 ${
      isGold ? "border-gold" : "border-text-secondary"
    }`}
  >
    <Ionicons
      name="add"
      size={20}
      color={isGold ? palette.gold[600] : palette.slate[600]}
    />
    <Text
      className={`text-base font-semibold ${
        isGold ? "text-gold" : "text-text-secondary"
      }`}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default function MyMetalsScreen() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const isDark = mode === "dark";

  const [prices, setPrices] = useState<MetalPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [addType, setAddType] = useState<"gold" | "silver">("gold");

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      setLoading(true);
      const data = await getMetalPrices();
      setPrices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const GoldPrice = prices ? prices.gold.price : 0;
  const SilverPrice = prices ? prices.silver.price : 0;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
      />

      {/* Header */}
      <View
        className="flex-row items-center justify-between px-5 pb-5"
        style={{ paddingTop: insets.top + 12 }}
      >
        <TouchableOpacity
          onPress={() => setIsDrawerOpen(true)}
          className="h-10 w-10 items-center justify-center rounded-xl bg-surface-highlight dark:bg-white/10"
        >
          <Ionicons
            name="menu-outline"
            size={24}
            color={isDark ? "#FFF" : palette.slate[800]}
          />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-text-primary dark:text-white">
          My Metals
        </Text>
        <TouchableOpacity className="h-10 w-10 items-center justify-center rounded-xl bg-surface-highlight dark:bg-white/10">
          <Ionicons
            name="settings-outline"
            size={22}
            color={isDark ? "#FFF" : palette.slate[800]}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      >
        <MetalsValueCard mode={mode} />

        {/* Gold Holdings */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center">
            <FontAwesome5
              name="coins"
              size={20}
              color={palette.gold[600]}
              style={{ marginRight: 10 }}
            />
            <Text className="text-lg font-bold text-text-primary dark:text-white">
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
            <Text className="text-lg font-bold text-text-primary dark:text-white">
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
        className="absolute bottom-5 left-5 right-5 flex-row items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm dark:border-white/10 dark:bg-black/90"
        style={{ bottom: insets.bottom + 10 }}
      >
        <View className="flex-row items-center gap-1">
          <Text className="text-xs text-text-secondary dark:text-text-muted">
            Gold 24K:
          </Text>
          <Text className="text-xs font-bold text-text-primary dark:text-white">
            ${GoldPrice.toFixed(0)}/oz
          </Text>
          <Ionicons name="arrow-up" size={12} color={palette.nileGreen[500]} />
        </View>
        <View className="h-4 w-[1px] bg-border dark:bg-white/20" />
        <View className="flex-row items-center gap-1">
          <Text className="text-xs text-text-secondary dark:text-text-muted">
            Silver:
          </Text>
          <Text className="text-xs font-bold text-text-primary dark:text-white">
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
                className="rounded-t-[32px] bg-white p-6 dark:bg-[#1C1917]"
                style={{ paddingBottom: insets.bottom + 24 }}
              >
                {/* Handle */}
                <View className="mb-6 h-1 w-10 self-center rounded-full bg-border dark:bg-white/20" />

                <Text className="mb-6 self-center text-2xl font-bold text-text-primary dark:text-white">
                  Add New Holding
                </Text>

                {/* Type Toggle */}
                <View className="mb-6 flex-row rounded-2xl bg-slate-100 p-1 dark:bg-[#292524]">
                  {(["gold", "silver"] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setAddType(t)}
                      className={`flex-1 items-center rounded-xl py-3 ${
                        addType === t
                          ? t === "gold"
                            ? "bg-gold"
                            : "bg-slate-400"
                          : "bg-transparent"
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
                            : "text-text-secondary dark:text-text-muted"
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
                              ? "text-gold"
                              : "text-text-secondary dark:text-text-muted"
                          }`}
                        >
                          {k}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Weight Input */}
                <View className="mb-8 flex-row items-center border-b border-border pb-2 dark:border-white/20">
                  <Text className="mr-2 text-2xl font-bold text-text-primary dark:text-white">
                    0.0 g
                  </Text>
                  <TextInput
                    placeholder="Enter weight in grams"
                    placeholderTextColor={
                      isDark ? palette.slate[500] : palette.slate[400]
                    }
                    className="flex-1 text-right text-base text-text-primary dark:text-white"
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

      <AppDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </View>
  );
}
