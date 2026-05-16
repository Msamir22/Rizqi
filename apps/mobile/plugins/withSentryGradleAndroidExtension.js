/**
 * Expo Config Plugin: withSentryGradleAndroidExtension
 *
 * Keeps @sentry/react-native's legacy sentry.gradle compatible with this
 * Gradle project. Gradle exposes an empty string project property named
 * `android`, while Sentry's script resolves unqualified `android` inside a
 * helper function and expects the Android Gradle extension.
 *
 * This plugin binds `project.ext.android` to the real Android extension before
 * applying Sentry's Gradle script. It keeps the fix durable across prebuilds.
 */

const { withAppBuildGradle } = require("expo/config-plugins");

const SENTRY_APPLY_LINE =
  'apply from: new File(["node", "--print", "require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\'))"].execute().text.trim(), "sentry.gradle")';
const ANDROID_EXTENSION_BINDING =
  'project.ext.android = extensions.getByName("android")';

function withSentryGradleAndroidExtension(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (
      contents.includes(ANDROID_EXTENSION_BINDING) ||
      !contents.includes(SENTRY_APPLY_LINE)
    ) {
      return config;
    }

    config.modResults.contents = contents.replace(
      SENTRY_APPLY_LINE,
      `${ANDROID_EXTENSION_BINDING}\n${SENTRY_APPLY_LINE}`
    );

    return config;
  });
}

module.exports = withSentryGradleAndroidExtension;
