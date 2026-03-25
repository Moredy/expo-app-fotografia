const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Stub react-dom since @clerk/clerk-react imports it but it's not available in React Native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-dom': require.resolve('./shims/react-dom.js'),
};

module.exports = config;
