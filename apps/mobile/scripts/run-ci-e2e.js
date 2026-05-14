const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

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

function assertRequiredEnv() {
  const requiredEnv =
    process.env.CI === "true"
      ? [
          "EXPO_PUBLIC_SUPABASE_URL",
          "EXPO_PUBLIC_SUPABASE_ANON_KEY",
          "MAESTRO_E2E_EMAIL",
          "MAESTRO_E2E_PASSWORD",
        ]
      : shouldBootstrapAuth
        ? ["MAESTRO_E2E_EMAIL", "MAESTRO_E2E_PASSWORD"]
        : [];

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

function getLiveSmsJourneys() {
  const value = process.env.E2E_CI_LIVE_SMS_JOURNEYS;
  if (!value) return defaultLiveSmsJourneys;

  return value
    .split(",")
    .map((journey) => journey.trim())
    .filter(Boolean);
}

function main() {
  assertRequiredEnv();

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
