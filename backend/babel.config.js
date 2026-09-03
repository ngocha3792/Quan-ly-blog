// Used only by Jest (via babel-jest) to transpile the ESM-only
// htmlparser2/domhandler/... copy that sanitize-html@2.17.x nests under
// its own node_modules, so it can be require()'d in CommonJS tests.
// The app itself is built with tsc (see nest-cli.json), not Babel.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
