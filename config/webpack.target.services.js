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

  return {
    entry: entry,
    output: {
      path: path.resolve(__dirname, `../build/${app}`),
      filename: '[name].js'
    },
    plugins: plugins,
    externals: [nodeExternals()]
  }
}
