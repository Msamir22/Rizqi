import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { FontAwesome5 } from "@expo/vector-icons";
import { AnchoredTooltip } from "@/components/ui/AnchoredTooltip";
import { palette } from "@/constants/colors";
import { useMicButtonRef } from "@/context/MicButtonRefContext";
import { useDismissOnBack } from "@/hooks/useDismissOnBack";

interface MicButtonTooltipProps {
  readonly visible: boolean;
  readonly onTryItNow: () => void;
  readonly onClose: () => void;
}

export function MicButtonTooltip({
  visible,
  onTryItNow,
  onClose,
}: MicButtonTooltipProps): React.ReactElement | null {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");
  const micRef = useMicButtonRef();

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
    />
  );
}
