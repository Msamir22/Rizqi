#!/usr/bin/env node
/**
 * PreToolUse hook: Block --no-verify flag on git commits/pushes.
 * Protects pre-commit, commit-msg, and pre-push hooks from being bypassed.
 *
 * Exit code 2 = block the tool call
 * Exit code 0 = allow
 */
const fs = require("fs");

const input = fs.readFileSync(0, "utf8");

try {
  const data = JSON.parse(input);
  const command = data.tool_input?.command || "";

  if (/--no-verify/.test(command)) {
    process.stderr.write(
      "BLOCKED: --no-verify flag is not allowed. Fix the underlying hook issue instead.\n"
    );
    process.exit(2);
  }
} catch {
  // If we can't parse input, allow the command
}

process.exit(0);
