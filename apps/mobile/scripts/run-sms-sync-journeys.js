const { join } = require("node:path");
const {
  adb,
  appId,
  collapseSystemUi,
  ensureE2eAppReady,
  forceStopApp,
  resolveMaestroBin,
  run,
} = require("./e2e-preflight");
const { getE2eSeedConfig } = require("./e2e-seed");

const mobileRoot = join(__dirname, "..");
const flowDir = join("e2e", "maestro", "sms-sync");

const readSmsPermission = "android.permission.READ_SMS";
function clearPermissionFlags(permission) {
  adb(
    [
      "shell",
      "pm",
      "clear-permission-flags",
      appId,
      permission,
      "user-set",
      "user-fixed",
    ],
    { allowFailure: true }
  );
}

function grantReadSmsPermission() {
  clearPermissionFlags(readSmsPermission);
  adb(["shell", "pm", "grant", appId, readSmsPermission], {
    allowFailure: true,
  });
}

function runFlow(flow) {
  const maestroBin = resolveMaestroBin();
  if (!maestroBin) {
    throw new Error("Maestro was not found. Install it or set MAESTRO_BIN.");
  }

  run(maestroBin, ["test", join(flowDir, flow)], { cwd: mobileRoot });
}

function applyLocalE2eDefaults() {
  if (process.env.E2E_SUPABASE_MODE !== "local") return;

  process.env.E2E_SUPABASE_MODE = "local";
  process.env.EXPO_PUBLIC_MONYVI_TEST_MODE ??= "e2e";
  process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE ??= "fixture";
  process.env.EXPO_PUBLIC_SUPABASE_URL ??= "http://10.0.2.2:54321";

  if (process.env.E2E_SKIP_AUTH_BOOTSTRAP === "1") return;

  const config = getE2eSeedConfig({
    ...process.env,
    E2E_SUPABASE_MODE: "local",
  });

  process.env.EXPO_PUBLIC_SUPABASE_URL = config.appSupabaseUrl;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= config.anonKey;
  process.env.MAESTRO_E2E_EMAIL ??= config.email;
  process.env.MAESTRO_E2E_PASSWORD ??= config.password;
}

async function bootstrapCleanAuthenticatedSession() {
  if (process.env.E2E_SUPABASE_MODE !== "local") return;
  if (process.env.E2E_SKIP_AUTH_BOOTSTRAP === "1") return;

  applyLocalE2eDefaults();
  run(process.execPath, [join(__dirname, "e2e-seed.js"), "seed"], {
    cwd: mobileRoot,
  });
  adb(["shell", "pm", "clear", appId]);
  await ensureE2eAppReady();
  runFlow("../helpers/ci-auth-bootstrap.yaml");
}

function queryWatermelonScalar(sql) {
  return adb(["shell", "run-as", appId, "sqlite3", "watermelon.db"], {
    allowFailure: false,
    capture: true,
    input: sql,
  }).trim();
}

function expectWatermelonScalar(sql, expected, label) {
  const actual = queryWatermelonScalar(sql);
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function clearSmsSyncProbeRows() {
  const sql = [
    "delete from transactions where counterparty = 'PR622 BATCH DUPLICATE SHOP';",
    "delete from transfers where notes = 'ATM Withdrawal' and amount = 2000;",
  ].join(" ");

  adb(["shell", "run-as", appId, "sqlite3", "watermelon.db"], {
    allowFailure: true,
    capture: true,
    input: sql,
  });
}

function verifyBatchSmsSaved() {
  expectWatermelonScalar(
    [
      "select count(*) from transactions",
      "where counterparty = 'PR622 BATCH DUPLICATE SHOP'",
      "and deleted = 0",
      "and sms_fingerprint is not null;",
    ].join(" "),
    "2",
    "Duplicate batch SMS transaction count"
  );
  expectWatermelonScalar(
    [
      "select count(distinct sms_fingerprint) from transactions",
      "where counterparty = 'PR622 BATCH DUPLICATE SHOP'",
      "and deleted = 0",
      "and sms_fingerprint is not null;",
    ].join(" "),
    "2",
    "Duplicate batch SMS distinct fingerprint count"
  );
  expectWatermelonScalar(
    [
      "select count(*) from transfers",
      "where notes = 'ATM Withdrawal'",
      "and amount = 2000",
      "and deleted = 0",
      "and sms_fingerprint is not null;",
    ].join(" "),
    "1",
    "ATM withdrawal transfer count"
  );
}

let hasSavedSmsSyncBaseline = false;

async function runBatchDuplicatesAndAtm() {
  grantReadSmsPermission();
  clearSmsSyncProbeRows();
  forceStopApp();
  await ensureE2eAppReady();
  runFlow("sms-sync-batch-duplicates-atm.yaml");
  verifyBatchSmsSaved();
  hasSavedSmsSyncBaseline = true;
}

async function runRescanSkipsSaved() {
  if (!hasSavedSmsSyncBaseline) {
    await runBatchDuplicatesAndAtm();
  }

  grantReadSmsPermission();
  forceStopApp();
  await ensureE2eAppReady();
  runFlow("sms-sync-rescan-skips-saved.yaml");
  verifyBatchSmsSaved();
}

const journeys = {
  "01": runBatchDuplicatesAndAtm,
  "02": runRescanSkipsSaved,
};

async function main() {
  applyLocalE2eDefaults();

  const requested = process.argv.slice(2);
  const selected =
    requested.length > 0
      ? requested.map((id) => id.padStart(2, "0"))
      : Object.keys(journeys);

  await bootstrapCleanAuthenticatedSession();

  for (const id of selected) {
    const journey = journeys[id];
    if (!journey) {
      throw new Error(`Unknown SMS sync journey: ${id}`);
    }

    console.log(`\n=== SMS sync journey ${id} ===`);
    collapseSystemUi();
    await journey();
    collapseSystemUi();
    console.log(`SMS sync journey ${id} passed`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
