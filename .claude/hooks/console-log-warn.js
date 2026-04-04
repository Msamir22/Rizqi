#!/usr/bin/env node
/**
 * PostToolUse hook: Warn when console.log is added to edited files.
 * Runs after Edit/Write operations on .ts/.tsx files.
 *
 * Writes warning to stderr (non-blocking).
 * Exit code 0 = always allow (warning only).
 */
const fs = require("fs");
const path = require("path");

const input = fs.readFileSync(0, "utf8");

try {
  const data = JSON.parse(input);
  const filePath = data.tool_input?.file_path || data.tool_input?.path || "";

  if (!filePath) {
    process.exit(0);
  }

  const ext = path.extname(filePath);
  if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    process.exit(0);
  }

  // Skip test files
  if (
    filePath.includes("__tests__") ||
    filePath.includes(".test.") ||
    filePath.includes(".spec.")
  ) {
    process.exit(0);
  }

  // Check if the file exists and contains console.log
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const consoleLines = [];

    lines.forEach((line, i) => {
      if (
        /console\.(log|debug|info)\s*\(/.test(line) &&
        !line.trim().startsWith("//")
      ) {
        consoleLines.push(i + 1);
      }
    });

    if (consoleLines.length > 0) {
      const shortPath = filePath.split(/[/\\]/).slice(-3).join("/");
      process.stderr.write(
        `WARNING: console.log found in ${shortPath} at line(s): ${consoleLines.join(", ")}. Use structured logger in production code.\n`
      );
    }
  }
} catch {
  // Don't block on errors
}

process.exit(0);
