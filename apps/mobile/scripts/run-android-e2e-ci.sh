#!/usr/bin/env bash
set -euo pipefail

timeout "${E2E_ADB_WAIT_TIMEOUT_SECONDS:-120}"s adb wait-for-device
device_state="$(adb get-state)"
if [ "$device_state" != "device" ]; then
  echo "Android device is not ready. Current state: ${device_state}" >&2
  exit 1
fi

adb logcat -c
adb install -r monyvi-android-debug/app-debug.apk
adb reverse tcp:8081 tcp:8081

metro_url="${E2E_HOST_METRO_URL:-http://127.0.0.1:8081}"
status_url="${metro_url%/}/status"
metro_wait_timeout_seconds="${E2E_METRO_WAIT_TIMEOUT_SECONDS:-240}"

echo "Waiting for Metro status at ${status_url}"
deadline=$((SECONDS + metro_wait_timeout_seconds))
until curl --fail --silent --show-error --max-time 10 "$status_url" >/dev/null; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "Metro did not become ready at ${status_url} within ${metro_wait_timeout_seconds}s." >&2
    exit 1
  fi
  sleep 2
done

set +e
npm run e2e:ci -w @monyvi/mobile
e2e_status=$?
timeout "${E2E_LOGCAT_TIMEOUT_SECONDS:-30}"s adb logcat -d > android-e2e-logcat.log || true
exit "$e2e_status"
