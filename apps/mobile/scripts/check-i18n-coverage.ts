/**
 * i18n Coverage Check Script
 *
 * Validates translation completeness across EN and AR locales.
 * Run: npx tsx scripts/check-i18n-coverage.ts
 *
 * Three checks:
 * 1. Key parity between EN and AR JSON files
 * 2. AR value language sanity (catches untranslated Latin values)
 * 3. Hardcoded English strings in JSX source files
 *
 * Exit code 0 = all checks pass, 1 = failures found.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LOCALES_DIR = path.resolve(__dirname, "../locales");
const SRC_DIR = path.resolve(__dirname, "..");
const EN_DIR = path.join(LOCALES_DIR, "en");
const AR_DIR = path.join(LOCALES_DIR, "ar");

const SRC_GLOB_DIRS = [SRC_DIR];

/** Files/patterns to exclude from the hardcoded-string check */
const EXCLUDE_PATTERNS = [
  "node_modules/",
  "locales/",
  "sms-simulator.tsx",
  "scripts/",
  ".test.",
  ".spec.",
  "__tests__",
];

/** Arabic plural suffixes not present in EN (i18next v4 compat) */
const AR_PLURAL_SUFFIXES = ["_zero", "_two", "_few", "_many"];

/** Legitimate Latin values in AR files (allowlist) */
const AR_LATIN_ALLOWLIST = new Set([
  "English", // language name shown in language picker dropdown
  "USD",
  "EGP",
  "EUR",
  "GBP",
  "SAR",
  "AED",
  "Astik",
]);

/** Regex for purely numeric/placeholder values like "0.00", "0.0" */
const NUMERIC_VALUE_RE = /^[0-9.,\s]+$/;

/**
 * Baseline count of known hardcoded strings that existed when the i18n gate
 * was introduced. The gate blocks NEW regressions while allowing the team to
 * chip away at existing debt. Update this ONLY when known issues are fixed.
 */
const KNOWN_ISSUES_BASELINE = 96;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`Missing locale directory: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function readJson(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse ${filePath}: ${message}`);
  }
}

function hasArabicScript(str: string): boolean {
  return /[\u0600-\u06FF]/.test(str);
}

function hasInterpolation(str: string): boolean {
  return /\{\{.*?\}\}/.test(str);
}

// ---------------------------------------------------------------------------
// Check 1: Key Parity
// ---------------------------------------------------------------------------

function checkKeyParity(): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  const enFiles = getJsonFiles(EN_DIR);
  const arFiles = getJsonFiles(AR_DIR);

  // Check for missing namespaces
  const enNamespaces = new Set(enFiles.map((f) => f.replace(".json", "")));
  const arNamespaces = new Set(arFiles.map((f) => f.replace(".json", "")));

  for (const ns of enNamespaces) {
    if (!arNamespaces.has(ns)) {
      errors.push(`Missing AR namespace: ${ns}.json`);
    }
  }
  for (const ns of arNamespaces) {
    if (!enNamespaces.has(ns)) {
      errors.push(`Missing EN namespace: ${ns}.json`);
    }
  }

  // Check key parity per namespace
  for (const enFile of enFiles) {
    const ns = enFile.replace(".json", "");
    const enPath = path.join(EN_DIR, enFile);
    const arPath = path.join(AR_DIR, enFile);

    if (!fs.existsSync(arPath)) continue;

    const enKeys = new Set(flattenKeys(readJson(enPath)));
    const arKeys = new Set(flattenKeys(readJson(arPath)));

    for (const key of enKeys) {
      if (!arKeys.has(key)) {
        errors.push(`ar/${ns}.json missing key: ${key}`);
      }
    }
    for (const key of arKeys) {
      if (enKeys.has(key)) continue;

      // Arabic plural forms (e.g., _zero, _two, _few, _many) extend the EN
      // "one"/"other" keys — they are expected and valid.
      const hasPluralBase = AR_PLURAL_SUFFIXES.some((suffix) => {
        if (!key.endsWith(suffix)) return false;
        const base = key.slice(0, -suffix.length);
        // Check if EN has any variant of this plural key
        return (
          enKeys.has(base) ||
          enKeys.has(`${base}_one`) ||
          enKeys.has(`${base}_other`)
        );
      });
      if (!hasPluralBase) {
        errors.push(`ar/${ns}.json has extra key not in en: ${key}`);
      }
    }
  }

  return { passed: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Check 2: AR Value Language Sanity
// ---------------------------------------------------------------------------

function checkArabicValues(): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  const arFiles = getJsonFiles(AR_DIR);

  for (const arFile of arFiles) {
    const ns = arFile.replace(".json", "");
    const arPath = path.join(AR_DIR, arFile);
    const arData = readJson(arPath);
    const flatEntries = flattenToEntries(arData);

    for (const [key, value] of flatEntries) {
      if (typeof value !== "string") continue;

      // Skip interpolation-only strings like "{{count}}"
      if (hasInterpolation(value) && !hasArabicScript(value)) {
        const stripped = value.replace(/\{\{.*?\}\}/g, "").trim();
        if (stripped.length === 0) continue;
      }

      // Skip allowlisted values
      if (AR_LATIN_ALLOWLIST.has(value)) continue;

      // Skip very short values (likely codes/labels)
      if (value.length <= 2) continue;

      // Skip purely numeric values like "0.00", "0.0"
      if (NUMERIC_VALUE_RE.test(value)) continue;

      // If the value is purely Latin (no Arabic script) and > 3 chars, flag it
      if (!hasArabicScript(value) && value.length > 3) {
        errors.push(`ar/${ns}.json "${key}" = "${value}" (no Arabic script)`);
      }
    }
  }

  return { passed: errors.length === 0, errors };
}

