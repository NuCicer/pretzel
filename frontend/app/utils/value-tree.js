
/* global Ember */

import { isArray } from '@ember/array';

const trace_values = 0;
const dLog = console.debug;


/*----------------------------------------------------------------------------*/

/** levelMeta.get(value) is simply the data type name, except in the case of
 * the multi-root of the ontology tree, which also has a name attribute,
 * i.e. {typeName : 'term', name : 'CO'}
 * This addition might lead to other values in the meta, perhaps a class with
 * access functions.
 * This function accesses the data type name, irrespective of whether the meta is
 * just the type name (string) or an object containing .typeName
 */
function valueGetType(levelMeta, value) {
  let valueType = levelMeta.get(value);
  if (valueType?.typeName) {
    valueType = valueType.typeName;
  }
  return valueType;
}


/*----------------------------------------------------------------------------*/
/* Functional programming utilities.
 * Lodash is already included by various packages, so may use that, or possibly Ramda.
 */

/** Analogous to Array map(), produce a result parallel to the input, having the
 * same keys, and a value for each key based on the corresponding value of the
 * input hash.
 * @param h  input hash (object)
 * @param fn function(key, value) -> value which transforms the values.
 */
function mapHash(h, fn) {
  let result = {};
  for (var key in h) {
    if (h.hasOwnProperty(key)) {
      let value = h[key];
      console.log('mapHash', key, value);
      result[key] = fn(key, value);
    }
  }
  console.log('mapHash', h, '->', result);
  return result;
}

/*----------------------------------------------------------------------------*/


/** Analogous to Array forEach(), call function for each key:value pair of the
 * input hash.
 * Similar to mapHash().
 * @param h  input hash (object)
 * @param fn function(key, value)
 */
function forEachHash(h, fn) {
  // based on mapHash().
  console.log('forEachHash', h);
  for (var key in h) {
    if (h.hasOwnProperty(key)) {
      let value = h[key];
      console.log('forEachHash', key, value);
      fn(key, value);
    }
  }
}


/** Analogous to Array .reduce(), call function for each key:value pair of the
 * input hash, passing & returning result.
 * Similar to mapHash().
 * @param h  input hash (object)
 * @param fn function(result, key, value) -> result
 * @param result
 */
function reduceHash(h, fn, result) {
  const fnName = 'reduceHash';
  // based on mapHash().
  dLog(fnName, h, result);
  for (var key in h) {
    if (h.hasOwnProperty(key)) {
      let value = h[key];
      dLog(fnName, key, value, result);
      result = fn(result, key, value);
    }
  }
  return result;
}


/** Similar to reduceHash(); this is specific to the tree returned by
 * services/data/ontology.js : getTree(), and copied by manage-explorer.js :
 * mapTree() and treeFor().
 * Similar to walkTree() (manage-explorer.js);  difference : this passes parentKey, index to fn;
 * The API of the tree used by this function is {id, children : []}.
 * Analogous to Array .reduce(), call function for each key:value pair of the
 * input hash, passing & returning result.
 * @param tree  input tree (object : {id, children : [], .. }
 * @param fn function(result, parentKey, index, value) -> result
 * @param result
 */
function reduceIdChildrenTree(tree, fn, result) {
  const fnName = 'reduceIdChildrenTree';
  dLog(fnName, tree, result);
  return reduceIdChildrenTreeR(tree, /*parentKey*/undefined, /*index*/-1, fn, result);
}
/** The recursive part of reduceIdChildrenTree().
 */
function reduceIdChildrenTreeR(tree, parentKey, index, fn, result) {
  // based on mapTree0().

  result = fn(result, parentKey, index, tree);

  let children = tree.children;
  if (children === undefined) {
    result = Object.entries(tree).reduce(
      (result2, e) => reduceIdChildrenTreeR(e[1], tree.id, e[0], fn, result2), result);
  } else if (isArray(children)) {
    result = children.reduce((result1, childNode, i) => {
        result1 = reduceIdChildrenTreeR(childNode, tree.id, i, fn, result1);
        return result1;
      }, result);
  }

  return result;
}


/*============================================================================*/

/* global d3 */

/**
 * @return true if value is just {unmatched : ... }, i.e. it is an object with
 * only 1 key, and that key is 'unmatched'.
 */
function justUnmatched(value) {
  // could instead pass a flag to datasetFilter() to discard unmatched.
  let result = value.hasOwnProperty('unmatched') && (d3.keys(value).length === 1);
  return result;
}

/*============================================================================*/
/* For logging value tree constructed in data explorer - manage-explorer.js */

/** For devel logging - log the contents of the given value tree v.
 * @param levelMeta annotations of the value tree, e.g. dataTypeName text.
 */
