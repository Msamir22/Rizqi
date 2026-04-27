import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { FontAwesome5 } from "@expo/vector-icons";
import { AnchoredTooltip } from "@/components/ui/AnchoredTooltip";
import { palette } from "@/constants/colors";
import { useMicButtonRef } from "@/context/MicButtonRefContext";
import { useMicTooltip } from "@/context/MicTooltipContext";
import { useDismissOnBack } from "@/hooks/useDismissOnBack";

/**
 * MicButtonTooltip is now self-contained — it reads its visibility and
 * action handlers from `MicTooltipContext`. It MUST be rendered at the
 * dashboard root (sibling of `CashAccountTooltip`) so the
 * `AnchoredTooltip` overlay covers the whole screen and isn't clipped by
 * `OnboardingGuideCard`'s `overflow-hidden`.
 */
export function MicButtonTooltip(): React.ReactElement | null {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");
  const micRef = useMicButtonRef();
  const {
    isVisible: visible,
    onTryItNow,
    onDismiss: onClose,
  } = useMicTooltip();

  // Android hardware-back while visible → same path as X close (FR-039),
  // NOT "Try it now" — does not open the voice flow.
  useDismissOnBack(visible, onClose);

  if (!visible || !micRef) return null;

  // Per mockup `06-tooltip-mic-button.png`: green-tinted circle with a mic
  // glyph centered above the title.
  const tooltipIcon = (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-nileGreen-500/15">
      <FontAwesome5
        name="microphone"
        size={16}
        color={palette.nileGreen[600]}
      />
    </View>
  );

  return (
    <AnchoredTooltip
      visible={visible}
      anchorRef={micRef}
      title={t("mic_button_tooltip_title")}
      body={t("mic_button_tooltip_body")}
      primaryLabel={t("mic_button_tooltip_try_it_now")}
      onPrimaryPress={onTryItNow}
      onClose={onClose}
      closeAccessibilityLabel={tCommon("cancel")}
      icon={tooltipIcon}
      anchorSide="above"
      // Per mockup 06: icon, title, body all centered as a stack;
      // "Try it now" is a centered green text button at the bottom.
      layout="centered"
      primaryButtonColor={palette.nileGreen[600]}
    />
  );
}
