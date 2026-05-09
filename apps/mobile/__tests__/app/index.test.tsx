import React from "react";

interface ReactTestRendererInstance {
  root: {
    findAllByProps: (m: Record<string, unknown>) => unknown[];
  };
  toJSON: () => unknown;
}

interface ReactTestRendererModule {
  create: (el: React.ReactElement) => ReactTestRendererInstance;
  act: (cb: () => void | Promise<void>) => void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

const mockUseAuth = jest.fn();
const mockUseIntroSeen = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }): React.ReactElement => {
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
    const ReactMod = require("react");
    const RN = require("react-native");
    return ReactMod.createElement(
      RN.View,
      { testID: "redirect", "data-href": props.href },
      null
    ) as React.ReactElement;
    /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  },
  useRouter: (): { replace: jest.Mock } => ({
    replace: mockRouterReplace,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: (): unknown => mockUseAuth(),
}));

jest.mock("@/hooks/useIntroSeen", () => ({
  useIntroSeen: (): unknown => mockUseIntroSeen(),
}));

jest.mock("@/components/ui/StartupLoadingView", () => {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  const ReactMod = require("react");
  const RN = require("react-native");
  return {
    StartupLoadingView: (): React.ReactElement =>
      ReactMod.createElement(RN.View, { testID: "startup-loading" }),
  };
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
});

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const IndexModule = require("../../app/index.tsx") as {
  default: () => React.ReactNode;
};
const Index = IndexModule.default;

function renderIndex(): ReactTestRendererInstance {
  return RTR.create(React.createElement(Index));
}

function findRedirectHref(
  renderer: ReactTestRendererInstance
): string | undefined {
  const hits = renderer.root.findAllByProps({ testID: "redirect" });
  const node = hits[0] as { props?: { [key: string]: unknown } } | undefined;
  return node?.props?.["data-href"] as string | undefined;
}

describe("public index route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing while auth or intro state is loading", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    mockUseIntroSeen.mockReturnValue({
      isSeen: false,
      isLoading: false,
    });

    expect(renderIndex().toJSON()).toBeNull();
  });

  it("routes first-time signed-out users to pitch", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    mockUseIntroSeen.mockReturnValue({
      isSeen: false,
      isLoading: false,
    });

    expect(findRedirectHref(renderIndex())).toBe("/pitch");
  });

  it("routes returning signed-out users to auth", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    mockUseIntroSeen.mockReturnValue({
      isSeen: true,
      isLoading: false,
    });

    expect(findRedirectHref(renderIndex())).toBe("/auth");
  });

  it("routes authenticated users into the private startup gate", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    mockUseIntroSeen.mockReturnValue({
      isSeen: true,
      isLoading: false,
    });

    let renderer: ReactTestRendererInstance | undefined;
    RTR.act(() => {
      renderer = renderIndex();
    });

    expect(
      renderer?.root.findAllByProps({ testID: "startup-loading" }).length
    ).toBeGreaterThan(0);
    expect(mockRouterReplace).toHaveBeenCalledWith("/startup");
  });
});
