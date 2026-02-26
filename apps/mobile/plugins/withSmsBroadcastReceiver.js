/**
 * Expo Config Plugin: withSmsBroadcastReceiver
 *
 * Injects native Android components for unified SMS detection into the
 * Android project during `expo prebuild`.
 *
 * Components generated:
 * 1. SmsBroadcastReceiver.kt — catches SMS_RECEIVED intents in all app states
 * 2. SmsHeadlessTaskService.kt — bridges SMS to JS when app is killed
 * 3. SmsEventModule.kt — React Native native module that emits events to JS
 *    via DeviceEventEmitter when app process is alive
 *
 * Architecture:
 * - App alive (foreground/background): BroadcastReceiver → SmsEventModule → DeviceEventEmitter → JS
 * - App killed: BroadcastReceiver → HeadlessJS → JS
 *
 * This ensures all changes survive `expo prebuild --clean`.
 *
 * Usage in app.json:
 *   "plugins": ["./plugins/withSmsBroadcastReceiver"]
 */

const {
  withDangerousMod,
  withAndroidManifest,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Kotlin source templates
// ---------------------------------------------------------------------------

/**
 * SmsEventModule — React Native Native Module
 *
 * Provides a bridge from native BroadcastReceiver → JS via DeviceEventEmitter.
 * When the app process is alive, the BroadcastReceiver calls
 * SmsEventModule.emitSmsReceived() which sends the event to JS.
 */
const SMS_EVENT_MODULE_KT = `package {{PACKAGE_NAME}}

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Native module that emits SMS events to JavaScript via DeviceEventEmitter.
 *
 * Used by SmsBroadcastReceiver when the app process is alive (foreground
 * or background) to deliver SMS data to the JS listener without HeadlessJS.
 */
class SmsEventModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = MODULE_NAME

    companion object {
        const val MODULE_NAME = "SmsEventModule"
        const val EVENT_NAME = "onSmsReceived"

        private var reactContextRef: ReactApplicationContext? = null

        /**
         * Store a reference to the ReactApplicationContext so the
         * BroadcastReceiver can emit events even without a direct
         * reference to this module instance.
         */
        fun setReactContext(context: ReactApplicationContext) {
            reactContextRef = context
        }

        /**
         * Emit an SMS event to JavaScript. Called by SmsBroadcastReceiver
         * when the app process is alive.
         *
         * @return true if event was emitted, false if no React context available
         */
        fun emitSmsReceived(sender: String, body: String, timestamp: Double): Boolean {
            val context = reactContextRef ?: return false
            if (!context.hasActiveReactInstance()) return false

            return try {
                val params = Arguments.createMap().apply {
                    putString("sender", sender)
                    putString("body", body)
                    putDouble("timestamp", timestamp)
                }
                context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_NAME, params)
                true
            } catch (e: Exception) {
                false
            }
        }
    }

    override fun initialize() {
        super.initialize()
        setReactContext(reactApplicationContext)
    }

    override fun invalidate() {
        super.invalidate()
        if (reactContextRef === reactApplicationContext) {
            reactContextRef = null
        }
    }
}
`;

/**
 * SmsEventPackage — React Native Package registration
 *
 * Registers SmsEventModule so React Native discovers it at startup.
 */
const SMS_EVENT_PACKAGE_KT = `package {{PACKAGE_NAME}}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers SmsEventModule with the React Native bridge.
 */
class SmsEventPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {
        return listOf(SmsEventModule(reactContext))
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

/**
 * SmsBroadcastReceiver — catches SMS_RECEIVED in all app states.
 *
 * Strategy:
 * 1. Try to emit via SmsEventModule (DeviceEventEmitter) → works when app is alive
 * 2. Fall back to HeadlessJS via SmsHeadlessTaskService → works when app is killed
 */
const BROADCAST_RECEIVER_KT = `package {{PACKAGE_NAME}}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Telephony
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

/**
 * Native Android BroadcastReceiver for SMS_RECEIVED intents.
 *
 * Unified handler for all app states:
 * - App alive: emits via SmsEventModule → DeviceEventEmitter → JS
 * - App killed: starts HeadlessJS via SmsHeadlessTaskService
 */
class SmsBroadcastReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmsBroadcastReceiver"
        private const val TASK_KEY_SENDER = "sender"
        private const val TASK_KEY_BODY = "body"
        private const val TASK_KEY_TIMESTAMP = "timestamp"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) {
            Log.w(TAG, "No SMS messages in intent")
            return
        }

        // Combine multi-part SMS messages
        val sender = messages[0].displayOriginatingAddress ?: "Unknown"
        val body = messages.joinToString("") { it.messageBody ?: "" }
        val timestamp = messages[0].timestampMillis

        Log.d(TAG, "SMS received from: \${"$"}sender")

        // Strategy 1: Try DeviceEventEmitter (app process alive)
        val emitted = SmsEventModule.emitSmsReceived(sender, body, timestamp.toDouble())

        if (emitted) {
            Log.d(TAG, "SMS forwarded via DeviceEventEmitter")
            return
        }

        // Strategy 2: Fall back to HeadlessJS (app killed)
        Log.d(TAG, "App not alive, starting HeadlessJS task")
        val taskData = Bundle().apply {
            putString(TASK_KEY_SENDER, sender)
            putString(TASK_KEY_BODY, body)
            putDouble(TASK_KEY_TIMESTAMP, timestamp.toDouble())
        }

        val serviceIntent = Intent(context, SmsHeadlessTaskService::class.java).apply {
            putExtras(taskData)
        }

        try {
            context.startService(serviceIntent)
            HeadlessJsTaskService.acquireWakeLockNow(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start HeadlessJS service", e)
        }
    }
}
`;

const HEADLESS_TASK_SERVICE_KT = `package {{PACKAGE_NAME}}

