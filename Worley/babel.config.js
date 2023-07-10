module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@view': './src/view',
            '@model': './src/model',
          },
          extensions: ['.ts', '.tsx'],
        },
      ],
    ],
  };
};
