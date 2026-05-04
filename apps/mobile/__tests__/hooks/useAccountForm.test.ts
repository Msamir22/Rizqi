import { act, renderHook } from "@testing-library/react-native";
import { useAccountForm } from "../../hooks/useAccountForm";

jest.mock("../../hooks/usePreferredCurrency", () => ({
  usePreferredCurrency: (): { preferredCurrency: "EGP" } => ({
    preferredCurrency: "EGP",
  }),
}));

jest.mock("../../services/supabase", () => ({
  getCurrentUserId: (): Promise<string> => Promise.resolve("user-1"),
}));

jest.mock("../../services/edit-account-service", () => ({
  checkAccountNameUniqueness: (): Promise<{
    isUnique: boolean;
    error: null;
  }> => Promise.resolve({ isUnique: true, error: null }),
}));

describe("useAccountForm", () => {
  it("initializes account balance to the visible default of zero", () => {
    const { result } = renderHook(() => useAccountForm());

    expect(result.current.formData.balance).toBe("0");
  });

  it("resets account balance back to zero", () => {
    const { result } = renderHook(() => useAccountForm());

    act(() => {
      result.current.updateField("balance", "125");
    });

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.formData.balance).toBe("0");
  });
});
