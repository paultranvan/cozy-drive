'use strict'

const path = require('path')
const fs = require('fs')
const { DefinePlugin } = require('webpack')
const nodeExternals = require('webpack-node-externals')

const TARGET_DIR = path.resolve(__dirname, '../targets/')
const SRC_DIR = path.resolve(__dirname, '../src/')

module.exports = function(production, app) {
  var entry = {
    onPhotoUpload: path.resolve(TARGET_DIR, './photos/services/onPhotoUpload')
  }

  var plugins = [
    new DefinePlugin({
      __TARGET__: JSON.stringify('services')
    })
  ]
  var target = 'node'
  var modules = {
    rules: [
      {
        test: /\.hbs$/,
        include: SRC_DIR,
        loader: 'raw-loader'
      },
      {
        test: /\.js$/,
        include: path.resolve('./node_modules'),
        loader: 'shebang-loader'
      },
      {
        test: /\.svg$/,
        include: SRC_DIR,
        loader: 'null-loader'
      }
    ],
    // Dynamic requires produce warnings in webpack. Some of our dependencies
    // use them for features we do not use, so we can disable them.
    // More information : https://gitlab.cozycloud.cc/labs/cozy-bank/merge_requests/197#note_4018
    exprContextRegExp: /$^/,
    exprContextCritical: false,
  }

  var resolve = {
    alias: {
      // Unminified Handlebars uses `require.extensions` and this causes
      // warnings on Webpack. We should think of a way to precompile
      // our Handlebars template. At the moment it is not possible
      // since we pass helpers at runtime.
      handlebars: 'handlebars/dist/handlebars.min.js'
    }
  }

  return {
    entry: entry,
    output: {
      path: path.resolve(__dirname, `../build/${app}`),
      filename: '[name].js'
    },
    plugins: plugins,
    module: module,
    target: target,
    externals: [nodeExternals()]
  }
}
