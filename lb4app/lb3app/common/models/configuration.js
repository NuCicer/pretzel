'use strict';

var acl = require('../utilities/acl');

/* global process */
/* global require */
/* global module */

module.exports = function (Configuration) {
  /*--------------------------------------------------------------------------*/

  Configuration.runtimeConfig = function (cb) {
    let handsOnTableLicenseKey = process.env.handsOnTableLicenseKey,
      config = {handsOnTableLicenseKey: 'non-commercial-and-evaluation'};
    console.log('runtimeConfig', config);
    cb(null, config);
  };

  /*--------------------------------------------------------------------------*/

  Configuration.remoteMethod('runtimeConfig', {
    accepts: [],
    returns: {type: 'object', root: true},
    description:
      'Request run-time environment configuration of backend server, including handsOnTableLicenseKey',
  });

  /*--------------------------------------------------------------------------*/

  Configuration.version = function (cb) {
    let apiVersion = 2,
      config = {apiVersion};
    console.log('version', config);
    cb(null, config);
  };

  // ---------------------------------------------------------------------------

  Configuration.remoteMethod('version', {
    accepts: [],
    returns: {type: 'object', root: true},
    description: 'Request API version of backend server',
  });

  // ---------------------------------------------------------------------------

  acl.assignRulesRecord(Configuration);

  Configuration.disableRemoteMethodByName('findById');
};
