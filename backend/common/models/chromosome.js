'use strict';

var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var task = require('../utilities/task')

module.exports = function(Chromosome) {

  Chromosome.observe('access', function(ctx, next) {
    console.log('> Chromosome.access');
    // identity.queryFilterAccessible(ctx)
    next()
  })

  Chromosome.observe('loaded', function(ctx, next) {
    // console.log('> Chromosome.loaded');
    next()
  })

  // Chromosome.observe('before save', function(ctx, next) {
  //   console.log('> Chromosome.before save');
  //   next();
  // });

  Chromosome.paths = function(left, right, cb) {
    task.paths(this.app.models, left, right)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  }

  Chromosome.remoteMethod('paths', {
    accepts: [
      {arg: '0', type: 'string', required: true}, // chromosome reference
      {arg: '1', type: 'string', required: true}, // chromosome reference
    ],
    returns: {type: 'array', root: true},
    description: "Request paths for left and right chromosomes"
  });

  Chromosome.syntenies = function(id0, id1, thresholdSize, thresholdContinuity, cb) {
    task.syntenies(this.app.models, id0, id1, thresholdSize, thresholdContinuity)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  }

  Chromosome.remoteMethod('syntenies', {
    accepts: [
      {arg: '0', type: 'string', required: true}, // chromosome reference
      {arg: '1', type: 'string', required: true}, // chromosome reference
      {arg: 'threshold-size', type: 'string', required: false}, // chromosome reference
      {arg: 'threshold-continuity', type: 'string', required: false}, // chromosome reference
    ],
    returns: {type: 'array', root: true},
    description: "Request syntenic blocks for left and right chromosomes"
  });

  acl.assignRulesRecord(Chromosome)
  acl.limitRemoteMethods(Chromosome)
  acl.limitRemoteMethodsSubrecord(Chromosome)
  acl.limitRemoteMethodsRelated(Chromosome)
};
