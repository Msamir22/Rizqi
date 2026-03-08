/**
 * Unit tests for auth-service OAuth flow orchestration
 *
 * Tests T011–T012 from tasks.md:
 * - T011: linkIdentityWithProvider calls Supabase linkIdentity with correct provider
 * - T012: Error handling for network failure and duplicate account
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLinkIdentity = jest.fn();

const mockRefreshSession = jest.fn<
  Promise<{ data: unknown; error: unknown }>,
  unknown[]
>();
const mockGetUser = jest.fn<
  Promise<{
    data: {
      user: { identities: Array<{ id: string }>; is_anonymous: boolean } | null;
    };
    error: unknown;
  }>,
  unknown[]
>();

jest.mock("@/services/supabase", () => ({
  linkIdentityWithProvider: (...args: unknown[]): Promise<unknown> =>
    mockLinkIdentity(...args) as Promise<unknown>,
  supabase: {
    auth: {
      refreshSession: (...args: unknown[]): Promise<unknown> =>
        mockRefreshSession(...args) as Promise<unknown>,
      getUser: (...args: unknown[]): Promise<unknown> =>
        mockGetUser(...args) as Promise<unknown>,
    },
  },
}));

jest.mock("@/constants/auth-constants", () => ({
  AUTH_REDIRECT_URL: "astik://auth-callback",
}));

const mockOpenAuthSession = jest.fn<Promise<{ type: string }>, unknown[]>();

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]): Promise<unknown> =>
    mockOpenAuthSession(...args) as Promise<unknown>,
  WebBrowserResultType: {
    CANCEL: "cancel",
    DISMISS: "dismiss",
    SUCCESS: "success",
  },
}));

// Import after mocks
import { initiateOAuthLink } from "../../services/auth-service";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/**
 * Creates an AuthError-shaped object that passes `isAuthError()` type guard.
 * Supabase type guards check for `__isAuthError` property on the object.
 */
