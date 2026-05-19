interface RunMaestroModule {
  getMaestroTimeoutMs(env?: Readonly<Record<string, string | undefined>>): number;
}

const runMaestro = jest.requireActual(
  "../../scripts/run-maestro"
) as RunMaestroModule;

describe("run-maestro helpers", () => {
  it("uses a bounded Maestro timeout with env override", () => {
    expect(runMaestro.getMaestroTimeoutMs({})).toBe(15 * 60 * 1000);
    expect(
      runMaestro.getMaestroTimeoutMs({ E2E_MAESTRO_TIMEOUT_MS: "1000" })
    ).toBe(1000);
  });
});
