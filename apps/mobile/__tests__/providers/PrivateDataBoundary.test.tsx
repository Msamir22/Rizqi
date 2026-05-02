/**
 * PrivateDataBoundary.test.tsx
 *
 * Verifies that authenticated, in-memory app data is cleared when the
 * effective user changes or signs out.
 */

import React from "react";

interface ReactTestRendererInstance {
  update: (element: React.ReactElement) => void;
  unmount: () => void;
}

interface ReactTestRendererAct {
  (callback: () => Promise<void>): Promise<void>;
  (callback: () => void): void;
}

interface ReactTestRendererModule {
  act: ReactTestRendererAct;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

const mockClearQueryClient = jest.fn<Promise<void>, []>(() =>
  Promise.resolve()
);
let mockUserId: string | null = "user-1";

jest.mock("@/providers/QueryProvider", () => ({
  queryClient: {
    clear: (): Promise<void> => mockClearQueryClient(),
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: (): { user: { readonly id: string } | null } => ({
    user: mockUserId ? { id: mockUserId } : null,
  }),
}));

import { PrivateDataBoundary } from "@/providers/PrivateDataBoundary";

function renderBoundary(): ReactTestRendererInstance {
  return RTR.create(
    <PrivateDataBoundary>
      <React.Fragment />
    </PrivateDataBoundary>
  );
}

describe("PrivateDataBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = "user-1";
  });

  it("does not clear private cache on the initial render", () => {
    const renderer = renderBoundary();

    expect(mockClearQueryClient).not.toHaveBeenCalled();
    renderer.unmount();
  });

  it("clears private cache when the authenticated user changes", () => {
    const renderer = renderBoundary();

    RTR.act(() => {
      mockUserId = "user-2";
      renderer.update(
        <PrivateDataBoundary>
          <React.Fragment />
        </PrivateDataBoundary>
      );
    });

    expect(mockClearQueryClient).toHaveBeenCalledTimes(1);
    renderer.unmount();
  });

  it("clears private cache when the user signs out", () => {
    const renderer = renderBoundary();

    RTR.act(() => {
      mockUserId = null;
      renderer.update(
        <PrivateDataBoundary>
          <React.Fragment />
        </PrivateDataBoundary>
      );
    });

    expect(mockClearQueryClient).toHaveBeenCalledTimes(1);
    renderer.unmount();
  });
});
