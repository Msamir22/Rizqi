const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getSentryExpoConfig(projectRoot);

// 1. Add the monorepo root while preserving Expo/Sentry defaults.
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot])
);

// 2. Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Keep Expo's hierarchical lookup default so expo-doctor stays aligned.
config.resolver.disableHierarchicalLookup = false;

// SVG transformer (existing).
config.transformer.babelTransformerPath =
  require.resolve("react-native-svg-transformer");
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = withNativeWind(config, {
  input: "./global.css",
  getCSSForPlatform: async (platform) => platform,
});
