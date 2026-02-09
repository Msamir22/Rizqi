import { CurrencyType } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import React from "react";
import { palette } from "@/constants/colors";
import { IconLibrary } from "../common/CategoryIcon";
import { BaseCard } from "./BaseCard";

interface TransactionCardProps {
  id: string;
  signedAmount: number;
  currency: CurrencyType;
  date: Date;
  isExpense: boolean;
  isIncome: boolean;
  merchant?: string;
  note?: string;
  source?: string;
  accountName: string;
  categoryName: string;
  categoryIconName: string;
  categoryIconLibrary: IconLibrary;
  displayNetWorth: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function TransactionCard({
  id,
  signedAmount,
  currency,
  date,
  isExpense,
  isIncome,
  merchant,
  note,
  source,
  accountName,
  categoryName,
  categoryIconName,
  categoryIconLibrary,
  displayNetWorth,
  isSelectionMode,
  isSelected,
  onPress,
  onLongPress,
  // New Props
  index,
  onSwipeDelete,
  onCategoryPress,
  onAmountPress,
}: TransactionCardProps & {
  index?: number;
  onSwipeDelete?: (id: string) => void;
  onCategoryPress?: (id: string) => void;
  onAmountPress?: (id: string) => void;
}): React.JSX.Element {
  // Compute derived values
  const mainColor = isExpense
    ? palette.red[500]
    : isIncome
      ? palette.nileGreen[500]
      : palette.slate[500];

  const formattedAmount = formatCurrency({
    amount: signedAmount,
    currency,
  });
  // Title is always the category name
  const title = categoryName;
  const details = note || source;

  return (
    <BaseCard
      id={id}
      isSelectionMode={isSelectionMode}
      isSelected={isSelected}
      onPress={onPress}
      onLongPress={onLongPress}
      mainColor={mainColor}
      iconName={categoryIconName}
      iconLibrary={categoryIconLibrary}
      title={title}
      amount={formattedAmount}
      subtitle={accountName}
      merchant={merchant}
      details={details}
      displayNetWorth={displayNetWorth}
      date={date}
      index={index}
      onSwipeDelete={onSwipeDelete}
      onCategoryPress={onCategoryPress}
      onAmountPress={onAmountPress}
    />
  );
}
