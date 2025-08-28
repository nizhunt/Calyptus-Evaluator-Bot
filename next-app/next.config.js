const withTM = require('next-transpile-modules')([
  '@atlaskit/icon-lab',
  '@atlaskit/icon',
  '@loomhq/lens',
  '@loomhq/record-sdk'
]);

module.exports = withTM({
  reactStrictMode: false,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.css$/,
      include: /node_modules/,
      use: [
        'style-loader',
        'css-loader',
      ],
    });
    config.module.rules.push({
      test: /\.css$/,
      exclude: /node_modules/,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            importLoaders: 1,
          },
        },
        'postcss-loader',
      ],
    });
    return config;
  },
});