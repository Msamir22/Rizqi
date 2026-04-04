#!/usr/bin/env node
/**
 * PreToolUse hook: Block modifications to linter/formatter config files.
 * Prevents the agent from weakening configs to suppress errors — fix code instead.
 *
 * Exit code 2 = block the tool call
 * Exit code 0 = allow
 */
const fs = require("fs");
const path = require("path");

const PROTECTED_FILES = [
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.json",
  ".eslintrc.yml",
  "eslint.config.js",
  "eslint.config.mjs",
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.json",
  "prettier.config.js",
  "tsconfig.json",
  "tsconfig.base.json",
  "tailwind.config.js",
  "tailwind.config.ts",
  "biome.json",
  "biome.jsonc",
];

const input = fs.readFileSync(0, "utf8");

try {
  const data = JSON.parse(input);
  const filePath = data.tool_input?.file_path || "";

  if (!filePath) {
    process.exit(0);
  }

  const fileName = path.basename(filePath);

  if (PROTECTED_FILES.includes(fileName)) {
    process.stderr.write(
      `BLOCKED: Modification to ${fileName} is not allowed. Fix the code instead of weakening linter/formatter configs. If this change is intentional, ask the user first.\n`
    );
    process.exit(2);
  }
} catch {
  // Don't block on parse errors
}

process.exit(0);
