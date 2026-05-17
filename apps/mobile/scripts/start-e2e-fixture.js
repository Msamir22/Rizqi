const { spawnSync } = require("node:child_process");

const LOCAL_ANDROID_SUPABASE_URL = "http://10.0.2.2:54321";

function resolveNpxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function main() {
  const env = {
    ...process.env,
    E2E_SUPABASE_MODE: "local",
    EXPO_PUBLIC_MONYVI_TEST_MODE: "e2e",
    EXPO_PUBLIC_AI_SMS_PARSER_MODE: "fixture",
    EXPO_PUBLIC_SUPABASE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? LOCAL_ANDROID_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
    EXPO_NO_TELEMETRY: "1",
    CI: process.env.CI ?? "1",
  };

  const args =
    process.argv.length > 2
      ? ["expo", "start", ...process.argv.slice(2)]
      : ["expo", "start", "--clear", "--dev-client", "--port", "8081"];

  const result = spawnSync(resolveNpxCommand(), args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  process.exit(result.status ?? 1);
}

main();
