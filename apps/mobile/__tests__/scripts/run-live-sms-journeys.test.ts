interface RunLiveSmsJourneysModule {
  buildLiveSmsActionProbeCleanupSql(): string;
  shouldSkipRunAsProbeCleanup(
    env?: Readonly<Record<string, string | undefined>>
  ): boolean;
  createKilledAppConfirmMarker(env?: Readonly<Record<string, string | undefined>>): string;
  getMaestroFlowTimeoutMs(
    env?: Readonly<Record<string, string | undefined>>
  ): number;
  isRetryableMaestroTransportFailure(output: string): boolean;
}

const liveSmsJourneys = jest.requireActual(
  "../../scripts/run-live-sms-journeys"
) as RunLiveSmsJourneysModule;

describe("run-live-sms-journeys helpers", () => {
  beforeEach(() => {
    process.env.E2E_USER_ID = "e2e-user-1";
  });

  afterEach(() => {
    delete process.env.E2E_USER_ID;
  });

  it("cleans action probe transactions and transfers using real table columns", () => {
    const sql = liveSmsJourneys.buildLiveSmsActionProbeCleanupSql();

    expect(sql).toContain("delete from transactions where");
    expect(sql).toContain("counterparty like '%CONFIRM ACTION MARKET%'");
    expect(sql).toContain("note like '%CONFIRM ACTION MARKET%'");
    expect(sql).toContain(
      "user_id = 'e2e-user-1'"
    );
    expect(sql).toContain("delete from transfers where");
    expect(sql).toContain("notes like '%CONFIRM ACTION MARKET%'");
    expect(sql).not.toMatch(/delete from transfers where[^;]*counterparty/);
  });

  it("skips run-as probe cleanup for release APK runs", () => {
    expect(
      liveSmsJourneys.shouldSkipRunAsProbeCleanup({
        E2E_RELEASE_BUILD: "1",
      })
    ).toBe(true);
    expect(liveSmsJourneys.shouldSkipRunAsProbeCleanup({})).toBe(false);
  });

  it("uses a per-run killed-app marker for release verification", () => {
    expect(
      liveSmsJourneys.createKilledAppConfirmMarker({
        E2E_PROBE_RUN_ID: "run-123",
      })
    ).toBe("CLOSED CONFIRM MARKET run-123");
  });

  it("uses a bounded Maestro flow timeout with env override", () => {
    expect(liveSmsJourneys.getMaestroFlowTimeoutMs({})).toBe(10 * 60 * 1000);
    expect(
      liveSmsJourneys.getMaestroFlowTimeoutMs({
        E2E_MAESTRO_FLOW_TIMEOUT_MS: "1000",
      })
    ).toBe(1000);
  });

  it("detects retryable Maestro Android transport disconnects", () => {
    expect(
      liveSmsJourneys.isRetryableMaestroTransportFailure(
        "io.grpc.StatusRuntimeException: UNAVAILABLE: End of stream or IOException"
      )
    ).toBe(true);
    expect(
      liveSmsJourneys.isRetryableMaestroTransportFailure(
        "Caused by: java.io.IOException: Command failed (host:transport:emulator-5554): device offline"
      )
    ).toBe(true);
  });

  it("does not retry normal Maestro assertion failures", () => {
    expect(
      liveSmsJourneys.isRetryableMaestroTransportFailure(
        'Assertion is false: "Transactions" is visible'
      )
    ).toBe(false);
  });
});
