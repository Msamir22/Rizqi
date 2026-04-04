---
description: How to run Maestro E2E tests (setup + execute)
---

# Running Maestro E2E Tests

// turbo-all

## First-Time Setup (Once)

1. Install Maestro on Windows:
   - Download from
     https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip
   - Extract to `C:\Users\<username>\maestro`
   - Add `maestro\bin` to your PATH:
     `setx PATH "%PATH%;C:\Users\<username>\maestro\bin"`

2. Set `ANDROID_HOME` if not already set:

```powershell
setx ANDROID_HOME "C:\Users\<username>\AppData\Local\Android\Sdk"
```

3. Add `platform-tools` to PATH if `adb` is not found:

```powershell
# Add via System > Environment Variables, or:
setx PATH "%PATH%;C:\Users\<username>\AppData\Local\Android\Sdk\platform-tools"
```

4. Create an emulator in Android Studio → Device Manager:
   - **Device**: Pixel 7
   - **API Level**: 34 (Android 14) — most stable with React Native
   - **ABI**: x86_64
   - ⚠️ Avoid API 36 — causes black screen with Expo dev builds

5. Build and install the app on the emulator:

```powershell
npm run mobile:android-local-build
# Or if already built:
adb install "apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk"
```

## Per-Session Workflow

```powershell
# 1. Start the emulator from Android Studio Device Manager

# 2. Verify device is connected
adb devices

# 3. Set up port reverse for Metro
adb reverse tcp:8081 tcp:8081

# 4. Start Metro (keep running in separate terminal)
npm run start:android

# 5. Wait for app to fully load on emulator, then run tests
cd apps\mobile
maestro test "e2e\maestro\create-transaction.yaml"
```

## Running Tests

```powershell
# Run all flows
maestro test e2e\maestro\

# Run a single flow
maestro test e2e\maestro\create-transaction.yaml

# Target specific device
maestro --device emulator-5554 test e2e\maestro\create-transaction.yaml

# Interactive element inspector
maestro studio
```

## Troubleshooting

| Problem                         | Solution                                              |
| ------------------------------- | ----------------------------------------------------- |
| "0 devices connected"           | Check `adb devices` and `ANDROID_HOME` env var        |
| Black screen on emulator        | Use API 34 emulator, not API 36                       |
| "device offline" in ADB         | Run `taskkill /f /im adb.exe` then `adb start-server` |
| App shows "Development servers" | Start Metro first: `npm run start:android`            |
| Bundle not loading              | Run `adb reverse tcp:8081 tcp:8081`                   |

## Important Notes

- **Do NOT use WSL2** — native Windows Maestro works directly
- **Do NOT add `netsh portproxy` rules** — they interfere with ADB
- The emulator must have the app installed AND Metro must be running
- Tests require pre-existing data (accounts, transactions) as noted in flow
  preconditions
