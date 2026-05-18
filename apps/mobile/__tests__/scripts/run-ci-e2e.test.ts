interface RunCiE2eModule {
  isDeviceOfflineFailure(output: string): boolean;
}

const runCiE2e = jest.requireActual(
  "../../scripts/run-ci-e2e"
) as RunCiE2eModule;

describe("run-ci-e2e helpers", () => {
  it("detects ADB device-offline failures for infrastructure-only retry", () => {
    expect(
      runCiE2e.isDeviceOfflineFailure(
        "Caused by: java.io.IOException: Command failed (host:transport:emulator-5554): device offline"
      )
    ).toBe(true);
    expect(
      runCiE2e.isDeviceOfflineFailure(
        "io.grpc.StatusRuntimeException: UNAVAILABLE"
      )
    ).toBe(true);
  });

  it("does not retry normal assertion failures", () => {
    expect(
      runCiE2e.isDeviceOfflineFailure(
        'Assertion is false: "Transactions" is visible'
      )
    ).toBe(false);
  });
});
