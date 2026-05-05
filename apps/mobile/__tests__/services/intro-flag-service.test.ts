import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  readIntroSeen,
  markIntroSeen,
  readIntroLocaleOverride,
  setIntroLocaleOverride,
  readPendingSignupLocale,
  setPendingSignupLocale,
  clearPendingSignupLocale,
} from "@/services/intro-flag-service";

jest.mock("@react-native-async-storage/async-storage");
const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;
const mockRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<
  typeof AsyncStorage.removeItem
>;

describe("intro-flag-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("readIntroSeen", () => {
    it("returns false when key is not set", async () => {
      mockGetItem.mockResolvedValueOnce(null);
      expect(await readIntroSeen()).toBe(false);
    });

    it("returns true when key is 'true'", async () => {
      mockGetItem.mockResolvedValueOnce("true");
      expect(await readIntroSeen()).toBe(true);
    });

    it("returns false for unexpected values", async () => {
      mockGetItem.mockResolvedValueOnce("false");
      expect(await readIntroSeen()).toBe(false);
    });

    it("returns false on AsyncStorage error", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("storage error"));
      expect(await readIntroSeen()).toBe(false);
    });
  });

  describe("markIntroSeen", () => {
    it("writes 'true' to INTRO_SEEN_KEY", async () => {
      mockSetItem.mockResolvedValueOnce();
      await markIntroSeen();
      expect(mockSetItem).toHaveBeenCalledWith("@monyvi/intro-seen", "true");
    });

    it("is idempotent — calling twice writes same value", async () => {
      mockSetItem.mockResolvedValue();
      await markIntroSeen();
      await markIntroSeen();
      expect(mockSetItem).toHaveBeenCalledTimes(2);
      expect(mockSetItem).toHaveBeenNthCalledWith(
        2,
        "@monyvi/intro-seen",
        "true"
      );
    });
  });

  describe("readIntroLocaleOverride", () => {
    it("returns null when key is not set", async () => {
      mockGetItem.mockResolvedValueOnce(null);
      expect(await readIntroLocaleOverride()).toBeNull();
    });

    it("returns 'en' for english override", async () => {
      mockGetItem.mockResolvedValueOnce("en");
      expect(await readIntroLocaleOverride()).toBe("en");
    });

    it("returns 'ar' for arabic override", async () => {
      mockGetItem.mockResolvedValueOnce("ar");
      expect(await readIntroLocaleOverride()).toBe("ar");
    });

    it("returns null for invalid values", async () => {
      mockGetItem.mockResolvedValueOnce("fr");
      expect(await readIntroLocaleOverride()).toBeNull();
    });
  });

  describe("setIntroLocaleOverride", () => {
    it("persists the language value", async () => {
      mockSetItem.mockResolvedValueOnce();
      await setIntroLocaleOverride("ar");
      expect(mockSetItem).toHaveBeenCalledWith(
        "@monyvi/intro-locale-override",
        "ar"
      );
    });

    it("does not clear on sign-up (override persists)", () => {
      // Verify no clearIntroLocaleOverride export exists (FR-030).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const svc = require("@/services/intro-flag-service") as Record<
        string,
        unknown
      >;
      expect(svc.clearIntroLocaleOverride).toBeUndefined();
    });
  });

  describe("pending signup locale", () => {
    it("persists a normalized email with the signup language", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-05-05T10:00:00.000Z"));
      mockSetItem.mockResolvedValueOnce();

      await setPendingSignupLocale(
        " New@Example.COM ",
        "ar",
        " signup-user-1 ",
        "2026-05-05T09:59:57.000Z"
      );

      expect(mockSetItem).toHaveBeenCalledWith(
        "@monyvi/pending-signup-locale",
        JSON.stringify({
          email: "new@example.com",
          language: "ar",
          userId: "signup-user-1",
          userCreatedAt: "2026-05-05T09:59:57.000Z",
          markerCreatedAt: "2026-05-05T10:00:00.000Z",
        })
      );
      jest.useRealTimers();
    });

    it("reads a valid pending signup locale marker", async () => {
      mockGetItem.mockResolvedValueOnce(
        JSON.stringify({
          email: "New@Example.COM",
          language: "ar",
          userId: "signup-user-1",
          userCreatedAt: "2026-05-05T09:59:57.000Z",
          markerCreatedAt: "2026-05-05T10:00:00.000Z",
        })
      );

      await expect(readPendingSignupLocale()).resolves.toEqual({
        email: "new@example.com",
        language: "ar",
        userId: "signup-user-1",
        userCreatedAt: "2026-05-05T09:59:57.000Z",
        markerCreatedAt: "2026-05-05T10:00:00.000Z",
      });
    });

    it("returns null for invalid pending signup locale payloads", async () => {
      mockGetItem.mockResolvedValueOnce(
        JSON.stringify({
          email: "new@example.com",
          language: "fr",
          userId: "signup-user-1",
          userCreatedAt: "2026-05-05T09:59:57.000Z",
          markerCreatedAt: "2026-05-05T10:00:00.000Z",
        })
      );

      await expect(readPendingSignupLocale()).resolves.toBeNull();
    });

    it("clears the pending signup locale marker", async () => {
      mockRemoveItem.mockResolvedValueOnce();

      await clearPendingSignupLocale();

      expect(mockRemoveItem).toHaveBeenCalledWith(
        "@monyvi/pending-signup-locale"
      );
    });
  });
});
