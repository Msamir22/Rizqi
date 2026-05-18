#!/usr/bin/env bash
set -u

adb logcat -c
adb install -r monyvi-android-debug/app-debug.apk
adb reverse tcp:8081 tcp:8081

metro_url="${E2E_HOST_METRO_URL:-http://127.0.0.1:8081}"
bundle_url="${metro_url%/}/index.bundle?platform=android&dev=true&minify=false"
bundle_output="${RUNNER_TEMP:-/tmp}/monyvi-e2e-index.android.bundle"
warm_timeout_seconds="${E2E_METRO_WARM_TIMEOUT_SECONDS:-240}"

echo "Warming Android Metro bundle at ${bundle_url}"
curl --fail --silent --show-error --location \
  --retry 2 --retry-delay 2 --retry-all-errors \
  --max-time "$warm_timeout_seconds" \
  --output "$bundle_output" \
  "$bundle_url"

set +e
npm run e2e:ci -w @monyvi/mobile
e2e_status=$?
adb logcat -d > android-e2e-logcat.log || true
exit "$e2e_status"
