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

// Mock @expo/vector-icons — module-level load checks expo-font's
// loadedNativeFonts which is not initialized under the jest-expo preset.
// Tests that render components using these icons would otherwise crash
// with "loadedNativeFonts.forEach is not a function".
jest.mock("@expo/vector-icons", () => {
  const NullIcon = (): null => null;
  return new Proxy(
    {},
    {
      get: (): typeof NullIcon => NullIcon,
    }
  );
});

// Mock the internal AppState module that react-native/index.js re-requires
// on every property access. Patching the returned object in place does not
// stick, so we mock the underlying module directly. We cannot `jest.mock`
// the whole "react-native" module (breaks jest-expo's component mocks which
// read `displayName` on every exported component during setup).
jest.mock("react-native/Libraries/AppState/AppState", () => ({
  currentState: "active",
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
}));

// Ditto — the individual icon-family entrypoints used directly by some files.
jest.mock("@expo/vector-icons/Ionicons", () => {
  const NullIcon = (): null => null;
  return { __esModule: true, default: NullIcon };
});
jest.mock("@expo/vector-icons/FontAwesome5", () => {
  const NullIcon = (): null => null;
  return { __esModule: true, default: NullIcon };
});
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => {
  const NullIcon = (): null => null;
  return { __esModule: true, default: NullIcon };
});
