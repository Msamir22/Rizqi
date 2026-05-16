const { existsSync } = require("node:fs");
const http = require("node:http");
const { delimiter, join } = require("node:path");
const { spawnSync } = require("node:child_process");

const appId = process.env.E2E_APP_ID || "com.monyvi.app";
const deviceId = process.env.ANDROID_SERIAL || "emulator-5554";
const metroUrl = process.env.E2E_METRO_URL || "http://127.0.0.1:8081";
const isReleaseBuild = process.env.E2E_RELEASE_BUILD === "1";
const devClientUrl = `exp+monyvi://expo-development-client/?url=${encodeURIComponent(
  metroUrl
)}`;
const appReadyMarkers = [
  "Settings",
  "Home",
  "Transactions",
  "Accounts",
  "Good Evening",
  "Good Morning",
  "Open menu",
  "fab-button",
  "Welcome to Monyvi",
  "Email address",
  "Sign In",
];

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
      request.setTimeout(3000, () => {
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

function isAppReady(uiXml) {
  return appReadyMarkers.some((marker) => uiXml.includes(marker));
}

function assertNotWrongShell(currentFocus) {
  if (currentFocus.includes("host.exp.exponent")) {
    throw new Error(
      "E2E preflight opened Expo Go instead of the Monyvi dev client."
    );
  }
}

function waitForProductUi(timeoutMs = 120000) {
  const startedAt = Date.now();
  let lastUiXml = "";
  let lastFocus = "";

  while (Date.now() - startedAt < timeoutMs) {
    collapseSystemUi();
    wait(1000);
    lastFocus = getCurrentFocus();
    lastUiXml = dumpVisibleText();

    assertNotWrongShell(lastFocus);

    if (lastFocus.includes(appId) && isAppReady(lastUiXml)) {
      return;
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

function visibleTextShowsWrongShell(uiXml) {
  return (
    uiXml.includes("Development servers") || uiXml.includes("Recently opened")
  );
}

async function ensureE2eAppReady() {
  if (!isReleaseBuild) {
    await waitForHttpOk(`${metroUrl}/status`, 30000);
  }
  collapseSystemUi();
  startAppWithoutChangingPermissions();
  waitForProductUi();
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
  metroUrl,
  resolveMaestroBin,
  run,
  startAppWithoutChangingPermissions,
  wait,
  waitForProductUi,
};
