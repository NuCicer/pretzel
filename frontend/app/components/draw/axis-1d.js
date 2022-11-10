import { later, next, once as run_once, throttle } from '@ember/runloop';
import { A } from '@ember/array';
import { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import Evented from '@ember/object/evented';
import Component from '@ember/component';
import { inject as service } from '@ember/service';


import { sum } from 'lodash/math';
import { isEqual } from 'lodash/lang';


import { contentOf } from '../../utils/common/promises';
import AxisEvents from '../../utils/draw/axis-events';
import AxisPosition from '../../mixins/axis-position';
import DrawStackObject from '../../models/draw/stack';
import {
  /* Block,
  */ Stacked,
  /*Stack,
  */ stacks /*,
  xScaleExtend,
  axisRedrawText,
  axisId2Name*/
} from '../../utils/stacks';
import {
  noDomain,
  /* Axes, yAxisTextScale,  yAxisTicksScale,*/  yAxisBtnScale,
  /* yAxisTitleTransform, eltId,*/ axisEltId /*, eltIdAll, highlightId*/,
  axisEltIdClipPath,
  axisTitleColour,
  eltId,
  featureTraitColour,
} from '../../utils/draw/axis';
import {
  DragTransition,
  dragTransitionTime,
  dragTransitionNew,
  dragTransition
} from '../../utils/stacks-drag';
import { selectAxis } from '../../utils/draw/stacksAxes';
import { selectGroup, nowOrAfterTransition } from '../../utils/draw/d3-svg';
import { breakPoint } from '../../utils/breakPoint';
import { configureHover } from '../../utils/hover';
import { getAttrOrCP } from '../../utils/ember-devel';
import { intervalExtent, intervalOverlapOrAbut }  from '../../utils/interval-calcs';
import { inRange } from '../../utils/draw/zoomPanCalcs';
import { updateDomain } from '../../utils/stacksLayout';
import { FeatureTicks, FeatureTick_className, blockTickEltId } from '../../utils/draw/feature-ticks';


/* global d3 */
/* global require */

/*------------------------------------------------------------------------*/

const Stacked_p = Stacked.prototype;

const trace_stack = 0;

const dLog = console.debug;

/* milliseconds duration of transitions in which axis ticks are drawn / changed.
 * Match with time used by draw-map.js : zoom() and resetZoom() : 750.
 * also @see   dragTransitionTime.
 */
const axisTickTransitionTime = 750;

/** if true, assign colours to block.get('dataset'), otherwise block. */
const colourByDataset = true;

/*------------------------------------------------------------------------*/

function blockColourObj(block) {
  let obj;
  if (colourByDataset) {
    obj = block.get('datasetId');
    if (obj?.content) {
      obj = obj.content;
    }
  } else {
    obj = block;
  }
  return obj;
}

function blockKeyFn(block) { return block.axisName; }


/*------------------------------------------------------------------------*/


/*------------------------------------------------------------------------*/


const componentName = 'axis-1d';
const className = FeatureTick_className;



/**
 * @property zoomed   selects either .zoomedDomain or .blocksDomain.  initially undefined (false).
 * @property flipped  if true then the domain is flipped in the view.  initially undefined (false).
 */
export default Component.extend(Evented, AxisEvents, AxisPosition, {
  blockService: service('data/block'),
  selected : service('data/selected'),
  axisBrush: service('data/axis-brush'),
  axisZoom: service('data/axis-zoom'),
  headsUp : service('data/heads-up'),
  controls : service(),

  controlsView : alias('controls.view'),

  stacks : stacks,
  /** oa is used for these connections, which will eventually be
   * passed as params or replaced : axisApi, eventBus, svgContainer, axes[].
   * (stacks.oa is equivalent)
   */
  oa : alias('drawMap.oa'),
  axisApi : alias('oa.axisApi'),

  axisTicks : alias('controlsView.axisTicks'),

  featuresCountsThreshold : alias('controls.view.featuresCountsThreshold'),

  /** flipRegion implies paths' positions should be updated.  The region is
   * defined by brush so it is within the domain, so the domain does not change.
   */
  flipRegionCounter : 0,


  init() {
    this._super(...arguments);

    // reference block -> axis-1d.  can change to a Symbol.
    this.axis.set('axis1dR', this);
    let axisName = this.get('axis.id');
    /* axisS may not exist yet, so give Stacked a reference to this. */
    Stacked.axis1dAdd(axisName, this);
    let axisS = this.get('axisS');
    if (! axisS) {
      dLog('axis-1d:init', this, axisName, this.get('axis'));
    }
    else if (axisS.axis1d === this) {
      // no change
    }
    else if (axisS.axis1d && ! axisS.axis1d.isDestroyed)
    {
      dLog('axis-1d:init', this, axisName, this.get('axis'), axisS, axisS && axisS.axis1d);
    }
    else {
      axisS.axis1d = this;
      if (trace_stack) {
        dLog('axis-1d:init', this, this.get('axis.id'), axisS); axisS.log();
      }
    }

    next(() => this.axis1dExists(this, true));
  },


  // ---------------------------------------------------------------------------

  referenceBlock : undefined,
  axisName : alias('axis.id'),
  portion : computed('stack.portions', function () {
    const fnName = 'portion' + ' (axesP)';
    let portion;
    if (!this.stack || ! this.stack?.axisIndex) {
      later(() => {
        const portions = this.get('stack.portions');
      }, 4000);
    } else {
      const
      portions = this.stack.portions,
      axisIndex = this.stack.axisIndex(this);
      portion = (axisIndex === -1) ? undefined : portions[axisIndex];
      console.log(fnName, portion, this.axis.scope);
    }
    return portion;
  }),
  position : undefined,

  // ---------------------------------------------------------------------------

  /** Create a stack for this axis-1d. */
  createStackForAxis() {
    const fnName = 'createStackForAxis' + ' (axesP)';
    const axis1d = this;
    let s = DrawStackObject.create({axes : [axis1d]});
    axis1d.set('stack', s); // or Ember_set()
    console.log(fnName, s);
    return s;
  },

  // ---------------------------------------------------------------------------

  getAxis		: Stacked_p.getAxis,
  axis1dAdd		: Stacked.axis1dAdd,
  axis1dRemove		: Stacked.axis1dRemove,
  getAxis1d		: Stacked_p.getAxis1d,
  toString		: Stacked_p.toString,
  log		: Stacked_p.log,
  longName		: Stacked_p.longName,
  logBlocks		: Stacked_p.logBlocks,
  logElt		: Stacked_p.logElt,
  referenceBlockS		: Stacked_p.referenceBlockS,
  getStack		: Stacked_p.getStack,
  getAxis		: Stacked.getAxis,
  axisOfDatasetAndScope		: Stacked.axisOfDatasetAndScope,
  getStack		: Stacked.getStack,
  longName		: Stacked.longName,
  removeBlock		: Stacked_p.removeBlock,
  removeBlockByName		: Stacked_p.removeBlockByName,
  move		: Stacked_p.move,
  yOffset		: Stacked_p.yOffset,
  yRange		: Stacked_p.yRange,
  yRange2		: Stacked_p.yRange2,
  domainCalc		: Stacked_p.domainCalc,
  referenceDomain		: Stacked_p.referenceDomain,
  getDomain		: Stacked_p.getDomain,
  verify		: Stacked_p.verify,
  children		: Stacked_p.children,
  dataBlocks		: Stacked_p.dataBlocks,
  keyFunction		: Stacked_p.keyFunction,
  axisSide		: Stacked_p.axisSide,
  // axisTransform		: Stacked_p.axisTransform,
  selectAll		: Stacked_p.selectAll,
  selectAll		: Stacked.selectAll,
  allocatedWidth		: Stacked_p.allocatedWidth,
  extendedWidth		: Stacked_p.extendedWidth,
  location		: Stacked_p.location,
  axisTransformO		: Stacked_p.axisTransformO_orig,
  getY		: Stacked_p.getY,
  currentPosition		: Stacked_p.currentPosition,
  axisDimensions		: Stacked_p.axisDimensions,
  setDomain		: Stacked_p.setDomain,
  setZoomed		: Stacked_p.setZoomed,
  unviewBlocks		: Stacked_p.unviewBlocks,


  /*--------------------------------------------------------------------------*/

  /** @return true if there is a brush on this axis.
   */
  brushed : computed('brushedRegion', function () {
    let brushed = !! this.get('brushedRegion');
    return brushed;
  }),
  brushedRegion : computed(
    'axis.id',
    'axisBrush.brushedAxes.[]',
    /** oa.brushedRegions is a hash, and it is updated not replaced,
     * so as a dependency key it will not signal changes; selectedAxes
     * is an array and is changed when brushedRegions is changed, so
     * it is used as a dependency, but it may not change when the user
     * brushes because it persists after the brush is cleared.
     */
    'oa.brushedRegions', 'oa.selectedAxes.[]',
    function () {
      let brushedRegions = this.get('oa.brushedRegions'),
      axisId = this.get('axis.id'),
      brushed = brushedRegions[axisId];
      dLog('brushed', axisId, brushedRegions[axisId], this.get('axisBrush.brushedAxes'));
      return brushed;
    }),
  brushedDomain : computed('brushedRegion', function () {
    let
    brushedRegion = this.get('brushedRegion'),
    /** refBlockId */
    axisId = this.get('axis.id'),
    brushedDomain = brushedRegion && this.get('axisApi').axisRange2Domain(axisId, brushedRegion);
    return brushedDomain;
  }),

  /** Dependency on .dataBlocks provides update for this axis if brushed, when a
   * data block is viewed on it.
   */
  brushedBlocks : computed('brushed', 'block', 'zoomedDomain.{0,1}', 'dataBlocks', function () {
    let blocks;
    if (this.brushed) {
      blocks = this.get('dataBlocks');
      dLog('brushedBlocks', blocks, this);
    }
    return blocks || [];
  }),


  zoomed2 : computed('zoomed', 'domain', 'zoomedDomain', function () {
    let
    zoomed = this.get('zoomed'),
    domain = this.get('domain'),
    zoomedDomain = this.get('zoomedDomain');
    if (zoomed) {
      zoomed &= (domain[0] !== zoomedDomain[0]) ||
        (domain[1] !== zoomedDomain[1]);
    }
    return zoomed;
  }),

  /** similar to isZoomedOut, this is quicker to evaluate because it
   * only considers the fully-zoomed out case, which means that the
   * total .featureCount for each block can be used instead of
   * calculating .featuresCountIncludingZoom.
   * i.e. if all .dataBlocks[] have block.featureCount < featuresCountsThreshold
   */
  isZoomedRightOut() {
    let out = ! this.zoomed;
    if (out) {
      let
      featuresCountsThreshold = this.get('featuresCountsThreshold');
      out = ! this.dataBlocks.any((b) => b.featureCount <= featuresCountsThreshold);
      dLog('isZoomedRightOut', out, featuresCountsThreshold, this.dataBlocks);
    }
    return out;
  },

  /*--------------------------------------------------------------------------*/

  /** axis-1d receives axisStackChanged and zoomedAxis from draw-map
   * zoomedAxis is specific to an axisID, so respond to that if it matches this.axis.
   */

  resized : function(widthChanged, heightChanged, useTransition) {
    /* useTransition could be passed down to showTickLocations()
     * (also could pass in duration or t from showResize()).
     */
    if (trace_stack)
      dLog("resized in components/axis-1d");
    if (heightChanged)
      this.renderTicksDebounce();
  },

  axisStackChanged : function() {
/*
    dLog("axisStackChanged in components/axis-1d");
    this.renderTicksDebounce();
*/
  },


  dropIn(targetAxis1d, top) {
    const fnName = 'dropIn' + '(axesP)';
    console.log(fnName, this.get('axis.id'), this.axis.scope, targetAxis1d, top, targetAxis1d.get('axis.scope'));
    targetAxis1d.stack.dropIn(this, targetAxis1d, top);
  },
  dropOut() {
    const fnName = 'dropOut';
    console.log(fnName, this.get('axis.id'));
    /* updateStacksAxes() : createForReference() will create a new stack for this axis. */
    this.stack.dropOut(this);
  },

  /** @return the Stacked object corresponding to this axis. */
  axisS : computed(
    'axis.id', 'stacks.axesPCount', 'axis.view',
    function () {
      let
      fnName = 'axisS',
      axisName = this.get('axis.id'),
      axisS = Stacked.getAxis(axisName) || this.get('axis.view');
      if (! axisS) {
        let
        block = this.axis,
        scope = block.get('scope'),
        name = block.get('datasetId.id');
        /** match with a different server, using name and scope. */
        axisS = Stacked.axisOfDatasetAndScope(true, name, scope) ||
          Stacked.axisOfDatasetAndScope(false, name, scope);
        dLog(fnName, name, scope, axisS, block);
      }
      if (axisS) {
        if (axisS.axis1d === this && this.isDestroying)
          axisS.axis1d = undefined;
        else if (! axisS.axis1d && ! this.isDestroying) {
          axisS.axis1d = this;
        }
      }
    return axisS;
  }),
  /** @return true if an axis-2d child component is required for this
   * axis, i.e. the axis is split or has data blocks which are QTLs
   * (which are shown as axis-tracks outside-right of the axis, and
   * hence axis-2d and axis-tracks are required.
   */
  is2d : computed('extended', 'dataBlocksQtl.[]', function () {
    return !! this.get('extended') || this.get('dataBlocksQtl.length');
  }),
  /** viewed blocks on this axis.
   * For just the data blocks (depends on .hasFeatures), @see dataBlocks()
   * @desc
   * Related : block : viewedChildBlocks().
   */
  viewedBlocks : computed('axis', 'blockService.axesViewedBlocks2.[]', function () {
    let
    blocks,
    axesBlocks = this.get('blockService.axesViewedBlocks2'),
    referenceBlock = this.get('axis');
      blocks = axesBlocks.get(referenceBlock);
      dLog('viewedBlocks', referenceBlock, axesBlocks, blocks);
    return blocks || [];
  }),
  dataBlocks : computed('viewedBlocks.@each.isData', function () {
    let
    /** block.isData is similar to the block.hasFeatures filtering which is done in loadedViewedChildBlocks() */
    dataBlocks = this.get('viewedBlocks')
      .filter((block) => block.get('isData'));
    dLog('dataBlocks', dataBlocks);
    return dataBlocks;
  }),
  dataBlocksQtl : computed('dataBlocks.[]', function () {
    let
    /** isSNP is constant for a block. */
    qtlBlocks = this.get('dataBlocks')
      .filter((block) => block.get('isQTL'));
    dLog('qtlBlocks', qtlBlocks);
    return qtlBlocks;
  }),

  /** Reverse map dataBlocks : map from blockId to index position within the dataBlocks[].
   *
   * This can replace storeBlockIndex(), which is defined in
   * showTickLocations(); that is calculated at render time, whereas this is
   * dependent on the base data.
   */
  blockIndexes : computed('viewedBlocks.[]', function () {
    // based on axis-tracks.js : blockIndexes(), translated to .reduce.
    let dataBlocks = this.get('viewedBlocks');
    let blockIndexes =
    dataBlocks.reduce(function (result, b, i) {
      let d = b.get('id');  result[d] = i; 
      return result;
    }, {});
    dLog('blockIndexes', blockIndexes, dataBlocks);
    return blockIndexes;
  }),
  colourSlotsUsed : A([]),
  /** assign colour slots to viewed blocks of an axis
   * e.g. slots 0-10 for schemeCategory10
   * @return array mapping colour slots to blocks, or perhaps blocks to slots
   */
  colourSlots : computed('dataBlocks.[]', function () {
    /* 
     * when .viewed blocks changes : for each viewed block
     * if it is viewed and does not have a colour slot assigned
     * look for a slot assigned to a block which is no longer viewed
     * if 1 found, re-use that slot
     * else use an incrementing count (maybe simply append - that would enable 2 identical colours after others are unviewed, but new allocations would be from the initial range because search from start)
     */
    let colourSlots,
    used = this.get('colourSlotsUsed');
    let dataBlocks = this.get('dataBlocks');
    if (trace_stack > 1)
      dLog('colourSlots', used, 'dataBlocks', dataBlocks);
    dataBlocks.forEach((b) => {
      if (b.get('isViewed') && (this.blockColour(b) < 0)) {
        let free = used.findIndex(function (bi, i) {
          /** bi is block or dataset, @see blockColourObj(). */
          return !bi || !bi.get('isViewed');
        });
        const obj = blockColourObj(b);
        if (free > 0)
          used[free] = obj;
        else
          used.push(obj);
      }
    } );
    colourSlots = used;
    if (trace_stack)
      dLog('colourSlots', colourSlots);
    return colourSlots;
  }),
  colourSlotsEffect : computed('colourSlots.[]', 'dataBlocks.[]', function () {
    let colourSlots = this.get('colourSlots');
    if (trace_stack)
      dLog('colourSlotsEffect', colourSlots, 'colourSlots', 'dataBlocks');
    /** Update the block titles text colour. */
    this.axisTitleFamily();
  }),
  /** @return the colour index of this block
   */
  blockColour(block) {
    let used = this.get('colourSlotsUsed'),
    i = used.indexOf(blockColourObj(block));
    if ((trace_stack > 1) && (i === -1) && block.isData) {
      dLog('blockColour', i, block.mapName, block, used, this,
           this.viewedBlocks, this.viewedBlocks.map((b) => [b.mapName, b.isData, b.id]));
    }
    return i;
  },
  /** @return a colour value for .attr 'color'
   * @desc uses axisTitleColour(), which uses this.blockColour()
   */
  blockColourValue(block) {
    let
    blockId = block.get('id'),
    /** Could set up param i as is done in showTickLocations() :
     * featurePathStroke(), but i is only used when axisTitleColourBy is .index,
     * and currently it is configured as .slot.
     */
    colour = axisTitleColour(blockId, /*i*/undefined) || 'black';
    return colour;
    },

  /** @return the domains of the data blocks of this axis.
   * The result does not contain a domain for data blocks with no features loaded.
   *
   * These events are input to the chain dataBlocksDomains -> blocksDomains ->
   *   blocksDomain -> domain -> domainChanged -> scaleChanged
   */
  dataBlocksDomains : computed('dataBlocks.@each.featuresDomain', function () {
    let dataBlocks = this.get('dataBlocks'),
    dataBlockDomains = dataBlocks.map(function (b) { return b.get('featuresDomain'); } )
    /* featuresDomain() will return undefined when block has no features loaded. */
      .filter(d => d !== undefined);
    return dataBlockDomains;
  }),
  referenceBlock : alias('axis'),
  /** @return the domains of all the blocks of this axis, including the reference block if any.
   * @description related @see axesDomains() (draw/block-adj)
   */
  blocksDomains : computed('dataBlocksDomains.[]', 'referenceBlock.range', function () {
    let
      /* alternative :
       * dataBlocksMap = this.get('blockService.dataBlocks'),
       * axisId = this.get('axis.id'),
       * datablocks = dataBlocksMap.get(axisId),
       */
      /** see also domainCalc(), blocksUpdateDomain() */
      blocksDomains = this.get('dataBlocksDomains'),
    /** equivalent : Stacked:referenceDomain() */
    referenceRange = this.get('referenceBlock.range');
    if (referenceRange) {
      dLog('referenceRange', referenceRange, blocksDomains);
      blocksDomains.push(referenceRange);
    }
    return blocksDomains;
  }),
  /** @return the union of blocksDomains[], i.e. the interval which contains all
   * the blocksDomains intervals.
   */
  blocksDomain : computed('blocksDomains.[]', function () {
    let 
      blocksDomains = this.get('blocksDomains'),
    domain = intervalExtent(blocksDomains);
    dLog('blocksDomain', blocksDomains, domain);
    return domain;
  }),
  /** if domain is [0,0] or [false, false] then consider that undefined. */
  domainDefined : computed('domain.0', 'domain.1', function () {
    let domain = this.get('domain'),
    defined = ! noDomain(domain);
    return defined;
  }),
  /** Update the domain of the Y scales. */
  updateScaleDomain() {
    if (this.isDestroyed) return undefined;
    let domain = this.get('domain'),
    domainDefined = this.get('domainDefined');
    if (domain && domainDefined) {
      /* Similar to this.updateDomain(), defined in axis-position.js, */
      let axisS = this.get('axisS');
      dLog('updateScaleDomain', domain, axisS);
      if (axisS) {
        let y = axisS.getY(), ys = axisS.ys;
        updateDomain(axisS.y, axisS.ys, axisS, domain);
      }
    }
    return domain;
  },
  /** This is the currently viewed domain.
   * @return if zoomed return the zoom yDomain, otherwise blockDomain.
   * Result .{0,1} are swapped if .flipped.
   */
  domain : computed('zoomed', 'flipped', 'blocksDomain', 'zoomedDomain'/*Throttled*/, function () {
    /** Actually .zoomedDomain will be == blocksDomain when not zoomed, but
     * using it as a CP dependency causes problems, whereas blocksDomain has a
     * more direct dependency on axis' blocks' features' locations.
     * When .zoomed is set, .zoomedDomain may be undefined briefly; if so use .blocksDomain.
     */
    let domain = this.get('zoomed') ? this.get('zoomedDomain') || this.get('blocksDomain') : this.get('blocksDomain');
    if (this.get('flipped')) {
      domain = [domain[1], domain[0]];
    }
    return domain;
  }),


  /** count of features of .dataBlocks
   * Maybe : Also depend on block.featuresForAxis, to trigger a request for features of
   * a block when it is added to an axis.
   */
  featureLength : computed(
    /** depend on both featuresLength{Debounced,Throttled} because we want a
     * steady flow of updates (throttled) and the trailing edge / final value
     * update (debounced).  In practice, Features are received in bursts (API
     * responses) so the throttled events may not occur.
     * lodash has options to combine these features into a single function.
     */
    'dataBlocks.@each.{featuresLengthDebounced,featuresLengthThrottled,featuresForAxis}', 
    function () {
    let dataBlocks = this.get('dataBlocks'),
    featureLengths = dataBlocks.map(function (b) { return b.get('featuresLength'); } ),
    featureLength = sum(featureLengths);
    /** This is only intended to trigger an initial featuresForAxis, but changes
     * in dataBlocks[*].featuresLength will trigger this CP, so it would be
     * recursive to request featuresForAxis here.
     * If enabled this seems to cause "Cannot read property 'nextSibling' of null" in DOMChanges.insertAfter (runtime.js)
     * seemingly because of multiple requests in a short time.
     */
    let featuresForAxis; // = dataBlocks.map(function (b) { return b.get('featuresForAxis'); } );
    dLog(this, dataBlocks, featureLengths, 'featureLength', featureLength, featuresForAxis /*.length*/);
    let axisS = this.get('axisS'); if (axisS && trace_stack) axisS.log();
    return featureLength;
  }),
  /** When featureLength changes, render.
   * The suffix Effect is used to denote a Side Effect triggered by a CF.
   */
  featureLengthEffect : computed('featureLength', 'flipRegionCounter', 'axisS', function () {
    let featureLength = this.get('featureLength');

    this.renderTicksDebounce();
    this.updateBrushedFeatures();

    /** Update the featureCount shown in the axis block title */
    this.axisTitleTextBlockCount();
    if (featureLength)
      dLog('featureLengthEffect', this.get('axis.id'), featureLength);

    return featureLength;
  }),
  updateBrushedFeatures() {
    let axisApi = stacks.oa.axisApi,
    /** defined after first brushHelper() call. */
    axisFeatureCirclesBrushed = axisApi.axisFeatureCirclesBrushed;
    if (axisFeatureCirclesBrushed) {
      next(axisFeatureCirclesBrushed);
    }
  },
  /** When values change on user controls which configure the brush,
   * re-calculate the brushed features.
   */
  brushControlEffect : computed(
    'controlsView.featureIntervalContain',
    'controlsView.featureIntervalOverlap',
    'controlsView.tickOrPath',
    function () {
      this.updateBrushedFeatures();
    }),
  axisTitleFamily() {
    let axisApi = stacks.oa.axisApi;
    let axis = this.get('axisS');
    if (axis) {
      let
        gAxis = axis.selectAll(),
      axisTitleS = gAxis.select("g.axis-outer > g.axis-all > text");
      dLog(
        'axisTitleFamily', axisTitleS.nodes(), axisTitleS.node(),
        gAxis.nodes(), gAxis.node());
      axisApi.axisTitleFamily(axisTitleS);
    }
  },
  updateAxisTitleSize() {
    let axisApi = stacks.oa.axisApi;
    let axis = this.get('axisS');
    if (axis) {
      let
        gAxis = axis.selectAll();
      axisApi.updateAxisTitleSize(gAxis);
    }
  },

  /** Text for display in the axis title.
   * Extracted from utils/stacks.js : Block:titleText(), which this replaces.
   * @return '' if the name / scope are not defined yet.
   */
  get axisTitleText() {
    let
    referenceBlock = this.get('referenceBlock'),  // i.e. .axis
    parts = [],
    axisTitleChrOnly = this.controlsView.axisTitleChrOnly,
    /** changed requirements, probably axisTitleShow is not required. */
    showDatasetName = /*referenceBlock.get('axisTitleShow.scope') &&*/ ! axisTitleChrOnly;
    if (/*referenceBlock.get('axisTitleShow.name')  && (! axisTitleChrOnly || ! )*/ showDatasetName) {
      parts.push(referenceBlock.get('datasetId.shortNameOrName'));
    }
    // maybe :
    /** If user edits .shortName via editedShortName then consider that to
     * override axisTitleChrOnly. */

      /** block name is generally the same as scope, but there can be multiple
       * blocks in a dataset with the same scope; showing their names is more
       * useful - likely to be unique.
       */
      parts.push(referenceBlock.get('name'));

    let name = parts.filter((n) => n).join(' : ');
    return name;
  },

  /** Update the display of the feature (loaded / total) count in the
   * axis title text for the data blocks.
   *
   * This is a small part of draw-map.js : axisTitleFamily(), and it
   * is used in response to receipt of features (possibly via paths),
   * which may be via zoomedDomain change.  So the usage is high
   * frequency, and the remainder of axisTitleFamily() is not needed
   * for these updates.
   */
  axisTitleTextBlockCount() {
    let subTitleS = this.get('axisSelectTextBlock');
    // dLog('axisTitleTextBlockCount', subTitleS.nodes(), subTitleS.node());
    subTitleS
      .text(function (block) { return block.titleText(); });
    if (true || trace_stack) {
      let nodes = subTitleS.nodes(),
          lastNode = nodes.length ? nodes[nodes.length - 1] : null;
      dLog('axisTitleTextBlockCount', nodes, lastNode);
    }
  },

  /** d3 selection of .axis-outer of this axis.
   * Equivalent : this.get('axisS').selectAll(), which does a selection by id
   * from svgContainer through g.stack to the g.axis-outer.
   */
  axisSelect : computed('axis.id', function () {
    let 
      axisId = this.get('axis.id'),
    /** could narrow this to svgContainer, but probably not a performance
     * improvement, and if we have multiple draw-maps later, the map id can be
     * included in eltId() etc. */
    as = d3.selectAll(".axis-outer#" + eltId(axisId));
    return as;
  }),

  /** d3 selection of tspan.blockTitle of this axis.
   */
  axisSelectTextBlock : computed('axisSelect', function () {
    let
    gAxis = this.get('axisSelect'),
    axisTitleS = gAxis.selectAll("g.axis-all > text"),
    subTitleS = axisTitleS.selectAll("tspan.blockTitle");
    return subTitleS;
  }),

  /** d3.select g.groupName within g.axis-all > g.axis-1d
   * Create g.axis-1d and g.groupName if needed.
   */
  selectGroup(groupName) {
    let resultG;
    let axisS = this.get('axisS');

    if (! axisS) {
      resultG = d3.select();
    } else {
      let
      /** this selects g.axis-outer.  It matches axisS .stack.stackID also.  equivalent : this.axisSelect(). */
      gAxis = axisS.selectAll(),
      /** compare : selectAxis(axisS) selects g.axis-outer > g.axis-all > g.axis. 
       * This is similar to axisTitleFamily(), could be factored. */
      aS = gAxis.selectAll('g.axis-outer > g.axis-all'),
      /** select/create the component g.axis-1d */
      gcA = selectGroup(aS, componentName, undefined, undefined, undefined, undefined),
      /** In earlier versions, horizTick <path> was used to show scaffolds,
       * which were distinguished by blockWithTicks() (i.e. .showPaths===false),
       * and were only shown when not split axis (notWhenExtended, i.e.
       * ! .extended).
       * scaffolds are now represented using split axis tracks, so that use case
       * is no longer required.
       * All the axis-1d elements (triangles, labels, spanning line) are shown regardless of .extended.
       */
      blocks = axisS.blocks,
      gA = selectGroup(gcA, groupName, blocks, blockKeyFn, blockTickEltId(groupName), [className]);
      resultG = gA;

    }
    return resultG;
  },
    

  get transitionTime() {
    return this.get('axisZoom.axisTransitionTime');
  },
  selectionToTransition(selection) {
    return this.get('axisZoom').selectionToTransition(selection);
  },

  /*--------------------------------------------------------------------------*/

  /** Calculate current scaled position of the given feature on this axis.
   */
  featureY(feature) {
    let
    /* alternative :
    axisName = this.get('axis.id'),
    ak = axisName,
    y = stacks.oa.y[ak],
    */
    axisS = this.get('axisS'),
    y = axisS && axisS.getY(),
    ys = axisS && axisS.ys,

    range = getAttrOrCP(feature, 'range') || getAttrOrCP(feature, 'value'),
    tickY = range && (range.length ? range[0] : range),
    /** scaled to axis.
     * Similar : draw-map : featureY_(ak, feature.id);     */
    akYs = y(tickY);
    return akYs;
  },

  inDomain(feature) {
    let
    /** comment re. getAttrOrCP() in @see keyFn() */
    value = getAttrOrCP(feature, 'value'), // feature.get('value'),
    domain = this.currentDomain,
    overlap = intervalOverlapOrAbut([value, domain]);
    return overlap;
  },
  inRange(feature) {
    let
    axisS = this.get('axisS'),
    range0 = axisS.yRange2(),
    overlap = this.inRangeR(feature);
    return overlap;
  },
  inRangeR(feature, range0) {
    let
    axisS = this.get('axisS'),
    y = this.featureY(feature),
    yScale = axisS.getY(),
    value = getAttrOrCP(feature, 'value'), // feature.value,
    yInterval = value.length ? value.map(yScale) : yScale(value),
    overlap = value.length === 1 ?
      inRange(yInterval[0], range0) :
      value.length ? intervalOverlapOrAbut([yInterval, range0]) :
      inRange(yInterval, range0);
    return overlap;
  },

  /*--------------------------------------------------------------------------*/

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) { },

  /** position when last pathUpdate() drawn. */
  lastDrawnDomain : alias('lastDrawn.yDomain'),
  /** position as of the last zoom. */
  zoomedDomain : alias('currentPosition.yDomain'),
  zoomedDomainDebounced : alias('currentPosition.yDomainDebounced'),
  zoomedDomainThrottled : alias('currentPosition.yDomainThrottled'),

  /** Updates when the array elements of .domain[] update.
   *  @return undefined; value is unused.
   */
  domainChanged : computed(
    'domain.0', 'domain.1',
    function () {
      if (this.isDestroyed) return undefined;
      let domain = this.get('domain'),
      domainDefined = this.get('domainDefined');
      // domain is initially undefined or []
      if (domain && domainDefined) {
        // use the VLinePosition:toString() for the position-s
        dLog('domainChanged', domain, this.get('axisS'), ''+this.get('currentPosition'), ''+this.get('lastDrawn'));
        // this.notifyChanges();
        if (! this.get('axisS'))
          dLog('domainChanged() no axisS yet', domain, this.get('axis.id'));
        else {
          this.updateScaleDomain();
          throttle(this, this.updateAxis, this.get('controlsView.throttleTime'));
        }
      }
      return domainDefined && domain;
    }),
  /** Update when the domain has changed and the scale has been updated.
   */
  scaleChanged : computed('domainChanged', function () {
    let scale, domainDefined = this.get('domainChanged');
    dLog('scaleChanged', domainDefined);
    if (domainDefined) {
      let axisS = this.get('axisS');
      if (axisS) {
        let y = axisS.getY(), ys = axisS.ys;
        scale = y;
      }
    }
    return scale;
  }),
  notifyChanges() {
    let axisID = this.get('axis.id');
    dLog('notifyChanges', axisID);

    let axisApi = stacks.oa.axisApi;
    let t = stacks.oa.svgContainer; // .transition().duration(750);

    let eventBus = stacks.oa.eventBus;

    let p = axisID;
    eventBus.trigger("zoomedAxis", [axisID, t]);
    // true does pathUpdate(t);
    axisApi.axisScaleChanged(p, t, true);

    axisApi.axisStackChanged(t);
  },
  updateAxis() {
    // subset of notifyChanges()
    let axisApi = stacks.oa.axisApi;
    let axisID = this.get('axis.id');
    dLog('updateAxis', axisID);
    let t = stacks.oa.svgContainer; //.transition().duration(750);
    axisApi.axisScaleChanged(axisID, t, true);
  },
  drawTicks() {
    /** based on extract from axisScaleChanged() */
    let
      axisTicks = this.axisTicks,
    axisId = this.get('axis.id'),
    axisS = this.get('axisS'),
    yScale = axisS && axisS.y;
    if (yScale) {
      let yAxis = axisS.axisSide(yScale).ticks(axisTicks * axisS.portion);

      /** axisSelect is the g.axis-outer.  structure within that is :
       *                id prefix  prefix function
       * g.axis-outer   id         eltId()
       * > g.axis-all   all        eltIdAll()
       * > g.axis       a          axisEltId()
       * The d3 axis function is called on the g.axis.
       */
      let gAxis = this.get('axisSelect')
        .select("#" + axisEltId(axisId))
        /*.transition().duration(750)*/;
      gAxis.call(yAxis);
      dLog('drawTicks', axisId, axisS, gAxis.nodes(), gAxis.node());

      
      function showText(text) {
        if (! this.get('isDestroying') && ! this.get('headsUp.isDestroying')) {
          this.set('headsUp.tipText', text);
        }
      }
      gAxis.selectAll('text')
        .on('mouseover', showText.bind(this, 'Ctrl-click to drag axis'))
        .on('mouseout', showText.bind(this, ''));
    }
  },
  drawTicksEffect : computed('controlsView.axisTicks', function () {
    later(() => this.drawTicks());
  }),

  ensureAxis : computed('viewedBlocks', function () {
    let viewedBlocks = this.get('viewedBlocks');
    let axisApi = stacks.oa.axisApi;
    let count = viewedBlocks.length;
    viewedBlocks.forEach((block) => {
      if (! block.get('axis'))
        axisApi.ensureAxis(block.id);
      if (! block.get('axis'))
        count--;
    });
    return count;
  }),

  extendedEffect : computed('extended', function () {
    let
    extended = this.get('extended'),
    axisID = this.get('axis.id');
    dLog('extended', extended, axisID);
    // possibly ... pass an action param.
    let axis2d = this.get('axis2d');
    if (axis2d) {
      next(() => ! axis2d.isDestroyed && axis2d.axisWidthResizeEnded());
    }

    this.showExtendedClass();
    this.drawTicks();

    if (extended)
      this.removeTicks();
    else
    {
      let axisID_t = [axisID, undefined];
      this.renderTicksDebounce(axisID_t);
    }

    /* when split axis is closed,
     * updateAxisTitleSize() is called in willDestroyElement()->axisWidthResizeEnded()->stacksAdjust()
     * when split axis is opened or closed, widthEffects()->this.updateAxisTitleSize() -> updateAxisTitleSize()
     */

    this.widthEffects();

    return extended;
  }),

  extendedWidthEffect : computed(/*'extended',*/ 'axis2d.allocatedWidthsMax.centre', function () {
    this.widthEffects();
  }),
  widthEffects() {
    this.showZoomResetButtonXPosn();

    let axisApi = stacks.oa.axisApi;
    axisApi.updateXScale();
    axisApi.collateO();

    /** .extended has changed, so the centre of the axisTitle is changed. */
    this.axisTitleFamily();
    this.updateAxisTitleSize();
  },
  titleEffect : computed(
    /** dependencies of axisTitleText() */
    'referenceBlock.axisTitleShow.{name,scope}',
    'referenceBlock.datasetId._meta.shortName',
    'controlsView.axisTitleChrOnly',
    function () {
      this.axisTitleFamily();
    }),

  /*--------------------------------------------------------------------------*/


  didReceiveAttrs() {
    this._super(...arguments);
    this.get('featureTicks') || this.constructFeatureTicks();
  },
  didInsertElement() {
    this._super(...arguments);
    dLog('axis-1d didInsertElement', this, this.get('listen') !== undefined);
  },
  willDestroyElement() {
    dLog('willDestroyElement', this.get('axis.id'));
    this.removeTicks();
    let axisS = this.get('axisS');
    if (axisS) {
      if (axisS.axis1d === this)
        delete axisS.axis1d;
    }
    let axisName = this.get('axis.id');
    Stacked.axis1dRemove(axisName, this);
    next(() => this.axis1dExists(this, false));

    this._super(...arguments);
  },
  /*--------------------------------------------------------------------------*/
  removeTicks() {
    /** Select all the <path.horizTick> of this axis and remove them.
     * Could use : this.renderTicks() because when ! axis.extended,
     * showTickLocations() will use features == [], which will remove ticks;
     */
    let axis = this.get('axis'),
    aS = selectAxis(axis),
    pS = aS.selectAll("path." + className);
    pS.remove();
  },
  didRender() {
    this._super.apply(this, arguments);

    this.renderTicksDebounce();
  },
  constructFeatureTicks () {
    /** There is 1 axis-1d component per axis, so here `block` is an axis (Stacked),
     * Can rename it to axis, assuming this structure remains.
     */
    let block = this.get('axis'), blockId = block.get('id');
    dLog('constructFeatureTicks', blockId, this);
    let axisApi = this.get('drawMap.oa.axisApi');
    let oa = this.get('drawMap.oa');
    let axis = oa.axes[blockId];
    // dLog('axis-1d renderTicks', block, blockId, axis);

    /* If block is a child block, don't render, expect to get an event for the
     * parent (reference) block of the axis. */
    if (! axis)
      dLog('renderTicks block', block, blockId, oa.stacks.blocks[blockId]);
    else {
      let featureTicks = new FeatureTicks(axis, axisApi, this);
      dLog('featureTicks', featureTicks);
      this.set('featureTicks',  featureTicks);
    }
  },
  renderTicks() {
    let featureTicks = this.get('featureTicks');
    if (! featureTicks && this.get('axisS')) {
      this.constructFeatureTicks();
      featureTicks = this.get('featureTicks');
    }
    if (! featureTicks)
      dLog('renderTicks', featureTicks);
    /* originally used to show the edges of scaffolds, which are now shown
     * within the split axis, so this is not required atm; there might be a case
     * for marking scaffold edges with a horizontal line (not a triangle) when
     * the axis is not open, viewing paths.
    else
      featureTicks.showTickLocations(undefined, true, 'notPaths', true);
      */
  },
  /** call renderTicks().
   * filter / debounce the calls to handle multiple events at the same time.
   * @param axisID_t is defined by zoomedAxis(), undefined when called from
   * axisStackChanged()
   */
  renderTicksDebounce(axisID_t) {
    // dLog('renderTicksDebounce', axisID_t);
    // renderTicks() doesn't use axisID_t; this call chain is likely to be refined yet.
    /* using throttle() instead of debounce() - the former has default immediate==true.
     * It is possible that the last event in a group may indicate a change which
     * should be rendered, but in this case it is likely there is no change
     * after the first event in the group.
     */
    // throttle(this, this.renderTicks, axisID_t, 500);
    run_once(() => this.renderTicks(axisID_t))
  },

  /** Give the g.axis-outer a .extended class if the axis is split.
   * .extended interacts with .rightmost in the CSS rules which place axis ticks on the right side of the rightmost axis.
   */
  showExtendedClass()
  {
    let
      as = this.get('axisSelect');
    as.classed("extended", this.get('extended'));
  },
  buttonStateEffect : computed('brushed', 'zoomed', function () {
    this.showZoomResetButtonState();
  }),
  showZoomResetButtonState() {
    let
    as = this.get('axisSelect'),
    gb = as.selectAll('g.btn');
    gb.attr('class', () => 'btn graph-btn ' + ['brushed', 'zoomed'].filter((state) => this.get(state)).join(' '));
    dLog('showZoomResetButtonState', gb.node(), this.get('brushed'), this.get('zoomed'), this.get('zoomed2'), this.get('axisBrush.brushedAxes'));
  },
  showZoomResetButtonXPosn() {
    if (! (this.isDestroying || this.isDestroyed) && this.axis.get('isViewed')) {
      let
      as = this.get('axisSelect'),
      gb = as.selectAll('g.btn');
      gb
        .attr('transform', yAxisBtnScale);
    }
  }
  
});

