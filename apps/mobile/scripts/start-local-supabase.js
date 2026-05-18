const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const LOCAL_ANDROID_SUPABASE_URL = "http://10.0.2.2:54321";
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

function main() {
  const { anonKey } = getLocalSupabaseEnv();
  const env = {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? LOCAL_ANDROID_SUPABASE_URL,
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
    timeout: 5 * 60_000,
  });

  process.exit(result.status ?? 1);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
