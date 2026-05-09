import { getStartupProgressTranslateX } from "@/components/ui/StartupLoadingView";

describe("StartupLoadingView progress animation", () => {
  it("moves the progress segment left-to-right in LTR", () => {
    expect(getStartupProgressTranslateX(0, false)).toBe(0);
    expect(getStartupProgressTranslateX(0.5, false)).toBe(60);
    expect(getStartupProgressTranslateX(1, false)).toBe(120);
  });

  it("moves the progress segment right-to-left in RTL", () => {
    expect(getStartupProgressTranslateX(0, true)).toBe(120);
    expect(getStartupProgressTranslateX(0.5, true)).toBe(60);
    expect(getStartupProgressTranslateX(1, true)).toBe(0);
  });
});
