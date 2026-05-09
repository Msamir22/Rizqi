import React from "react";
import { render, type RenderAPI } from "@testing-library/react-native";

interface MockAuthState {
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
}

const mockUseAuth = jest.fn<MockAuthState, []>();
const mockReplace = jest.fn();
let mockRootNavigationReady = true;

function mockCreatePassThroughProvider(testID: string): React.ComponentType<{
  readonly children: React.ReactNode;
}> {
  function MockProvider({
    children,
  }: {
    readonly children: React.ReactNode;
  }): React.ReactElement {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    return React.createElement(RN.View, { testID }, children);
  }

  return MockProvider;
}

jest.mock("expo-router", () => {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  const ReactMod = require("react");
  const RN = require("react-native");

  const Stack = (props: {
    readonly children: React.ReactNode;
  }): React.ReactElement =>
    ReactMod.createElement(
      RN.View,
      { testID: "private-stack" },
      props.children
    ) as React.ReactElement;
  Stack.Screen = (): null => null;

  return {
    Stack,
    router: {
      replace: mockReplace,
    },
    useRootNavigationState: (): { key: string } | undefined =>
      mockRootNavigationReady ? { key: "root" } : undefined,
  };
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
});

jest.mock("react-i18next", () => ({
  useTranslation: (): { t: (key: string) => string } => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: (): MockAuthState => mockUseAuth(),
}));

jest.mock("@/components/AppReadyGate", () => ({
  AppReadyGate: (): React.ReactElement => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactMod = require("react") as typeof React;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require("react-native") as typeof import("react-native");
    return ReactMod.createElement(RN.View, { testID: "app-ready-gate" });
  },
}));

jest.mock("@/providers/QueryProvider", () => ({
  QueryProvider: mockCreatePassThroughProvider("query-provider"),
}));

jest.mock("@/providers/DatabaseProvider", () => ({
  DatabaseProvider: mockCreatePassThroughProvider("database-provider"),
}));

jest.mock("@/providers/PrivateDataBoundary", () => ({
  PrivateDataBoundary: mockCreatePassThroughProvider("private-data-boundary"),
}));

jest.mock("@/providers/SyncProvider", () => ({
  SyncProvider: mockCreatePassThroughProvider("sync-provider"),
}));

jest.mock("@/providers/MarketRatesRealtimeProvider", () => ({
  MarketRatesRealtimeProvider: mockCreatePassThroughProvider(
    "market-rates-provider"
  ),
}));

jest.mock("@/context/CategoriesContext", () => ({
  CategoriesProvider: mockCreatePassThroughProvider("categories-provider"),
}));

jest.mock("@/context/SmsScanContext", () => ({
  SmsScanProvider: mockCreatePassThroughProvider("sms-scan-provider"),
}));

jest.mock("@/context/FirstRunTooltipContext", () => ({
  FirstRunTooltipProvider: mockCreatePassThroughProvider("first-run-provider"),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const PrivateLayoutModule = require("../../app/(private)/_layout.tsx") as {
  default: () => React.ReactNode;
};
const PrivateLayout = PrivateLayoutModule.default;

function renderLayout(): RenderAPI {
  return render(React.createElement(PrivateLayout));
}

describe("private route layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRootNavigationReady = true;
  });

  it("renders nothing while auth is still resolving", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    const { toJSON } = renderLayout();

    expect(toJSON()).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects signed-out private route access without mounting private providers", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    const { toJSON } = renderLayout();

    expect(toJSON()).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/auth");
  });

  it("mounts private runtime providers only for authenticated users", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    const { queryAllByTestId } = renderLayout();

    expect(queryAllByTestId("sync-provider").length).toBeGreaterThan(0);
    expect(queryAllByTestId("categories-provider").length).toBeGreaterThan(0);
    expect(queryAllByTestId("private-stack").length).toBeGreaterThan(0);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
