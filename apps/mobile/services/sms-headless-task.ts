/**
 * SMS Headless Task (Tier 2)
 *
 * Registered as a React Native Headless JS task that runs when the app
 * is killed/terminated. The native `SmsBroadcastReceiver` starts a
 * `HeadlessJsTaskService` which invokes this task with the SMS data.
 *
 * Architecture & Design Rationale:
 * - Pattern: Bridge Pattern (native ↔ JS boundary)
 * - Why: Android's BroadcastReceiver catches SMS even when the app
 *   process is dead. Headless JS lets us run identical parsing logic
 *   (RegexSmsParser) without a UI.
 * - SOLID: SRP — this module only registers and bootstraps the headless
 *   task. All business logic delegates to sms-live-detection-handler.
 *
 * @module sms-headless-task
 */

import { AppRegistry } from "react-native";
import { RegexSmsParser, computeSmsHash } from "@astik/logic";
import { database } from "@astik/db";
import { handleDetectedSms } from "./sms-live-detection-handler";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload from the native SmsBroadcastReceiver */
interface SmsTaskData {
  readonly sender: string;
  readonly body: string;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Task name constant — must match the native SmsHeadlessTaskService
// ---------------------------------------------------------------------------

/** Name used in both AppRegistry.registerHeadlessTask and the native service */
const SMS_DETECTION_TASK = "SmsDetectionTask";

// ---------------------------------------------------------------------------
// Task handler
// ---------------------------------------------------------------------------

/**
 * Headless JS task handler.
 *
 * Runs without UI when the native BroadcastReceiver starts the service.
 * Parses the incoming SMS via RegexSmsParser, checks dedup, then delegates
 * to the shared detection handler.
 */
async function smsDetectionTask(taskData: SmsTaskData): Promise<void> {
  try {
    console.log(
      `[sms-headless] Received SMS from ${taskData.sender} at ${taskData.timestamp}`
    );

    const parser = new RegexSmsParser();
    const parsed = parser.parse(taskData.body, taskData.sender);

    if (!parsed) {
      // Not a financial SMS — exit silently
      console.log("[sms-headless] Non-financial SMS, ignoring");
      return;
    }

    // Compute hash for dedup (same logic as Tier 1)
    const _hash = await computeSmsHash(taskData.body);
    // Note: In headless mode we can't check the in-memory hash set
    // from Tier 1. WatermelonDB dedup (sms_body_hash) handles this.

    // Delegate to shared detection handler
    await handleDetectedSms(parsed, database);

    console.log("[sms-headless] Successfully processed SMS transaction");
  } catch (err) {
    console.error(
      "[sms-headless] Task failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the headless JS task.
 *
 * Must be called at the top level of the app entry point (index.js)
 * for Headless JS to work when the app process is restarted by Android.
 */
export function registerSmsHeadlessTask(): void {
  AppRegistry.registerHeadlessTask(SMS_DETECTION_TASK, () => smsDetectionTask);
}
