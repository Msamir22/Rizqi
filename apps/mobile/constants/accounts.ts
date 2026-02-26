import { AccountType } from "@astik/db";
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

export const CURRENCIES = [
  {
    value: "EGP",
    label: "EGP - Egyptian Pound",
    icon: "🇪🇬",
    iconType: "emoji",
  },
  {
    value: "USD",
    label: "USD - US Dollar",
    icon: "🇺🇸",
    iconType: "emoji",
  },
  {
    value: "EUR",
    label: "EUR - Euro",
    icon: "🇪🇺",
    iconType: "emoji",
  },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["value"];
