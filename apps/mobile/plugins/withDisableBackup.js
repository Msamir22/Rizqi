/**
 * Expo Config Plugin: withDisableBackup
 *
 * Disables Android Auto-Backup entirely by setting android:allowBackup="false"
 * and removing fullBackupContent / dataExtractionRules attributes.
 *
 * Monyvi uses Supabase sync for data recovery — Android backup is unnecessary
 * and would expose the WatermelonDB SQLite file (sensitive financial data)
 * to Google Drive.
 *
 * Usage in app.json:
 *   "plugins": ["./plugins/withDisableBackup"]
 */

const { withAndroidManifest } = require("expo/config-plugins");

function setDisableBackup(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];

    if (!mainApplication) {
      return config;
    }

    mainApplication.$["android:allowBackup"] = "false";
    delete mainApplication.$["android:fullBackupContent"];
    delete mainApplication.$["android:dataExtractionRules"];

    return config;
  });
}

module.exports = setDisableBackup;
