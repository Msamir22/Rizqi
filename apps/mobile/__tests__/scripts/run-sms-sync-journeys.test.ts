interface RunSmsSyncJourneysModule {
  buildSmsSyncProbeCleanupSql(): string;
  buildBatchSmsSavedVerificationQueries(): readonly string[];
}

const smsSyncJourneys = jest.requireActual(
  "../../scripts/run-sms-sync-journeys"
) as RunSmsSyncJourneysModule;

describe("run-sms-sync-journeys helpers", () => {
  beforeEach(() => {
    process.env.E2E_USER_ID = "e2e-user-1";
  });

  afterEach(() => {
    delete process.env.E2E_USER_ID;
  });

  it("cleans only current-user SMS sync probe rows and fails on SQL errors", () => {
    const sql = smsSyncJourneys.buildSmsSyncProbeCleanupSql();

    expect(sql).toContain("delete from transactions where");
    expect(sql).toContain("counterparty = 'PR622 BATCH DUPLICATE SHOP'");
    expect(sql).toContain("delete from transfers where");
    expect(sql).toContain("notes = 'ATM Withdrawal'");
    expect(sql).toContain("amount = 2000");
    expect(sql).toContain("sms_fingerprint is not null");
    expect(sql).toContain(
      "user_id = 'e2e-user-1'"
    );
  });

  it("verifies saved SMS sync rows only for the current E2E user", () => {
    const queries = smsSyncJourneys.buildBatchSmsSavedVerificationQueries();

    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query).toContain(
        "user_id = 'e2e-user-1'"
      );
    }
  });
});
