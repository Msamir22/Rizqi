/**
 * Unit tests for RetrySyncScreen.
 *
 * Regression guard (T033) for PR #238 review Finding #3:
 *   "The status chip must use the dedicated `sync_failed_chip` translation
 *    key, not a substring of `sync_failed_title`. The old `.split(' ').slice(-2)`
 *    approach breaks on Arabic (RTL + different word order)."
 *
 * Tests:
 * - Pressing Retry invokes `onRetry`.
 * - Pressing Sign out invokes `onSignOut`.
 * - The chip renders the `sync_failed_chip` translation key (not a derived
 *   slice of the title).
 */

import React from "react";
import { TouchableOpacity } from "react-native";

interface ReactTestRendererInstance {
  root: {
    findAllByType: (type: unknown) => Array<{
      props: Record<string, unknown>;
      children: unknown[];
    }>;
    findAllByProps: (matcher: Record<string, unknown>) => unknown[];
  };
  toJSON: () => unknown;
  unmount: () => void;
}
interface ReactTestRendererModule {
  act: (fn: () => void | Promise<void>) => void;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

// =============================================================================
// Mocks
// =============================================================================

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: (): { top: number; bottom: number } => ({
    top: 0,
    bottom: 0,
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: (): { t: (key: string) => string } => ({
    // Echo the key so we can assert the exact key being rendered.
    t: (key: string): string => key,
  }),
}));

// =============================================================================
// Under test
// =============================================================================

import { RetrySyncScreen } from "@/components/ui/RetrySyncScreen";

// =============================================================================
// Helpers
// =============================================================================

function collectText(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (typeof node === "object") {
    const maybe = node as { children?: unknown };
    collectText(maybe.children, out);
  }
}

function findButtonByLabel(
  renderer: ReactTestRendererInstance,
  label: string
): (() => void) | null {
  const buttons = renderer.root.findAllByType(TouchableOpacity);
  for (const btn of buttons) {
    const accessibilityLabel = btn.props.accessibilityLabel;
    if (accessibilityLabel === label) {
      return btn.props.onPress as () => void;
    }
  }
  return null;
}

// =============================================================================
// Tests
// =============================================================================

describe("RetrySyncScreen", () => {
  it("invokes onRetry when the Retry button is pressed", () => {
    const onRetry = jest.fn();
    const onSignOut = jest.fn();

    const renderer = RTR.create(
      React.createElement(RetrySyncScreen, { onRetry, onSignOut })
    );

    const handler = findButtonByLabel(renderer, "retry");
    expect(handler).not.toBeNull();
    handler?.();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("invokes onSignOut when the Sign out button is pressed", () => {
    const onRetry = jest.fn();
    const onSignOut = jest.fn();

    const renderer = RTR.create(
      React.createElement(RetrySyncScreen, { onRetry, onSignOut })
    );

    const handler = findButtonByLabel(renderer, "sign_out");
    expect(handler).not.toBeNull();
    handler?.();

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("renders the dedicated `sync_failed_chip` key — not a substring derived from `sync_failed_title` (Finding #3)", () => {
    const renderer = RTR.create(
      React.createElement(RetrySyncScreen, {
        onRetry: jest.fn(),
        onSignOut: jest.fn(),
      })
    );

    const texts: string[] = [];
    collectText(renderer.toJSON(), texts);

    // The dedicated chip key must be present; if a regression reintroduced
    // the old `sync_failed_title.split(" ").slice(-2)` logic, the string
    // "sync_failed_chip" would NOT appear anywhere in the output.
    expect(texts).toContain("sync_failed_chip");
    // And the title should still render as a separate string — proving
    // the chip is a distinct key, not a derivation from the title.
    expect(texts).toContain("sync_failed_title");
  });
});
