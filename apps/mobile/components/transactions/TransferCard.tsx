import { CurrencyType } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import React from "react";
import { palette } from "@/constants/colors";
import { BaseCard } from "./BaseCard";

interface TransferCardProps {
  id: string;
  amount: number;
  currency: CurrencyType;
  date: Date;
  fromAccountName: string;
  toAccountName: string;
  notes?: string;
  displayNetWorth: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function TransferCard({
  id,
  amount,
  currency,
  date,
  fromAccountName,
  toAccountName,
  notes,
  displayNetWorth,
  isSelectionMode,
  isSelected,
  index,
  onPress,
  onLongPress,
  onSwipeDelete,
}: TransferCardProps & {
  index?: number;
  onSwipeDelete?: (id: string) => void;
}): React.JSX.Element {
  const mainColor = palette.blue[500];
  const formattedAmount = formatCurrency({
    amount: Math.abs(amount),
    currency,
  });
  const subtitle = `${fromAccountName} → ${toAccountName}`;

  return (
    <BaseCard
      id={id}
      isSelectionMode={isSelectionMode}
      isSelected={isSelected}
      onPress={onPress}
      onLongPress={onLongPress}
      mainColor={mainColor}
      iconName="swap-horizontal"
      iconLibrary="Ionicons"
      title="Transfer"
      amount={formattedAmount}
      subtitle={subtitle}
      details={notes}
      displayNetWorth={displayNetWorth}
      date={date}
      index={index}
      onSwipeDelete={onSwipeDelete}
      onCategoryPress={undefined}
      onAmountPress={undefined}
    />
  );
}
