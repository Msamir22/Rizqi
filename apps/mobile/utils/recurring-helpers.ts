/**
 * Shared helper utilities for recurring payments.
 */

import type { Ionicons } from "@expo/vector-icons";

/**
 * Guesses an icon name based on the payment name.
 *
 * This is a fallback for recurring payments that don't have
 * a linked category icon. Prefer using the actual category
 * icon via `CategoryIcon` whenever `categoryId` is available.
 */
export function getPaymentIcon(name: string): keyof typeof Ionicons.glyphMap {
  const nameLower = name.toLowerCase();

  if (nameLower.includes("netflix") || nameLower.includes("stream"))
    return "play-circle";
  if (nameLower.includes("spotify") || nameLower.includes("music"))
    return "musical-notes";
  if (nameLower.includes("gym") || nameLower.includes("fitness"))
    return "barbell";
  if (nameLower.includes("internet") || nameLower.includes("wifi"))
    return "wifi";
  if (
    nameLower.includes("electric") ||
    nameLower.includes("power") ||
    nameLower.includes("utility")
  )
    return "flash";
  if (nameLower.includes("water")) return "water";
  if (nameLower.includes("gas")) return "flame";
  if (nameLower.includes("rent") || nameLower.includes("house")) return "home";
  if (nameLower.includes("salary") || nameLower.includes("income"))
    return "cash";
  if (nameLower.includes("phone") || nameLower.includes("mobile"))
    return "phone-portrait";
  if (
    nameLower.includes("insurance") ||
    nameLower.includes("health") ||
    nameLower.includes("medical")
  )
    return "medical";
  if (nameLower.includes("subscription")) return "card";

  return "receipt";
}
