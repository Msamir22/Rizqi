const { existsSync } = require("node:fs");
const http = require("node:http");
const { delimiter, join } = require("node:path");
const { spawnSync } = require("node:child_process");

const appId = process.env.E2E_APP_ID || "com.monyvi.app";
const deviceId = process.env.ANDROID_SERIAL || "emulator-5554";
const hostMetroUrl =
  process.env.E2E_HOST_METRO_URL ||
  process.env.E2E_METRO_URL ||
  "http://127.0.0.1:8081";
const metroUrl = appendAndroidPlatform(
  process.env.E2E_DEVICE_METRO_URL ||
    process.env.E2E_METRO_URL ||
    hostMetroUrl
);
const isReleaseBuild = process.env.E2E_RELEASE_BUILD === "1";
const preflightLaunchAttempts = parsePositiveInt(
  process.env.E2E_PREFLIGHT_LAUNCH_ATTEMPTS,
  3
);
const preflightAttemptTimeoutMs = parsePositiveInt(
  process.env.E2E_PREFLIGHT_ATTEMPT_TIMEOUT_MS,
  120000
);
const devClientUrl = `exp+monyvi://expo-development-client/?url=${encodeURIComponent(
  metroUrl
)}`;
const privateReadyMarkers = ["Good Evening", "Good Afternoon", "Good Morning"];
const authReadyMarkers = [
  "Welcome to Monyvi",
  "Email address",
  "Sign In",
  "Your bank texts. We listen.",
  "Skip",
];

function appendAndroidPlatform(url) {
  const parsedUrl = new URL(url);
  if (!parsedUrl.searchParams.has("platform")) {
    parsedUrl.searchParams.set("platform", "android");
  }
  return parsedUrl.toString();
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function findOnPath(command) {
  const pathValue = process.env.PATH || "";
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
      : [""];

  for (const directory of pathValue.split(delimiter)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension.toLowerCase()}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function resolveMaestroBin() {
  if (process.env.MAESTRO_BIN) {
    return process.env.MAESTRO_BIN;
  }

  const home = process.env.USERPROFILE || process.env.HOME;
  if (home) {
    const localInstall =
      process.platform === "win32"
        ? join(home, "maestro", "bin", "maestro.bat")
        : join(home, ".maestro", "bin", "maestro");

    if (existsSync(localInstall)) {
      return localInstall;
    }
  }

  return findOnPath("maestro");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd,
    input: options.input,
    shell: process.platform === "win32" && command.endsWith(".bat"),
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture
      ? `\n${result.stdout || ""}${result.stderr || ""}`
      : "";
    throw new Error(`${command} ${args.join(" ")} failed${detail}`);
  }

  return `${result.stdout || ""}${result.stderr || ""}`;
}

function waitForHttpOk(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function attempt() {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200) {
          resolve();
          return;
        }
        retry();
      });

      request.on("error", retry);
      request.setTimeout(30000, () => {
        request.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(
          new Error(
            `Metro is not reachable at ${url}. Start it with npm run start:android.`
          )
        );
        return;
      }
      setTimeout(attempt, 1000);
    }

    attempt();
  });
}

function waitForHttpComplete(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function attempt() {
      const request = http.get(url, (response) => {
        if (!response.statusCode || response.statusCode < 200) {
          response.resume();
          retry();
          return;
        }

        response.on("data", () => {});
        response.on("end", resolve);
        response.on("error", retry);
      });

      request.on("error", retry);
      request.setTimeout(60000, () => {
        request.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(
          new Error(
            `Metro did not finish serving the Android bundle at ${url}.`
          )
        );
        return;
      }
      setTimeout(attempt, 1000);
    }

    attempt();
  });
}

function adb(args, options = {}) {
  return run("adb", ["-s", deviceId, ...args], options);
}

function collapseSystemUi() {
  adb(["shell", "cmd", "statusbar", "collapse"], { allowFailure: true });
}

function forceStopApp() {
  collapseSystemUi();
  adb(["shell", "am", "force-stop", appId], { allowFailure: true });
}

function startAppWithoutChangingPermissions() {
  if (isReleaseBuild) {
    adb([
      "shell",
      "monkey",
      "-p",
      appId,
      "-c",
      "android.intent.category.LAUNCHER",
      "1",
    ]);
    return;
  }

  adb(["reverse", "tcp:8081", "tcp:8081"]);
  adb([
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    devClientUrl,
    appId,
  ]);
}

function getCurrentFocus() {
  return adb(["shell", "dumpsys", "window"], {
    capture: true,
    allowFailure: true,
  });
}

