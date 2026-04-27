/**
 * Unit tests for MicButtonTooltip (T068).
 *
 * Validates:
 *  - renders null when not visible OR when micRef is missing
 *  - "Try it now" wires through to context's `onTryItNow`
 *  - "X" close wires through to context's `onDismiss`
 *  - Android back handler uses `useDismissOnBack(visible, onDismiss)` —
 *    i.e. back = X semantics (FR-039), never "Try it now"
 *
 * State + handlers come from `MicTooltipContext`. Visibility prop / handlers
 * are no longer passed — see MicTooltipContext.tsx for the migration
 * rationale (overlay needs to render at the screen root to avoid being
 * clipped by `OnboardingGuideCard`'s `overflow-hidden`).
 */

import React from "react";
import { View } from "react-native";

interface ReactTestRendererInstance {
  root: { findByType: (type: unknown) => { props: Record<string, unknown> } };
  toJSON: () => unknown;
  unmount: () => void;
}
interface ReactTestRendererModule {
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

// =============================================================================
// Mocks
// =============================================================================

const mockMicRef: React.RefObject<View> = { current: null };
const mockRefState: { current: React.RefObject<View> | null } = {
  current: mockMicRef,
};

jest.mock("@/context/MicButtonRefContext", () => ({
  useMicButtonRef: (): React.RefObject<View> | null => mockRefState.current,
}));

interface MockTooltipState {
  isVisible: boolean;
  voiceTooltipSeen: boolean;
  onVoiceStepAction: () => void;
  onTryItNow: () => void;
  onDismiss: () => void;
}
const mockTooltipState: { current: MockTooltipState } = {
  current: {
    isVisible: false,
    voiceTooltipSeen: false,
    onVoiceStepAction: jest.fn(),
    onTryItNow: jest.fn(),
    onDismiss: jest.fn(),
  },
};

jest.mock("@/context/MicTooltipContext", () => ({
  useMicTooltip: (): MockTooltipState => mockTooltipState.current,
}));

const mockUseDismissOnBack = jest.fn<void, [boolean, () => void]>();
jest.mock("@/hooks/useDismissOnBack", () => ({
  useDismissOnBack: (visible: boolean, onDismiss: () => void): void =>
    mockUseDismissOnBack(visible, onDismiss),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockAnchoredTooltip = jest.fn((_props: Record<string, unknown>) => null);
jest.mock("@/components/ui/AnchoredTooltip", () => ({
  AnchoredTooltip: (props: Record<string, unknown>) =>
    mockAnchoredTooltip(props),
}));

// eslint-disable-next-line import/first
import { MicButtonTooltip } from "@/components/dashboard/MicButtonTooltip";

// =============================================================================
// Tests
// =============================================================================

describe("MicButtonTooltip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefState.current = mockMicRef;
    mockTooltipState.current = {
      isVisible: false,
      voiceTooltipSeen: false,
      onVoiceStepAction: jest.fn(),
      onTryItNow: jest.fn(),
      onDismiss: jest.fn(),
    };
  });

  it("renders null when context.isVisible is false", () => {
    mockTooltipState.current.isVisible = false;
    const r = RTR.create(React.createElement(MicButtonTooltip));
    expect(r.toJSON()).toBeNull();
    expect(mockAnchoredTooltip).not.toHaveBeenCalled();
  });

  it("renders null when micRef is missing (tab bar not mounted)", () => {
    mockRefState.current = null;
    mockTooltipState.current.isVisible = true;
    const r = RTR.create(React.createElement(MicButtonTooltip));
    expect(r.toJSON()).toBeNull();
  });

  it("forwards context handlers to AnchoredTooltip when visible", () => {
    const onTryItNow = jest.fn();
    const onDismiss = jest.fn();
    mockTooltipState.current = {
      isVisible: true,
      voiceTooltipSeen: false,
      onVoiceStepAction: jest.fn(),
      onTryItNow,
      onDismiss,
    };
    RTR.create(React.createElement(MicButtonTooltip));
    expect(mockAnchoredTooltip).toHaveBeenCalled();
    const props = mockAnchoredTooltip.mock.calls[0][0];
    expect(props.visible).toBe(true);
    expect(props.title).toBe("mic_button_tooltip_title");
    expect(props.body).toBe("mic_button_tooltip_body");
    expect(props.primaryLabel).toBe("mic_button_tooltip_try_it_now");
    expect(props.onPrimaryPress).toBe(onTryItNow);
    expect(props.onClose).toBe(onDismiss);
  });

  it("wires hardware back to onDismiss (X semantics), not onTryItNow", () => {
    const onTryItNow = jest.fn();
    const onDismiss = jest.fn();
    mockTooltipState.current = {
      isVisible: true,
      voiceTooltipSeen: false,
      onVoiceStepAction: jest.fn(),
      onTryItNow,
      onDismiss,
    };
    RTR.create(React.createElement(MicButtonTooltip));
    expect(mockUseDismissOnBack).toHaveBeenCalledWith(true, onDismiss);
    // Crucially NOT called with onTryItNow.
    expect(mockUseDismissOnBack).not.toHaveBeenCalledWith(true, onTryItNow);
  });
});
