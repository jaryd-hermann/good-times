// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // (remove: require.resolve('expo-router/babel'))
      'react-native-reanimated/plugin', // must be last
    ],
  };
};
