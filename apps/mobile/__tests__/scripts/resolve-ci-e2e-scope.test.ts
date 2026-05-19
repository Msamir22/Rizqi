interface ResolveCiE2eScopeModule {
  getGitDiffArgs(
    env?: Readonly<Record<string, string | undefined>>
  ): readonly string[];
  resolveCiE2eScope(files: readonly string[]): {
    readonly shouldRun: boolean;
    readonly suites: readonly string[];
  };
}

const scopeResolver = jest.requireActual(
  "../../scripts/resolve-ci-e2e-scope"
) as ResolveCiE2eScopeModule;

describe("resolve-ci-e2e-scope", () => {
  it("skips Android E2E for docs-only changes", () => {
    expect(scopeResolver.resolveCiE2eScope(["README.md"])).toEqual({
      shouldRun: false,
      suites: [],
    });
  });

  it("selects live SMS E2E for live detection changes", () => {
    expect(
      scopeResolver.resolveCiE2eScope([
        "apps/mobile/services/sms-live-detection-handler.ts",
      ])
    ).toEqual({
      shouldRun: true,
      suites: ["live-sms"],
    });
  });

  it("selects SMS sync E2E for batch SMS scan changes", () => {
    expect(
      scopeResolver.resolveCiE2eScope([
        "apps/mobile/services/sms-sync-service.ts",
      ])
    ).toEqual({
      shouldRun: true,
      suites: ["sms-sync"],
    });
  });

  it("selects both SMS suites for shared fixture parser changes", () => {
    expect(
      scopeResolver.resolveCiE2eScope([
        "apps/mobile/services/testing/ai-sms-fixture-parser.ts",
      ])
    ).toEqual({
      shouldRun: true,
      suites: ["sms-sync", "live-sms"],
    });
  });

  it("runs every suite for shared E2E harness changes", () => {
    expect(
      scopeResolver.resolveCiE2eScope(["apps/mobile/scripts/e2e-preflight.js"])
    ).toEqual({
      shouldRun: true,
      suites: ["transactions", "sms-sync", "live-sms"],
    });
  });

  it("diffs the full pushed range on push events", () => {
    expect(
      scopeResolver.getGitDiffArgs({
        GITHUB_EVENT_NAME: "push",
        E2E_PUSH_BEFORE_SHA: "abc123",
      })
    ).toEqual(["diff", "--name-only", "abc123...HEAD"]);
  });
});
