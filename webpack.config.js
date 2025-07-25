const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
// MiniCssExtractPlugin removed - no CSS files are imported in JS/TS
// CSS files are handled by CopyWebpackPlugin instead
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      background: './src/background/background.ts',
      contentScript: './src/content/contentScript.ts',
      inPageNotifier: './src/content/inPageNotifier.ts',
      popup: './src/popup/popup.ts',
      options: './src/options/options.ts',
      sandbox: './src/sandbox/sandbox.ts',
      offscreen: './src/offscreen/offscreen.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'js/[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        // CSS rule removed - CSS files are copied directly, not processed through JS imports
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name][ext]'
          }
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    plugins: [
      // MiniCssExtractPlugin removed - CSS files are copied directly by CopyWebpackPlugin
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/manifest.json',
            to: 'manifest.json'
          },
          {
            from: 'src/assets/icons',
            to: 'images'
          },
          {
            from: 'src/**/*.css',
            to: 'css/[name][ext]'
          }
        ]
      }),
      new HtmlWebpackPlugin({
        template: './src/popup/popup.html',
        filename: 'popup.html',
        chunks: ['popup']
      }),
      new HtmlWebpackPlugin({
        template: './src/options/options.html',
        filename: 'options.html',
        chunks: ['options']
      }),
      new HtmlWebpackPlugin({
        template: './src/sandbox/sandbox.html',
        filename: 'sandbox.html',
        chunks: ['sandbox']
      }),
      new HtmlWebpackPlugin({
        template: './src/offscreen/offscreen.html',
        filename: 'offscreen.html',
        chunks: ['offscreen']
      })
    ],
    devtool: isProduction ? false : 'cheap-module-source-map',
    optimization: {
      minimize: isProduction
    }
  };
};
