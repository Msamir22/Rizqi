const { spawnSync } = require("node:child_process");
const { ensureE2eAppReady, resolveMaestroBin } = require("./e2e-preflight");

function shouldRunPreflight(args) {
  return args.includes("test");
}

async function main() {
  const maestroBin = resolveMaestroBin();

  if (!maestroBin) {
    console.error(
      "Maestro was not found. Install it, add it to PATH, or set MAESTRO_BIN."
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (shouldRunPreflight(args)) {
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
