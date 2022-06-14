import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Evented from '@ember/object/evented';
import { on } from '@ember/object/evented';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { throttle, debounce } from '@ember/runloop';
import DS from 'ember-data';


import PathData from './path-data';

import AxisEvents from '../../utils/draw/axis-events';
import { stacks, Stacked } from '../../utils/stacks';
import {
  selectAxis,
  blockAdjKeyFn,
  blockAdjEltId,
  featureEltIdPrefix,
  featureNameClass,
  foregroundSelector,
  selectBlockAdj
} from '../../utils/draw/stacksAxes';
import { intervalSize } from '../../utils/interval-calcs';
import { thenOrNow } from '../../utils/common/promises';
import { toPromiseProxy } from '../../utils/ember-devel';

/* global d3 */

/*----------------------------------------------------------------------------*/

/** Used for CSS selectors targeting <g> and <path>-s generated by this component. */
const className = "axisBrush";
const CompName = 'components/axis-brush';

const trace_axisBrush = 1;
const dLog = console.debug;


/*----------------------------------------------------------------------------*/

/**
 * @param blockId
 * @param drawMap for Evented - stack events
 */
export default Component.extend(Evented, AxisEvents, {
  /** AxisEvents is used to receive axis stacking and resize events.
   *  Evented may be used in future to propagate events to components rendered within axis-brush.
   */
  store: service(),
  pathsP : service('data/paths-progressive'),
  controls : service(),
  auth : service(),


  /*--------------------------------------------------------------------------*/

  stacks : stacks,
  oa : alias('stacks.oa'),
  /** .drawMap is used by Evented : utils/draw/axis-events.js */
  drawMap : alias('oa.eventBus'),
  axisApi : alias('oa.axisApi'),

  apiServerSelectedOrPrimary : alias('controls.apiServerSelectedOrPrimary'),

  /*--------------------------------------------------------------------------*/

  tagName : '',

  zoomCounter : 0,

  /*--------------------------------------------------------------------------*/

  referenceDataset : computed('axis', function () {
    let dataset = this.get('axis').referenceBlock.get('datasetId');
    return dataset;
  }),

  datasetName : computed('block', 'id', function () {
    let
    axis = this.get('axis'),
    name = axis && axis.axis1d && axis.axis1d.get('referenceBlock.datasetId.id');
    dLog('datasetName', name, axis);
    return name;
  }),


  brushedDomainRounded : computed('block.brushedDomain', function () {
    let domain = this.get('block.brushedDomain');
    if (domain) {
      domain = domain.map((d) => d.toFixed(2));
    }
    return domain;
  }),

  /*--------------------------------------------------------------------------*/

  axisBrush : computed('block', function () {
    let
      block = this.get('block'),
    /** axis-brush object in store */
    record = this.get('pathsP').ensureAxisBrush(block);

    let axis1d = block.get('block.axis.axis1d');
    if (axis1d && ! axis1d.axisBrushComp) {
      axis1d.axisBrushComp = this;
    }

    if (trace_axisBrush)
      dLog('block', block.id, block, record);
    return record;
  }),

  blockId : alias('block.id'),

  /** Result is, for blockID,  the axis on which the block is displayed.
   * Will need to add dependency on stacks component, because block can be un-viewed then re-viewed.
   */
  axis :  computed('blockId', function () {
    let
      blockId = this.get('blockId'),
    axis = Stacked.getAxis(blockId);
    console.log('axis', axis);
    return axis;
  }),

  features : computed('axisBrush.features.[]', 'zoomCounter', function () {
    console.log('features', this.zoomCounter, this);
    let featuresP = this.get('axisBrush.features');
    featuresP.then((features) => {
    this.receivedLengths(features);
    /** features is now an array of results, 1 per block, so .length is the number of data blocks. */
    if (features && features.length)
      throttle(this, () => ! this.isDestroying && this.draw(features), 200, false);
    });
    return featuresP;
  }),

  /*--------------------------------------------------------------------------*/

  featuresReceived : undefined,

  initData : on('init', function () {
    this.set('featuresReceived', {});
  }),

  /** round to 1 decimal place.
   * @param featuresCount  undefined or number
   */
  round1(featuresCount) {
    return featuresCount && Math.round(featuresCount * 10) / 10;
  },

  /** Augment axis1d.brushedBlocks with features.length and block
   * .featuresCountIncludingZoom (later : featuresCountInBrush)
   */
  brushedBlocks : computed(
    'axis.axis1d.brushedBlocks.[]',
    'block.brushedDomain.{0,1}',
    function () {
      let
      blocks = this.get('axis.axis1d.brushedBlocks') || [],
      brushedBlocks = blocks.map((block, i) => {
        let 
        featureCountInBrush = this.round1(block.get('featuresCountIncludingBrush')),
        featuresCount = this.round1(block.get('featuresCountIncludingZoom'));
        return {block, featuresCount, featureCountInBrush};
      });
      dLog('brushedBlocks', brushedBlocks);
      return brushedBlocks;
    }),

  receivedLengths(featuresResults) {
    /** could use an immutable structure, then template get would depend on it.  */
    featuresResults.forEach((featuresLengthResult) => {
      if (featuresLengthResult) {
        let length = featuresLengthResult.value?.length;
        /** if length, get blockId from value[0], otherwise not
         * straightforward to use this result.  */
        if (length) {
          let blockId = length && featuresLengthResult.value[0].blockId;
          this.featuresReceived[blockId] = length;
        }
      }
    });
  },


  /*--------------------------------------------------------------------------*/

  isAxis(axisID) {
    let axis = this.get('axis'),
    match = (axis.axisName === axisID);
    return match;
  },

  /*--------------------------------------------------------------------------*/


  /**
   * @param features
   */
  draw (features) {
    if (features.length === 0)
      return;

    let axisApi = this.get('axisApi');
    dLog('draw', this, features.length, axisApi);
    if (axisApi) {
      let
        /** defined after first brushHelper() call. */
        axisFeatureCirclesBrushed = axisApi.axisFeatureCirclesBrushed;
      if (axisFeatureCirclesBrushed)
        axisFeatureCirclesBrushed();
    }

  },

  /** Update the cx and cy attributes of the <circle>-s.  */
  updateFeaturesPosition() {
  },

  /*--------------------------------------------------------------------------*/

  updateFeaturesPositionDebounce(axisID_t) {
    // console.log('updateFeaturesPositionDebounce', axisID_t);
    debounce(this, this.updateFeaturesPosition, axisID_t, 500);
  },

  /*--------------------------------------------------------------------------*/
  
  /** axis-brush receives axisStackChanged and zoomedAxis from draw-map
   */

  resized : function(widthChanged, heightChanged, useTransition) {
    if (trace_axisBrush > 1)
      dLog("resized in ", CompName);
    if (heightChanged)
      // instead of debounce, can trigger position update with this.incrementProperty('rangeCounter');
      this.updateFeaturesPositionDebounce();
  },

  axisStackChanged : function() {
    if (trace_axisBrush > 1)
      dLog("axisStackChanged in ", CompName);
    this.updateFeaturesPositionDebounce();
  },

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) {
    let axisID = axisID_t[0],
    blockId = this.get('blockId'),
    axis = this.get('axis');
    if (trace_axisBrush > 1)
      console.log("zoomedAxis in ", CompName, axisID_t, blockId, axis);
    if (this.isAxis(axisID))
    {
      if (trace_axisBrush > 1)
        dLog('zoomedAxis matched', axisID, blockId, axis);
      this.incrementProperty('zoomCounter');
    }
  },
  /*--------------------------------------------------------------------------*/

  datasetOkForSequenceLookup : computed('referenceDataset', function () {
    let
    datasetP = this.get('referenceDataset'),
    okP = toPromiseProxy(thenOrNow(datasetP, (dataset) => dataset?.hasTag('BlastDb')));
    return okP;
  }),
  sequenceLookupDomain: computed('block.brushedDomain', function () {
    let
    domain = this.get('block.brushedDomain'),
    domainInteger = domain && 
      (intervalSize(domain) < 100000) &&
      domain.map((d) => d.toFixed(0));
    return domainInteger;
  }),
  dnaSequenceLookup() {
    let
    domainInteger = this.get('sequenceLookupDomain');
    if (domainInteger) {
      let
    scope = this.get('block.block.scope'),
    region = 'chr' + scope + ':' + domainInteger.join('-'),
    parent = this.get('datasetName');

    let sequenceTextP = this.get('auth').dnaSequenceLookup(
      this.get('apiServerSelectedOrPrimary'), parent, region,
      {} );
    sequenceTextP.then(
      (sequenceText) => {
        dLog('dnaSequenceLookup', sequenceText);
        this.set('sequenceText', sequenceText?.sequence);
      });
    }
  },


  // ---------------------------------------------------------------------------


  
});


/*----------------------------------------------------------------------------*/

function featureEltId(featureBlock)
{
  let id = featureKeyFn(featureBlock);
  id = featureNameClass(id);
  return id;
}


function featureKeyFn (featureBlock)
{ return featureBlock._id.name; }



/*----------------------------------------------------------------------------*/
