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

/**
 * Translation keys whose AR values are legitimately Latin-only.
 * Keyed by "namespace.flatKey" so the exception is tied to a specific
 * translation slot, not a raw value that could mask a real miss.
 *
 * Add entries here when a specific key must keep a Latin value in Arabic
 * (e.g. a language name displayed in its own script).
 */
const AR_LATIN_KEY_EXCEPTIONS = new Set<string>([
  // Currently empty — "English" was removed because the AR value is "الإنجليزية".
  // Add entries as: "namespace.flatKey"
]);

/**
 * Short Latin values (currency codes, brand names) that are legitimate
 * in AR files regardless of which key uses them.
 */
const AR_LATIN_SHORT_ALLOWLIST = new Set([
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
 * Path to the baseline file that tracks known hardcoded-string findings
 * by identity (file + description). This allows the gate to detect individual
 * regressions and fixes, rather than masking one with the other via a raw count.
 *
 * Run with --update-baseline to regenerate after fixing known issues.
 */
const BASELINE_PATH = path.resolve(__dirname, ".i18n-baseline.json");

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
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    throw new Error(`Missing JSON locale files in: ${dir}`);
  }
  return files;
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

      // Skip key-scoped exceptions (tied to specific translation slots)
      const fullScopedKey = `${ns}.${key}`;
      if (AR_LATIN_KEY_EXCEPTIONS.has(fullScopedKey)) continue;

      // Skip short allowlisted values (currency codes, brand names)
      if (AR_LATIN_SHORT_ALLOWLIST.has(value)) continue;

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
    // Only reports truly multiline matches — single-line is handled by Pass 2.
    const multilineTextRe =
      /<Text[^>]*>\s*([A-Z][A-Za-z ,.'!?&;:()\-]{2,}?)\s*<\/Text>/gs;
    for (const m of content.matchAll(multilineTextRe)) {
      if (m.index === undefined) continue;
      // Skip single-line matches — Pass 2 handles those
      if (!m[0].includes("\n")) continue;
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

      // Skip i18n-ignore lines (current or previous line)
      if (line.includes("i18n-ignore")) continue;
      if (i > 0 && lines[i - 1].includes("i18n-ignore")) continue;

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

  return { passed: true, errors };
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
// Baseline helpers
// ---------------------------------------------------------------------------

/**
 * Strips line numbers from a finding to produce a stable fingerprint.
 * "components/Foo.tsx:42 — <Text>Hello</Text>" → "components/Foo.tsx — <Text>Hello</Text>"
 */
function toFingerprint(finding: string): string {
  return finding.replace(/:\d+ — /, " — ");
}

function loadBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_PATH)) {
    return new Set();
  }
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
    if (Array.isArray(data)) {
      return new Set(data as string[]);
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function saveBaseline(findings: string[]): void {
  const fingerprints = findings.map(toFingerprint).sort();
  // Deduplicate (same file + same text can appear multiple times)
  const unique = [...new Set(fingerprints)];
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(unique, null, 2) + "\n");
  console.log(
    `  Baseline updated: ${unique.length} findings written to ${path.basename(BASELINE_PATH)}\n`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const updateBaseline = process.argv.includes("--update-baseline");

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

  // Check 3: Identity-based baseline comparison
  console.log("Check 3: Hardcoded English Strings in Source");
  const hardcoded = checkHardcodedStrings();

  if (updateBaseline) {
    saveBaseline(hardcoded.errors);
    // In update mode, don't fail on hardcoded strings
  } else {
    const baseline = loadBaseline();
    const currentFingerprints = new Set(hardcoded.errors.map(toFingerprint));

    // New findings = in current but NOT in baseline → regressions
    const newFindings = [...currentFingerprints].filter(
      (f) => !baseline.has(f)
    );
    // Fixed findings = in baseline but NOT in current → improvements
    const fixedFindings = [...baseline].filter(
      (f) => !currentFingerprints.has(f)
    );

    if (newFindings.length === 0) {
      if (currentFingerprints.size === 0) {
        console.log("  PASSED\n");
      } else {
        console.log(
          `  PASSED with ${currentFingerprints.size} known issues (baseline: ${baseline.size})\n`
        );
        if (fixedFindings.length > 0) {
          console.log(`  ${fixedFindings.length} issues fixed since baseline:`);
          for (const f of fixedFindings) {
            console.log(`    ✓ ${f}`);
          }
          console.log(
            `\n  Run with --update-baseline to update the baseline file.\n`
          );
        }
      }
    } else {
      console.log(
        `  FAILED — ${newFindings.length} new regressions (${currentFingerprints.size} total, baseline: ${baseline.size})`
      );
      console.log("\n  New regressions:");
      for (const f of newFindings) {
        console.log(`    ✗ ${f}`);
      }
      if (fixedFindings.length > 0) {
        console.log(`\n  Fixed since baseline:`);
        for (const f of fixedFindings) {
          console.log(`    ✓ ${f}`);
        }
      }
      console.log();
      totalErrors += newFindings.length;
    }
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
