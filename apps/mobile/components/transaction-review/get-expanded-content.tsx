import type { ReviewableTransaction } from "@astik/logic";
import React from "react";
import { Text, View } from "react-native";

export function getExpandedContent(
  tx: ReviewableTransaction
): { title: string; body: string } | undefined {
  if ("rawSmsBody" in tx && tx.rawSmsBody) {
    return { title: "Original SMS", body: tx.rawSmsBody as string };
  }
  if ("originalTranscript" in tx && tx.originalTranscript) {
    return { title: "Original Note", body: tx.originalTranscript as string };
  }
  return undefined;
}

export function OriginalContentBlock({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}): React.JSX.Element {
  return (
    <View className="bg-slate-100 dark:bg-slate-900/60 rounded-xl p-3">
      <Text className="text-xs text-slate-500 mb-1 font-medium">{title}</Text>
      <Text className="text-xs text-slate-600 dark:text-slate-400 leading-5">
        {body}
      </Text>
    </View>
  );
}
