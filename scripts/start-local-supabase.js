/**
 * Starts the local Supabase Docker stack with repository-level development
 * defaults.
 *
 * The wrapper loads ignored root `.env` values and forwards them to
 * `supabase start`, including optional Google OAuth credentials and local Edge
 * Function secrets. Placeholder Google credentials keep the stack startable for
 * CI and developers who do not need Google sign-in.
 */
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = resolve(__dirname, "..");
const envPath = resolve(repoRoot, ".env");

const GOOGLE_CLIENT_ID_PLACEHOLDER =
  "local-google-client-id.apps.googleusercontent.com";
const GOOGLE_SECRET_PLACEHOLDER = "local-google-secret";

function resolveNpxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function parseDotEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed
    .slice(separatorIndex + 1)
    .trim()
    .replace(/^"|"$/g, "");

  return key ? [key, value] : null;
}

function readRootDotEnv() {
  if (!existsSync(envPath)) return {};

  return readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map(parseDotEnvLine)
    .filter(Boolean)
    .reduce((env, entry) => {
      const [key, value] = entry;
      return { ...env, [key]: value };
    }, {});
}

function main() {
  const dotEnv = readRootDotEnv();
  const googleClientId =
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ??
    dotEnv.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ??
    GOOGLE_CLIENT_ID_PLACEHOLDER;
  const googleSecret =
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ??
    dotEnv.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ??
    GOOGLE_SECRET_PLACEHOLDER;

  if (
    googleClientId === GOOGLE_CLIENT_ID_PLACEHOLDER ||
    googleSecret === GOOGLE_SECRET_PLACEHOLDER
  ) {
    console.warn(
      [
        "Starting local Supabase with placeholder Google OAuth credentials.",
        "Google sign-in will only work after setting SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
        "and SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET in your root .env or shell.",
      ].join(" ")
    );
  }

  const result = spawnSync(
    resolveNpxCommand(),
    ["supabase", "start", ...process.argv.slice(2)],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...dotEnv,
        SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: googleClientId,
        SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: googleSecret,
      },
      stdio: "inherit",
      shell: process.platform === "win32",
    }
  );

  process.exit(result.status ?? 1);
}

main();
