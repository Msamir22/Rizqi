interface RunCiE2eModule {
  appendOutputTail(
    currentOutput: string,
    nextChunk: string,
    maxLength?: number
  ): string;
  getRequestedCiSuites(
    env?: Readonly<Record<string, string | undefined>>
  ): ReadonlySet<"transactions" | "sms-sync" | "live-sms">;
  getChildTimeoutMs(env?: Readonly<Record<string, string | undefined>>): number;
  getLiveSmsTimeoutMs(
    env?: Readonly<Record<string, string | undefined>>
  ): number;
  isDeviceOfflineFailure(output: string): boolean;
  shouldBootstrapBeforeLiveSms(
    selectedSuites: ReadonlySet<string>,
    supabaseMode: "local" | "remote"
  ): boolean;
}

const runCiE2e = jest.requireActual(
  "../../scripts/run-ci-e2e"
) as RunCiE2eModule;

describe("run-ci-e2e helpers", () => {
  it("defaults to all E2E suites when no selective suite is requested", () => {
    expect([...runCiE2e.getRequestedCiSuites({})]).toEqual([
      "transactions",
      "sms-sync",
      "live-sms",
    ]);
  });

  it("parses selected E2E suites and treats skip as no-op", () => {
    expect([
      ...runCiE2e.getRequestedCiSuites({
        E2E_CI_SUITES: "sms-sync,live-sms",
      }),
    ]).toEqual(["sms-sync", "live-sms"]);

    expect(runCiE2e.getRequestedCiSuites({ E2E_CI_SUITES: "skip" }).size).toBe(
      0
    );
  });

  it("keeps only a bounded output tail for retry detection", () => {
    expect(runCiE2e.appendOutputTail("abcdef", "ghij", 6)).toBe("efghij");
  });

  it("uses a bounded child-process timeout with env override", () => {
    expect(runCiE2e.getChildTimeoutMs({})).toBe(20 * 60 * 1000);
    expect(runCiE2e.getChildTimeoutMs({ E2E_CHILD_TIMEOUT_MS: "1000" })).toBe(
      1000
    );
  });

  it("uses a longer bounded timeout for the aggregate live-SMS suite", () => {
    expect(runCiE2e.getLiveSmsTimeoutMs({})).toBe(45 * 60 * 1000);
    expect(
      runCiE2e.getLiveSmsTimeoutMs({ E2E_LIVE_SMS_TIMEOUT_MS: "1000" })
    ).toBe(1000);
  });

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

  it("bootstraps auth for remote live-SMS-only suites", () => {
    expect(
      runCiE2e.shouldBootstrapBeforeLiveSms(new Set(["live-sms"]), "remote")
    ).toBe(true);
    expect(
      runCiE2e.shouldBootstrapBeforeLiveSms(new Set(["live-sms"]), "local")
    ).toBe(false);
    expect(
      runCiE2e.shouldBootstrapBeforeLiveSms(new Set(["sms-sync"]), "remote")
    ).toBe(false);
  });
});
