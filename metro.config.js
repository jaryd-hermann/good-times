// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure react-native-draggable-flatlist is resolved correctly
config.resolver.sourceExts.push('tsx', 'ts');

module.exports = config;

