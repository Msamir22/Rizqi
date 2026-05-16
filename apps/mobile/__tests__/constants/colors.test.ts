import { darkTheme, lightTheme, palette } from "@/constants/colors";

describe("v1 design system colors", () => {
  it("exposes the raw palettes needed by the approved v1 mockups", () => {
    expect(palette.brandGreen[600]).toBe("#15803D");
    expect(palette.night[950]).toBe("#02090A");
    expect(palette.paper[50]).toBe("#FCFAF6");
    expect(palette.gold[500]).toBe("#EAB308");
    expect(palette.silver[500]).toBe("#A7ADB1");
    expect(palette.danger[500]).toBe("#EF4444");
    expect(palette.info[500]).toBe("#3B82F6");
  });

  it("maps light and dark themes to semantic UI tokens", () => {
    expect(lightTheme.background).toBe(palette.paper[50]);
    expect(lightTheme.surfaceRaised).toBe(palette.paper[25]);
    expect(lightTheme.surfaceGlass).toBe("#FFFFFFE6");
    expect(lightTheme.borderSubtle).toBe(palette.paper[200]);
    expect(lightTheme.action).toBe(palette.brandGreen[700]);
    expect(lightTheme.metal.gold).toBe(palette.gold[500]);

    expect(darkTheme.background).toBe(palette.night[950]);
    expect(darkTheme.surfaceRaised).toBe(palette.night[850]);
    expect(darkTheme.surfaceGlass).toBe("#071314D9");
    expect(darkTheme.borderSubtle).toBe("#FFFFFF1F");
    expect(darkTheme.action).toBe(palette.brandGreen[500]);
    expect(darkTheme.metal.silver).toBe(palette.silver[400]);
  });
});