function dumpVisibleText() {
  adb(["shell", "uiautomator", "dump", "/sdcard/window.xml"], {
    allowFailure: true,
  });
  return adb(["exec-out", "cat", "/sdcard/window.xml"], {
    capture: true,
    allowFailure: true,
  });
}

function tapByVisibleLabel(uiXml, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = uiXml.match(
    new RegExp(
      `(?:text|content-desc)="${escapedLabel}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`
    )
  );

  if (!match) {
    return false;
  }

  const [, left, top, right, bottom] = match.map(Number);
  const x = Math.round((left + right) / 2);
  const y = Math.round((top + bottom) / 2);
  adb(["shell", "input", "tap", String(x), String(y)], {
    allowFailure: true,
  });
  return true;
}

function tapDevelopmentServerIfVisible(uiXml) {
  if (!visibleTextShowsWrongShell(uiXml)) {
    return false;
  }

  if (tapByVisibleLabel(uiXml, metroUrl)) {
    wait(2000);
    return true;
  }

  const normalizedMetroUrl = metroUrl.replace(/\/\?/, "?");
  if (tapByVisibleLabel(uiXml, normalizedMetroUrl)) {
    wait(2000);
    return true;
  }

  const localhostMetroUrl = metroUrl.replace("10.0.2.2", "127.0.0.1");
  if (tapByVisibleLabel(uiXml, localhostMetroUrl)) {
    wait(2000);
    return true;
  }

  const emulatorMetroUrl = metroUrl.replace("127.0.0.1", "10.0.2.2");
  if (tapByVisibleLabel(uiXml, emulatorMetroUrl)) {
    wait(2000);
    return true;
  }

  const metroUrlWithoutPlatform = new URL(metroUrl);
  metroUrlWithoutPlatform.searchParams.delete("platform");
  const baseMetroUrl = metroUrlWithoutPlatform.toString().replace(/\/$/, "");
  if (tapByVisibleLabel(uiXml, baseMetroUrl)) {
    wait(2000);
    return true;
  }

  const baseEmulatorMetroUrl = baseMetroUrl.replace("127.0.0.1", "10.0.2.2");
  if (tapByVisibleLabel(uiXml, baseEmulatorMetroUrl)) {
    wait(2000);
    return true;
  }

  return false;
}

function dismissDevMenuIfVisible(uiXml) {
  if (uiXml.includes("This is the developer menu")) {
    tapByVisibleLabel(uiXml, "Continue");
    wait(2000);
    adb(["shell", "input", "keyevent", "4"], { allowFailure: true });
    wait(2000);
    return true;
  }

  if (uiXml.includes("Connected to:") && uiXml.includes("Reload")) {
    adb(["shell", "input", "keyevent", "4"], { allowFailure: true });
    wait(2000);
    return true;
  }

  return false;
}

function dismissDevMenuIfFocused(currentFocus) {
  if (!currentFocusShowsDevMenu(currentFocus)) {
    return false;
  }

  adb(["shell", "input", "keyevent", "4"], { allowFailure: true });
  wait(2000);
  return true;
}

function waitThroughAnrDialogIfVisible(uiXml, waitAttempts) {
  if (!uiXml.includes("isn't responding")) {
    return false;
  }

  const isMonyviAnr = uiXml.includes("Monyvi isn't responding");
  if (isMonyviAnr && waitAttempts >= 3) {
    throw new Error("Monyvi showed the Android ANR dialog repeatedly.");
  }

  tapByVisibleLabel(uiXml, "Wait");
  wait(5000);
  return true;
}

function restoreAppFromLauncherIfVisible(uiXml, restoreAttempts) {
  if (!uiXml.includes("com.google.android.apps.nexuslauncher")) {
    return false;
  }

  if (restoreAttempts >= 3) {
    throw new Error("Monyvi kept returning to the Android launcher.");
  }

  startAppWithoutChangingPermissions();
  wait(3000);
  return true;
}

function restoreAppFromDevLauncherIfFocused(currentFocus, restoreAttempts) {
  if (!currentFocus.includes("expo.modules.devlauncher.launcher")) {
    return false;
  }

  if (restoreAttempts >= 3) {
    throw new Error("Monyvi stayed in the Expo Dev Launcher.");
  }

  startAppWithoutChangingPermissions();
  wait(3000);
  return true;
}

function isAppReady(uiXml) {
  if (visibleTextShowsWrongShell(uiXml) || visibleTextShowsDevMenu(uiXml)) {
    return false;
  }

  const isSettingsReady =
    uiXml.includes("LANGUAGE") &&
    uiXml.includes("SMS SYNC") &&
    uiXml.includes("LIVE SMS DETECTION");
  const isPrivateHomeReady =
    uiXml.includes("Open menu") &&
    privateReadyMarkers.some((marker) => uiXml.includes(marker));
  const isAuthReady = authReadyMarkers.some((marker) => uiXml.includes(marker));

  return isSettingsReady || isPrivateHomeReady || isAuthReady;
}

