// Exclude react-native-reanimated from autolinking
// We're not using it - the app uses React Native's built-in Animated API
module.exports = {
  dependencies: {
    'react-native-reanimated': {
      platforms: {
        ios: null, // Disable iOS platform, preventing it from being linked
        android: null, // Disable Android platform
      },
    },
  },
};

