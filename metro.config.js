const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

const assetExts = config.resolver?.assetExts || [];
config.resolver = {
  ...config.resolver,
  assetExts: [...new Set([...assetExts, "glb"])],
};

module.exports = config;