function assertNotWrongShell(currentFocus) {
  if (currentFocus.includes("host.exp.exponent")) {
    throw new Error(
      "E2E preflight opened Expo Go instead of the Monyvi dev client."
    );
  }
}

function waitForProductUi(timeoutMs = 240000) {
  const startedAt = Date.now();
  let lastUiXml = "";
  let lastFocus = "";
  let anrWaitAttempts = 0;
  let launcherRestoreAttempts = 0;
  let devLauncherRestoreAttempts = 0;

  while (Date.now() - startedAt < timeoutMs) {
    collapseSystemUi();
    wait(1000);
    lastFocus = getCurrentFocus();
    lastUiXml = dumpVisibleText();

    assertNotWrongShell(lastFocus);

    if (dismissDevMenuIfVisible(lastUiXml)) {
      continue;
    }

    if (dismissDevMenuIfFocused(lastFocus)) {
      continue;
    }

    if (
      restoreAppFromDevLauncherIfFocused(
        lastFocus,
        devLauncherRestoreAttempts
      )
    ) {
      devLauncherRestoreAttempts += 1;
      continue;
    }

    if (waitThroughAnrDialogIfVisible(lastUiXml, anrWaitAttempts)) {
      if (lastUiXml.includes("Monyvi isn't responding")) {
        anrWaitAttempts += 1;
      }
      continue;
    }

    if (restoreAppFromLauncherIfVisible(lastUiXml, launcherRestoreAttempts)) {
      launcherRestoreAttempts += 1;
      continue;
    }

    if (tapDevelopmentServerIfVisible(lastUiXml)) {
      continue;
    }

    if (lastFocus.includes(appId) && isAppReady(lastUiXml)) {
      const finalFocus = getCurrentFocus();
      const finalUiXml = dumpVisibleText();
      if (
        finalFocus.includes(appId) &&
        !currentFocusShowsDevMenu(finalFocus) &&
        isAppReady(finalUiXml)
      ) {
        return;
      }
    }

    wait(2000);
  }

  const isAccountLoading = lastUiXml.includes("account-loading-screen");
  const isDevLauncher =
    currentFocusShowsWrongShell(lastFocus) ||
    visibleTextShowsWrongShell(lastUiXml);
  const hint = isDevLauncher
    ? `The app stayed in the Expo Dev Launcher. Metro URL: ${metroUrl}`
    : isAccountLoading
      ? "The app stayed on Loading your account. Check auth/profile startup state and Metro logs."
      : "The app did not reach a recognized Monyvi screen.";

  throw new Error(`E2E preflight failed. ${hint}\n${lastFocus}`);
}

function currentFocusShowsWrongShell(currentFocus) {
  return (
    currentFocus.includes("host.exp.exponent") ||
    currentFocus.includes("DevLauncherActivity")
  );
}

function currentFocusShowsDevMenu(currentFocus) {
  return currentFocus.includes("expo.modules.devmenu.DevMenuActivity");
}

function visibleTextShowsWrongShell(uiXml) {
  return (
    uiXml.includes("Development servers") || uiXml.includes("Recently opened")
  );
}

function visibleTextShowsDevMenu(uiXml) {
  return (
    uiXml.includes("This is the developer menu") ||
    (uiXml.includes("Connected to:") && uiXml.includes("Reload"))
  );
}

async function ensureE2eAppReady() {
  if (!isReleaseBuild) {
    await waitForHttpOk(new URL("/status", hostMetroUrl).toString(), 120000);
    const bundleUrl = new URL(
      "/index.bundle?platform=android&dev=true&minify=false",
      hostMetroUrl
    );
    await waitForHttpComplete(bundleUrl.toString(), 300000);
  }

  let lastError = null;
  for (let attempt = 1; attempt <= preflightLaunchAttempts; attempt += 1) {
    collapseSystemUi();
    startAppWithoutChangingPermissions();

    try {
      waitForProductUi(preflightAttemptTimeoutMs);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= preflightLaunchAttempts) {
        break;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `E2E preflight launch attempt ${attempt} failed; retrying. ${message}`
      );
      forceStopApp();
      wait(3000);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("E2E preflight failed to open Monyvi.");
}

module.exports = {
  adb,
  appId,
  collapseSystemUi,
  deviceId,
  dumpVisibleText,
  ensureE2eAppReady,
  forceStopApp,
  isReleaseBuild,
  hostMetroUrl,
  metroUrl,
  resolveMaestroBin,
  run,
  startAppWithoutChangingPermissions,
  wait,
  waitForProductUi,
};
