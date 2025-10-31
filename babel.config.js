module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['./'],
        alias: { '@': './' },   // so "@/lib/supabase" -> "./lib/supabase"
        extensions: ['.tsx', '.ts', '.js', '.json']
      }],
      'react-native-reanimated/plugin', // MUST be last
    ],
  };
};
