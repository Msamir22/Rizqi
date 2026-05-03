import { AccountType } from "@monyvi/db";
import { SUPPORTED_CURRENCIES } from "@monyvi/logic";
import { Ionicons } from "@expo/vector-icons";

export const ACCOUNT_TYPES = [
  {
    id: "CASH" as AccountType,
    label: "Cash",
    icon: "cash-outline" as keyof typeof Ionicons.glyphMap,
  },
  {
    id: "BANK" as AccountType,
    label: "Bank Account",
    icon: "business-outline" as keyof typeof Ionicons.glyphMap,
  },
  {
    id: "DIGITAL_WALLET" as AccountType,
    label: "Digital Wallet",
    icon: "phone-portrait-outline" as keyof typeof Ionicons.glyphMap,
  },
] as const;

export const CURRENCIES = SUPPORTED_CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.code} - ${c.name}`,
  icon: c.flag,
  iconType: "emoji" as const,
}));
