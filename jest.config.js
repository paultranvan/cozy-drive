module.exports = {

  "roots": ["<rootDir>/src"],
  "moduleFileExtensions": ["js", "jsx", "json", "styl"],
  "moduleNameMapper": {
    "\\.styl$": "identity-obj-proxy",
    "\\.css$": "identity-obj-proxy",
    "\\.svg$": "identity-obj-proxy",
    "drive/(.*)": "<rootDir>/src/drive/$1"
  },
  "transform": {
    "^.+\\.(js|jsx|styl)?$": "<rootDir>/test/jestLib/babel-transformer.js"
  },
  "transformIgnorePatterns": ["node_modules/(?!cozy-ui)/", "node_modules/(?!cozy-konnector-libs)/"],
  "testMatch": ["**/(*.)(spec|test).js?(x)"]
}
