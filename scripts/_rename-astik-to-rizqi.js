#!/usr/bin/env node
/**
 * One-shot rename: RIZQI -> Monyvi across source + configs + docs.
 *
 * Skips: node_modules, .git, lockfiles, binary assets, ios/android generated
 * dirs, build outputs, and *.svg (we already renamed SVG asset files).
 *
 * Preserves case:
 *   Rizqi  -> Monyvi
 *   rizqi  -> monyvi
 *   RIZQI  -> MONYVI
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".nx",
  ".expo",
  ".expo-shared",
  "dist",
  "build",
  "coverage",
  ".next",
  "ios",
  "android",
  ".cache",
  ".turbo",
  "tmp",
]);
const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "rename-astik-to-monyvi.js",
]);
const EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".md",
  ".mdx",
  ".sql",
  ".toml",
  ".xml",
  ".gradle",
  ".properties",
  ".plist",
]);

// Order matters: apply most specific first.
const REPLACEMENTS = [
  { re: /@rizqi\//g, to: "@monyvi/" },
  { re: /com\.msamir22\.rizqimobile/g, to: "com.monyvi.app" },
  { re: /com\.rizqi\.app/g, to: "com.monyvi.app" },
  { re: /com\.rizqi\./g, to: "com.monyvi." },
  { re: /RIZQI/g, to: "MONYVI" },
  { re: /Rizqi/g, to: "Monyvi" },
  { re: /rizqi/g, to: "monyvi" },
];

let touched = 0;
let skipped = 0;
const changed = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!EXTS.has(ext)) continue;
      try {
        const before = fs.readFileSync(full, "utf8");
        let after = before;
        for (const r of REPLACEMENTS) after = after.replace(r.re, r.to);
        if (after !== before) {
          fs.writeFileSync(full, after);
          touched++;
          changed.push(path.relative(ROOT, full));
        }
      } catch (e) {
        skipped++;
      }
    }
  }
}

walk(ROOT);
console.log(`modified ${touched} files (skipped ${skipped} unreadable)`);
if (process.argv.includes("--list")) {
  for (const f of changed) console.log("  " + f);
}