function flattenToEntries(
  obj: Record<string, unknown>,
  prefix = ""
): [string, unknown][] {
  const entries: [string, unknown][] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      entries.push(
        ...flattenToEntries(value as Record<string, unknown>, fullKey)
      );
    } else {
      entries.push([fullKey, value]);
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Check 3: Hardcoded Strings in JSX
// ---------------------------------------------------------------------------

function checkHardcodedStrings(): {
  passed: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const files = collectSourceFiles();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const relativePath = path.relative(SRC_DIR, filePath);

    // ── Pass 1: Multiline <Text> detection ──────────────────────────────
    // Catches <Text ...>\n  English content\n</Text> that line-by-line misses.
    const multilineTextRe =
      /<Text[^>]*>\s*([A-Z][A-Za-z ,.'!?&;:()\-]{2,}?)\s*<\/Text>/gs;
    for (const m of content.matchAll(multilineTextRe)) {
      if (m.index === undefined) continue;
      const captured = m[1].trim();
      // Skip if the content is already wrapped in t()
      if (/^\{?\s*t\s*\(/.test(captured)) continue;
      // Skip i18n-ignore
      const beforeText = content.slice(Math.max(0, m.index - 200), m.index);
      if (beforeText.includes("i18n-ignore")) continue;

      const lineNum = content.slice(0, m.index).split("\n").length;
      errors.push(`${relativePath}:${lineNum} — <Text>${captured}</Text>`);
    }

    // ── Pass 2: Line-by-line attribute checks ─────────────────────────────
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Skip i18n-ignore lines
      if (line.includes("i18n-ignore")) continue;

      // Skip import-only lines
      if (line.includes("useTranslation")) continue;

      // Pattern 1: <Text> with hardcoded English content (single-line)
      const textMatch = line.match(
        /<Text[^>]*>\s*([A-Z][A-Za-z ,.'!?&;:()\-]{2,})\s*<\/Text>/
      );
      if (textMatch) {
        // Only flag if the content is NOT a t() call
        const inner = textMatch[1].trim();
        if (!/^\{?\s*t\s*\(/.test(inner)) {
          errors.push(`${relativePath}:${lineNum} — <Text>${inner}</Text>`);
        }
      }

      // Pattern 2: placeholder="English text" (not placeholder={t(...)} or placeholder={t`...`})
      const placeholderMatch = line.match(
        /placeholder=["']([A-Z][A-Za-z ]{2,})["']/
      );
      if (placeholderMatch) {
        errors.push(
          `${relativePath}:${lineNum} — placeholder="${placeholderMatch[1]}"`
        );
      }

      // Pattern 3: title="English text"
      const titleMatch = line.match(/title=["']([A-Z][A-Za-z ]{2,})["']/);
      if (titleMatch && !line.includes("title={")) {
        errors.push(`${relativePath}:${lineNum} — title="${titleMatch[1]}"`);
      }

      // Pattern 4: accessibilityLabel="English text"
      const a11yLabelMatch = line.match(
        /accessibilityLabel=["']([A-Z][A-Za-z ]{2,})["']/
      );
      if (a11yLabelMatch) {
        errors.push(
          `${relativePath}:${lineNum} — accessibilityLabel="${a11yLabelMatch[1]}"`
        );
      }

      // Pattern 5: accessibilityHint="English text"
      const a11yHintMatch = line.match(
        /accessibilityHint=["']([A-Z][A-Za-z ]{2,})["']/
      );
      if (a11yHintMatch) {
        errors.push(
          `${relativePath}:${lineNum} — accessibilityHint="${a11yHintMatch[1]}"`
        );
      }

      // Pattern 6: Alert.alert("English text"
      const alertMatch = line.match(
        /Alert\.alert\(\s*["']([A-Z][A-Za-z ]{2,})/
      );
      if (alertMatch) {
        errors.push(
          `${relativePath}:${lineNum} — Alert.alert("${alertMatch[1]}")`
        );
      }

      // Pattern 7: throw new Error("English text"
      const throwMatch = line.match(
        /throw new Error\(["']([A-Z][A-Za-z ]{2,})/
      );
      if (throwMatch) {
        errors.push(
          `${relativePath}:${lineNum} — throw new Error("${throwMatch[1]}")`
        );
      }
    }
  }

  return { passed: errors.length <= KNOWN_ISSUES_BASELINE, errors };
}

function collectSourceFiles(): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) {
      throw new Error(`Missing source directory: ${dir}`);
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
        const relative = path.relative(SRC_DIR, fullPath).replace(/\\/g, "/");
        if (EXCLUDE_PATTERNS.some((p) => relative.includes(p))) continue;
        files.push(fullPath);
      }
    }
  }

  for (const dir of SRC_GLOB_DIRS) {
    if (!fs.existsSync(dir)) {
      throw new Error(`Missing source directory: ${dir}`);
    }
    walk(dir);
  }

  if (files.length === 0) {
    throw new Error("No TS/TSX files found for i18n coverage scan.");
  }

  return files.sort();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("=== i18n Coverage Check ===\n");

  let totalErrors = 0;

  // Check 1
  console.log("Check 1: Key Parity (EN vs AR)");
  const parity = checkKeyParity();
  if (parity.passed) {
    console.log("  PASSED\n");
  } else {
    console.log(`  FAILED (${parity.errors.length} issues)`);
    for (const err of parity.errors) {
      console.log(`    - ${err}`);
    }
    console.log();
    totalErrors += parity.errors.length;
  }

  // Check 2
  console.log("Check 2: AR Value Language Sanity");
  const arValues = checkArabicValues();
  if (arValues.passed) {
    console.log("  PASSED\n");
  } else {
    console.log(`  FAILED (${arValues.errors.length} issues)`);
    for (const err of arValues.errors) {
      console.log(`    - ${err}`);
    }
    console.log();
    totalErrors += arValues.errors.length;
  }

  // Check 3
  console.log("Check 3: Hardcoded English Strings in Source");
  const hardcoded = checkHardcodedStrings();
  const baselineDiff = hardcoded.errors.length - KNOWN_ISSUES_BASELINE;

  if (hardcoded.passed) {
    if (hardcoded.errors.length === 0) {
      console.log("  PASSED\n");
    } else {
      console.log(
        `  PASSED with ${hardcoded.errors.length} known issues (baseline: ${KNOWN_ISSUES_BASELINE})\n`
      );
      for (const err of hardcoded.errors) {
        console.log(`    - ${err}`);
      }
      console.log();
    }
  } else {
    console.log(
      `  FAILED — ${hardcoded.errors.length} hardcoded strings found (baseline: ${KNOWN_ISSUES_BASELINE}, +${baselineDiff} new regressions)`
    );
    for (const err of hardcoded.errors) {
      console.log(`    - ${err}`);
    }
    console.log();
    totalErrors += baselineDiff;
  }

  // Summary
  if (totalErrors === 0) {
    console.log("=== All checks passed! ===");
    process.exit(0);
  } else {
    console.log(`=== ${totalErrors} total issues found ===`);
    process.exit(1);
  }
}

main();
