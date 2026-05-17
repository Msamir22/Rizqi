const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { getE2eSeedConfig } = require("./e2e-seed");

const mobileRoot = join(__dirname, "..");

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

function runNodeScript(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: mobileRoot,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${script} ${args.join(" ")} failed`);
  }
}

function maybeSeedE2eData() {
  if (process.env.E2E_SKIP_SEED === "1") return;

  runNodeScript("scripts/e2e-seed.js", ["seed"]);
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

  runNodeScript("scripts/run-live-sms-journeys.js", getLiveSmsJourneys());
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
