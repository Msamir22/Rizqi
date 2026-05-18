interface E2ePreflightModule {
  appendAndroidPlatform(url: string): string;
  isAppReady(uiXml: string): boolean;
}

const preflight = jest.requireActual(
  "../../scripts/e2e-preflight"
) as E2ePreflightModule;

describe("e2e-preflight", () => {
  it("forces Android platform in Metro URLs", () => {
    expect(
      preflight.appendAndroidPlatform(
        "http://127.0.0.1:8081/status?platform=ios"
      )
    ).toBe("http://127.0.0.1:8081/status?platform=android");
  });

  it("treats the pre-auth pitch carousel as loaded product UI", () => {
    expect(preflight.isAppReady('<node text="Skip" />')).toBe(true);
    expect(preflight.isAppReady('<node text="Track with your voice." />')).toBe(
      true
    );
  });

  it("does not treat the Expo developer menu as product UI", () => {
    expect(
      preflight.isAppReady(
        '<node text="This is the developer menu" /><node text="Skip" />'
      )
    ).toBe(false);
  });
});
