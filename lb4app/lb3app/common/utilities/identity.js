'use strict';

/* global exports */
/* global require */

var clientGroups = require('./client-groups');
var { cirquePush } = require('../../common/utilities/cirque');

/**
 * Find the client id from loopback context, if exists
 * @param {Object} data - ctx - loopback method context
 * @returns clientId
 */
exports.gatherClientId = (data) => {
  var accessToken = null
  if (data.options && data.options.accessToken) {
    // built-in remote methods provide token via ctx.options
    accessToken = data.options.accessToken
  } else if (data.accessToken) {
    // app-defined remote methods provide token via options
    accessToken = data.accessToken
  } 
  if (accessToken != null) {
    let clientId = String(accessToken.userId)
    return clientId
  } else {
    return null
  }
}

/**
 * Apply filters to return only owned or public resources
 * @param {Object} ctx - loopback method context
 * @returns clientId
 */
exports.queryFilterAccessible = (ctx) => {
  const fnName = 'queryFilterAccessible';
  let clientId = exports.gatherClientId(ctx)
  if (! clientGroups.clientGroups?.clientGroups) {
    console.log(fnName, ctx, clientId, this, clientGroups);
    debugger;
  }
  /** add read permission for Records / Datasets which are in groups which the
   * client is in or owns.
   */
  const
  inGroups  = clientGroups.clientGroups.clientGroups[clientId],
  ownGroups = Object.values(clientGroups.clientGroups.groups)
    .filter(group => group.clientId?.toJSON() === clientId)
    .map(group => group._id.toJSON()),
  groups = inGroups ? inGroups.concat(ownGroups) : ownGroups;
  // console.log(fnName, clientId, inGroups, ownGroups, ctx?.options.property);
  cirquePush(fnName + ' ' + clientId + '. ' + inGroups?.join() + '. ' + ownGroups.join());

  if (!ctx.query) {
    ctx.query = {};
  }
  // let groupsNull = groups.slice().push(null);
  let where = {or: [{clientId: clientId}, {public: true}]};
  /** For read access, it is sufficient for dataset.groupId to be in client groups
   * This is not applicable for delete, and also for deleteById, $in is not supported :
   * Operators \"$in\" are not allowed in query","code":"OPERATOR_NOT_ALLOWED_IN_QUERY","
   */
  /** It is possible to use $and, $or, and groups.map(ObjectId), in place of 'and', 'or' and groups. */
  let property = ctx?.options.property;
  if ((! property || (property !== 'deleteById')) && (groups?.length)) {
    let groupId = {},
        inField = property ? '$in' : 'in';
    groupId[inField] = groups;
    where.or.push({groupId});
    // console.dir(where.or[2]);
  }
  if (ctx.query.where) {
    where = {and: [where, ctx.query.where]}
  }
  ctx.query.where = where;
}

// -----------------------------------------------------------------------------

/**
 * @param clientId string or BSON id
 * @param groupId string
 */
exports.clientIsInGroup = function(clientId, groupId) {
  const fnName = 'clientIsInGroup';
  /** .toString() will do .toHexString() if clientId is BSON id.  */
  let clientIdString = clientId.toString();
  /** groups of the logged-in user.  String, from ClientGroups:update()). */
  let groups = clientGroups.clientGroups.clientGroups[clientIdString];
  // console.log('isInGroup', clientIdString, groups, groupId, data);
  /** if groupId may be BSON id insteam of string,
   * can use ObjectId .equals() for comparing BSON with String :
   *   groups.find((id) => groupId.equals(id))
   * or groups.includes(groupId.toString())
   */
  let ok = groups.includes(groupId);
  if (! ok) {
    cirquePush(fnName + ' ' + groupId.toString() + ', ' + clientIdString + ', ' + JSON.stringify(groups));
  }
  return ok;
};


/**
 * @param clientId string or BSON id
 * @param groupId string or BSON id
 */
exports.clientOwnsGroup = function(clientId, groupId) {
  const
  fnName = 'clientOwnsGroup',
  groups = clientGroups.clientGroups?.groups,
  group = groups && groups[groupId.toString()],
  ok = group?.clientId.equals(clientId);
  if (! ok) {
    cirquePush(fnName + ' ' + ok + ' ' + clientId.toString() + ' ' + groupId.toString());
    // console.log( ... , clientGroups.clientGroups);
  }
  return ok;
};


/**
 * @param groupId string or BSON id
 */
exports.groupIsWritable = function(groupId) {
  const
  fnName = 'groupIsWritable',
  groups = clientGroups.clientGroups?.groups,
  group = groups && groups[groupId.toString()],
  writable = group?.writable;
  console.log(fnName, writable, groupId.toString());
  return writable;
};

// -----------------------------------------------------------------------------
