module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54+) auto-detects `react-native-worklets` and
    // adds its plugin automatically — do NOT add it again here.
    presets: ['babel-preset-expo'],
  };
};
