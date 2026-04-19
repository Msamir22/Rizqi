/**
 * Jest global setup — mock native modules that aren't available in test env.
 */

/* eslint-disable @typescript-eslint/no-empty-function */

// Mock expo-haptics (uses native module)
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

// Mock @sentry/react-native — its module-level access of the native
// `RNSentry` TurboModule throws under Jest. Any test that transitively
// imports `utils/logger` (which wraps Sentry) would otherwise fail to load.
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  withScope: jest.fn((fn: (scope: unknown) => void) =>
    fn({
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setContext: jest.fn(),
    })
  ),
}));
