const { spawnSync } = require("node:child_process");
const {
  adb,
  appId,
  ensureE2eAppReady,
  resolveMaestroBin,
} = require("./e2e-preflight");
const { getE2eSeedConfig } = require("./e2e-seed");

function shouldRunPreflight(args) {
  return args.includes("test");
}

function applyLocalE2eDefaults() {
  if (process.env.E2E_SUPABASE_MODE !== "local") return;

  const config = getE2eSeedConfig({
    ...process.env,
    E2E_SUPABASE_MODE: "local",
  });

  process.env.E2E_SUPABASE_MODE = "local";
  process.env.EXPO_PUBLIC_SUPABASE_URL ??= config.appSupabaseUrl;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= config.anonKey;
  process.env.EXPO_PUBLIC_MONYVI_TEST_MODE ??= "e2e";
  process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE ??= "fixture";
  process.env.MAESTRO_E2E_EMAIL ??= config.email;
  process.env.MAESTRO_E2E_PASSWORD ??= config.password;
}

async function main() {
  applyLocalE2eDefaults();

  const maestroBin = resolveMaestroBin();

  if (!maestroBin) {
    console.error(
      "Maestro was not found. Install it, add it to PATH, or set MAESTRO_BIN."
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (shouldRunPreflight(args)) {
    if (process.env.E2E_CLEAR_APP_STATE === "1") {
      adb(["shell", "pm", "clear", appId]);
    }
    await ensureE2eAppReady();
  }

  const result = spawnSync(maestroBin, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