import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * HeadlessJS Task Service for background SMS processing.
 *
 * Started by SmsBroadcastReceiver when an SMS is received while the
 * app process is dead. Bridges the SMS data to the JavaScript
 * "SmsDetectionTask" registered via AppRegistry.registerHeadlessTask.
 */
class SmsHeadlessTaskService : HeadlessJsTaskService() {

    companion object {
        private const val TASK_NAME = "SmsDetectionTask"
        private const val TASK_TIMEOUT_MS = 30000L // 30 seconds
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras: Bundle = intent?.extras ?: return null

        val sender = extras.getString("sender") ?: return null
        val body = extras.getString("body") ?: return null
        val timestamp = extras.getDouble("timestamp")

        val data = Arguments.createMap().apply {
            putString("sender", sender)
            putString("body", body)
            putDouble("timestamp", timestamp)
        }

        return HeadlessJsTaskConfig(
            TASK_NAME,
            data,
            TASK_TIMEOUT_MS,
            true // allow task to run in foreground too
        )
    }
}
`;

// ---------------------------------------------------------------------------
// Plugin: Write Kotlin source files
// ---------------------------------------------------------------------------

/**
 * Writes all Kotlin source files into the Android project's package directory.
 */
function withKotlinSourceFiles(config) {
  return withDangerousMod(config, [
    "android",
    (modConfig) => {
      const packageName =
        modConfig.android?.package || "com.msamir22.astikmobile";
      const packagePath = packageName.replace(/\./g, "/");

      const sourceDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        packagePath
      );

      // Ensure directory exists
      fs.mkdirSync(sourceDir, { recursive: true });

      // Template files and their content
      const kotlinFiles = [
        { name: "SmsBroadcastReceiver.kt", content: BROADCAST_RECEIVER_KT },
        {
          name: "SmsHeadlessTaskService.kt",
          content: HEADLESS_TASK_SERVICE_KT,
        },
        { name: "SmsEventModule.kt", content: SMS_EVENT_MODULE_KT },
        { name: "SmsEventPackage.kt", content: SMS_EVENT_PACKAGE_KT },
      ];

      for (const file of kotlinFiles) {
        const fileContent = file.content.replace(
          /\{\{PACKAGE_NAME\}\}/g,
          packageName
        );
        fs.writeFileSync(path.join(sourceDir, file.name), fileContent, "utf-8");
      }

      return modConfig;
    },
  ]);
}

// ---------------------------------------------------------------------------
// Plugin: Register SmsEventPackage in MainApplication
// ---------------------------------------------------------------------------

/**
 * Adds the SmsEventPackage to MainApplication.kt's getPackages() list.
 * This is needed so React Native discovers the SmsEventModule at startup.
 */
function withSmsEventPackageRegistration(config) {
  return withDangerousMod(config, [
    "android",
    (modConfig) => {
      const packageName =
        modConfig.android?.package || "com.msamir22.astikmobile";
      const packagePath = packageName.replace(/\./g, "/");

      const mainApplicationPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        packagePath,
        "MainApplication.kt"
      );

      if (!fs.existsSync(mainApplicationPath)) {
        console.warn(
          "[withSmsBroadcastReceiver] MainApplication.kt not found, skipping package registration"
        );
        return modConfig;
      }

      let content = fs.readFileSync(mainApplicationPath, "utf-8");

      // Check if already registered
      if (content.includes("SmsEventPackage")) {
        return modConfig;
      }

      // Find the getPackages() method and add SmsEventPackage to the list
      // The Expo-generated MainApplication uses PackageList(this).packages
      // We need to add our package to the returned list
      const packagesPattern =
        /override fun getPackages\(\): List<ReactPackage> \{[^}]*?return PackageList\(this\)\.packages/;

      if (packagesPattern.test(content)) {
        content = content.replace(
          packagesPattern,
          (match) =>
            `${match}.apply {\n              add(${packageName}.SmsEventPackage())\n            }`
        );
        fs.writeFileSync(mainApplicationPath, content, "utf-8");
      } else {
        console.warn(
          "[withSmsBroadcastReceiver] Could not find PackageList pattern in MainApplication.kt"
        );
      }

      return modConfig;
    },
  ]);
}

// ---------------------------------------------------------------------------
// Plugin: Modify AndroidManifest.xml
// ---------------------------------------------------------------------------

/**
 * Adds RECEIVE_SMS permission and registers the BroadcastReceiver +
 * HeadlessTaskService in the AndroidManifest.
 */
function withSmsManifestChanges(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const packageName =
      modConfig.android?.package || "com.msamir22.astikmobile";

    // --- Add RECEIVE_SMS permission ---
    const permissions = manifest["uses-permission"] || [];
    const hasReceiveSms = permissions.some(
      (p) => p.$?.["android:name"] === "android.permission.RECEIVE_SMS"
    );

    if (!hasReceiveSms) {
      permissions.push({
        $: { "android:name": "android.permission.RECEIVE_SMS" },
      });
      manifest["uses-permission"] = permissions;
    }

    // --- Register BroadcastReceiver and Service ---
    const application = manifest.application?.[0];
    if (!application) {
      return modConfig;
    }

    // Check if receiver already registered
    const receivers = application.receiver || [];
    const hasReceiver = receivers.some(
      (r) =>
        r.$?.["android:name"] === `.SmsBroadcastReceiver` ||
        r.$?.["android:name"] === `${packageName}.SmsBroadcastReceiver`
    );

    if (!hasReceiver) {
      receivers.push({
        $: {
          "android:name": ".SmsBroadcastReceiver",
          "android:exported": "true",
          "android:permission": "android.permission.BROADCAST_SMS",
        },
        "intent-filter": [
          {
            $: { "android:priority": "999" },
            action: [
              {
                $: {
                  "android:name": "android.provider.Telephony.SMS_RECEIVED",
                },
              },
            ],
          },
        ],
      });
      application.receiver = receivers;
    }

    // Check if service already registered
    const services = application.service || [];
    const hasService = services.some(
      (s) =>
        s.$?.["android:name"] === `.SmsHeadlessTaskService` ||
        s.$?.["android:name"] === `${packageName}.SmsHeadlessTaskService`
    );

    if (!hasService) {
      services.push({
        $: {
          "android:name": ".SmsHeadlessTaskService",
          "android:exported": "false",
        },
      });
      application.service = services;
    }

    return modConfig;
  });
}

// ---------------------------------------------------------------------------
// Main plugin export
// ---------------------------------------------------------------------------

/**
 * Combined plugin that sets up all native Android components for
 * unified SMS detection (foreground + background + killed).
 */
function withSmsBroadcastReceiver(config) {
  config = withKotlinSourceFiles(config);
  config = withSmsEventPackageRegistration(config);
  config = withSmsManifestChanges(config);
  return config;
}

module.exports = withSmsBroadcastReceiver;
