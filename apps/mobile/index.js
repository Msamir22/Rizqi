import { registerSmsHeadlessTask } from "./services/sms-headless-task";
import "expo-router/entry";

// Register Headless JS task for Tier 2 background SMS detection.
// Must be at the top level so Android can invoke it when the app is killed.
registerSmsHeadlessTask();
