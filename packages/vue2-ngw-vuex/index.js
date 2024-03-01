'use strict';

if (process.env.NODE_ENV === 'development') {
  module.exports = require('./lib/vue2-ngw-vuex.cjs.js');
} else {
  module.exports = require('./lib/vue2-ngw-vuex.cjs.prod.js');
}
