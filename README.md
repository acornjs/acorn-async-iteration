# Async iteration support for Acorn

[![NPM version](https://img.shields.io/npm/v/acorn-async-iteration.svg)](https://www.npmjs.org/package/acorn-async-iteration)

This is a plugin for [Acorn](http://marijnhaverbeke.nl/acorn/) - a tiny, fast JavaScript parser, written completely in JavaScript.

It implements support for async iteration as defined in the stage 3 proposal [Asynchronous Iterators for JavaScript](https://github.com/tc39/proposal-async-iteration). The emitted AST follows [ESTree](https://github.com/estree/estree/blob/master/experimental/async-iteration.md).

## Usage

You can use this module directly in order to get an Acorn instance with the plugin installed:

```javascript
var acorn = require('acorn-async-iteration');
```

Or you can use `inject.js` for injecting the plugin into your own version of Acorn like this:

```javascript
var acorn = require('acorn-async-iteration/inject')(require('./custom-acorn'));
```

Then, use the `plugins` option to enable the plugiin:

```javascript
var ast = acorn.parse(code, {
  plugins: { asyncIteration: true }
});
```

## License

This plugin is released under the [GNU Affero General Public License](./LICENSE).
