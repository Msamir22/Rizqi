/**
 * Gold Hero Card
 *
 * Full-width hero card for Gold 24K price display with 21K/18K inline chips.
 * Intentionally uses a dark surface (slate-800) in both themes for visual emphasis,
 * per the approved mockup.
 *
 * Architecture & Design Rationale:
 * - Pattern: Composable Component (Atomic Design Level 2 — Molecule)
 * - Why: Gold has a unique chip layout for 21K/18K that Silver/Platinum don't need.
 *   Separate from MetalCard to maintain SRP.
 * - SOLID: OCP — adding new karat chips is additive, no existing code changes.
 *
 * @module GoldHeroCard
 */

import { palette } from "@/constants/colors";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

// =============================================================================
// Types
// =============================================================================

interface GoldHeroCardProps {
  readonly price24k: string;
  readonly price21k: string;
  readonly price18k: string;
  readonly trendPercent: number;
  readonly currencySymbol: string;
}

// =============================================================================
// Sub-components
// =============================================================================

function TrendBadge({
  trendPercent,
}: {
  readonly trendPercent: number;
}): React.JSX.Element | null {
  const roundedTrend = Number(trendPercent.toFixed(1));
  if (roundedTrend === 0) return null;

  const isUp = roundedTrend > 0;
  const color = isUp ? palette.nileGreen[400] : palette.red[400];
  const icon = isUp ? "arrow-drop-up" : "arrow-drop-down";
  const label = `${isUp ? "▲" : "▼"} ${Math.abs(roundedTrend).toFixed(1)}% today`;

  return (
    <View className="flex-row items-center mt-0.5">
      <MaterialIcons
        name={icon}
        size={18}
        color={color}
        style={{ marginStart: -4 }}
      />
      <Text style={{ color, fontSize: 12, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

function PurityChip({
  label,
  price,
  currencySymbol,
}: {
  readonly label: string;
  readonly price: string;
  readonly currencySymbol: string;
}): React.JSX.Element {
  return (
    <View
      className="rounded-lg px-3 py-2 me-2"
      style={{ backgroundColor: `${palette.gold[600]}20` }}
    >
      <Text className="text-[10px] font-medium text-slate-400 mb-0.5">
        {label}
      </Text>
      <Text className="text-sm font-semibold text-white">
        {currencySymbol} {price}/g
      </Text>
    </View>
  );
}

// =============================================================================
// Component
// =============================================================================

export function GoldHeroCard({
  price24k,
  price21k,
  price18k,
  trendPercent,
  currencySymbol,
}: GoldHeroCardProps): React.JSX.Element {
  return (
    <View className="bg-slate-800 rounded-2xl p-4 overflow-hidden border-l-[3px] border-l-gold-600">
      {/* Gold label */}
      <View className="flex-row items-center mb-1">
        <FontAwesome5 name="coins" size={14} color={palette.gold[400]} />
        <Text
          className="ms-1.5 text-sm font-semibold"
          style={{ color: palette.gold[400] }}
        >
          Gold
        </Text>
      </View>

      {/* 24K Price — large display */}
      <Text className="text-[28px] font-bold text-white tracking-tight">
        {currencySymbol} {price24k}/g
      </Text>

      {/* Subtitle + trend */}
      <View className="flex-row items-center mt-0.5">
        <Text className="text-xs text-slate-400">24 Karat · Pure Gold</Text>
        <TrendBadge trendPercent={trendPercent} />
      </View>

      {/* 21K and 18K chips */}
      <View className="flex-row mt-3">
        <PurityChip
          label="21 Karat"
          price={price21k}
          currencySymbol={currencySymbol}
        />
        <PurityChip
          label="18 Karat"
          price={price18k}
          currencySymbol={currencySymbol}
        />
      </View>
    </View>
  );
}
