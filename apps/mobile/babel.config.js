module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54+) auto-detects `react-native-worklets` and
    // adds its plugin automatically — do NOT add it again here.
    // ВРЕМЕННО для веб-превью: zustand/middleware использует import.meta,
    // и Metro-web падает без этого. Вернуть перед коммитом.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
