'use strict';

if (process.env.NODE_ENV === 'development') {
  module.exports = require('./lib/vue2-ngw-maplibregl.esm-bundler.js');
} else {
  module.exports = require('./lib/vue2-ngw-maplibregl.esm-bundler.prod.js');
}