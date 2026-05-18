const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { getE2eSeedConfig } = require("./e2e-seed");

const mobileRoot = join(__dirname, "..");
const maxScriptOutputBuffer = 50 * 1024 * 1024;

const shouldBootstrapAuth = process.env.E2E_SKIP_AUTH_BOOTSTRAP !== "1";

const maestroFlows = [
  ...(shouldBootstrapAuth ? ["helpers/ci-auth-bootstrap.yaml"] : []),
  "transactions/create-transaction.yaml",
  "transactions/edit-transaction.yaml",
  "transactions/edit-category-quick.yaml",
  "transactions/edit-amount-quick.yaml",
  "transactions/swap-account.yaml",
  "transactions/change-type.yaml",
  "transactions/search-filter.yaml",
  "transactions/delete-transaction.yaml",
  "sms-sync/sms-sync-permission-requestable.yaml",
];

const defaultLiveSmsJourneys = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "16",
];
// Journey 15 covers killed-app HeadlessJS. It needs a release/preview APK with
// embedded JS, so it stays on the release-specific runner until that build path
// is reliable in CI.

function getSupabaseMode() {
  return process.env.E2E_SUPABASE_MODE === "remote" ? "remote" : "local";
}

function applyLocalE2eDefaults() {
  if (getSupabaseMode() !== "local") return;

  process.env.E2E_SUPABASE_MODE = "local";
  process.env.EXPO_PUBLIC_MONYVI_TEST_MODE ??= "e2e";
  process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE ??= "fixture";
  if (process.env.E2E_SKIP_SEED === "1") {
    process.env.EXPO_PUBLIC_SUPABASE_URL ??= "http://10.0.2.2:54321";
    return;
  }

  const config = getE2eSeedConfig({
    ...process.env,
    E2E_SUPABASE_MODE: "local",
  });

  process.env.EXPO_PUBLIC_SUPABASE_URL ??= config.appSupabaseUrl;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= config.anonKey;
  process.env.MAESTRO_E2E_EMAIL ??= config.email;
  process.env.MAESTRO_E2E_PASSWORD ??= config.password;
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= config.serviceRoleKey;
}

function assertRequiredEnv() {
  const baseRequiredEnv =
    process.env.CI === "true" || getSupabaseMode() === "local"
      ? [
          "EXPO_PUBLIC_SUPABASE_URL",
          "EXPO_PUBLIC_SUPABASE_ANON_KEY",
          "EXPO_PUBLIC_MONYVI_TEST_MODE",
          "EXPO_PUBLIC_AI_SMS_PARSER_MODE",
          "MAESTRO_E2E_EMAIL",
          "MAESTRO_E2E_PASSWORD",
        ]
      : shouldBootstrapAuth
        ? ["MAESTRO_E2E_EMAIL", "MAESTRO_E2E_PASSWORD"]
        : [];
  const requiredEnv =
    process.env.E2E_SKIP_SEED === "1"
      ? baseRequiredEnv
      : [...baseRequiredEnv, "SUPABASE_SERVICE_ROLE_KEY"];

  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length === 0) return;

  throw new Error(
    `Missing required E2E environment variables: ${missing.join(", ")}`
  );
}

function isDeviceOfflineFailure(output) {
  return /device offline|StatusRuntimeException: UNAVAILABLE|host:transport:.*device offline/i.test(
    output
  );
}

function runAdb(args, options = {}) {
  return spawnSync("adb", args, {
    cwd: mobileRoot,
    env: process.env,
    shell: false,
    stdio: "inherit",
    ...options,
  });
}

function reconnectAdb() {
  console.warn("ADB device went offline. Reconnecting before one retry.");
  runAdb(["kill-server"], { timeout: 30_000 });
  runAdb(["start-server"], { timeout: 30_000 });
  const waitResult = runAdb(["wait-for-device"], { timeout: 60_000 });

  if (waitResult.status !== 0) {
    throw new Error("ADB device did not come back online after reconnect.");
  }

  runAdb(["reverse", "tcp:8081", "tcp:8081"], { timeout: 30_000 });
}

function runNodeScriptOnce(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: mobileRoot,
    env: process.env,
    shell: false,
    encoding: "utf8",
    maxBuffer: maxScriptOutputBuffer,
  });

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: result.status ?? 1,
  };
}

function runNodeScript(script, args) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = runNodeScriptOnce(script, args);

    if (result.status === 0) {
      return;
    }

    if (attempt === 1 && isDeviceOfflineFailure(result.output)) {
      reconnectAdb();
      continue;
    }

    throw new Error(`${script} ${args.join(" ")} failed`);
  }
}

function maybeSeedE2eData() {
  if (process.env.E2E_SKIP_SEED === "1") return;

  runNodeScript("scripts/e2e-seed.js", ["seed"]);
}

function isFixtureE2eMode() {
  return (
    process.env.EXPO_PUBLIC_MONYVI_TEST_MODE === "e2e" &&
    process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE === "fixture"
  );
}

function maybeRunSmsSyncJourneys() {
  if (!isFixtureE2eMode()) {
    console.warn(
      "Skipping fixture SMS sync journeys because E2E fixture parser mode is not enabled."
    );
    return;
  }

  runNodeScript("scripts/run-sms-sync-journeys.js", []);
}

function getLiveSmsJourneys() {
  const value = process.env.E2E_CI_LIVE_SMS_JOURNEYS;
  if (!value) return defaultLiveSmsJourneys;

  return value
    .split(",")
    .map((journey) => journey.trim())
    .filter(Boolean);
}

function main() {
  applyLocalE2eDefaults();
  assertRequiredEnv();
  maybeSeedE2eData();

  for (const flow of maestroFlows) {
    runNodeScript("scripts/run-maestro.js", [
      "test",
      join("e2e", "maestro", flow),
    ]);
  }

  maybeRunSmsSyncJourneys();
  runNodeScript("scripts/run-live-sms-journeys.js", getLiveSmsJourneys());
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  isDeviceOfflineFailure,
};