function createAuthError(
  message: string,
  code: string,
  status = 422
): Error & { __isAuthError: boolean; code: string; status: number } {
  const error = new Error(message) as Error & {
    __isAuthError: boolean;
    code: string;
    status: number;
  };
  error.name = "AuthApiError";
  error.__isAuthError = true;
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Creates an AuthRetryableFetchError-shaped object that passes
 * `isAuthRetryableFetchError()` type guard.
 */
function createRetryableFetchError(
  message: string
): Error & { __isAuthError: boolean; status: number } {
  const error = new Error(message) as Error & {
    __isAuthError: boolean;
    status: number;
  };
  error.name = "AuthRetryableFetchError";
  error.__isAuthError = true;
  error.status = 0;
  return error;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("auth-service - initiateOAuthLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks for the success path
    mockRefreshSession.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          identities: [{ id: "identity-1" }],
          is_anonymous: false,
        },
      },
      error: null,
    });
  });

  // =========================================================================
  // T011: linkIdentityWithProvider calls correct provider
  // =========================================================================

  describe("T011: successful OAuth flows", () => {
    it("calls linkIdentityWithProvider with 'google' and opens browser", async () => {
      mockLinkIdentity.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/auth?...",
      });
      mockOpenAuthSession.mockResolvedValue({
        type: "success",
      });

      const result = await initiateOAuthLink("google");

      expect(mockLinkIdentity).toHaveBeenCalledWith("google");
      expect(mockOpenAuthSession).toHaveBeenCalledWith(
        "https://accounts.google.com/o/oauth2/auth?...",
        "astik://auth-callback"
      );
      expect(result).toEqual({ success: true });
    });

    it("calls linkIdentityWithProvider with 'facebook'", async () => {
      mockLinkIdentity.mockResolvedValue({
        url: "https://www.facebook.com/v18.0/dialog/oauth?...",
      });
      mockOpenAuthSession.mockResolvedValue({
        type: "success",
      });

      const result = await initiateOAuthLink("facebook");

      expect(mockLinkIdentity).toHaveBeenCalledWith("facebook");
      expect(result).toEqual({ success: true });
    });

    it("calls linkIdentityWithProvider with 'apple'", async () => {
      mockLinkIdentity.mockResolvedValue({
        url: "https://appleid.apple.com/auth/authorize?...",
      });
      mockOpenAuthSession.mockResolvedValue({
        type: "success",
      });

      const result = await initiateOAuthLink("apple");

      expect(mockLinkIdentity).toHaveBeenCalledWith("apple");
      expect(result).toEqual({ success: true });
    });
  });

  // =========================================================================
  // T012: Error handling
  // =========================================================================

  describe("T012: error handling", () => {
    it("returns human-readable error for network failure", async () => {
      mockLinkIdentity.mockResolvedValue({
        error: createRetryableFetchError("TypeError: Network request failed"),
      });

      const result = await initiateOAuthLink("google");

      expect(result).toEqual({
        success: false,
        error:
          "No internet connection. Please check your network and try again.",
      });
    });

    it("returns human-readable error for duplicate account (identity already exists)", async () => {
      mockLinkIdentity.mockResolvedValue({
        error: createAuthError(
          "Identity already exists for this user",
          "identity_already_exists"
        ),
      });

      const result = await initiateOAuthLink("google");

      expect(result).toEqual({
        success: false,
        error:
          "This account is already linked to another user. Please use a different account.",
      });
    });

    it("returns generic error for unknown failures", async () => {
      mockLinkIdentity.mockResolvedValue({
        error: createAuthError("Some unexpected error", "unexpected_failure"),
      });

      const result = await initiateOAuthLink("google");

      expect(result).toEqual({
        success: false,
        error: "Something went wrong during sign-in. Please try again.",
      });
    });

    it("returns cancelled error when user dismisses browser", async () => {
      mockLinkIdentity.mockResolvedValue({
        url: "https://accounts.google.com/...",
      });
      mockOpenAuthSession.mockResolvedValue({
        type: "cancel",
      });

      const result = await initiateOAuthLink("google");

      expect(result).toEqual({
        success: false,
        error: "Sign-in was cancelled.",
      });
    });

    it("handles thrown exceptions gracefully", async () => {
      mockLinkIdentity.mockRejectedValue(
        createRetryableFetchError("Unexpected network error from fetch")
      );

      const result = await initiateOAuthLink("google");

      expect(result).toEqual({
        success: false,
        error:
          "No internet connection. Please check your network and try again.",
      });
    });

    it("returns error when refreshSession fails", async () => {
      mockLinkIdentity.mockResolvedValue({
        url: "https://accounts.google.com/...",
      });
      mockOpenAuthSession.mockResolvedValue({ type: "success" });
      mockRefreshSession.mockResolvedValue({
        data: {},
        error: createRetryableFetchError("Network failure during refresh"),
      });

      const result = await initiateOAuthLink("google");

      expect(result).toEqual({
        success: false,
        error:
          "No internet connection. Please check your network and try again.",
      });
    });

    it("returns error when getUser fails after successful browser flow", async () => {
      mockLinkIdentity.mockResolvedValue({
        url: "https://accounts.google.com/...",
      });
      mockOpenAuthSession.mockResolvedValue({ type: "success" });
      mockRefreshSession.mockResolvedValue({ data: {}, error: null });
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: createRetryableFetchError("Network failure during getUser"),
      });

      const result = await initiateOAuthLink("google");

      expect(result).toEqual({
        success: false,
        error:
          "No internet connection. Please check your network and try again.",
      });
    });

    it("returns 'already linked' when browser succeeds but identity still anonymous (silent 422)", async () => {
      // This covers the case where Supabase returns a 302 redirect even
      // when linkIdentity fails server-side with 422.
      mockLinkIdentity.mockResolvedValue({
        url: "https://accounts.google.com/...",
      });
      mockOpenAuthSession.mockResolvedValue({ type: "success" });
      mockRefreshSession.mockResolvedValue({ data: {}, error: null });
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            identities: [],
            is_anonymous: true,
          },
        },
        error: null,
      });

      const result = await initiateOAuthLink("google");

      expect(result).toEqual({
        success: false,
        error:
          "This account is already linked to another user. Please try a different account.",
      });
    });
  });
});
