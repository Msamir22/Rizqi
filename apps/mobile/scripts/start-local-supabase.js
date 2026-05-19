/**
 * Starts the Expo dev client in normal app mode against local Supabase.
 *
 * The script reads the local anon key from `npx supabase status -o env`, points
 * Android emulators to the local Supabase API, and keeps E2E fixture behavior
 * disabled. When `MONYVI_LOCAL_GOOGLE_AUTH=1`, it uses the loopback Supabase URL
 * plus `adb reverse tcp:54321 tcp:54321` so browser-based Google OAuth can
 * return to the local Supabase callback from the Android emulator.
 */
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const LOCAL_ANDROID_SUPABASE_URL = "http://10.0.2.2:54321";
const LOCAL_LOOPBACK_SUPABASE_URL = "http://127.0.0.1:54321";
const repoRoot = resolve(__dirname, "..", "..", "..");

function resolveNpxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function parseSupabaseEnv(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((env, line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) return env;

      const key = line.slice(0, separatorIndex);
      const value = line.slice(separatorIndex + 1).replace(/^"|"$/g, "");
      return { ...env, [key]: value };
    }, {});
}

function getLocalSupabaseEnv() {
  const result = spawnSync(
    resolveNpxCommand(),
    ["supabase", "status", "-o", "env"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
      timeout: 30_000,
    }
  );

  if (result.status !== 0) {
    throw new Error(
      [
        "Local Supabase is not ready.",
        "Start it from the repo root with: npx supabase start",
        result.stderr || result.stdout,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const supabaseEnv = parseSupabaseEnv(result.stdout);
  const anonKey =
    supabaseEnv.ANON_KEY ||
    supabaseEnv.SUPABASE_ANON_KEY ||
    supabaseEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error(
      "Could not find ANON_KEY in `npx supabase status -o env` output."
    );
  }

  return { anonKey };
}

function listConnectedDevices() {
  const result = spawnSync("adb", ["devices"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 10_000,
  });

  if (result.status !== 0) return [];

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("\tdevice"))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

function resolveAdbDeviceArgs() {
  if (process.env.DEVICE) return ["-s", process.env.DEVICE];

  const devices = listConnectedDevices();
  if (devices.length === 1) return ["-s", devices[0]];

  if (devices.length > 1) {
    console.warn(
      [
        "Multiple Android devices are connected.",
        "Set DEVICE=<serial> before running this script so local Supabase port 54321 can be reversed.",
        `Connected devices: ${devices.join(", ")}`,
      ].join(" ")
    );
  }

  return [];
}

function reverseLocalSupabasePort() {
  const deviceArgs = resolveAdbDeviceArgs();
  const result = spawnSync(
    "adb",
    [...deviceArgs, "reverse", "tcp:54321", "tcp:54321"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
      timeout: 10_000,
    }
  );

  if (result.status !== 0) {
    console.warn(
      [
        "Could not reverse local Supabase port 54321 to the Android emulator.",
        "Google sign-in may not complete until an emulator is running and",
        "`adb reverse tcp:54321 tcp:54321` succeeds.",
        result.stderr || result.stdout,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}

function main() {
  const { anonKey } = getLocalSupabaseEnv();
  const useLoopbackSupabase =
    process.env.MONYVI_LOCAL_GOOGLE_AUTH === "1" ||
    process.env.MONYVI_LOCAL_SUPABASE_LOOPBACK === "1";

  if (useLoopbackSupabase) {
    reverseLocalSupabasePort();
  }

  const env = {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_URL ??
      (useLoopbackSupabase
        ? LOCAL_LOOPBACK_SUPABASE_URL
        : LOCAL_ANDROID_SUPABASE_URL),
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? anonKey,
    EXPO_PUBLIC_MONYVI_TEST_MODE: "off",
    EXPO_PUBLIC_AI_SMS_PARSER_MODE: "edge",
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
    EXPO_NO_METRO_WORKSPACE_ROOT:
      process.env.EXPO_NO_METRO_WORKSPACE_ROOT ?? "1",
    EXPO_NO_TELEMETRY: "1",
  };

  const args =
    process.argv.length > 2
      ? ["expo", "start", ...process.argv.slice(2)]
      : ["expo", "start", "--dev-client", "--port", "8081"];

  const result = spawnSync(resolveNpxCommand(), args, {
    cwd: join(repoRoot, "apps", "mobile"),
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  process.exit(result.status ?? 1);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
