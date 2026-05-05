/**
 * Unit tests for auth-service
 *
 * Tests public API functions:
 * - signInWithOAuth (success, PKCE, error, cancellation, exceptions)
 * - signUpWithEmail (success, error)
 * - signInWithEmail (success)
 * - requestPasswordReset (success)
 *
 * Mock Strategy:
 *   - supabase is mocked via jest.mock to control signInWithOAuthProvider,
 *     setSession, exchangeCodeForSession, signUpWithEmail, signInWithEmail,
 *     and resetPasswordForEmail
 *   - expo-web-browser is mocked for openAuthSessionAsync and
 *     dismissAuthSession
 *   - @supabase/supabase-js error helpers are mocked for network error
 *     detection
 */

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// ---------------------------------------------------------------------------

const mockSignInWithOAuthProvider = jest.fn();
const mockSetSession = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSignUpWithEmail = jest.fn();
const mockSignInWithEmailFn = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockReadIntroLocaleOverride = jest.fn();
const mockSetPendingSignupLocale = jest.fn();
const mockGetCurrentLanguage = jest.fn();

jest.mock("@/services/supabase", () => ({
  signInWithOAuthProvider: (...args: unknown[]): Promise<unknown> =>
    mockSignInWithOAuthProvider(...args) as Promise<unknown>,
  signUpWithEmail: (...args: unknown[]): Promise<unknown> =>
    mockSignUpWithEmail(...args) as Promise<unknown>,
  signInWithEmail: (...args: unknown[]): Promise<unknown> =>
    mockSignInWithEmailFn(...args) as Promise<unknown>,
  resetPasswordForEmail: (...args: unknown[]): Promise<unknown> =>
    mockResetPasswordForEmail(...args) as Promise<unknown>,
  supabase: {
    auth: {
      setSession: (...args: unknown[]): Promise<unknown> =>
        mockSetSession(...args) as Promise<unknown>,
      exchangeCodeForSession: (...args: unknown[]): Promise<unknown> =>
        mockExchangeCodeForSession(...args) as Promise<unknown>,
    },
  },
}));

jest.mock("@/constants/auth-constants", () => ({
  AUTH_REDIRECT_URL: "monyvi://auth-callback",
}));

jest.mock("@/services/intro-flag-service", () => ({
  readIntroLocaleOverride: (): Promise<"en" | "ar" | null> =>
    mockReadIntroLocaleOverride() as Promise<"en" | "ar" | null>,
  setPendingSignupLocale: (...args: unknown[]): Promise<void> =>
    mockSetPendingSignupLocale(...args) as Promise<void>,
}));

jest.mock("@/i18n/changeLanguage", () => ({
  getCurrentLanguage: (): "en" | "ar" =>
    mockGetCurrentLanguage() as "en" | "ar",
}));

const mockOpenAuthSession = jest.fn<
  Promise<{ type: string; url?: string }>,
  unknown[]
>();
const mockDismissAuthSession = jest.fn();

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]): Promise<unknown> =>
    mockOpenAuthSession(...args) as Promise<unknown>,
  dismissAuthSession: (...args: unknown[]): unknown =>
    mockDismissAuthSession(...args) as unknown,
  WebBrowserResultType: {
    CANCEL: "cancel",
    DISMISS: "dismiss",
    SUCCESS: "success",
  },
}));

// Import after mocks
import {
  signInWithOAuth,
  signUpWithEmail,
  signInWithEmail,
  requestPasswordReset,
} from "../../services/auth-service";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

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
// Test Suite: signInWithOAuth
// ---------------------------------------------------------------------------

