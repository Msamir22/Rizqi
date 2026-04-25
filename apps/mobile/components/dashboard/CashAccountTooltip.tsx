import React, { useCallback } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { AnchoredTooltip } from "@/components/ui/AnchoredTooltip";
import { palette } from "@/constants/colors";
import { useFirstRunTooltip } from "@/context/FirstRunTooltipContext";
import { useDismissOnBack } from "@/hooks/useDismissOnBack";
import { useOnboardingFlags } from "@/hooks/useOnboardingFlags";
import { setOnboardingFlag } from "@/services/profile-service";
import { logger } from "@/utils/logger";

interface CashAccountTooltipProps {
  /** Ref to the rendered cash-account card for anchor measurement. */
  readonly anchorRef: React.RefObject<View>;
  /**
   * Whether the SMS permission prompt is currently visible. Passed in by the
   * dashboard so both the SMS prompt and this tooltip share a SINGLE
   * `useSmsSync()` state. Instantiating `useSmsSync()` here would produce an
   * independent mutable state and race against the dashboard's prompt on
   * Android.
   */
  readonly isSmsPromptVisible: boolean;
}

export function CashAccountTooltip({
  anchorRef,
  isSmsPromptVisible,
}: CashAccountTooltipProps): React.ReactElement | null {
  const { t } = useTranslation("onboarding");
  const { isFirstRunPending, markFirstRunConsumed } = useFirstRunTooltip();
  const flags = useOnboardingFlags();

  const visible =
    isFirstRunPending &&
    !isSmsPromptVisible &&
    !flags.cash_account_tooltip_dismissed;

  const handleDismiss = useCallback((): void => {
    // Do NOT update local state (mark-consumed) before the write resolves —
    // on failure we still want the tooltip to hide and the session to
    // advance, but we log so the issue is visible. The flag persists on
    // success; on failure the sync retry catches it on the next mount.
    const finalize = (): void => {
      markFirstRunConsumed();
    };
    setOnboardingFlag("cash_account_tooltip_dismissed", true)
      .then(finalize)
      .catch((error: unknown) => {
        logger.warn(
          "cashAccountTooltip.dismiss.failed",
          error instanceof Error ? { message: error.message } : undefined
        );
        finalize();
      });
  }, [markFirstRunConsumed]);

  // Android hardware-back while visible → same path as "Got it"
  useDismissOnBack(visible, handleDismiss);

  if (!visible) return null;

  // Per mockup `05-tooltip-cash-account.png`: small green-tinted circle with
  // a leaf/check-mark icon above the title. We use the project's Ionicons
  // sparkles glyph to communicate "we set this up for you" / fresh-bloom.
  const tooltipIcon = (
    <View className="h-8 w-8 items-center justify-center rounded-full bg-nileGreen-500/15">
      <Ionicons name="sparkles" size={16} color={palette.nileGreen[600]} />
    </View>
  );

  return (
    <AnchoredTooltip
      visible={visible}
      anchorRef={anchorRef}
      title={t("cash_account_tooltip_title")}
      body={t("cash_account_tooltip_body")}
      primaryLabel={t("cash_account_tooltip_got_it")}
      onPrimaryPress={handleDismiss}
      icon={tooltipIcon}
      anchorSide="above"
    />
  );
}
