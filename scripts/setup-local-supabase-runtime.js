/**
 * Configures runtime-only local Supabase behavior that cannot be committed as a
 * normal migration because it depends on local URLs and local service-role keys.
 *
 * Current responsibility:
 * - Schedule the local `fetch-metal-rates` pg_cron job to call the local Edge
 *   Function through Kong (`http://kong:8000/...`) using the local service-role
 *   key from `npx supabase status -o env`.
 *
 * Schema objects such as tables, triggers, and Postgres functions belong in
 * `supabase/migrations/`, not in this script.
 */
const { spawnSync } = require("node:child_process");
const { writeFileSync, unlinkSync } = require("node:fs");

const LOCAL_FUNCTIONS_URL = "http://kong:8000/functions/v1/fetch-metal-rates";
const FETCH_MARKET_RATES_SCHEDULE = "0 */12 * * *";

function runSupabase(args) {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const commandArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `npx supabase ${args.join(" ")}`]
      : ["supabase", ...args];

  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Supabase command failed: supabase ${args.join(" ")}`,
        result.stderr,
        result.stdout,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return result.stdout;
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

function runLocalSql(name, sql) {
  const sqlPath = `.tmp-${name}.sql`;
  writeFileSync(sqlPath, sql, "utf8");

  try {
    runSupabase(["db", "query", "--local", "-f", sqlPath]);
  } finally {
    unlinkSync(sqlPath);
  }
}

function getLocalServiceRoleKey() {
  const env = parseSupabaseEnv(runSupabase(["status", "-o", "env"]));
  const serviceRoleKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Could not find SERVICE_ROLE_KEY in `npx supabase status -o env` output."
    );
  }

  return serviceRoleKey;
}

function main() {
  const serviceRoleKey = getLocalServiceRoleKey();

  runLocalSql(
    "local-unschedule-market-rates",
    `select cron.unschedule('fetch-metal-rates')
where exists (
  select 1 from cron.job where jobname = 'fetch-metal-rates'
);
`
  );

  runLocalSql(
    "local-schedule-market-rates",
    `select cron.schedule(
  'fetch-metal-rates',
  '${FETCH_MARKET_RATES_SCHEDULE}',
  $job$
  select net.http_post(
    url := '${LOCAL_FUNCTIONS_URL}',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ${serviceRoleKey}'),
    timeout_milliseconds := 10000
  );
  $job$
);
`
  );

  console.log("Local Supabase runtime setup complete.");
}

main();