describe("auth-service - signInWithOAuth", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("success flows", () => {
    it("calls signInWithOAuthProvider with 'google' and opens browser", async () => {
      mockSignInWithOAuthProvider.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/auth?...",
      });
      mockOpenAuthSession.mockResolvedValue({
        type: "success",
        url: "monyvi://auth-callback#access_token=test-token&refresh_token=test-refresh&token_type=bearer",
      });
      mockSetSession.mockResolvedValue({ data: { session: {} }, error: null });

      const result = await signInWithOAuth("google");

      expect(mockSignInWithOAuthProvider).toHaveBeenCalledWith("google");
      expect(mockOpenAuthSession).toHaveBeenCalledWith(
        "https://accounts.google.com/o/oauth2/auth?...",
        "monyvi://auth-callback"
      );
      expect(result).toEqual({ success: true });
    });

    it("extracts PKCE code from redirect URL and calls exchangeCodeForSession", async () => {
      mockSignInWithOAuthProvider.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/auth?...",
      });
      mockOpenAuthSession.mockResolvedValue({
        type: "success",
        url: "monyvi://auth-callback?code=pkce-auth-code",
      });
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: {} },
        error: null,
      });

      const result = await signInWithOAuth("google");

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("pkce-auth-code");
      expect(mockSetSession).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("returns error when redirect URL has no tokens or code", async () => {
      mockSignInWithOAuthProvider.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/auth?...",
      });
      mockOpenAuthSession.mockResolvedValue({
        type: "success",
        url: "monyvi://auth-callback",
      });

      const result = await signInWithOAuth("google");

      expect(result).toEqual({
        success: false,
        error: "Could not extract session from the sign-in response.",
        errorCode: "unknown",
      });
    });

    it("propagates errorCode from setSession failure (e.g. network error)", async () => {
      mockSignInWithOAuthProvider.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/auth?...",
      });
      mockOpenAuthSession.mockResolvedValue({
        type: "success",
        url: "monyvi://auth-callback#access_token=test-token&refresh_token=test-refresh",
      });
      mockSetSession.mockResolvedValue({
        data: { session: null },
        error: createRetryableFetchError("Network failed"),
      });

      const result = await signInWithOAuth("google");

      expect(result).toEqual({
        success: false,
        error:
          "No internet connection. Please check your network and try again.",
        errorCode: "network",
      });
    });
  });

  describe("error handling", () => {
    it("returns error result when credentials are invalid", async () => {
      const mockError = {
        message: "Invalid login credentials",
        status: 400,
        name: "AuthApiError",
      };

      mockSignInWithEmailFn.mockResolvedValue({
        success: false,
        error: mockError,
      });

      const result = await signInWithEmail("test@example.com", "wrongpassword");

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it("returns network error when signInWithOAuthProvider fails", async () => {
      mockSignInWithOAuthProvider.mockResolvedValue({
        error: createRetryableFetchError("Network error"),
      });

      const result = await signInWithOAuth("google");

      expect(result).toEqual({
        success: false,
        error:
          "No internet connection. Please check your network and try again.",
        errorCode: "network",
      });
    });

    it("returns cancelled when user dismisses browser", async () => {
      mockSignInWithOAuthProvider.mockResolvedValue({
        url: "https://accounts.google.com/...",
      });
      mockOpenAuthSession.mockResolvedValue({ type: "cancel" });

      const result = await signInWithOAuth("google");

      expect(result).toEqual({
        success: false,
        error: "Sign-in was cancelled.",
        errorCode: "cancelled",
      });
    });

    it("handles thrown exceptions gracefully", async () => {
      mockSignInWithOAuthProvider.mockRejectedValue(
        new Error("Unexpected error")
      );

      const result = await signInWithOAuth("google");

      expect(result).toEqual({
        success: false,
        error: "Something went wrong during sign-in. Please try again.",
        errorCode: "unknown",
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Test Suite: signUpWithEmail
// ---------------------------------------------------------------------------

describe("auth-service - signUpWithEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadIntroLocaleOverride.mockResolvedValue(null);
    mockGetCurrentLanguage.mockReturnValue("en");
  });

  it("delegates to supabase signUpWithEmail and returns result", async () => {
    mockSignUpWithEmail.mockResolvedValue({
      success: true,
      needsVerification: true,
      userId: "signup-user-1",
      userCreatedAt: "2026-05-05T10:00:00.000Z",
    });

    const result = await signUpWithEmail("test@example.com", "password123");

    expect(mockSignUpWithEmail).toHaveBeenCalledWith(
      "test@example.com",
      "password123",
      { preferredLanguage: "en" }
    );
    expect(mockSetPendingSignupLocale).toHaveBeenCalledWith(
      "test@example.com",
      "en",
      "signup-user-1",
      "2026-05-05T10:00:00.000Z"
    );
    expect(result.needsVerification).toBe(true);
    expect(result.success).toBe(true);
  });

  it("passes the pre-auth Arabic language override into signup metadata", async () => {
    mockReadIntroLocaleOverride.mockResolvedValueOnce("ar");
    mockSignUpWithEmail.mockResolvedValue({
      success: true,
      needsVerification: true,
      userId: "signup-user-2",
      userCreatedAt: "2026-05-05T10:00:00.000Z",
    });

    await signUpWithEmail("arabic@example.com", "password123");

    expect(mockSignUpWithEmail).toHaveBeenCalledWith(
      "arabic@example.com",
      "password123",
      { preferredLanguage: "ar" }
    );
    expect(mockSetPendingSignupLocale).toHaveBeenCalledWith(
      "arabic@example.com",
      "ar",
      "signup-user-2",
      "2026-05-05T10:00:00.000Z"
    );
  });

  it("falls back to the current Arabic app language for signup metadata", async () => {
    mockReadIntroLocaleOverride.mockResolvedValueOnce(null);
    mockGetCurrentLanguage.mockReturnValueOnce("ar");
    mockSignUpWithEmail.mockResolvedValue({
      success: true,
      needsVerification: true,
      userId: "signup-user-3",
      userCreatedAt: "2026-05-05T10:00:00.000Z",
    });

    const result = await signUpWithEmail(
      "arabic-fallback@example.com",
      "password123"
    );

    expect(mockSignUpWithEmail).toHaveBeenCalledWith(
      "arabic-fallback@example.com",
      "password123",
      { preferredLanguage: "ar" }
    );
    expect(mockSetPendingSignupLocale).toHaveBeenCalledWith(
      "arabic-fallback@example.com",
      "ar",
      "signup-user-3",
      "2026-05-05T10:00:00.000Z"
    );
    expect(result.success).toBe(true);
  });

  it("returns error result when supabase signUpWithEmail fails", async () => {
    const mockError = {
      message: "User already registered",
      status: 422,
      name: "AuthApiError",
    };

    mockSignUpWithEmail.mockResolvedValue({
      success: false,
      error: mockError,
      needsVerification: false,
    });

    const result = await signUpWithEmail("existing@example.com", "password123");

    expect(mockSignUpWithEmail).toHaveBeenCalledWith(
      "existing@example.com",
      "password123",
      { preferredLanguage: "en" }
    );
    expect(mockSetPendingSignupLocale).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toEqual(mockError);
  });
});

// ---------------------------------------------------------------------------
// Test Suite: signInWithEmail
// ---------------------------------------------------------------------------

describe("auth-service - signInWithEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates to supabase signInWithEmail and returns result", async () => {
    mockSignInWithEmailFn.mockResolvedValue({
      user: { id: "user-1" },
      session: { access_token: "token" },
      needsVerification: false,
      error: null,
    });

    const result = await signInWithEmail("test@example.com", "password123");

    expect(mockSignInWithEmailFn).toHaveBeenCalledWith(
      "test@example.com",
      "password123"
    );
    expect(result.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test Suite: requestPasswordReset
// ---------------------------------------------------------------------------

describe("auth-service - requestPasswordReset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates to supabase resetPasswordForEmail and returns result", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: null,
    });

    const result = await requestPasswordReset("test@example.com");

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("test@example.com");
    expect(result.error).toBeNull();
  });
});
