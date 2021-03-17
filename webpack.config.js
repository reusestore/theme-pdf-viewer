var webpack = require('webpack');
var path = require('path');

module.exports = function(env) {
  var debug = false;
  if(env) {
    debug = !!env.debug;
  }

  var commonPlugins = [
    new webpack.DefinePlugin({
      GLOBAL_LIBS: {
        jQuery: JSON.stringify(true),
        html2canvas: JSON.stringify(true),
        React: JSON.stringify(true),
        THREE: JSON.stringify(true),
        PDFJS: JSON.stringify(true),// don't set false. It isn't implemented
      },
      GLOBAL_PATHS: {
        pdfJsWorker: JSON.stringify('js/pdf.worker.js'),
        pdfJsCMapUrl: JSON.stringify('cmaps/')
      }
    })
  ];

  if(!debug) {
    commonPlugins.push(new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }));
  }

  return {
    context: __dirname,
    devtool: debug ? 'inline-sourcemap' : '',
    entry: ['../common/polyfill.js', './index.js'],
    output: {
      path: __dirname,
      filename: 'js/dist/'+(debug? '3dflipbook.js': '3dflipbook.min.js')
    },
    module: {
      loaders: [
        {
          test: /\.html$/,
          loader: 'raw-loader'
        },
        {
          test: /\.js$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel-loader',
          query: {
            presets: [['es2015', {'loose': true}], 'stage-0'],
            plugins: ['transform-class-properties']
          }
        }
      ]
    },
    resolve: {
      extensions: ['.js'],
      modules: [
        path.resolve('./node_modules'),
        path.resolve('../common/classes')
      ]
    },
    plugins: debug ? commonPlugins : [
      ...commonPlugins,
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.optimize.UglifyJsPlugin({ mangle: false, sourcemap: false }),
    ],
  };
}
