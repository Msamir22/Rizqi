/**
 * Dev-only SMS simulator.
 *
 * Re-emits the same `onSmsReceived` DeviceEventEmitter event the native
 * SmsBroadcastReceiver emits in production. Because the live listener
 * subscribes to that exact event name (see `sms-live-listener-service.ts`),
 * the entire pipeline (keyword filter → fingerprint dedup → AI parse → account
 * resolve → persist) runs unchanged from a fake injection.
 *
 * All entry points are guarded by `__DEV__` so the module is tree-shaken
 * in release builds.
 *
 * @module services/dev/sms-simulator
 */

import { DeviceEventEmitter } from "react-native";
import { clearRecentFingerprints } from "../sms-live-listener-service";
import { getFixtureById, type SmsFixture } from "./sms-fixtures";

/** Must match `NATIVE_SMS_EVENT` in sms-live-listener-service.ts */
const NATIVE_SMS_EVENT = "onSmsReceived";

interface InjectArgs {
  readonly sender: string;
  readonly body: string;
  readonly timestamp?: number;
}

/**
 * Inject a fake SMS into the live detection pipeline.
 * No-op outside dev builds.
 */
export function injectFakeSms({ sender, body, timestamp }: InjectArgs): void {
  if (!__DEV__) return;

  DeviceEventEmitter.emit(NATIVE_SMS_EVENT, {
    sender,
    body,
    timestamp: timestamp ?? Date.now(),
  });
}

/**
 * Inject a named fixture by id. Returns the fixture that was injected, or
 * `null` if no fixture was found (or in non-dev builds).
 */
export function injectFixture(fixtureId: string): SmsFixture | null {
  if (!__DEV__) return null;

  const fixture = getFixtureById(fixtureId);
  if (!fixture) return null;

  injectFakeSms({ sender: fixture.sender, body: fixture.body });
  return fixture;
}

/**
 * Inject the same fixture multiple times in rapid succession to verify the
 * dedup cache (`recentFingerprints` in sms-live-listener-service).
 */
export function injectBurst(fixtureId: string, count: number = 3): number {
  if (!__DEV__) return 0;

  const fixture = getFixtureById(fixtureId);
  if (!fixture) return 0;

  for (let i = 0; i < count; i++) {
    injectFakeSms({ sender: fixture.sender, body: fixture.body });
  }
  return count;
}

/**
 * Reset the live listener's in-memory dedup cache so previously-injected
 * fixtures can be re-processed.
 */
export function resetSimulatorState(): void {
  if (!__DEV__) return;
  clearRecentFingerprints();
}
