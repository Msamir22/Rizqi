const { appendFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const orderedSuites = ["transactions", "sms-sync", "live-sms"];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function isDocsOnlyFile(filePath) {
  return (
    filePath === "AGENTS.md" ||
    filePath === "README.md" ||
    filePath === "apps/mobile/README.md" ||
    filePath.startsWith("docs/") ||
    filePath.endsWith(".md")
  );
}

function requiresFullE2e(filePath) {
  return (
    filePath === ".github/workflows/ci.yml" ||
    filePath === "package.json" ||
    filePath === "package-lock.json" ||
    filePath === "apps/mobile/package.json" ||
    filePath.startsWith("apps/mobile/e2e/") ||
    filePath.startsWith("apps/mobile/scripts/") ||
    filePath.startsWith("apps/mobile/config/e2e") ||
    filePath.startsWith("packages/db/") ||
    filePath.startsWith("packages/logic/") ||
    filePath.startsWith("scripts/") ||
    filePath.startsWith("supabase/")
  );
}

function getSuitesForFile(filePath) {
  const normalized = normalizePath(filePath);

  if (requiresFullE2e(normalized)) {
    return orderedSuites;
  }

  const suites = [];
  const isSharedSmsParserPath =
    /ai-sms|sms-fixture|sms-hash|sms-keyword|egyptian-bank/i.test(normalized);
  if (
    isSharedSmsParserPath ||
    /live-sms|sms-live|notification-service|SmsPermission|useSmsPermission/i.test(
      normalized
    )
  ) {
    suites.push("live-sms");
  }

  if (
    isSharedSmsParserPath ||
    /sms-sync|sms-reader|sms-review/i.test(normalized)
  ) {
    suites.push("sms-sync");
  }

  if (
    /transaction|category|account|transfer|recurring-payment/i.test(normalized)
  ) {
    suites.push("transactions");
  }

  if (suites.length === 0 && normalized.startsWith("apps/mobile/")) {
    return orderedSuites;
  }

  return suites;
}

function resolveCiE2eScope(files) {
  const normalizedFiles = files.map(normalizePath).filter(Boolean);
  if (normalizedFiles.length === 0) {
    return { shouldRun: true, suites: orderedSuites };
  }

  const nonDocsFiles = normalizedFiles.filter(
    (filePath) => !isDocsOnlyFile(filePath)
  );
  if (nonDocsFiles.length === 0) {
    return { shouldRun: false, suites: [] };
  }

  const selectedSuites = new Set();
  for (const filePath of nonDocsFiles) {
    for (const suite of getSuitesForFile(filePath)) {
      selectedSuites.add(suite);
    }
  }

  return {
    shouldRun: selectedSuites.size > 0,
    suites: orderedSuites.filter((suite) => selectedSuites.has(suite)),
  };
}

function isUsableCommitSha(value) {
  return Boolean(value) && !/^0+$/.test(value);
}

function getGitDiffArgs(env = process.env) {
  const baseRef = env.GITHUB_BASE_REF;
  if (baseRef) {
    return ["diff", "--name-only", `origin/${baseRef}...HEAD`];
  }

  const pushBeforeSha = env.E2E_PUSH_BEFORE_SHA || env.GITHUB_EVENT_BEFORE;
  if (env.GITHUB_EVENT_NAME === "push" && isUsableCommitSha(pushBeforeSha)) {
    return ["diff", "--name-only", `${pushBeforeSha}...HEAD`];
  }

  return ["diff", "--name-only", "HEAD~1", "HEAD"];
}

function getChangedFilesFromGit() {
  if (process.env.E2E_CHANGED_FILES) {
    return process.env.E2E_CHANGED_FILES.split(/\r?\n|,/)
      .map((filePath) => filePath.trim())
      .filter(Boolean);
  }

  const args = process.argv.slice(2).filter(Boolean);
  if (args.length > 0) {
    return args;
  }

  const diffArgs = getGitDiffArgs();
  const result = spawnSync("git", diffArgs, {
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr || "Unable to resolve changed files for E2E scope."
    );
  }

  return result.stdout
    .split(/\r?\n/)
    .map((filePath) => filePath.trim())
    .filter(Boolean);
}

function appendGitHubEnv(name, value) {
  if (!process.env.GITHUB_ENV) return;
  appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}

function appendGitHubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function main() {
  const files = getChangedFilesFromGit();
  const scope = resolveCiE2eScope(files);
  const suitesValue = scope.shouldRun ? scope.suites.join(",") : "skip";

  appendGitHubEnv("E2E_CI_SUITES", suitesValue);
  appendGitHubOutput("should_run", scope.shouldRun ? "true" : "false");
  appendGitHubOutput("suites", suitesValue);

  console.log(`Android E2E suites: ${suitesValue}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  getGitDiffArgs,
  resolveCiE2eScope,
};