function logV(levelMeta, v) {
  console.log(v);
  if (v && v.constructor === Map) {
    v.forEach(function (key, value) {
      console.log(key, levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  /** may have Ember.isArray(v) and (typeof v === 'object') (e.g. result of
   * computed property / promise array proxy), so test for array first.
   */
  else if (isArray(v)) {
    v.forEach(function (value) {
      console.log(levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  else if (v.constructor.modelName) {
    /* Ember object */
    console.log(
      v.constructor.modelName,
      v.get('name'),
      v._internalModel.__data
    );
  }
  else if (typeof v === 'object') {
    forEachHash(v, function (key, value) {
      console.log(key, levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  else
    console.log(levelMeta.get(v), v);
}

/*----------------------------------------------------------------------------*/

/** Count the leaf values, i.e. the blocks.
 * This is used when deciding whether to auto-expand all levels down to the leaves.
 * It is desirable to expand all (using allActive) if the displayed list is then
 * only a couple of pages, i.e. if there are a reasonable number of leaves.
 * @see autoAllActive(), allActive
 *
 * @param levelMeta annotations of the value tree, e.g. dataTypeName text.
 * @param values  a value tree
 */
function leafCount(levelMeta, values) {
  /** Traverse the value tree, similar to logV() above; it is probably not
   * necessary to handle all node types as logV() does, since leafCount() is
   * simply counting the leaves not visiting them.
   */
  let 
    datasetIds = Object.keys(values),
  count0 =
    datasetIds.reduce((count1, d) => {
      let
        value = values[d],
      /** If value is an array of Blocks, simply add .length to count, otherwise
       * it is a hash of scopes - traverse them and sum the .length of the
       * blocks array of each.
       * Ember.isArray(scopes) could instead be used to discern these 2 cases.
       */
      valueType = valueGetType(levelMeta, value);
      if (valueType == "Blocks") {
        count1 += value.length;
      }
      else if (
        // getting "Dataset";  not sure if values should include that.
        (valueType == "Dataset") && 
          value.get &&
          value.get('isLoaded')) {
        dLog('leafCount', valueType, value.get('id'), value.get('name'), value.get('blocks'));
        count1 += value.get('blocks.length');
      }
      else {
        let
          scopes = value,
          scopeNames =  Object.keys(scopes);
        count1 = scopeNames.reduce((sum, s) => {
          if (trace_values > 1)
          dLog(sum, s, scopes[s]);
          return sum+=scopes[s].length;
        }, count1);
      }
      if (trace_values > 1)
      console.log(value, valueType, count1);
      return count1;
    }, 0);
  if (trace_values)
  console.log('leafCount', values, datasetIds, count0);

  return count0;
}

/*----------------------------------------------------------------------------*/

/** Count blocks in Ontology tree.
 */
function leafCountIdChildrenTree(levelMeta, tree) {
  function addCount(result1, parentKey, index, value) {
    /** value.node[] is an array of parents (blocks grouped by parent / scope),
     * added by manage-explorer : mapTree()
     */
    if (value.node) {
      result1 = value.node.reduce((result2, parentGroup) => result2 += leafCount(levelMeta, parentGroup), result1);
    }
    return result1;
  };
  let result = reduceIdChildrenTree(tree, addCount, 0);
  return result;
}


function leafCountOntologyTab(levelMeta, values) {
  let count;
  let dataTypeName = valueGetType(levelMeta, values);

  switch (dataTypeName) {
  case 'Groups' :
    count = reduceHash(
      values,
      (result, key, value) => result += leafCount(levelMeta, value),
      0);
    break;
  case 'term' : count = leafCountIdChildrenTree(levelMeta, values);
    break;
  default :
    dLog('autoAllActive', dataTypeName, values);
    break;
  }
  return count;
}

// -----------------------------------------------------------------------------

/** The tree created by blockFeatureOntologiesTreeEmbedded() has .node, added by mapTree().
 * These are not required in the view panel component panel/ontologies, and are
 * deleted by this function (this is a copy made by treeFor).
 */
function unlinkDataIdChildrenTree(tree) {
  /** based on leafCountIdChildrenTree(), which comments about value.node[]. */
  function deleteNodeAttr(result1, parentKey, index, value) {
    if (value.node) {
      delete value.node;
    }
  };
  reduceIdChildrenTree(tree, deleteNodeAttr, 0);
}

/** Replace levelMeta matchString with a copy of value, with .typeName : matchString.
 * @param tree   created by blockFeatureOntologiesTreeEmbedded(), has strings 'term' and 'trait' for ontology nodes.
 * @param matchString  e.g. 'term'
 * @param objectValue Object, copied with Object.assign({typeName : matchString}, value)
 */
function augmentMetaIdChildrenTree(tree, levelMeta, matchString, objectValue) {
  function augmentMatchingNode(result1, parentKey, index, value) {
    if (levelMeta.get(value) == matchString) {
      let newValue = Object.assign({typeName : matchString}, objectValue);
      levelMeta.set(value, newValue);
    }
  };
  reduceIdChildrenTree(tree, augmentMatchingNode, 0);
}


/*----------------------------------------------------------------------------*/

function typeMetaIdChildrenTree(levelMeta, tree) {
  function storeType(result, parentKey, index, value) {
    levelMeta.set(value, value.type);
  };
  reduceIdChildrenTree(tree, storeType, undefined);
  return levelMeta;
}


/*----------------------------------------------------------------------------*/

/** if the OntologyId has been augmented with its text description, then parse
 * out the ID.
 * @param oid either e.g. "CO_338:0000017" or "[CO_338:0000017] Flower color"
 * @return just the ID, e.g. "CO_338:0000017" etc  (regexp handles :ROOT, or :Term Name)
 */
function ontologyIdFromIdText(oid) {
  if (oid.startsWith('[')) {
    let
    ontologyIdMatch = oid.match(/^\[(CO_[0-9]+.*)\]/);
    oid = ontologyIdMatch && ontologyIdMatch[1];
  }
  return oid;
}


/*----------------------------------------------------------------------------*/

export {
  valueGetType,
  mapHash, forEachHash, reduceHash, reduceIdChildrenTree,
  justUnmatched, logV,
  leafCount, leafCountOntologyTab,
  unlinkDataIdChildrenTree,
  augmentMetaIdChildrenTree,
  typeMetaIdChildrenTree,
  ontologyIdFromIdText,
};
