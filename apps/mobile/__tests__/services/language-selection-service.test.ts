import { applyLanguageSelection } from "@/services/language-selection-service";
import { changeLanguage } from "@/i18n/changeLanguage";
import { setIntroLocaleOverride } from "@/services/intro-flag-service";
import { setPreferredLanguage } from "@/services/profile-service";

jest.mock("@/i18n/changeLanguage", () => ({
  changeLanguage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/intro-flag-service", () => ({
  setIntroLocaleOverride: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/profile-service", () => ({
  setPreferredLanguage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const mockChangeLanguage = changeLanguage as jest.Mock;
const mockSetIntroLocaleOverride = setIntroLocaleOverride as jest.Mock;
const mockSetPreferredLanguage = setPreferredLanguage as jest.Mock;

describe("applyLanguageSelection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChangeLanguage.mockResolvedValue(undefined);
    mockSetIntroLocaleOverride.mockResolvedValue(undefined);
    mockSetPreferredLanguage.mockResolvedValue(undefined);
  });

  it("uses the unauthenticated override path before a user signs in", async (): Promise<void> => {
    const setUnauthenticatedOverride = jest.fn().mockResolvedValue(undefined);

    await applyLanguageSelection("ar", {
      isAuthenticated: false,
      setUnauthenticatedOverride,
    });

    expect(setUnauthenticatedOverride).toHaveBeenCalledWith("ar");
    expect(mockSetIntroLocaleOverride).not.toHaveBeenCalled();
    expect(mockSetPreferredLanguage).not.toHaveBeenCalled();
    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });

  it("falls back to changing the visible language when profile persistence is not ready", async (): Promise<void> => {
    const setUnauthenticatedOverride = jest.fn().mockResolvedValue(undefined);
    mockSetPreferredLanguage.mockRejectedValueOnce(
      new Error("profile row is not ready")
    );

    await applyLanguageSelection("ar", {
      isAuthenticated: true,
      setUnauthenticatedOverride,
    });

    expect(mockSetIntroLocaleOverride).toHaveBeenCalledWith("ar");
    expect(mockSetPreferredLanguage).toHaveBeenCalledWith("ar");
    expect(mockChangeLanguage).toHaveBeenCalledWith("ar");
    expect(setUnauthenticatedOverride).not.toHaveBeenCalled();
  });
});
