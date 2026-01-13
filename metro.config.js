// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure react-native-draggable-flatlist is resolved correctly
config.resolver.sourceExts.push('tsx', 'ts');

// Add video file extensions as asset extensions so they can be bundled
config.resolver.assetExts.push('mov', 'MOV', 'mp4', 'MP4');

module.exports = config;

