const { spawnSync } = require("node:child_process");
const { getE2eSeedConfig } = require("./e2e-seed");

function resolveNpxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function main() {
  const config = getE2eSeedConfig({
    ...process.env,
    E2E_SUPABASE_MODE: "local",
  });

  const env = {
    ...process.env,
    E2E_SUPABASE_MODE: "local",
    EXPO_PUBLIC_MONYVI_TEST_MODE: "e2e",
    EXPO_PUBLIC_AI_SMS_PARSER_MODE: "fixture",
    EXPO_PUBLIC_SUPABASE_URL: config.appSupabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: config.anonKey,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
    EXPO_NO_METRO_WORKSPACE_ROOT:
      process.env.EXPO_NO_METRO_WORKSPACE_ROOT ?? "1",
    EXPO_NO_TELEMETRY: "1",
    CI: process.env.CI ?? "1",
  };

  const shouldClearCache = process.env.E2E_METRO_CLEAR_CACHE === "1";
  const defaultArgs = ["expo", "start", "--dev-client", "--port", "8081"];
  if (shouldClearCache) {
    defaultArgs.splice(2, 0, "--clear");
  }

  const args =
    process.argv.length > 2
      ? ["expo", "start", ...process.argv.slice(2)]
      : defaultArgs;

  const result = spawnSync(resolveNpxCommand(), args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  process.exit(result.status ?? 1);
}

main();
