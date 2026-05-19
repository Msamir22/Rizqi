const { join } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createClient } = require("@supabase/supabase-js");
const { getE2eSeedConfig, seedE2eData } = require("./e2e-seed");

const mobileRoot = join(__dirname, "..");
const maxCapturedOutputLength = 256 * 1024;
const defaultChildTimeoutMs = 20 * 60 * 1000;

const shouldBootstrapAuth = process.env.E2E_SKIP_AUTH_BOOTSTRAP !== "1";
const allCiSuites = ["transactions", "sms-sync", "live-sms"];
let hasRunAuthBootstrap = false;

const authBootstrapFlow = "helpers/ci-auth-bootstrap.yaml";
const transactionMaestroFlows = [
  "transactions/create-transaction.yaml",
  "transactions/edit-transaction.yaml",
  "transactions/edit-category-quick.yaml",
  "transactions/edit-amount-quick.yaml",
  "transactions/swap-account.yaml",
  "transactions/change-type.yaml",
  "transactions/search-filter.yaml",
  "transactions/delete-transaction.yaml",
];
const smsSyncMaestroFlows = ["sms-sync/sms-sync-permission-requestable.yaml"];
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

function appendOutputTail(
  currentOutput,
  nextChunk,
  maxLength = maxCapturedOutputLength
) {
  const nextOutput = `${currentOutput}${nextChunk}`;
  if (nextOutput.length <= maxLength) {
    return nextOutput;
  }

  return nextOutput.slice(nextOutput.length - maxLength);
}

function getChildTimeoutMs(env = process.env) {
  const parsed = Number(env.E2E_CHILD_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultChildTimeoutMs;
}

function getRequestedCiSuites(env = process.env) {
  const value = env.E2E_CI_SUITES;
  if (!value || value === "full") {
    return new Set(allCiSuites);
  }

  const requested = value
    .split(",")
    .map((suite) => suite.trim())
    .filter(Boolean);

  if (requested.includes("skip")) {
    return new Set();
  }

  const unknown = requested.filter((suite) => !allCiSuites.includes(suite));
  if (unknown.length > 0) {
    throw new Error(`Unknown E2E CI suite(s): ${unknown.join(", ")}`);
  }

  return new Set(requested);
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
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: mobileRoot,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let didTimeout = false;
    const timeoutMs = getChildTimeoutMs();
    const timeout = setTimeout(() => {
      didTimeout = true;
      const label = `${script} ${args.join(" ")}`.trim();
      const text = `${label} timed out after ${timeoutMs}ms`;
      process.stderr.write(`${text}\n`);
      output = appendOutputTail(output, text);
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      output = appendOutputTail(output, text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      output = appendOutputTail(output, text);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      const text = error.message;
      process.stderr.write(`${text}\n`);
      output = appendOutputTail(output, text);
      resolve({ output, status: 1 });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ output, status: didTimeout ? 124 : (code ?? 1) });
    });
  });
}

async function runNodeScript(script, args) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await runNodeScriptOnce(script, args);

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

async function maybeSeedE2eData() {
  if (process.env.E2E_SKIP_SEED === "1") return;

  const config = getE2eSeedConfig();
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await seedE2eData(client, config);
  process.env.E2E_USER_ID = result.userId;
  console.log(
    `Seeded E2E data for ${config.email} (${result.userId}) on ${config.mode} Supabase`
  );
}

function isFixtureE2eMode() {
  return (
    process.env.EXPO_PUBLIC_MONYVI_TEST_MODE === "e2e" &&
    process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE === "fixture"
  );
}

async function maybeRunSmsSyncJourneys() {
  if (!isFixtureE2eMode()) {
    console.warn(
      "Skipping fixture SMS sync journeys because E2E fixture parser mode is not enabled."
    );
    return;
  }

  await runNodeScript("scripts/run-sms-sync-journeys.js", []);
}

function getLiveSmsJourneys() {
  const value = process.env.E2E_CI_LIVE_SMS_JOURNEYS;
  if (!value) return defaultLiveSmsJourneys;

  return value
    .split(",")
    .map((journey) => journey.trim())
    .filter(Boolean);
}

function shouldBootstrapBeforeLiveSms(selectedSuites, supabaseMode) {
  return selectedSuites.has("live-sms") && supabaseMode !== "local";
}

async function maybeRunAuthBootstrap() {
  if (shouldBootstrapAuth && !hasRunAuthBootstrap) {
    await runNodeScript("scripts/run-maestro.js", [
      "test",
      join("e2e", "maestro", authBootstrapFlow),
    ]);
    hasRunAuthBootstrap = true;
  }
}

async function runMaestroFlows(flows) {
  if (flows.length === 0) return;

  await maybeRunAuthBootstrap();

  for (const flow of flows) {
    await runNodeScript("scripts/run-maestro.js", [
      "test",
      join("e2e", "maestro", flow),
    ]);
  }
}

async function main() {
  const selectedSuites = getRequestedCiSuites();
  if (selectedSuites.size === 0) {
    console.log(
      "Skipping Android E2E because no affected suites were selected."
    );
    return;
  }

  applyLocalE2eDefaults();
  assertRequiredEnv();
  await maybeSeedE2eData();

  if (selectedSuites.has("transactions")) {
    await runMaestroFlows(transactionMaestroFlows);
  }

  if (selectedSuites.has("sms-sync")) {
    await runMaestroFlows(smsSyncMaestroFlows);
    await maybeRunSmsSyncJourneys();
  }

  if (shouldBootstrapBeforeLiveSms(selectedSuites, getSupabaseMode())) {
    await maybeRunAuthBootstrap();
  }

  if (selectedSuites.has("live-sms")) {
    await runNodeScript(
      "scripts/run-live-sms-journeys.js",
      getLiveSmsJourneys()
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  appendOutputTail,
  getChildTimeoutMs,
  getRequestedCiSuites,
  isDeviceOfflineFailure,
  shouldBootstrapBeforeLiveSms,
};
