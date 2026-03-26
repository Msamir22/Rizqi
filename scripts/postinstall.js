/**
 * postinstall script: Apply patches to node_modules
 *
 * This script fixes known bugs in dependencies that don't have patched
 * versions available for our current Expo SDK version.
 *
 * Patches applied:
 * - expo-audio 0.3.5: Fix inverted `isPrepared` guard in AudioModule.kt
 *   (https://github.com/expo/expo/issues/35589)
 *   The condition `if (!ref.isPrepared)` prevents `record()` from being
 *   called when the recorder IS prepared. Fixed upstream in 0.4.0+ (SDK 53+)
 *   but not backported to 0.3.x (SDK 52).
 */

const fs = require("fs");
const path = require("path");

/**
 * @typedef {Object} PatchEntry
 * @property {string} packageName       - npm package name for version check
 * @property {string} expectedVersion   - exact version this patch targets
 * @property {string} file              - absolute path to the file to patch
 * @property {string} search            - exact string to find
 * @property {string} replace           - replacement string
 * @property {string} description       - human-readable description
 */

/** @type {PatchEntry[]} */
const patches = [
  {
    packageName: "expo-audio",
    expectedVersion: "0.3.5",
    file: path.join(
      __dirname,
      "..",
      "node_modules",
      "expo-audio",
      "android",
      "src",
      "main",
      "java",
      "expo",
      "modules",
      "audio",
      "AudioModule.kt"
    ),
    search: "if (!ref.isPrepared) {",
    replace: "if (ref.isPrepared) {",
    description: "expo-audio#35589: Fix inverted isPrepared guard in record()",
  },
];

/**
 * Reads the installed version of a package from its package.json.
 * Returns null if the package is not installed.
 *
 * @param {string} packageName - npm package name
 * @returns {string | null}
 */
function getInstalledVersion(packageName) {
  const pkgJsonPath = path.join(
    __dirname,
    "..",
    "node_modules",
    packageName,
    "package.json"
  );
  if (!fs.existsSync(pkgJsonPath)) return null;
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  return pkgJson.version ?? null;
}

let applied = 0;
let skipped = 0;

for (const patch of patches) {
  // 1. Version gate: only patch the exact version we've verified against
  const installedVersion = getInstalledVersion(patch.packageName);
  if (installedVersion !== patch.expectedVersion) {
    console.warn(
      `[postinstall] SKIP: ${patch.packageName}@${installedVersion ?? "not installed"} ` +
        `does not match expected ${patch.expectedVersion}. ` +
        `Patch may no longer be needed: ${patch.description}`
    );
    skipped++;
    continue;
  }

  // 2. File existence check
  if (!fs.existsSync(patch.file)) {
    throw new Error(
      `[postinstall] FAIL: File not found: ${patch.file} ` +
        `(expected for ${patch.packageName}@${patch.expectedVersion}). ` +
        `Patch: ${patch.description}`
    );
  }

  const content = fs.readFileSync(patch.file, "utf8");

  // 3. Already patched — idempotent
  if (content.includes(patch.replace) && !content.includes(patch.search)) {
    skipped++;
    continue;
  }

  // 4. Verify the search string exists
  if (!content.includes(patch.search)) {
    throw new Error(
      `[postinstall] FAIL: Search string "${patch.search}" not found in ` +
        `${path.basename(patch.file)}. Package version matches (${patch.expectedVersion}) ` +
        `but file content does not. Patch: ${patch.description}`
    );
  }

  // 5. Verify exactly one occurrence of the search string
  const occurrences = content.split(patch.search).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `[postinstall] FAIL: Expected exactly 1 occurrence of "${patch.search}" in ` +
        `${path.basename(patch.file)}, found ${occurrences}. ` +
        `Cannot safely patch. Patch: ${patch.description}`
    );
  }

  // 6. Apply the patch
  const patched = content.replace(patch.search, patch.replace);

  // 7. Verify the replacement was made
  if (!patched.includes(patch.replace)) {
    throw new Error(
      `[postinstall] FAIL: Replacement verification failed for ` +
        `${path.basename(patch.file)}. Patch: ${patch.description}`
    );
  }

  fs.writeFileSync(patch.file, patched, "utf8");
  console.log(`[postinstall] APPLIED: ${patch.description}`);
  applied++;
}

console.log(
  `[postinstall] Done. ${applied} patch(es) applied, ${skipped} skipped.`
);
