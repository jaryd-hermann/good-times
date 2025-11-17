// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // (remove: require.resolve('expo-router/babel'))
      // Removed react-native-reanimated/plugin - not using Reanimated, using React Native's built-in Animated API
    ],
  };
};
