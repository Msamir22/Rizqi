import { palette } from "@/constants/colors";
import { formatCurrency } from "@astik/logic";
import React from "react";
import { BaseCard } from "./BaseCard";

interface TransferCardProps {
  id: string;
  amount: number;
  currency: string;
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
  onPress,
  onLongPress,
  index,
  onSwipeDelete,
  onCategoryPress,
  onAmountPress,
}: TransferCardProps & {
  index?: number;
  onSwipeDelete?: (id: string) => void;
  onCategoryPress?: (id: string) => void;
  onAmountPress?: (id: string) => void;
}): React.JSX.Element {
  const mainColor = palette.blue[500];
  const formattedAmount = formatCurrency(Math.abs(amount), currency);
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
