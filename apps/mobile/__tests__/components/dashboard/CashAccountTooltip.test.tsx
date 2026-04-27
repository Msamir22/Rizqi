/**
 * Unit tests for CashAccountTooltip (T059).
 *
 * Validates the self-gating visibility logic required by spec FR-017/FR-020:
 *  (a) not rendered when !isFirstRunPending
 *  (b) not rendered when SMS prompt is visible (shouldShowPrompt === true)
 *  (c) not rendered when onboardingFlags.cash_account_tooltip_dismissed === true
 *  (d) rendered when all three conditions are satisfied
 *      — and dismissal writes the flag AND calls markFirstRunConsumed()
 *
 * Implementation notes for these tests:
 * - The component now polls `anchorRef.current.measureInWindow` until the
 *   anchor reports a non-zero size (so the tooltip can land at the right
 *   on-screen Y), then defers `tooltipReady` to the next animation frame.
 *   The tests provide a mock anchor that synchronously reports a
 *   non-zero size, then flush both pending timers and microtasks via
 *   `act()` so the two-stage gating advances to the visible state in one
 *   deterministic step.
 */

import React from "react";
import { View } from "react-native";

interface ReactTestRendererInstance {
  root: {
    findByType: (type: unknown) => { props: Record<string, unknown> };
    findAllByType: (type: unknown) => Array<{ props: Record<string, unknown> }>;
  };
  toJSON: () => unknown;
  unmount: () => void;
}
interface ReactTestRendererModule {
  act: (fn: () => void | Promise<void>) => void | Promise<void>;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

// =============================================================================
// Mocks — each test overrides return values via mocked module exports.
// =============================================================================

const mockFirstRunCtx = {
  isFirstRunPending: false,
  markFirstRunPending: jest.fn(),
  markFirstRunConsumed: jest.fn(),
};

const mockFlags: {
  cash_account_tooltip_dismissed?: boolean;
  voice_tooltip_seen?: boolean;
} = {};

// `isSmsPromptVisible` is now a prop (not a hook instantiation inside the
// component), so we hold it in a closure var the tests can flip.
let mockIsSmsPromptVisible = false;

jest.mock("@/context/FirstRunTooltipContext", () => ({
  useFirstRunTooltip: () => mockFirstRunCtx,
}));

jest.mock("@/hooks/useOnboardingFlags", () => ({
  useOnboardingFlags: () => mockFlags,
}));

jest.mock("@/hooks/useDismissOnBack", () => ({
  useDismissOnBack: jest.fn(),
}));

const mockSetOnboardingFlag = jest.fn<Promise<void>, [string, boolean]>(() =>
  Promise.resolve()
);
jest.mock("@/services/profile-service", () => ({
  setOnboardingFlag: (key: string, value: boolean) =>
    mockSetOnboardingFlag(key, value),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockAnchoredTooltip = jest.fn(
  (_props: Record<string, unknown>) => null as unknown
);
jest.mock("@/components/ui/AnchoredTooltip", () => ({
  AnchoredTooltip: (props: Record<string, unknown>) =>
    mockAnchoredTooltip(props),
}));

// eslint-disable-next-line import/first
import { CashAccountTooltip } from "@/components/dashboard/CashAccountTooltip";

// =============================================================================
// Helpers
// =============================================================================

interface Overrides {
  isFirstRunPending?: boolean;
  shouldShowPrompt?: boolean;
  cash_account_tooltip_dismissed?: boolean;
}

function resetCtx(overrides: Overrides): void {
  mockFirstRunCtx.isFirstRunPending = overrides.isFirstRunPending ?? false;
  mockIsSmsPromptVisible = overrides.shouldShowPrompt ?? false;
  mockFlags.cash_account_tooltip_dismissed =
    overrides.cash_account_tooltip_dismissed ?? undefined;
}

/**
 * Mock anchor whose `measureInWindow` synchronously reports a non-zero
 * size — that's the signal the component polls for before flipping
 * `anchorReady`. Real RN refs are populated on commit; in tests we
 * fake the shape directly so the polling effect succeeds on its first
 * tick.
 */
function makeMeasurableAnchor(): React.RefObject<View> {
  const fakeView = {
    measureInWindow: (
      cb: (x: number, y: number, width: number, height: number) => void
    ): void => {
      cb(0, 100, 200, 50);
    },
  };
  // We cast through `unknown` because the test ref doesn't implement the
  // full `View` interface — only the methods the component actually
  // calls (`measureInWindow`).
  return { current: fakeView } as unknown as React.RefObject<View>;
}

/**
 * Render the tooltip and flush the two-stage gating (poll anchor → rAF
 * to flip tooltipReady) so AnchoredTooltip's render-call assertions
 * have something to inspect synchronously after `renderTooltip`.
 */
function renderTooltip(): ReactTestRendererInstance {
  const anchorRef = makeMeasurableAnchor();
  let instance!: ReactTestRendererInstance;
  RTR.act(() => {
    instance = RTR.create(
      React.createElement(CashAccountTooltip, {
        anchorRef,
        isSmsPromptVisible: mockIsSmsPromptVisible,
      })
    );
  });
  // First effect: poll → anchor.measureInWindow → setAnchorReady(true).
  // Second effect: rAF → setTooltipReady(true). Advance both.
  RTR.act(() => {
    jest.runOnlyPendingTimers();
  });
  RTR.act(() => {
    jest.runOnlyPendingTimers();
  });
  return instance;
}

// =============================================================================
// Tests
// =============================================================================

describe("CashAccountTooltip", () => {
  beforeEach(() => {
    // Modern fake timers cover both setInterval (used by the anchor
    // poll) and requestAnimationFrame (used by the show-after-scroll
    // step), which lets a single `runOnlyPendingTimers` flush both.
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetCtx({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders null when isFirstRunPending is false", () => {
    resetCtx({ isFirstRunPending: false });
    const r = renderTooltip();
    expect(r.toJSON()).toBeNull();
    expect(mockAnchoredTooltip).not.toHaveBeenCalled();
  });

  it("renders null when SMS prompt is visible (gating by isSmsPromptVisible prop)", () => {
    resetCtx({ isFirstRunPending: true, shouldShowPrompt: true });
    const r = renderTooltip();
    expect(r.toJSON()).toBeNull();
    expect(mockAnchoredTooltip).not.toHaveBeenCalled();
  });

  it("renders null when the tooltip has already been dismissed", () => {
    resetCtx({
      isFirstRunPending: true,
      shouldShowPrompt: false,
      cash_account_tooltip_dismissed: true,
    });
    const r = renderTooltip();
    expect(r.toJSON()).toBeNull();
    expect(mockAnchoredTooltip).not.toHaveBeenCalled();
  });

  it("renders AnchoredTooltip when all three conditions are satisfied", () => {
    resetCtx({ isFirstRunPending: true });
    renderTooltip();
    expect(mockAnchoredTooltip).toHaveBeenCalled();
    // The component re-renders multiple times as the gating state
    // advances; the LAST call is the one with `visible: true`.
    const lastCall =
      mockAnchoredTooltip.mock.calls[mockAnchoredTooltip.mock.calls.length - 1];
    const props = lastCall[0];
    expect(props.visible).toBe(true);
    expect(props.title).toBe("cash_account_tooltip_title");
    expect(props.body).toBe("cash_account_tooltip_body");
    expect(props.primaryLabel).toBe("cash_account_tooltip_got_it");
  });

  it("dismissal writes the flag and calls markFirstRunConsumed", async () => {
    resetCtx({ isFirstRunPending: true });
    renderTooltip();

    expect(mockAnchoredTooltip).toHaveBeenCalled();
    const lastCall =
      mockAnchoredTooltip.mock.calls[mockAnchoredTooltip.mock.calls.length - 1];
    const props = lastCall[0];
    const onPrimary = props.onPrimaryPress as () => void;

    RTR.act(() => {
      onPrimary();
    });

    // setOnboardingFlag resolves → markFirstRunConsumed() runs. Flush
    // microtasks. Use real timers briefly so the awaited Promise
    // microtask queue drains predictably.
    jest.useRealTimers();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSetOnboardingFlag).toHaveBeenCalledWith(
      "cash_account_tooltip_dismissed",
      true
    );
    expect(mockFirstRunCtx.markFirstRunConsumed).toHaveBeenCalled();
  });
});
