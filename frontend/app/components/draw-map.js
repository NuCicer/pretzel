import { on } from '@ember/object/evented';
import $ from 'jquery';
import {
  once,
  later,
  debounce,
  bind,
  throttle
} from '@ember/runloop';
import { computed, get, set as Ember_set, observer } from '@ember/object';
import { alias, filterBy } from '@ember/object/computed';
import Evented from '@ember/object/evented';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { A as Ember_array_A } from '@ember/array';

import { task, timeout, didCancel } from 'ember-concurrency';

import { isEqual } from 'lodash/lang';
import { debounce as lodash_debounce, throttle as lodash_throttle } from 'lodash/function';


/* global require */


/*----------------------------------------------------------------------------*/

import config from '../config/environment';
import { EventedListener } from '../utils/eventedListener';

import {
  chrData, cmNameAdd,
  AxisChrName,
  makeMapChrName,
  makeIntervalName,
 } from '../utils/utility-chromosome';

import {
  eltWidthResizable,
  eltResizeToAvailableWidth,
  ctrlKeyfilter,
  noKeyfilter,
  eltClassName,
  tabActive,
  inputRangeValue,
  expRange
} from '../utils/domElements';
import { I, combineFilters } from '../utils/draw/d3-svg';
import {
  /*fromSelectionArray,
  */ logSelectionLevel,
  logSelection,
  logSelectionNodes,
  selectImmediateChildNodes
} from '../utils/log-selection';
import { configureHover, configureHorizTickHover_orig } from '../utils/hover';
import { Viewport } from '../utils/draw/viewport';
import { axisFontSize, AxisTitleLayout } from '../utils/draw/axisTitleLayout';
import { AxisTitleBlocksServers } from '../utils/draw/axisTitleBlocksServers_tspan';

import {
  AxisTitle,
} from '../utils/draw/axisTitle';

import {
  brushClip,
  axisBrushSelect,
  showAxisZoomResetButtons,
  AxisBrushZoom,
} from '../utils/draw/axisBrush';

import {  Axes, maybeFlip, maybeFlipExtent,
          ensureYscaleDomain,
          /*yAxisTextScale,*/  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform,
          eltId, stackEltId, axisEltId, eltIdAll, axisEltIdTitle,
          moveOrAdd,
          axisFeatureCircles_eltId,
          axisFeatureCircles_selectAll,
          axisFeatureCircles_selectOneInAxis,
          axisFeatureCircles_removeBlock,
          /*, axisTitleColour*/  }  from '../utils/draw/axis';
import { stacksAxesDomVerify }  from '../utils/draw/stacksAxes';
import {
  Block,
  Stacked,
  Stack,
  stacks,
  xScaleExtend,
  axisRedrawText,
  axisId2Name,
  setCount
} from '../utils/stacks';
import {
  collateAdjacentAxes,
  log_adjAxes,
  log_adjAxes_a,
  isAdjacent
} from '../utils/stacks-adj';
import { updateRange } from '../utils/stacksLayout';
import {
  DragTransition,
  dragTransitionTime,
  dragTransitionNew,
  dragTransition
} from '../utils/stacks-drag';
import { subInterval, overlapInterval, wheelNewDomain, ZoomFilter } from '../utils/draw/zoomPanCalcs';
import { intervalsEqual, intervalIntersect } from '../utils/interval-calcs';
import { round_2, checkIsNumber } from '../utils/domCalcs';
import { Object_filter, compareFields } from '../utils/Object_filter';
import {
  name_chromosome_block,
  name_position_range,
  isOtherField
} from '../utils/field_names';
import { breakPoint, breakPointEnableSet } from '../utils/breakPoint';
import { highlightFeature_drawFromParams } from './draw/highlight-feature';
import { Flow } from "../utils/flows";
import {
  flowButtonsSel,
  configurejQueryTooltip,
  flows_showControls
} from "../utils/draw/flow-controls";
import { collateStacks, countPaths, /*countPathsWithData,*/
         collateData, collateFeatureClasses, maInMaAG, collateStacks1,
         pathsUnique_log, log_maamm, log_ffaa, mmaa2text,
         getAliased, collateStacksA, objPut,
         aliasesText, aliasText,
         addPathsToCollation, addPathsByReferenceToCollation,
         storePath, filterPaths,
         collateFeatureMap, concatAndUnique, featureStackAxes,
         collateMagm
       } from "../utils/draw/collate-paths";

import {
  unique_1_1_mapping 
} from '../utils/paths-config';

/** We can replace countPathsWithData() (which does a DOM search and is not
 * updated for progressive paths), with a sum of (pathsResult.length +
 * pathsAliasesResult.length) for all block-adj in flows.blockAdjs
 */
function countPathsWithData() { }
import { storeFeature } from '../utils/feature-lookup';

import AxisDraw from '../utils/draw/axis-draw';
import { DropTarget } from '../utils/draw/drop-target';
import { PathClasses } from '../utils/draw/path-classes';
import { PathDataUtils } from '../utils/draw/path-data';
import { PathInfo } from '../utils/draw/path-info';
import { showTickLocations } from '../utils/draw/feature-info';

import { selectedBlocksFeaturesToArray } from '../services/data/selected';

import { showSynteny } from '../utils/draw/synteny-blocks-draw';



/*----------------------------------------------------------------------------*/

/* jshint curly : false */

/* these warnings are sometimes useful, but they are causing "Too many errors. (89% scanned)." */
/* jshint -W087 */
/* jshint -W032 */
/* jshint -W116 */
/* jshint -W098 */
/* jshint -W014  */
/* jshint -W030 */
/* jshint -W083 */

/*global d3 */
/* global WheelEvent */

/*----------------------------------------------------------------------------*/

let trace_dataflow = 0;

const dLog = console.debug;

Object.filter = Object_filter;


const draw_orig = false;


/*----------------------------------------------------------------------------*/

//- moved to "../utils/draw/flow-controls.js" : flowButtonsSel, configurejQueryTooltip()

/*----------------------------------------------------------------------------*/

/** compareFn param for compareFields */
function compareViewport(keyName, a, b) {
  let different;
  if (keyName === 'viewportWidth') {
    /** viewportWidth may cycle due to the rendering affecting the geometry (seen once, in Firefox). */
    different = ((a === undefined) !== (b === undefined)) || Math.abs(a - b) > 5;
  } else {
    different = a !== b;
  }
  return different;
}
/*----------------------------------------------------------------------------*/




export default Component.extend(Evented, {
  classNames: ['draw-map-container'],

  store: service('store'),
  blockService: service('data/block'),
  flowsService: service('data/flows-collate'),
  pathsP : service('data/paths-progressive'),
  axisZoom : service('data/axis-zoom'),
  headsUp : service('data/heads-up'),
  queryParamsService: service('query-params'),
  apiServers : service(),
  controlsService : service('controls'),
  selectedService : service('data/selected'),

  /*--------------------------------------------------------------------------*/
  urlOptions : alias('queryParamsService.urlOptions'),

  /*------------------------------------------------------------------------*/
//-  graphData: Ember.inject.service('graph-data'),
  /*------------------------------------------------------------------------*/

  drawActionsListen: function(listen, name, target, method) {
    /** drawActions is an action&event bus specific to one draw-map; it is a reference
     * to mapview (see map-view.hbs) but could be owned by the draw-map. */
    let drawActions = this.get('drawActions'); 
    console.log("drawActionsListen", listen, name, target._debugContainerKey, method, drawActions, this);
    if (drawActions === undefined)
      console.log('parent component drawActions not passed', this);
    else
    {
      // let onOff = listen ? drawActions.on : drawActions.off;
        if (listen)
          drawActions.on(name, target, method);
        else
          drawActions.off(name, target, method);
      }
  },

  drawControlsListen(listen)
  {
    this.drawActionsListen(listen, 'drawControlsLife', this, this.drawControlsLife);
  },
  /** handle life-cycle events (didInsertElement, willDestroyElement) from draw-controls. */
   drawControlsLife : function(start) {
     console.log("drawControlsLife in components/draw-map (drawActions)", start);
     if (this.drawControlsLifeC)
       this.drawControlsLifeC(start);
   },
 
  /** Listen for actions from sub-components of draw-map.
   * Both mapview and draw-map component are Evented, and are used as event buses
   * for components defined within their templates.
   *
   * Also  @see drawActionsListen(), drawControlsListen(), which connect to the mapview event bus.
   * Based on components/goto-features createListener().
   */
  createListener(bus) {
    if (bus === undefined)
      console.log('Evented component not passed', bus);
    else
      this.set('listener', new EventedListener(
        bus,
        [{name: 'stackPositionsChanged', target: this, method: /*.actions.*/this.stackPositionsChanged}]
        // this.pathUpdateFlow is set later, because it calls into the draw() closure.
      ));
  },
  stackPositionsChanged(stack) {
    this.actions.stackPositionsChanged(stack);
  },

  /** listen to events sent by sub-components.
   * Called when init and willDestroyElement. */
  localBus : function (listen) {
    if (listen && this.get('listener') === undefined)
    {
      let oa = this.get('oa');

      /* oa.eventBus is used in stacks to send updatedStacks and stackPositionsChanged; 
       * perhaps change ownership of those events to a stacks Evented component. */
      let bus = this;
      if (oa.eventBus !== this) {
        Ember_set(oa, 'eventBus', this);
      }
      if (this.get('listener') === undefined)
        this.createListener(bus);
    }
    if (this.listener)
      this.listener.listen(listen);
    if (! listen && this.pathUpdateFlow)
      this.off('pathUpdateFlow', this, this.pathUpdateFlow);
  },

  /*------------------------------------------------------------------------*/

  /** Used for receiving colouredFeatures from selected-features.js,
   * and flipRegion, ...
   */
  feedService: (console.log("feedService"), service('feed')),

    /** these actions on feedService can be moved to drawActions;
     * feedService is global, whereas drawActions is specific to a single draw-map;
     * currently there is only one draw-map, but having multiple draw-maps in
     * one browser tab would be useful.
     */
  listen: on('init', function() {
    let f = this.get('feedService');
    console.log("listen", f);
    if (f === undefined)
    {
      console.log('listen() : feedService undefined', this);
      breakPoint();
    }
    else {
      f.on('colouredFeatures', this, 'updateColouredFeatures');
      f.on('clearScaffoldColours', this, 'clearScaffoldColours');
      f.on('flipRegion', this, 'flipRegion');
      f.on('resetZooms', this, 'resetZooms');
    }

    this.oa = {};
    this.drawControlsListen(true);
    this.localBus(true);
    let blockService = this.get('blockService');
    blockService.on('receivedBlock', this, 'receivedBlock');
    this.functionHandles = {};
  }),

/** addPathsToCollation() was in draw closure;  having moved it to library collate-paths.js, it could now be register here
  willInsertElement : function () {
    console.log("components/draw-map willInsertElement");
    this._super(...arguments);
    this.on('paths', addPathsToCollation);
  },
*/

  // remove the binding created in listen() above, upon component destruction
  cleanup: on('willDestroyElement', function() {
    let f = this.get('feedService');
    f.off('colouredFeatures', this, 'updateColouredFeatures');
    f.off('clearScaffoldColours', this, 'clearScaffoldColours');
    f.off('flipRegion', this, 'flipRegion');
    f.off('resetZooms', this, 'resetZooms');

    this.drawControlsListen(false);
    this.localBus(false);

    /* not registered in willInsertElement(). registered in draw() : drawControlsLifeC */
    if (this.has('paths')) {
      this.off('paths', addPathsToCollation);
    }

    let blockService = this.get('blockService');
    blockService.off('receivedBlock', this, 'receivedBlock');

  }),

//{
  /** undefined, or a function to call when colouredFeatures are received  */
  colouredFeaturesChanged : undefined,

  updateColouredFeatures: function(features) {
    console.log("updateColouredFeatures in components/draw-map.js");
    let self = this;
    this.get('scroller').scrollVertical('#holder', {
      duration : 1000,
      // easing : 'linear', // default is swing
      offset : -60
    }).then(function () {
      /* Could invert this control by using the same PathClasses instance as is
       * used for .configurePathColour() which sets .colouredFeaturesChanged,
       * and could instead set an enable flag, and here call
       * pathClasses.colouredFeaturesChanged().
       */
      let colouredFeaturesChanged = self.get('colouredFeaturesChanged');
      if (colouredFeaturesChanged)
        colouredFeaturesChanged(features);
    });
  },

  draw_flipRegion : undefined,
  flipRegion: function(features) {
    console.log("flipRegion in components/draw-map.js");
    let axisBrushZoom = AxisBrushZoom(this.oa);
    let flipRegion = axisBrushZoom.draw_flipRegion;
    if (flipRegion)
      flipRegion(features);
  },
//}

  /*------------------------------------------------------------------------*/

  /** Initialise in init(), so that each new instance of draw-map gets a
   * distinct object, so that functions don't refer to destroyed closures.
   */
  functionHandles : undefined,
  /** @return a constant value for the function
   * @desc for use with debounce / throttle
   */
  functionHandle(name, fn) {
    let functions = this.get('functionHandles');
    if (false) { // debug check / trace
      if (! functions.drawMap) { functions.drawMap = this; }
      else if (functions.drawMap !== this) { dLog('functionHandle', functions, this); }
    }
    if (functions[name] && (functions[name] !== fn) && (trace_dataflow > 2)) {
      dLog('functionHandle', name, functions[name], fn);
    }      
    let
    fnStored = functions[name] || (functions[name] = fn);
    return fnStored;
  },

  /*------------------------------------------------------------------------*/
  
  scroller: service(),

  axes1d : computed( function () { return stacks.axes1d; }),
  splitAxes: filterBy('axes1d', 'extended', true),

  axisTicks : alias('controls.view.axisTicks'),

  /** initialised to default value in components/panel/view-controls.js */
  sbSizeThreshold : alias('controls.view.sbSizeThreshold'),

  /*------------------------------------------------------------------------*/

  xOffsets : {},
  xOffsetsChangeCount : 0,

  // ---------------------------------------------------------------------------

  actions: {
//-	?
    updatedSelectedFeatures: function(selectedFeatures) {
      /* run once to handle multiple settings of selectedFeatures (panel/left-panel and draw/axis-1d)
       * selectedFeatures is good candidate for converting to a model, simplifying this.
       */
      once(this, selectedFeaturesSendArray, selectedFeatures);
      function selectedFeaturesSendArray(selectedFeatures) {
        let featuresAsArray = selectedBlocksFeaturesToArray(selectedFeatures);
        // console.log(featuresAsArray);
        console.log("updatedSelectedFeatures in draw-map component",
                    selectedFeatures, featuresAsArray.length);
        this.sendAction('updatedSelectedFeatures', featuresAsArray);
      }
    },

    updatedStacks: function(stacks) {
      let stacksText = stacks.toString();
      // stacks.log();
      console.log("updatedStacks in draw-map component");
    },

    stackPositionsChanged : function(stack) {
      console.log("stackPositionsChanged in components/draw-map (drawActions)", stack);
      let oa = this.get('oa');  // , stack = oa.stacks[stackID];
      // console.log(oa.stacks, stack);
      stack.axes.forEach(
        function (a, index)
        {
          updateRange(oa.y, oa.ys, oa.vc, a);
        });
    },

    addMap : function(mapName) {
      dLog("controller/draw-map", "addMap", mapName);
      this.sendAction('addMap', mapName);
    },

    removeBlock(block) {
      dLog('removeBlock', block.id);
      this.sendAction('removeBlock', block);
    },


    enableAxis2D: function(axisID, enabled) {
      let axes1d = this.get('axes1d') || this.get('oa.stacks.axes1d');
      let axis = axes1d[axisID];
      if (axis === undefined)
      {
        dLog('enableAxis2D()', enabled, "no", axisID, "in", axes1d);
      }
      else
        later(
          () => axis.set('extended', enabled));  // was axis2DEnabled
      console.log("enableAxis2D in components/draw-map", axisID, enabled, axis);
      console.log("splitAxes", this.get('splitAxes'));
    },

    resizeView : function()
    {
      console.log("resizeView()");
      // resize();
    },

    closeToolTipA() {
      const pathInfo = PathInfo(this.oa);
      pathInfo.closeToolTip();
    }

  },

  getAxis1d(axisID) {
    let axes1d = this.get('axes1d') || this.get('oa.stacks.axes1d');
    let axis1d = axes1d[axisID];
    return axis1d;
  },


  /** set attribute name of this to value, if that is not the current value.
   * It is expected that value is not a complex type.
   */
  ensureValue : function(name, value)
  {
    if (this.get(name) != value)
      this.set(name, value);
  },


  /** object attributes. initialised in init(). */
  oa : undefined,

  /*------------------------------------------------------------------------------*/

  peekBlock : function(blockId) {
    let blockService = this.get('blockService');
    return blockService.peekBlock(blockId);
  },

  receivedBlock : function (blocks) {
    console.log('receivedBlock', this, blocks);
    let retHash = 
      blocks.reduce((retHash, b) => {
      let block = b.obj;
    // copied from dataObserver() (similar to drawPromisedChr()) - can simplify and rename ch -> block, chr -> blockId, 
    let
      ch = block,
    chr  = block.get('id'),
                    rc = chrData(ch);
                    /** use same structure as routes/mapview.js */
                    retHash[chr] = rc;
    const receiveChr = this.receiveChr || console.log;
    this.get('receiveChr')(chr, rc, 'dataReceived');
      return retHash;
    }, {});

    later( () => {
      /* Cause the evaluation of stacks-view:axesP; also evaluates blockAdjIds,
       * and block-adj.hbs evaluates paths{,Aliases}ResultLength and hence
       * requests paths.  This dependency architecture will be made clearer.  */
      this.get('flowsService.blockAdjs');
      this.draw(retHash, 'dataReceived');
    });
  },


  /** Draw the Axes (Axis Pieces) and the paths between them.
   * Axes are Axis Pieces; in this first stage they correspond to chromosomes,
   * but the plan is for them to represent other data topics and types.
   * Each Chromosome is a part of a genetic map in this application.
   *
   * @param myData array indexed by myAPs[*]; each value is a hash indexed by
   * <mapName>_<chromosomeName>, whose values are an array of features {location,
   * map:<mapName>_<chromosomeName>, feature: featureName}
   * The index value is referred to as axisName (axis - Axis Piece) for generality
   * (originally "mapName", but it actually identifies a chromosome within a map).
   *
   * @param myData hash indexed by axis names
   * @param source 'didRender' or 'dataReceived' indicating an added map.
   */
  draw: function(myData, source) {
    const trace_stack = 0;

    let flowsService = this.get('flowsService');
    let myDataKeys;
    if (source === 'didRender')
    {
      myData = {};
    }
    myDataKeys = d3.keys(myData);
    dLog("draw()", myData, myDataKeys.length, source);

    // Draw functionality goes here.
    let me = this;

    let oa = this.get('oa');

    if (this.drawControlsLifeC === undefined)
    {
      console.log("set(drawControlsLife) (drawActions)", this, oa.stacks === undefined);
      this.set('drawControlsLifeC', true);

      /** currently have an instance of goto-feature in mapview.hbs (may remove
       * this - also have it via draw-map.hbs -> path-hover.hbs with data=oa ->
       * feature-name.hbs -> goto-feature ); this is just to get oa to that instance; not
       * ideal.  */
      let drawActions = this.get('drawActions'); 
      drawActions.trigger('drawObjectAttributes', this.get('oa')); // 
      console.log("draw() drawActions oa", drawActions, oa);

      this.on('paths', addPathsToCollation);
      this.on('pathsByReference', addPathsByReferenceToCollation);
    }

    // instanceChanged is defined below;  not needed because setting to the same value is harmless.
    // if ((oa.showResize === undefined) || instanceChanged)
    {
      oa.showResize = showResize;
    }

    /*------------------------------------------------------------------------*/



    if (oa.__lookupGetter__('stacks'))
      this.set('stacks', stacks);
    else
      oa.stacks = stacks;
    stacks.init(oa);
    // stacks.axes[] is a mix of Stacked & Block; shouldn't be required & planning to retire it in these changes.
    oa.axes = stacks.axesP;
    oa.axesP = stacks.axesP;
    /** Refresh axisApi when draw-map object instance changes, so the functions
     * do not refer to closures in the destroyed instance. */
    let instanceChanged;
    let axisBrushZoom = AxisBrushZoom(oa);
    if (! oa.axisApi || (instanceChanged = oa.axisApi.drawMap.isDestroying)) {
      const axisApi = {
                    collateO,
                    updateXScale,
                    axisStackChanged,
                    cmNameAdd,
                    axisIDAdd,
                    stacksAxesDomVerify : function (unviewedIsOK = false) { stacksAxesDomVerify(stacks, oa.svgContainer, unviewedIsOK); } ,
                    updateSyntenyBlocksPosition : () => this.get('updateSyntenyBlocksPosition').perform(),
                    drawMap : this,  // for debug trace / check.
                       // temporary additions - the definitions will be moved out.
                    sendUpdatedSelectedFeatures,
                    selectedFeatures_clear : () => this.get('selectedService').selectedFeatures_clear(),
                    deleteAxisfromAxisIDs,
                    removeAxisMaybeStack,
                   };
      Ember_set(oa, 'axisApi', axisApi);
    }
    const axisTitle = AxisTitle(oa);
    const axisChrName = AxisChrName(oa);
    const pathDataUtils = PathDataUtils(oa);
    const pathInfo = PathInfo(oa);
    dLog('draw-map stacks', stacks);

    /** Reference to all datasets by name.
     * (datasets have no id, their child blocks' datasetId refers to their name) .
     * Not used yet.
     */
    let datasets = oa.datasets || (oa.datasets = {});
    /** Reference to all blocks by apName.
     * Not used yet.
     let blocks = oa.blocks || (oa.blocks = {});
     */



    /**  oa.axisIDs is an array, containing the block ID-s (i.e. chr names made
     *  unique by prepending their map name).
     * The array is not ordered; the stack order (left-to-right) is recorded by
     * the order of oa.stacks[].
     * This is all blocks, not just axesP (the parent / reference blocks).
     * @see service/data/blocks.js:viewed(), which can replace oa.axisIDs[].
     * @see stacks.axisIDs(), slight difference : blocks are added to
     * oa.axisIDs[] by receiveChr() before they are added to stacks;
     */
    dLog("oa.axisIDs", oa.axisIDs, source);
    /** axisIDs are <mapName>_<chromosomeName> */
    if ((source == 'dataReceived') || oa.axisIDs)
    {
      // append each element of myDataKeys[] to oa.axisIDs[] if not already present.
      // if (false)  // later limit it to axesP[], exclude blocks[]
      myDataKeys.forEach(function (axisID) { axisIDAdd(axisID); } );
    }
    else if ((myDataKeys.length > 0) || (oa.axisIDs === undefined))
      oa.axisIDs = myDataKeys;
    dLog("oa.axisIDs", oa.axisIDs);
    /** mapName (axisName) of each chromosome, indexed by chr name. */
    let cmName = oa.cmName || (oa.cmName = {});
    /** axis id of each chromosome, indexed by axis name. */
    let mapChr2Axis = oa.mapChr2Axis || (oa.mapChr2Axis = {});

    /** Plan for layout of stacked axes.

     graph : {chromosome{linkageGroup{}+}*}

     graph : >=0  chromosome-s layed out horizontally

     chromosome : >=1 linkageGroup-s layed out vertically:
     catenated, use all the space, split space equally by default,
     can adjust space assigned to each linkageGroup (thumb drag) 
     */



    //- moved to utils/draw/viewport.js : Viewport(), viewPort, graphDim, dragLimit
    let vc = oa.vc || (oa.vc = new Viewport());
    if (vc.count < 2)
    {
      console.log(oa, vc);
      vc.count++;
      vc.calc(oa);
      if (vc.count > 1)
      {
        /** could use equalFields(). */
        let
          widthChanged = oa.vc.viewPort.w != oa.vc.viewPortPrev.w,
        heightChanged = oa.vc.viewPort.h != oa.vc.viewPortPrev.h;
        // showResize() -> collateO() uses .o
        if (oa.svgContainer && oa.o)
          oa.showResize(widthChanged, heightChanged);
      }
      stacks.vc = vc; //- perhaps create vc earlier and pass vc to stacks.init()
    }
    if (! oa.axisTitleLayout)
      oa.axisTitleLayout = new AxisTitleLayout();

    let
      axisHeaderTextLen = vc.axisHeaderTextLen,
    margins = vc.margins,
    marginIndex = vc.marginIndex;
    let yRange = vc.yRange;

    if (oa.axes2d === undefined)
      oa.axes2d = new Axes(oa);

    //- moved to utils/draw/path-classes.js : pathColourDefault, use_path_colour_scale, path_colour_scale_domain_set, path_colour_scale
    //- moved to utils/draw/viewport.js : xDropOutDistance_update()


    /** A simple mechanism for selecting a small percentage of the
     * physical maps, which are inconveniently large for debugging.
     * This will be replaced by the ability to request subsections of
     * chromosomes in API requests.
     */
    const filter_location = false;


    //- moved to path-classes : showScaffoldFeatures (showScaffoldMarkers), showAsymmetricAliases

    let svgContainer;

    let
      /** y[axisID] is the scale for axis axisID.
       * y[axisID] has range [0, yRange], i.e. as if the axis is not stacked.
       * g.axis-outer has a transform to position the axis within its stack, so this scale is used
       * for objects within g.axis-outer, and notably its child g.axis, such as the brush.
       * For objects in g.foreground, ys is the appropriate scale to use.
       */
      y = oa.y || (oa.y = {}),
    /** ys[axisID] is is the same as y[axisID], with added translation and scale
     * for the axis's current stacking (axis.position, axis.yOffset(), axis.portion).
     * See also comments for y re. the difference in uses of y and ys.
     */
    ys = oa.ys || (oa.ys = {}),
    /** scaled x value of each axis, indexed by axisIDs */
    o = oa.o || (oa.o = {}),
    /** Count features in Axes, to set stronger paths than normal when working
     * with small data sets during devel.  */
    featureTotal = 0,
    /** z[axisID] is a hash for axis axisID mapping feature name to location.
     * i.e. z[d.axis][d.feature] is the location of d.feature in d.axis.
     */
    z;  // was  = oa.z || (oa.z = myData);
    if (! oa.z)
      oa.blockFeatureLocation = oa.z = myData;
    else  // merge myData into oa.z
      d3.keys(myData).forEach(function (blockId) {
        if (! oa.z[blockId])
          oa.z[blockId] = myData[blockId];
      });
    z = oa.z;

    /** All feature names.
     * Initially a Set (to determine unique names), then converted to an array.
     */
    if (oa.d3FeatureSet === undefined)
      oa.d3FeatureSet = new Set();

    /** Index of features (markers) by object id. the value refers to the marker hash,
     * i.e. z[chr/ap/block name][feature/marker name] === featureIndex[feature/marker id] */
    oa.featureIndex || (oa.featureIndex = []);

    oa.selectedElements || (oa.selectedElements = this.get('selectedService.selectedElements'));


    if (source === 'didRender') {
      // when tasks are complete, receiveChr() is called via blockService : receivedBlock
    }
    else
      d3.keys(myData).forEach(function (axis) {
        /** axis is chr name */
        receiveChr(axis, myData[axis], source);
      });

    function redraw()
    {
      if (trace_dataflow > 1)
      {
        console.log("redraw", oa.axisIDs, oa.axes /*, oa.blocks*/);
        oa.stacks.log();
      }
      me.draw({}, 'dataReceived');
    }
    function receiveChr(axis, c, source) {
      let z = oa.z, cmName = oa.cmName;
      if ((z[axis] === undefined) || (cmName[axis] === undefined))
      {
        z[axis] = c;
        let dataset = c.dataset,
        datasetName = dataset && dataset.get('name'),
        parent = dataset && dataset.get('parent'),
        parentName = parent  && parent.get('name')
        ;
        if (oa.datasets[datasetName] === undefined)
        {
          oa.datasets[datasetName] = dataset;
          console.log(datasetName, dataset.get('_meta.shortName'));
        }
        cmName[axis] = {
          mapName : c.mapName, chrName : c.chrName,
          parent: parentName,
          name : c.name, range : c.range,
          scope: c.scope, featureType: c.featureType,
          dataset,
        };
        
        let mapChrName = makeMapChrName(c.mapName, c.chrName);
        mapChr2Axis[mapChrName] = axis;
        //-	receive 'add axisIDs'
        if (source == 'dataReceived')
        {
          axisIDAdd(axis);
        }
        delete c.mapName;
        delete c.chrName;
        if (trace_stack)
          dLog("receiveChr", axis, cmName[axis]);
        d3.keys(c).forEach(function(feature) {
          if (! isOtherField[feature]) {
            let f = z[axis][feature];
            // alternate filter, suited to physical maps : f.location > 2000000
            if ((featureTotal++ & 0x3) && filter_location)
              delete z[axis][feature];
            else
            {
              storeFeature(oa, flowsService, feature, f, undefined);
              /* could partition featureIndex by block name/id :
               * oa.featureIndex[axis][f.id] = f; but not necessary because object id
               * is unique. */

              // featureTotal++;

              /** This implementation of aliases was used initially.
               * The feature is simply duplicated (same location, same axis) for each alias.
               * This works, but loses the distinction between direct connections (same feature / gene)
               * and indirect (via aliases).
               */
              if (! unique_1_1_mapping)
              {
                let featureValue = z[axis][feature];
                if (featureValue && featureValue.aliases)
                  for (let a of featureValue.aliases)
                {
                    z[axis][a] = {location: featureValue.location};
                  }
              }
            }
          }
        });
      }
    }
    // hack a connection to receiveChr() until it gets moved / refactored.
    if (! this.get('receiveChr'))
      this.set('receiveChr', receiveChr);

    /** Check if axis exists in oa.axisIDs[].
     * @return index of axis in oa.axisIDs[], -1 if not found
     */
    function axisIDFind(axis) {
      let k;
      for (k=oa.axisIDs.length-1; (k>=0) && (oa.axisIDs[k] != axis); k--) { }
      return k;
    }
    /** If axis is not in oa.axisIDs[], then append it.
     * These 3 functions could be members of oa.axisIDs[] - maybe a class.
     */
    function axisIDAdd(axis) {
      if (axisIDFind(axis) < 0)
      {
        if (trace_stack)
          dLog("axisIDAdd push", oa.axisIDs, axis);
        oa.axisIDs.push(axis);
      }
    }
    /** Find axisName in oa.axisIDs, and remove it. */
    function deleteAxisfromAxisIDs(axisName)
    {
      let k = axisIDFind(axisName);
      if (k === -1)
        console.log("deleteAxisfromAxisIDs", "not found:", axisName);
      else
      {
        console.log("deleteAxisfromAxisIDs", axisName, k, oa.axisIDs);
        let a = oa.axisIDs.splice(k, 1);
        console.log(oa.axisIDs, "deleted:", a);
      }
    }

    /** Indexed by featureName, value is a Set of Axes in which the feature is present.
     * Currently featureName-s are unique, present in just one axis (Chromosome),
     * but it seems likely that ambiguity will arise, e.g. 2 assemblies of the same Chromosome.
     * Terminology :
     *   genetic map contains chromosomes with features;
     *   physical map (pseudo-molecule) contains genes
     */
    let featureAxisSets = flowsService.featureAxisSets;

    //- moved to view-controls : drawOptions
    if (oa.drawOptions === undefined)
    {
      // replaced in view-controls init()
      oa.drawOptions = {};
    }

    /** Alias groups : aliasGroup[aliasGroupName] : [ feature ]    feature references axis and array of aliases */
    let aliasGroup = flowsService.aliasGroup;


    /** Map from feature names to axis names.
     * Compiled by collateFeatureMap() from z[], which is compiled from d3Data.
     */
    let featureToAxis = flowsService.featureToAxis;
    /** Map from feature names to axis names, via aliases of the feature.
     * Compiled by collateFeatureMap() from z[], which is compiled from d3Data.
     */
    let featureAliasToAxis = flowsService.featureAliasToAxis;

    // results of collateData()
    let
      /** axis / alias : feature    axisFeatureAliasToFeature[axis][feature alias] : [feature] */
      axisFeatureAliasToFeature = flowsService.axisFeatureAliasToFeature,
    /** axis/feature : alias groups       axisFeatureAliasGroups[axis][feature] : aliasGroup
     * absorbed into z[axis][feature].aliasGroupName
     axisFeatureAliasGroups = {},  */
    // results of collateMagm() - not used
    /** feature alias groups Axes;  featureAliasGroupAxes[featureName] is [stackIndex, a0, a1] */
    featureAliasGroupAxes = flowsService.featureAliasGroupAxes;

    /** class names assigned by colouredFeatures to alias groups, indexed by alias group name.
     * result of collateFeatureClasses().
     */
    let aliasGroupClasses = flowsService.aliasGroupClasses;

    // results of collateStacks1()
    let

      /** Not used yet; for pathAliasGroup().
       *  store : alias group : axis/feature - axis/feature   aliasGroupAxisFeatures[aliasGroup] : [feature, feature]  features have refn to parent axis
       * i.e. [aliasGroup] -> [feature0, a0, a1, za0[feature0], za1[feature0]] */
      aliasGroupAxisFeatures = flowsService.aliasGroupAxisFeatures;

    let
      line = d3.line(),
    foreground;
    // brushActives = [],

    //- moved to ../utils/draw/axis.js :  eltId(), axisEltId(), highlightId()

    //- moved to ../utils/domElements.js :  eltClassName()

    //- moved to ../utils/domCalcs.js : checkIsNumber()

    /*------------------------------------------------------------------------*/
    // inRange() replaced by a later / equivalent version available from utils/draw/zoomPanCalcs.js
    //-    import { inRange } from "../utils/graph-maths.js";
    //-    import { } from "../utils/elementIds.js";

    //- moved to utils/utility-chromosome.js : mapChrName2Axis(), axisName2Chr(), axisName2MapChr(), makeMapChrName(), makeIntervalName(),

    //-    moved to "../utils/stacks-drag.js" : dragTransitionNew(), dragTransition(), dragTransitionEnd().

    /*------------------------------------------------------------------------*/
    //- moved to ../utils/domCalcs.js : round_2()
    /*------------------------------------------------------------------------*/
    /** These trace variables follow this pattern : 0 means no trace;
     * 1 means O(0) - constant size trace, i.e. just the array lengths, not the arrays.
     * further increments will trace the whole arrays, i.e. O(N),
     * and trace cross-products of arrays - O(N^2) e.g. trace the whole array for O(N) events.
     */
    const trace_scale_y = 0;
    const trace_drag = 0;
    //- moved to ../utils/draw/collate-paths.js : trace_alias, trace_adj
    const trace_path = 0;
    const trace_gui = 0;
    /*------------------------------------------------------------------------*/
    //- moved to utils/stacks.js

    /*------------------------------------------------------------------------*/

    //- moved to ../utils/flows.js : Flow()

    let flows;
    if ((flows = oa.flows) === undefined) // aka newRender
    {
      flows = oa.flows = flowsService.get('flows');
      // Continue to use oa for first version of split flows & paths, until replacement connections are established.
      if (oa && (flowsService.get('oa') === undefined))
        flowsService.set('oa', oa);
      flowsService.set('stackEvents', this);
    }


    //- moved to ../utils/draw/collate-paths.js : collateStacks()


    /*------------------------------------------------------------------------*/


    let pathFeatures = oa.pathFeatures || (oa.pathFeatures = {}); //For tool tip

    let selectedAxes = oa.selectedAxes || (oa.selectedAxes = this.get('selectedService.selectedAxes'));;
    let selectedFeatures = oa.selectedFeatures ||
        (oa.selectedFeatures = this.get('selectedService.blocksFeatures'));
    let brushedRegions = oa.brushedRegions || (oa.brushedRegions = {});

    /** planning to move selectedFeatures out to a separate class/component;
     * these 2 functions would be actions on it. */
    //Reset the selected Feature region, everytime an axis gets deleted
    function sendUpdatedSelectedFeatures()
    {
      if (oa.drawOptions.showSelectedFeatures)
        me.send('updatedSelectedFeatures', selectedFeatures);
    }
    //- moved to axes-1d.js : selectedFeatures_removeAxis(), selectedFeatures_removeBlock()

    collateData();

    /** For all Axes, store the x value of its axis, according to the current scale. */
    function collateO() {
      // if (me.isDestroying) { return; }
      dLog("collateO", oa.axisIDs.length, oa.stacks.axisIDs());
      oa.stacks.axisIDs().forEach(function(d){
        let o = oa.o;
        if (trace_stack > 1)
          console.log(d, axisId2Name(d), o[d], stacks.x(d));
        o[d] = stacks.x(d);
        checkIsNumber(oa.o[d]);
        if (o[d] === undefined) { breakPoint("collateO"); }
      });
      /** scaled x value of each axis, with its axisID. */
      let offsetArray = oa.stacks.axisIDs().map((d) => ({axisId : d, xOffset : oa.o[d]}));
      let previous = me.get('xOffsets'),
          changed = ! isEqual(previous, offsetArray);
      if (changed) {
        me.set('xOffsets', offsetArray);
        me.incrementProperty('xOffsetsChangeCount');
      }
    }
    /** Map an Array of Block-s to their longNames(), useful in log trace. */
    function Block_list_longName(blocks) {
      return blocks.map(function (b) { return b.longName(); });
    }
    let blocksToDraw = oa.axisIDs,
    viewedBlocks = me.get('blockService').get('viewedIds'),
    stackedBlocks = stacks.blockIDs(),
    blocksUnviewed = stackedBlocks.filter(function (blockId, i) {
      let foundAt = viewedBlocks.indexOf(blockId);
      return foundAt < 0;
    }),
    blocksToAdd = viewedBlocks.filter(function (axisName) {
      // axisName passes filter if it is not already in a stack
      return ! Stacked.getAxis(axisName) && (blocksToDraw.indexOf(axisName) == -1) ; });
    dLog(
      oa.stacks.axisIDs(), blocksToDraw.length, 'viewedBlocks', viewedBlocks,
      'blocksUnviewed', blocksUnviewed, 'blocksToAdd', blocksToAdd);
    if (blocksToAdd.length)
      blocksToDraw = blocksToDraw.concat(blocksToAdd);
    let duplicates = blocksToDraw.filter(function (v, i) { return blocksToDraw.indexOf(v, i+1) != -1; });
    if (duplicates.length)
      dLog/*breakPoint*/('duplicates', duplicates, blocksToDraw, blocksToAdd, oa.axisIDs);

    if ((oa.zoomBehavior === undefined) || instanceChanged)
    {
      const zoomFilterApi = ZoomFilter(oa);
      oa.zoomBehavior = d3.zoom()
        .filter(zoomFilterApi.zoomFilter)
        .wheelDelta(zoomFilterApi.wheelDelta)
      /* use scaleExtent() to limit the max zoom (zoom in); the min zoom (zoom
       * out) is limited by wheelNewDomain() : axisReferenceDomain, so no
       * minimum scaleExtent is given (0).
       * scaleExtent() constrains the result of transform.k * 2^wheelData( ),
       */
        .scaleExtent([0, 1e8])
        .on('zoom', axisBrushZoom.zoom)
      ;
      // console.log('zoomBehavior', oa.zoomBehavior);
    }


    /* may have parent and child blocks in the same axis becoming unviewed in
     * the same run-loop cycle, so ensure that the children are unviewed
     * before the parents.
     */
    [true, false].forEach(function (filterChildren) {
      /** Accumulate child data blocks whose parent is being unviewed;
       * these will be unviewed before the parents.
       */
      let orphaned = [];
      /** filter the generation indicated by filterChildren */
      let     generationBlocksUnviewed = blocksUnviewed.filter(function (blockId, i) {
        let b = oa.stacks.blocks[blockId],
        /** These 2 criteria should be equivalent (i.e. isParent == ! isChild);
         * the focus here is on unviewing the non-reference blocks of an axis
         * before the reference block, so isParent is used.
         * isChild says that the block is eligible to be a child; (it is possible,
         * but seems very unlikely, that the block may have just been added and
         * would be adopted below.)
         * Child blocks have .parent and may have namespace; parent blocks don't have namespace.
         */
        isParent = b.axis && (b === b.axis.blocks[0]), // equivalent to b.axis.referenceBlock.view,
        features = b.block.get('features'),
        isChild = (b.parent || b.block.get('namespace') || (features && features.length));
        if (isParent == isChild)        // verification.
          breakPoint(b.longName(), isParent, 'should be !=', isChild, b.axis, features);
        if (filterChildren && isParent)
        {
          let add = b.axis.dataBlocks(false, false).filter(function (b) { return b.block.get('isViewed'); });
          if (add.length)
            console.log(b.longName(), 'add to orphaned :', Block_list_longName(add));
          orphaned = orphaned.concat(add);
        }
        return filterChildren !== Boolean(isParent);
      });
      dLog('filterChildren', filterChildren, generationBlocksUnviewed);
      if (filterChildren && orphaned.length) {
        let orphanedIds = orphaned.map(function (b) { return b.axisName; });
        console.log('orphaned', Block_list_longName(orphaned), orphanedIds);
        generationBlocksUnviewed = generationBlocksUnviewed.concat(orphanedIds);
      }
      generationBlocksUnviewed.forEach(function (blockId) {
        blockIsUnviewed(blockId);
      });
    });

    /** Add the block to z[].
     * based on receivedBlock().
     */
    function receivedBlock2(block) {
      let retHash = {},
      ch = block,
      blockId = block.get('id'), // chr
      rc = chrData(ch);
      /** use same structure as routes/mapview.js */
      retHash[blockId] = rc;
      this.get('receiveChr')(blockId, rc, 'dataReceived');
    }

    // Place new data blocks in an existing or new axis.
    if (false)
      blocksToDraw.forEach(function(d){
        ensureAxis(d);
      });

    if (! oa.axisApi.ensureAxis)
      oa.axisApi.ensureAxis = ensureAxis;
    // for (let d in oa.stacks.axes) {
    /** ensure that d is shown in an axis & stack.
     * @return axis (Stacked)
     */
    function ensureAxis(d) {
      /** dBlock should be !== undefined.
       */
      let dBlock = me.peekBlock(d),
      sBlock = oa.stacks.blocks[d],
      addedBlock = ! sBlock;

      if (! oa.z[dBlock.id])
        receivedBlock2.apply(me, [dBlock]);


      if (! sBlock || ! dBlock.get('view')) {
        /** sBlock may already be associated with dBlock */
        let view = dBlock.get('view');
        sBlock = view || new Block(dBlock);
        // if view, then this is already set.
        if (oa.stacks.blocks[d] !== sBlock)
          oa.stacks.blocks[d] = sBlock;
        if (! view) {
          /* this .set() was getting assertion fail (https://github.com/emberjs/ember.js/issues/13948),
           * hence the catch and trace;  this has been resolved by not displaying .view in .hbs
           */
          try {
            dBlock.set('view', sBlock);
            dBlock.set('visible', sBlock.visible);
          }
          catch (exc) {
            console.log('ensureAxis', d, dBlock, sBlock, addedBlock, view, oa.stacks.blocks, exc.stack || exc);
          }
        }
      }
      let s = Stacked.getStack(d);
      if (trace_stack > 1)
        console.log(d, dBlock, 'sBlock', sBlock, s);
      /* verification
       if (addedBlock == (s !== undefined))
       breakPoint(d, 'addedBlock', addedBlock, sBlock, 'already in stack', s); */
      if (s && ! dBlock.get('view'))
        console.log(d, 'has stack', s, 'but no axis', dBlock);
      if (s && (s.axes.length == 0))
      {
        let axis = sBlock.axis;
        dLog('re-add to stack', d, s, axis);
        sBlock.log();
        s.log();
        axis.log();
        s.add(axis);
        oa.stacks.axesP[d] = axis;
        if (oa.stacks.indexOf(s) == -1)
          oa.stacks.append(s);
        axisIDAdd(d);
        s.log();
      }
      else
        // if axisID d does not exist in stacks[], add a new stack for it.
        if (! s)
      {
          let zd = oa.z[d],
          dataset = zd ? zd.dataset : dBlock.get('datasetId'),
          /** parent.parent may now be defined, in which case that will be the
           * axis owner, not parent.  Further note below re. parent.parent (QTLs)
           */
          parent = dataset && dataset.get('parent'),
          parentName = parent && parent.get('name'),  // e.g. "myGenome"
          parentId = parent && parent.get('id'),  // same as name
          namespace = dataset && dataset.get('namespace'),
          /** undefined or axis of parent block of d. */
          parentAxis
          ;
          Stack.verify();

          console.log(d, "zd", zd, dataset && dataset.get('name'), parent, parentName, parentId, namespace);
          // zd.  scope, featureType, , namespace
          // if block has a parent, find a block with name matching parentName, and matching scope.
          if (parentName)
          {
            /** this is alternative to matchParentAndScope() - direct lookup. */
            let parentDataset = oa.datasets[parentName];
            dLog("dataset", parentName, parentDataset);
            function matchParentAndScope (key, value) {
              if (! zd)
                zd = oa.z[d];
              let block = oa.z[key],
              /** block is a copy of the data attributes, it does not have
               * block.store; block_ is the ember data store object. */
              block_ = me.peekBlock(key),
              /** Match scope, dataset parent name, and store.name.
               * There may be a copy of the parent in >1 server; for now we'll
               * put the data block on the axis of the parent from the same
               * server.  It is not invalid to put it on a different server,
               * and that functionality can be considered.
               * Now replacing :
               *  (dBlock.store.name === block_.store.name)
               * with parentMatch (which probably covers match and could replace it)
               * And sometimes dataset (z[d].dataset) is the local dataset with
               * the same name instead of dBlock.get('datasetId').dBlock
               * So adding parentNameMatch, and using b.get('referenceBlock') as fall-back;
               * this will be replaced anyway (axesBlocks, which uses block.referenceBlock).
               */
              parentMatch = block_ && (block_.get('datasetId.content') === dataset.get('parent')),
              parentNameMatch = block_ && (dataset.get('parentName') === get(block_, 'datasetId.id')),
              match = (block.scope == zd.scope) && (block.dataset.get('name') == parentName);
              dLog(key, trace_stack ? block : block.dataset.get('name'), match, parentMatch, parentNameMatch);
              match = match && (parentMatch || parentNameMatch);
              return match;
            }

            let blockName;
            /** Adding support for QTLs whose parent is a marker set aligned to
             * a physical reference means we now may have dataset.parent.parent,
             * i.e. dBlock.parentBlock !== dBlock.referenceBlock, whereas
             * matchParentAndScope() assumes that the parentBlock is the owner of
             * the axis (the referenceBlock).  This is handled here as a special
             * case; it is likely useReferenceBlock() can now replace
             * matchParentAndScope().
             */
             if (dBlock.get('datasetId.parent.parent')) {
               useReferenceBlock(dBlock);
             }
            if (! blockName) {
              /** undefined if no parent found, otherwise is the id corresponding to parentName */
              blockName = d3.keys(oa.z).find(matchParentAndScope);
            }
            if (! blockName) {
              let b = me.peekBlock(d);
              useReferenceBlock(b);
            }
            function useReferenceBlock(b) {
              let
              r = b && b.get('referenceBlock');
              blockName = r && r.get('id');
              dLog(d, b, 'referenceBlock', r, blockName);
            }
            dLog(parentName, blockName);
            if (blockName)
            {
              let block = oa.z[blockName];
              parentAxis = oa.axesP[blockName];
              if (! block) {
                dLog('ensureAxis', blockName, oa.z, oa.axesP);
              } else {
                dLog(block.scope, block.featureType, block.dataset.get('name'), block.dataset.get('namespace'), "parentAxis", parentAxis);
              }
            }
          }

          let sd;
          /** if any children loaded before this, adopt them */
          let adopt;
          /** Use the stack of the first child to adopt.
           * First draft created a new stack, this may transition better.
           */
          let adopt0;

          /** if true then if child data blocks are received before their parent
           * blocks, create an axis and stack for the child block, and when the
           * parent arrives, re-assign the axis to the parent, adopting the child
           * into the axis.
           *
           * The idea was to give the user some positive feedback if the child
           * data arrived and not the parent block, but the updates involved in
           * the adoption step may be a problem, so this is currently disabled.
           */
          const drawChildBlocksBeforeParent = false;
          
          if (! drawChildBlocksBeforeParent && parentName && ! parentAxis)
          {
            dLog(sd, ".parentName", parentName);
            sBlock.parentName = parentName;
            sBlock.z = oa.z[d];
            /* Skip the remainder of the function, which implements the
             * drawChildBlocksBeforeParent feature.
             * Disabling adoption seems to avoid this error, which is probably
             * caused by an axis-1d component being destroyed during adoption :
             *  "Cannot update watchers for `domain` on `<... component:draw/axis-1d ...>` after it has been destroyed."
             *
             * This return can be re-structured to if/then, assuming this solution works.
             */
            return;
          }


          if (! parentAxis)
          {
            // initial stacking : 1 axis per stack, but later when db contains Linkage
            // Groups, can automatically stack Axes.
            /* It seems better to re-use oa.axesP[adopt0] instead of creating sd;
             * that requires the adoption search to be done earlier, which is simple,
             * and also will change this significantly, so is better deferred
             * until after current release.
             */
            sd = new Stacked(d, 1); // parentAxis === undefined
            sd.referenceBlock = dBlock;
            dLog('before push sd', sd, sd.blocks, sBlock);
            sd.logBlocks();
            if (sd.blocks.length && sd.blocks[0] === sBlock)
              breakPoint('sBlock already in sd.blocks', sd.blocks);
            else
            {
              sd.blocks.push(sBlock);
              dLog('after push', sd.blocks);
              sd.logBlocks();
            }
            // .parent of referenceBlock is undefined.
            sBlock.setAxis(sd);
            if (sBlock !== sd.referenceBlockS())
              dLog('sBlock', sBlock, ' !== sd.referenceBlockS()',  sd.referenceBlockS());

            adopt = 
              d3.keys(oa.axesP).filter(function (d2) {
                let a = oa.stacks.blocks[d2]; //  could traverse just axesP[] and get their reference
                let match = 
                  (d != d2) &&  // not self
                  ! a.parent && a.parentName && (a.parentName == dataset.get('name')) &&
                  a.z.scope && (a.z.scope == oa.cmName[d].scope) &&
                  (a.block.store.name === dataset.store.name);
                if (! a.parent && trace_stack > 1)
                {
                  console.log(d2, a.parentName,  dataset.get('name'),
                              a.z && a.z.scope,  oa.cmName[d].scope, match); 
                }
                return match;
              });

            if (adopt.length)
            {
              dLog("adopt", adopt);
              adopt0 = adopt.shift();
              let a = oa.axesP[adopt0];
              a.stack.log();
              /** stacks:Block of the block being adopted */
              let aBlock = a.referenceBlockS();
              sd.move(a, 0);

              delete oa.axesP[adopt0];
              deleteAxisfromAxisIDs(adopt0);
              a.stack.remove(adopt0);
              // roughly equivalent : a.stack.move(adopt0, newStack, -1)

              // a.axisName = d;
              // sd.blocks[0] is sBlock
              dLog('aBlock.parent', aBlock.parent, '->', sd.blocks[0]);
              aBlock.parent = sd.blocks[0];
              dLog('aBlock.axis', aBlock.axis, sd);
              // see comments re. axislater and run.later in @see Block.prototype.setAxis().
              aBlock.setAxis(sd);
              a.stack.add(sd);
              dLog(adopt0, a, sd, oa.axesP[a.axisName]);
              sd.stack.log();

              sd.scale = a.scale;
              /** the y scales will be accessed via the new name d. - also update domain */
              dLog('adopt scale', y[d] && 'defined', y[adopt0] && 'defined');
              if (y[d] === undefined)
                y[d] = y[adopt0]; // could then delete y[adopt0]

              /** change the axisID of the DOM elements of the axis which is being adopted.  */
              let aStackS = oa.svgContainer.select("g.axis-outer#" + eltId(adopt0));
              dLog('aStackS', aStackS.size());
              aStackS
                .datum(d)
                .attr("id", eltId);
              if (trace_stack > 1)
              {
                logSelection(aStackS);
                logSelectionNodes(aStackS);
              }

              let gAll = 
                aStackS.select("g.axis-all")
                .attr("id", eltIdAll);

              /** just the <text> which is immediate child of gAll;  could use selectImmediateChildNodes(gAll).
               */
              let axisTitleS = aStackS.select("g.axis-all > text");
              axisTitle.axisTitleFamily(axisTitleS);

              /** update the __data__ of those elements which refer to axis parent block name */
              let dataS = aStackS.selectAll("g.brush, g.brush > g[clip-path], g.stackDropTarget, g.stackDropTarget > rect");
              /* could also update adopt0 -> d in : 
               *  g.brush > clipPath#axis-clip-${axisID}
               *  g.brush > g[clip-path] url(#axis-clip-${axisID})
               * but adopt0 is unique and that is all that is required for now;
               * will likely change datum of g axis* and brush to the Stacked axis
               * when splitting out axes from draw-map, simplifying adoption.
               */
              dLog('dataS', dataS.nodes(), dataS.data(), '->', d);
              dataS.each(function () { d3.select(this).datum(d); });

              let gAxisS = aStackS.selectAll("g.axis");
              dLog('zoomBehavior adopt.length', adopt.length, gAxisS.nodes(), gAxisS.node());
              const axis = oa.axes[d];
              gAxisS
                .datum(d)
                .attr('id', axisEltId(d))
                .call(oa.zoomBehavior)
                .call(axis.scale(y[d]));

              if (trace_stack > 1)
              {
                let checkS = aStackS.selectAll("g, g.stackDropTarget > rect");
                checkS.each(function(b,i) {console.log(this,b,i,b.__data__); } );
                // logSelectionNodes(checkS);
              }
            }
          }

          // verification : sd is defined iff this block doesn't have a parent axis and is not adopting a block with an axis.
          if ((sd !== undefined) != ((parentAxis || adopt0) === undefined))
            dLog('sd', sd, parentAxis, adopt0);
          let
            /** blocks which have a parent axis do not need a Stack.
             * sd is defined if we need a new axis and hence a new Stack.
             */
            newStack = sd && ! adopt0 && new Stack(sd);
          if (parentAxis)
          {
            dLog("pre-adopt", parentAxis, d, parentName);
            /* axisIDAdd() has already been called (by receiveChr() or from
             * myDataKeys above), so remove d from axisIDs because it is a child
             * data block, not an axis / reference block.
             * Alternative is to use stacks.axisIDs(); splitting out axes as a
             * component will replace oa.axisIDs.
             */
            deleteAxisfromAxisIDs(d);
            delete oa.axesP[d];
            dLog('before push parentAxis', parentAxis, parentAxis.blocks, sBlock);
            parentAxis.logBlocks();
            parentAxis.blocks.push(sBlock);
            dLog('after push', parentAxis.blocks);
            parentAxis.logBlocks();
            sBlock.setAxis(parentAxis);
            sBlock.parent = parentAxis.referenceBlockS();
            let aStackS1 = oa.svgContainer.select("g.axis-outer#" + eltId(parentAxis.axisName));
            let axisTitleS = aStackS1.select("g.axis-all > text");
            axisTitle.axisTitleFamily(axisTitleS);
          }
          else if (! adopt0)
          {
            /** handle GM-s and reference.
             * : when reference arrives before any children : no .parent.
             * Difference : GM has namespace and features;  reference has range
             */
            let isReference = dBlock.get('range') !== undefined;
            // if (! isReference)
            /* GM has no parent/child separation; it is its own reference and data block.  */
            // set above : sd.referenceBlock = dBlock;
            // sBlock.parent = sd;   //-	.parent should be Block not Stacked
            // could push() - seems neater to place the reference block first.
            dLog('before unshift sd', sd, sd.blocks, sBlock);
            if (sd.blocks.length && sd.blocks[0] === sBlock)
              dLog('sBlock already in sd.blocks', sd.blocks);
            else
            {
              if (trace_stack)
                sd.logBlocks();
              sd.blocks.unshift(sBlock);
              dLog('after unshift', sd.blocks);
              if (trace_stack)
                sd.logBlocks();
            }
          }
          /** to recognise parent when it arrives.
           * not need when parentAxis is defined.
           */
          if (parentName && ! parentAxis)
          {
            console.log(sd, ".parentName", parentName);
            sBlock.parentName = parentName;
          }
          if (sBlock) { sBlock.z = oa.z[d]; }
          if (sd)
            sd.z = oa.z[d];  // reference from Stacked axis to z[axisID]

          // newStack is only defined if sd is defined (and !adopt0) which is only true if ! parentAxis
          if (newStack)
          {
            console.log("oa.stacks.append(stack)", d, newStack.stackID, oa.stacks);
            oa.stacks.append(newStack);
            console.log(oa.stacks);
            newStack.calculatePositions();
          }

          if (! parentAxis)
          {
            adopt.map(function (d3) {
              /** axis being adopted.
               * a is discarded, and a.blocks[0] is re-used.
               */
              let a = oa.axesP[d3];
              /** oldStack will be deleted. `a` will become unreferenced. */
              let oldStack = a.stack;

              /** re-use the Block being adopted. */
              let aBlock = a.referenceBlockS();
              sd.move(a, 0);
              // could set .parent in .move()
              aBlock.parent = sd;
              //	-	check that oldStack.delete() will delete the (Stacked) a

              console.log(d3, a, aBlock, sd, oa.axesP[a.axisName]);
              sd.stack.log();
              // noting that d3 == a.axisName
              delete oa.axesP[a.axisName];
              oa.stacks.blocks[a.axisName] = aBlock;
              console.log('aBlock.axis', aBlock.axis);
              aBlock.axis = sd;
              deleteAxisfromAxisIDs(a.axisName);
              if (! oldStack)
                console.log("adopted axis had no stack", a, a.axisName, oa.stacks);
              else
              {
                // remove Stack of a from oa.stacks.  a.stack is already replaced.
                console.log("remove Stack", oldStack, oa.stacks);
                oldStack.delete();
                console.log("removed Stack", oa.stacks, oa.stacks.length, a);
              }
            });
          }
          Stack.verify();
          stacksAxesDomVerify(stacks, oa.svgContainer);
        }
    }

    stacksAxesDomVerify(stacks, oa.svgContainer);
    /**  add width change to the x translation of axes to the right of this one.
     */
    function axisWidthResizeRight(axisID, width, dx)
    {
      console.log("axisWidthResizeRight", axisID, width, dx);
      /** this is like Stack.axisStackIndex().  */
      let axis = oa.axes[axisID], from = axis.stack,
      fromSix = from.stackIndex(),   o = oa.o;
      for (let six=0; six < stacks.length; six++)
      {
        let stack = stacks[six],
        /** apply the dx proportionally to the closeness of the stack to the cursor (e.g. stack index or x distance),
         * and apply it -ve to those to the left, including the stack of the axis extend being resized, so that it mirrors,
         * i.e. right side goes same distance as dx, left side same and opposite,
         */
        close =
          (six == fromSix)
          ? -1/2
          : (six < fromSix)
          ? (six - fromSix) / fromSix
          : (six - fromSix) / (stacks.length - fromSix);
        console.log("close", close, fromSix, six, stacks.length);
        stack.axes.forEach(
          function (a, index)
          {
            o[a.axisName] += (dx * close);
          }
        );
        // could filter the selection - just those right of the extended axis
        oa.svgContainer.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
        stack.axes.forEach( function (a, index) { axisRedrawText(oa.axes[a.axisName]); });
        pathDataUtils.pathUpdate(undefined);
      }
    };
    function updateXScale()
    {
      // xScale() uses stacks.keys().
      oa.xScaleExtend = xScaleExtend(); // or xScale();
    }
    let x = stacks.x;
    updateXScale();
    //let dynamic = d3.scaleLinear().domain([0,1000]).range([0,1000]);
    //console.log(axis.scale(y[axisIDs))
    //- stacks_for_axisIDs(); //- added during split

    //- moved to utils/stacks.js: oa.xScaleExtend = xScale();

    collateO();
    vc.xDropOutDistance_update(oa);

    //- moved updateRange() to utils/stacksLayout

    //-    import { } from "../utils/paths.js";

    //-    import { } from "../utils/intervals.js";

    //- moved to path-classes : featureScaffold, scaffolds, scaffoldFeatures, intervals, intervalNames, intervalTree, scaffoldTicks

    //-sb
    /** syntenyBlocks is an array, each element defines a synteny block which
     * can be seen as a parallelogram connecting 2 axes (Axes); the range on each
     * axis is defined by 2 gene names.
     * This is a simple form for input via the content-editable; the result from the BE API may be factored to :
     { chr1, chr2,
     [
     [ gene1, gene2, gene3, gene4, optional_extra_data],
     ...
     ]
     }, ...
     *
     * (the genes could instead be features on a genetic map, but the planned use of
     * synteny block display is physical maps / genes).
     */
    oa.syntenyBlocks || (oa.syntenyBlocks = []);

    //- moved to path-classes : configurePathColour()
    const pathClasses = PathClasses(oa);
    pathClasses.configurePathColour();

    //- moved to utils/draw/axis.js : maybeFlip(), maybeFlipExtent()

    //-components/stacks 
    /* for each axis :
     * calculate its domain if not already done; 
     * ensure it has a y scale,
     *   make a copy of the y scale - use 1 for the brush
     */
    oa.stacks.axisIDs().forEach(function(d) {
      let a = oa.axes[d];
      // now a is Stacked not Block, so expect ! a.parent
      if (a.parent && ! a.parent.getDomain)
        breakPoint('domain and ys', d, a, a.parent);
      let
        /** similar domain calcs in resetZoom().  */
        domain = a.parent ? a.parent.getDomain() : a.getDomain();
      if (false)      //  original, replaced by domainCalc().
      {
        /** Find the max of locations of all features of axis name d. */
        let yDomainMax = d3.max(Object.keys(oa.z[d]), function(a) { return oa.z[d][a].location; } );
        domain = [0, yDomainMax];
      }
      let myRange = a.yRange(), ys = oa.ys, y = oa.y;
      if (ys[d])  // equivalent to (y[d]==true), y[d] and ys[d] are created together
      {
        if (trace_stack > 1)
          console.log("ys exists", d, ys[d].domain(), y[d].domain(), ys[d].range());
      }
      else if (domain)
      {
        ys[d] = d3.scaleLinear()
          .domain(maybeFlip(domain, a.flipped))
          .range([0, myRange]); // set scales for each axis
        
        //console.log("OOO " + y[d].domain);
        // y and ys are the same until the axis is stacked.
        // The brush is on y.
        y[d] = ys[d].copy();
        y[d].brush = d3.brushY()
          .extent([[-8,0],[8,myRange]])
          .filter(combineFilters(noKeyfilter, me.controlsService.noGuiModeFilter))
          .on("end", axisBrushZoom.brushended);
      }
    });
    /** when draw( , 'dataReceived'), pathUpdate() is not valid until ys is updated.
     * ysUpdated is roughly equivalent to ysLength(), but on entry to a new
     * draw() closure, ysUpdated is undefined until this point, while oa.ys
     * contains existing axis scales.
     */
    let ysUpdated = true;
    function ysLength()
    {
      return oa && oa.ys && d3.keys(oa.ys).length;
    }

    let svgRoot;
    /** Diverting to the login component removes #holder and hence <svg>, so
     * check if oa.svgRoot refers to a DOM element which has been removed. */
    let newRender = ((svgRoot = oa.svgRoot) === undefined)
      ||  (oa.svgRoot.node().getRootNode() !== window.document);
    if (newRender)
    {
      if (oa.svgRoot)
        console.log('newRender old svgRoot', oa.svgRoot.node(), oa.svgContainer.node(), oa.foreground.node());
      
      // Use class in selector to avoid removing logo, which is SVG.
      d3.select("svg.FeatureMapViewer").remove();
      d3.select("div.d3-tip").remove();
    }
    let translateTransform = "translate(" + margins[marginIndex.left] + "," + margins[marginIndex.top] + ")";
    if (newRender)
    {
      let graphDim = oa.vc.graphDim;
      oa.svgRoot = 
        svgRoot = d3.select('#holder').append('svg')
        .attr("class", "FeatureMapViewer")
        .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
        .attr("preserveAspectRatio", "none"/*"xMinYMin meet"*/)
        .attr('width', "100%" /*graphDim.w*/)
        .attr('height', graphDim.h /*"auto"*/);
      oa.svgContainer =
        svgContainer = svgRoot
        .append("svg:g")
        .attr("transform", translateTransform);

      stacks.dragTransition = new DragTransition(oa.svgContainer);

      console.log(oa.svgRoot.node(), '.on(resize', this.resize);

      let resizeThis =
        // this.resize.bind(oa);
        function(transition) {
          if (trace_stack)
            dLog("resizeThis", transition);
          debounce(oa, me.resize, [transition], 500);
        };
      /** d3 dispatch.on() does not take arguments, and similarly for eltWidthResizable() param resized. */
      function resizeThisWithTransition() { resizeThis(true); }
      function resizeThisWithoutTransition() { resizeThis(false); }

      // This detects window resize, caused by min-/max-imise/full-screen.
      if (true)
        d3.select(window)
        .on('resize', resizeThisWithTransition);
      else  // also works, can drop if further testing doesn't indicate one is better.
        $( window )
        .resize(function(e) {
          console.log("window resize", e);
          // see notes in domElements.js regarding  .resize() debounce
          debounce(resizeThisWithTransition, 300);
        });

      /* 2 callbacks on window resize, register in the (reverse) order that they
       * need to be called (reorganise this).
       * Revert .resizable flex-grow before Viewport().calc() so the latter gets the new size.  */
      eltWidthResizable('.resizable', undefined, resizeThisWithoutTransition);
    }
    else
      svgContainer = oa.svgContainer;

    let options = this.get('urlOptions');

    function setCssVariable(name, value)
    {
      oa.svgRoot.style(name, value);
    }

    //- moved to ../utils/draw/collate-paths.js : countPaths(), countPathsWithData()

    //User shortcut from the keybroad to manipulate the Axes
    d3.select("#holder").on("keydown", function() {
      if ((String.fromCharCode(d3.event.keyCode)) == "D") {
        console.log("Delete axis (not implemented)");
        // deleteAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "Z") {
        zoomAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "R") {
        refreshAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "A") {
        /* replaced by tickOrPath === 'tick' or 'path' */
        oa.drawOptions.showAll = !oa.drawOptions.showAll;
        console.log("showAll", oa.drawOptions.showAll);
        refreshAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == " ") {
        console.log("space");
      }
    });

    //- moved to utils/draw/path-classes.js : pathClassA()
    //- moved to utils/draw/path-data.js : featureNameOfData(), data_text()

    function flowName(flow)
    {
      return flow.name;
    }
    function flowHidden(flow)
    {
      let hidden = ! flow.visible;
      return hidden;
    }

    // if (oa.foreground && newRender), oa.foreground has been removed; commented above.
    if (((foreground = oa.foreground) === undefined) || newRender)
    {
      oa.foreground =
        foreground = oa.svgContainer.append("g") // foreground has as elements "paths" that correspond to features
        .attr("class", "foreground");
      let flowValues = d3.values(flows),
      flowsg = oa.foreground.selectAll("g")
        .data(flowValues)
        .enter()
        .append("g")
        .attr("class", flowName)
        .classed("hidden", flowHidden)
        .each(function (flow, i, g) {
          /** separate attributes g and .gf, the latter for paths collated in frontend */
          flow.gf = d3.select(this);
          /* related : drawGroupContainer() and updateSelections_flowControls() */
          if (! flow.g) {
            flow.g = d3.select();
          }
        })
      ;
    }

    if (draw_orig) {
    // pathUpdate(undefined);
    stacks.log();

    //-components/stacks
    // Add a group element for each stack.
    // Stacks contain 1 or more Axes.
    /** selection of stacks */
    let stackSd = oa.svgContainer.selectAll(".stack")
      .data(stacks, Stack.prototype.keyFunction),
    stackS = stackSd
      .enter()
      .append("g"),
    stackX = stackSd.exit();
    if (trace_stack)
    {
      console.log("append g.stack", stackS.size(), stackSd.exit().size(), stackS.node(), stackS.nodes());
      if (oa.stacks.length > stackSd.size() + stackS.size())
      {
        console.log("missed stack", oa.stacks.length, stackSd.size());
        breakPoint();
      }
    }
    let removedStacks = 
      stackX;
    if (removedStacks.size())
    {
      if (trace_stack > 1)
      {
        logSelection(removedStacks);
        logSelectionNodes(removedStacks);
      }
      console.log('removedStacks', removedStacks.size());
      /** If there are g.axis-outer in removedStacks[], either move them to the
       * correct g.stack or remove them.
       *
       * Generation of the stacks / axes will probably be simpler when converted
       * to CP -> d3 join;   probably can still get the move transition for the
       * g.axis-outer by doing .insert() of the g.axis-outer in the .exit() case
       * of the g.stack.
       */
      let ra = removedStacks.selectAll("g.axis-outer");
      console.log('ra', ra, ra.nodes(), ra.node());
      ra.each(function (d, i, g) {
        console.log(d, i, this);
        let rag = this,
        ras = Stacked.getStack(d), sDest, alreadyAxis;
        if (! ras)
        {
          // this is OK - just information
          console.log('removedStacks', 'axis no longer in a stack', d);
        }
        else
          if (! (sDest = ras && oa.svgContainer.select("g.stack#" + eltId(ras.stackID)))
              || sDest.empty()) {
            dLog('removedStacks', 'No stack for axis', ras, ras.stackID, this);
          }
        else
          // check that target is not parent
          // if it is then no move required.
          if (sDest.node() === this.parentElement) {
            dLog('removedStacks', 'axis is already in the right parent', d, i, ras, this.parentElement);
          }
        // check if there is already a g.axis-outer with this id in that stack.
        else if ((alreadyAxis = sDest.selectAll("g > g.axis-outer#id" + rag.__data__)) && ! alreadyAxis.empty()) {
          dLog('removedStacks', 'axis is already in the right parent', rag.__data__, d, i, ras, sDest.node(), this.parentElement);
          // rag is not needed and will be removed with its parent which is in removedStacks[] / stackX
        }
        else
        {
          console.log('to stack', ras.stackID, sDest.node());
          let
            /** .insert() will change .__data__, refn d3 doc : " Each new
             * element inherits the data of the current elements, if any, in
             * the same manner as selection.select."
             * Data of parent g.stack is Stack; data of g.axis-outer is axisID
             */
            ragd = rag.__data__,
          moved = sDest.insert(function () { return rag; });
          rag.__data__ = ragd;
          if (trace_stack > 1)
          {
            console.log(moved.node(), moved.data(), moved.node().parentElement,
                        rag.__data__);
            Stack.verify();
            stacksAxesDomVerify(stacks, oa.svgContainer);
          }
        }
      });
      console.log('remnant', removedStacks.node());
    }
    }

    // moved to ../utils/draw/axis.js : stackEltId()

    /** For the given Stack, return its axisIDs.
     * @return [] containing string IDs of reference blocks of axes of the Stack.
     */
    function stack_axisIDs(stack)
    {
      let result = stack.parentAxisIDs();
      if (trace_stack > 1)
        dLog('stack_axisIDs', stack, result);
      return result;
    }

    if (draw_orig) {
    const
    axisDraw = new AxisDraw(oa, /*axis1d*/null, stacks, /*stacksView*/ null),
    selections = {svgContainer, stackSd, stackS,  stackX};    
    const resultSelections =  
        axisDraw.draw2(selections, stack_axisIDs, newRender, stacksAxesDomVerify);
    let {g, axisS, axisG, allG} = resultSelections;


    //- moved DropTarget to utils/draw/drop-target.js (considered : components/axis)
    /*------------------------------------------------------------------------*/

    axisTitle.updateAxisTitleSize(axisG.merge(axisS));

//- moved to ../utils/draw/axis.js : yAxisTextScale(),  yAxisTicksScale(),  yAxisBtnScale()

      //- moved to utils/draw/axisBrush.js : setupBrushZoom(), brushClipSize()

    /*------------------------------------------------------------------------*/
    /* above is the setup of scales, stacks, axis */
    /* stacksAdjust() calls pathUpdate() which depends on the axis y scales. */
    if (source == 'dataReceived')
      stacks.changed = 0x10;
    let t = stacksAdjust(true, undefined);
    }
    /* below is the setup of path hover (path classes, colouring are setup
     * above, but that can be moved following this, when split out). */
    /*------------------------------------------------------------------------*/

    //- moved toolTip to utils/draw/path-info.js
    pathInfo.setupToolTip();

    //Probably leave the delete function to Ember
    //function deleteAxis(){
    //  console.log("Delete");
    //}

    /** remove g#axisName
     */
    function removeAxis(axisName, t)
    {
      let axisS = oa.svgContainer.select("g.axis-outer#" + eltId(axisName));
      console.log("removeAxis", axisName, axisS.empty(), axisS.node());
      axisS.remove();
    }
    /** remove g.stack#id<stackID
     */
    function removeStack(stackID, t)
    {
      let stackS = oa.svgContainer.select("g.stack#" + eltId(stackID));
      console.log("removeStack", stackID, stackS.empty(), stackS.node());
      stackS.remove();
    }
    /** remove axis, and if it was only child, the parent stack;  pathUpdate
     * @param stackID -1 (result of .removeStacked) or id of stack to remove
     * @param stack refn to stack - if not being removed, redraw it
     */
    function removeAxisMaybeStack(axisName, stackID, stack)
    {
      let t = oa.svgContainer.transition().duration(750);
      removeAxis(axisName, t);
      /** number of stacks is changing */
      let changedNum = stackID != -1;
      if (changedNum)
      {
        removeStack(stackID, t);
      }
      else
      {
        console.log("removeAxisMaybeStack", axisName, stackID, stack);
        if (stack)
          stack.redraw(t);
      }
      stacks.changed = 0x10;
      /* Parts of stacksAdjust() are applicable to the 2 cases above : either a
       * stack is removed, or a stack is non-empty after an axis is removed from
       * it.  This is selected by changedNum.
       *
       * stacksAdjust() calls redrawAdjacencies() (when changedNum) for all
       * stacks, but only need it for the stacks on either side of the removed
       * stack.
       */
      stacksAdjust(changedNum, t);
    }
    /** Called when an axis and/or stack has change position.
     * This can affect Axis positions, and because data is filtered by the
     * current adjacencies, the displayed data.
     * Update the drawing to reflect those changes.
     * @param t undefined or transition to use for d3 element updates.
     */
    function axisStackChanged_(t)
    {
      showTickLocations(pathClasses.scaffoldTicks, t);
      if (oa.syntenyBlocks) {
        /** time for the axis positions to update */
        later(() => ! me.isDestroying && showSynteny(oa.syntenyBlocks, t, oa), 500);
      }

      me.trigger('axisStackChanged', t);
    }
    function axisStackChanged(t)
    {
      throttle(this, axisStackChanged_, [t], 500);
    }

//-components/paths
    //- moved to utils/draw/path-info.js : 
    /* setupMouseHover(), toolTipMouseOver(), toolTipMouseOut(), closeToolTip(),
     * setupToolTipMouseHover(), handleMouseOver(), hidePathHoverToolTip(),
     * handleMouseOut(),
     */

//- axis

    function zoomAxis(){
      console.log("Zoom : zoomAxis()");
    }
    function refreshAxis(){
      console.log("Refresh");
    }

    /*------------------------------------------------------------------------*/
    //- moved to utils/draw/feature-info.js : showTickLocations()
    //- moved to hover.js : configureHorizTickHover() as configureHorizTickHover_orig

    //--------------------------------------------------------------------------
    //- moved showSynteny() to utils/draw/synteny-blocks-draw.js  (related : components/draw/synteny-blocks.js)
    /*------------------------------------------------------------------------*/

    //- moved to collate-paths.js :
    /* aliasesUniqueName(), ensureFeatureIndex(), featureLookupName(),
     * collateData(), collateFeatureClasses(), maInMaAG(), collateStacks1(),
     * pathsUnique_log(), log_maamm(), log_ffaa(), mmaa2text(),
     */

    //- moved to stacks-adj.js : collateAdjacentAxes(), log_adjAxes(),  log_adjAxes_a(), isAdjacent()

    //- moved to stacks.js : axisId2Name()

    //- moved to collate-paths.js :
    /* getAliased(), collateStacksA(), objPut(),
     * aliasesText(), aliasText(),
     * addPathsToCollation(), addPathsByReferenceToCollation(),
     * storePath(), filterPaths(), selectCurrentAdjPaths(),
     * collateFeatureMap(), concatAndUnique(), featureStackAxes(),
     */

    //- moved to utils/draw/path-data.js :
    /* blockO(), featureLine2(), inside(), pointSegment(), featureLineS2(),
     * featureLineS3(), featureLineS(), lineHoriz(), featureLine(), path(),
     * pathU(), pathUg(), pathAliasGroup(), inRangeI(), inRangeI2(),
     * featureAliasesText(), pathFeatureStore(), featureNameInRange(),
     * featureInRange(), patham(), axisFeatureTick(), patham2(), featureY_(),
     * featureY2(), log_path_data(), pathUpdate_(), log_foreground_g(),
     * pathUpdate(), dataOfPath(), featureNameOfPath(),
     */


//- moved to axisBrush.js (considered axis-brush-zoom.js) : getBrushExtents() ... brushended()
/*
getBrushExtents(),
    getBrushedRegions(), axisBrushedDomain(), axisRange2DomainFn(), axisRange2Domain(), axisBrushShowSelection(),
    brushHelper(), resetZooms(), resetBrushes(), removeBrushExtent(), resetZoom(),
    axisFeatureCircles_selectAll(), handleFeatureCircleMouseOver(), handleFeatureCircleMouseOut(), brushEnableFeatureHover(), zoom(), axisScaleChangedRaf(), axisScaleChanged(), brushended(), 
*/


//- moved to  stacks-drag.js : dragstarted(), dragged(),  draggedAxisRedraw(),  axisChangeGroupElt(), dragended()

//- moved to utils/log-selection : fromSelectionArray(), logSelectionLevel(), logSelection()


    //- moved to utils/draw/path-classes.js : colouredAg(), classFromSet(), locationClasses(), pathClasses(), pathColourUpdate(), scaffoldLegendColourUpdate(),


//- moved  deleteAfterDrag() to stacks-drag (considered axis/)

    /** recalculate all stacks' Y position.
     * Recalculate Y scales.
     * Used after drawing / window (height) resize.
     */
    function stacksAdjustY(t)
    {
      oa.stacks.forEach(function (s) { s.calculatePositions(); });
      oa.stacks.axisIDs().forEach(function(axisName) {
        axisBrushZoom.axisScaleChanged(axisName, t, false);
      });
    }
    /** recalculate stacks X position and show via transition
     * @param changedNum  true means the number of stacks has changed.
     * @param t undefined or transition to use for axisTransformO change
     * @see stacks.log() for description of stacks.changed
     */
    function stacksAdjust(changedNum, t)
    {
      axisTitle.updateAxisTitleSize(undefined);
      /* updateAxisTitleSize() uses vc.axisXRange but not o, so call it before collateO(). */
      if (changedNum)
        collateO();
      collateStacks();
      if (changedNum)
      {
        if (t === undefined)
          t = d3.transition().duration(dragTransitionTime);
        t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
        if (trace_stack > 2)
        {
          let a=t.selectAll(".axis-outer");
          a.nodes().map(function(c) { console.log(c);});
          console.log('stacksAdjust', changedNum, a.nodes().length);
        }
        if (oa.svgContainer)
          oa.stacks.forEach(function (s) { s.redrawAdjacencies(); });
      }
      // could limit this to axes for which dataBlocks has changed
      // axisShowExtendAll();
      // pathUpdate() uses flow.gf, which is set after oa.foreground.
      if (oa.foreground && ysLength())
      {
        pathDataUtils.pathUpdate(t);
        countPathsWithData(oa.svgRoot);
      }
      else {
        console.log('stacksAdjust skipped pathUpdate', changedNum, oa.foreground, ysLength());
      }

      if (stacks.changed & 0x10)
      {
        console.log("stacksAdjust", "stacks.changed 0x", stacks.changed.toString(16));
        stacks.changed ^= 0x10;
        if (oa.svgContainer === undefined)
          later(function () {
            axisStackChanged(t);
          });
        else
          axisStackChanged(t);
      }

      return t;
    }
    if (! oa.axisApi.stacksAdjust)
      oa.axisApi.stacksAdjust = stacksAdjust;
    

//- moved to axisBrush.js (considered axis-brush-zoom) : draw_flipRegion(), (containing) features2Limits(), flipRegionInLimits(),


//- moved to path-classes : clearScaffoldColours()

//- axis-menu
    let apTitleSel = "g.axis-outer > text";
      function glyphIcon(glyphiconName) {
        return ''
          + '<span class="glyphicon ' + glyphiconName + '" aria-hidden=true></span>';
      }
    /** 
     * @param useGlyphIcon  selects glyphicon or html icon. optional param : undefined implies false
     */
    function iconButton(className, id, htmlIcon, glyphiconName, href, useGlyphIcon)
    {
        return ''
        + '<button class="' + className + '" id="' + id + '" href="' + href + '">'
        + (useGlyphIcon ? glyphIcon(glyphiconName) : htmlIcon)
        + '</button>';
    }


    /** The given block has become unviewed, e.g. via manage-explorer.
     * Update the stacks and the display.
     * @param blockId may be a reference or child block; if the former then delete its axis.
     */
    function blockIsUnviewed(blockId) {
      let axisName = blockId;
      let axis, sBlock;

      /* prior to unview of the parent block of a non-empty axis, the child data blocks are unviewed.
       * This is a verification check.
       */
      axis = oa.axes[axisName];
      console.log("blockIsUnviewed", axisName, axis);
      if (axis && axis.blocks.length > 1)
      {
        console.log(
          'blockIsUnviewed', blockId,
          'is the parent block of an axis which has child data blocks', axis.blocks, axis);
        axis.log();
        // augment blockId with name and map axis.blocks to names.
        let cn = oa.cmName[blockId], blockName = cn && (cn.mapName + ':' + cn.chrName);
        let blockNames = axis.blocks.map(function (block) { return block.longName(); } );
        alert(blockId + '/' + blockName + ' is the parent block of an axis which has child data blocks ' + blockNames);
      }

      axis = Stacked.getAxis(blockId);
      if (axis) {
        sBlock = axis.removeBlockByName(blockId);
        console.log(axis, sBlock);
        axis.log();
        // delete oa.stacks.blocks[blockId];
        /* if the axis has other blocks then don't remove the axis.
         * -  To handle this completely, the adoption would have to be reversed -
         * i.e. split the children into single-block axes.
         */
        if (axis.blocks.length)
          axis = undefined;
      }

      // verify : oa.axes[axisName]
      if (axis)
      {
        // removeBlockByName() is already done above

        // this can be factored with : deleteButtonS.on('click', ... )
        let stack = axis && axis.stack;
        // axes[axisName] is deleted by removeStacked1() 
        let stackID = Stack.removeStacked(axisName);
        console.log('removing axis', axisName, sBlock, stack, stackID);
        stack.log();
        deleteAxisfromAxisIDs(axisName);
        removeAxisMaybeStack(axisName, stackID, stack);
        // already done in removeStacked1() : delete oa.axesP[axisName];

      // already done, removeMap() triggers blockIsUnviewed()  : me.send('mapsToViewDelete', axisName);

      // filter axisName out of selectedFeatures and selectedAxes
      let mapChrName = axis.blocks[0]?.block?.brushName;
      oa.axisApi.selectedFeatures_removeAxis(axisName, mapChrName);
      sendUpdatedSelectedFeatures();
      }
      else
      {
        axisTitle.updateAxisTitles();
        axisTitle.updateAxisTitleSize(undefined);
        /* The if-then case above calls removeAxisMaybeStack(), which calls stacksAdjust();
         * so here in the else case, use a selection of updates from stacksAdjust() to
         * ensure that pathData is updated.
         */
        collateStacks();
        if (oa.foreground && ysLength())
        {
          pathDataUtils.pathUpdate(/*t*/ undefined);
          countPathsWithData(oa.svgRoot);
        }
        pathDataUtils.pathUpdate(undefined);
      }

    }

    //- moved extract of configureAxisTitleMenu() to axisTitle.js and removed configureAxisSubTitleMenu() 



    /*------------------------------------------------------------------------*/

    /** Record the viewport Width and Height for use as dependencies of
     * @see resizeEffect()
     */
    function recordViewport(w, h) {
      later(
        () => 
          ! this.isDestroying &&
      this.setProperties({
        viewportWidth : w,
        viewportHeight : h
      }));
    };

      /** Render the affect of resize on the drawing.
       * @param widthChanged   true if width changed
       * @param heightChanged   true if height changed
       * @param useTransition  undefined (default true), or false for no transition
       */
    function showResize(widthChanged, heightChanged, useTransition)
    {
        console.log('showResize', widthChanged, heightChanged, useTransition);
      console.log('showResize',   me.get('viewportWidth'), oa.vc.viewPort.w, me.get('viewportHeight'), oa.vc.viewPort.h);
      let viewPort = oa && oa.vc && oa.vc.viewPort;
      if (viewPort)
        /* When visibility of side panels (left, right) is toggled, width of
         * those panels changes in a transition (uses flex in CSS), and hence
         * resize() -> showResize() are called repeatedly in close succession,
         * with slightly changing width.
         * Minimise the impact of this by using debounce, and .toFixed(), since
         * changes < 1 pixel aren't worth a re-render.
         */
        debounce(
          me,
          recordViewport,
          viewPort.w.toFixed(),
          viewPort.h.toFixed(),
          500);
        updateXScale();
        collateO();
        me.axesShowXOffsets();
        if (widthChanged)
          axisTitle.updateAxisTitleSize(undefined);
        let 
          duration = useTransition || (useTransition === undefined) ? 750 : 0,
        t = oa.svgContainer.transition().duration(duration);
        let graphDim = oa.vc.graphDim;
        oa.svgRoot
        .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
          .attr('height', graphDim.h /*"auto"*/);

      axisBrushZoom.brushUpdates();

      // recalculate Y scales before pathUpdate().
        if (heightChanged)
          stacksAdjustY(t);

      // for stacked axes, window height change affects the transform.
        if (widthChanged || heightChanged)
        {
        t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
          // also xDropOutDistance_update (),  update DropTarget().size
          pathDataUtils.pathUpdate(t /*st*/);
        }

        if (heightChanged)
        {
          // let traceCount = 1;
          oa.svgContainer.selectAll('g.axis-all > g.brush > clipPath > rect')
            .each(function(d) {
              let a = oa.axesP[d],
              ya = oa.y[d],
              yaRange = ya.range();
              // dLog('axis-brush', this, this.getBBox(), yaRange);
              // see also brushClip().
              d3.select(this)
              // set 0 because getting y<0, probably from brushClip() - perhaps use [0, yRange] there.
                .attr("y", 0)
                .attr("height", yaRange[1]);
            });
          oa.svgContainer.selectAll('g.axis-all > g.brush > g[clip-path]')
            .each(function(d) {
              /* if (traceCount-->0) console.log(this, 'brush extent', oa.y[d].brush.extent()()); */
              let a = oa.axesP[d],
              ya = oa.y[d],
              b = ya.brush;
              // draw the brush overlay using the changed scale
              d3.select(this).call(b);
              /* if the user has created a selection on the brush, move it to a
               * new position based on the changed scale. */
              axisBrushZoom.axisBrushShowSelection(d, this);
            });
          if (DropTarget.prototype.showResize) {
            DropTarget.prototype.showResize();
          }
        }
        later( function () {
          if (me.isDestroying) { return; }
          /* This does .trigger() within .later(), which seems marginally better than vice versa; it works either way.  (Planning to replace event:resize soon). */
          if (widthChanged || heightChanged)
            try {
              /** draw-map sends 'resized' event to listening sub-components using trigger().
               * It does not listen to this event. */
              me.trigger('resized', widthChanged, heightChanged, useTransition);
            } catch (exc) {
              console.log('showResize', 'resized', me, me.resized, widthChanged, heightChanged, useTransition, graphDim, /*brushedDomains,*/ exc.stack || exc);
            }
          // axisShowExtendAll();
          showSynteny(oa.syntenyBlocks, undefined, oa); });
      };

   //- moved extracts to view-controls, replaced these functions using oninput=(action )  :  setupToggle(), setupTogglePathUpdate(), setupToggleModePublish(), setupToggleShowPathHover(), setupToggleShowAll(), setupToggleShowSelectedFeatures(), setupPathOpacity(), setupPathWidth(), setupVariousControls(),

//- moved to flows-controls.js : flows_showControls()


//- draw-map
    /** After chromosome is added, draw() will update elements, so
     * this function is used to update d3 selections :
     * svgRoot, svgContainer, foreground, flows[*].g
     */
    function updateSelections() {
      let svgRoot = oa.svgRoot, svgContainer = oa.svgContainer,
      foreground = oa.foreground;
      console.log(
        "svgRoot (._groups[0][0])", svgRoot._groups[0][0],
        ", svgContainer", svgContainer._groups[0][0],
        ", foreground", foreground._groups[0][0]);
      svgRoot = d3.select('#holder > svg');
      svgContainer = svgRoot.select('g');
      foreground = svgContainer.select('g.foreground');
      console.log(
        "svgRoot (._groups[0][0])", svgRoot._groups[0][0],
        ", svgContainer", svgContainer._groups[0][0],
        ", foreground", foreground._groups[0][0]);
      //- moved code to app/utils/draw/flow-controls.js: updateSelections_flowControls() (new function)
    };

//- moved to path-classes : getUsePatchColour() as getUsePathColour()

//- moved to flows-controls.js : Flow.prototype.ExportDataToDiv()


  },   // draw()

  //----------------------------------------------------------------------------

  /** Redraw all stacks.
   * Used when change of axisTicksOutside.
   */
  stacksRedraw()
  {
    dLog('stacksRedraw');
    if (this.oa.svgContainer) {
      let t = this.oa.svgContainer.transition().duration(750);
      this.oa.stacks.forEach(function (s) { s.redraw(t); });
    }
  },
  /** re-apply axisTransformO(), which uses the axis x scales oa.o */
  axesShowXOffsets() {
    let 
    oa = this.oa,
    t = oa.svgContainer;
    t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
  },


  //- moved to axisBrush.js : triggerZoomedAxis, throttledZoomedAxis,

  //----------------------------------------------------------------------------


  updateSyntenyBlocksPosition : task(function * () {
    dLog('updateSyntenyBlocksPosition', this.oa.syntenyBlocks.length);
    if (this.oa.axisApi.showSynteny) {
      this.oa.axisApi.showSynteny(this.oa.syntenyBlocks, undefined);
    }
    yield timeout(100);
  }).keepLatest(),

  //----------------------------------------------------------------------------

  didInsertElement() {
    this._super(...arguments);

    if (! $.popover && $.fn.popover) {
      dLog('didInsertElement initialise $.popover from .fn');
      $.popover = $.fn.popover;
      $.button = $.fn.button;	// maybe not used.
      $.tab = $.fn.tab;
    }
    // eltWidthResizable('.resizable');

    later(() => {
      $('.left-panel-shown')
        .on('toggled', (event) => this.readLeftPanelToggle() );
      /** .draggable() is provided by jquery-ui. ember-cli-jquery-ui is not
       * updated, and .make-ui-draggable is not enabled for any elements
       * currently; As needed, can instead use
       * e.g. github.com/mharris717/ember-drag-drop for .tooltip.ember-popover.
       * $('.make-ui-draggable').draggable();  */
    });
  },

  drawEffect : computed('data.[]', 'resizeEffect', function () {
    let me = this;
    let data = this.get('data');
    throttle(function () {
      /** when switching back from groups/ route to mapview/, this may be called
       * before oa.axisApi is initialised in draw(), */
      if (me.oa.axisApi) {
      /** viewed[] is equivalent to data[], apart from timing differences.  */
      let viewed = me.get('blockService.viewed'),
      /** create axes for the reference blocks before the data blocks are added. */
      referencesFirst = viewed.sort((a,b) => {
        let aHasReference = !!a.get('referenceBlock'),
        bHasReference = !!b.get('referenceBlock');
        return aHasReference === bHasReference ? 0 : aHasReference ?  1 : -1;
      });
      referencesFirst.forEach((block) => me.oa.axisApi.ensureAxis(block.id));
      }
      me.draw(data, 'didRender');
    }, 1500);

    highlightFeature_drawFromParams(this);
  }),
  resizeEffect : computed(
    /* viewportWidth and viewportHeight will change as a result of changes in
     * stacksWidthChanges.{left,right}, so these dependencies could be
     * consolidated (checking that the dependencies change after the element size
     * has changed).
     */
    'stacksWidthChanges.@each', 'viewportWidth', 'viewportHeight',
    function () {
      let
      stacksWidthChanges = this.get('stacksWidthChanges'),
      viewportWidth = this.get('viewportWidth'),
      viewportHeight = this.get('viewportHeight'),
      result = {
        stacksWidthChanges, viewportWidth, viewportHeight
      };
      let prev = this.get('resizePrev');
      this.set('resizePrev', result);
      if (prev) {
        delete result.changed;
        let changed = compareFields(prev, result, compareViewport);
        result.changed = changed;
      }
      dLog('resizeEffect', result);
    if (false) // currently the display is probably smoother with the debounce; later after tidying up the resize structure this direct call may be better.
      this.get('resize').apply(this.get('oa'), [/*transition*/true]);
    else
      debounce(this.get('oa'), this.get('resize'), [/*transition*/true], 500);
      return result;
  }),

  /** for CP dependency.  Depends on factors which affect the horizontal (X) layout of stacks.
   * When this CP fires, updates are required to X position of stacks / axes, and hence the paths between them.
   * @return value is for devel trace
   */
  stacksWidthChanges : computed(
    'blockService.stacksCount', 'splitAxes.[]',
    /** panelLayout is mapview .layout */
    'panelLayout.left.visible', 'panelLayout.right.visible',
    function () {
      let count = stacks.length;
      // just checking - will retire stacks.stacksCount anyway.
      if (count != stacks.stacksCount?.count)
        console.log('stacksWidthChanges',  count, '!=', stacks.stacksCount);
      let leftPanelShown = this.readLeftPanelToggle(),
      current = {
        stacksCount : count,
        splitAxes : this.get('splitAxes').length,
        // this.get('panelLayout.left.visible') is true, and does not update
        left : leftPanelShown,
        right : this.get('panelLayout.right.visible')
      };
      console.log('stacksWidthChanges', current);
      return current;
    }),
  /** Read the CSS attribute display of left-panel to determine if it is shown / visible.  */
  readLeftPanelToggle() {
      let leftPanel = $('#left-panel'),
      /** leftPanel.hasClass('left-panel-shown') is always true; instead the
       * <div>'s display attribute is toggled between flex and none.
       * using jQuery .toggle() applied to button.left-panel-{shown,hidden},
       * in toggleLeftPanel(), via left-panel.hbs action of button.panel-collapse-button.
       * This could be made consistent with right panel, but planning to use golden-layout in place of this anyway.
       *
       * .attributeStyleMap is part of CSS Typed OM; is in Chrome, not yet Firefox.
       * https://github.com/Fyrd/caniuse/issues/4164
       * https://developer.mozilla.org/en-US/docs/Web/API/CSS_Typed_OM_API
       */
      haveCSSOM = leftPanel[0].hasAttribute('attributeStyleMap'),
      leftPanelStyleDisplay = haveCSSOM ?
        leftPanel[0].attributeStyleMap.get('display').value :
        leftPanel[0].style.display,
      leftPanelShown = leftPanelStyleDisplay != 'none'
    ;
    dLog('readLeftPanelToggle', leftPanel[0], leftPanelShown);
    /* The returned value is used only in trace.  This attribute .leftPanelShown is observed by resize()
 */
    this.set('leftPanelShown', leftPanelShown);
    return leftPanelShown;
  },

  /** @return true if changes in #stacks or split axes impact the width and horizontal layout.
   * (maybe dotPlot / axis.perpendicular will affect width also)
   */
  stacksWidthChanged() {
    /* can change this to a CP, merged with resize() e.g. resizeEffect(), with
     * dependencies on 'blockService.stacksCount', 'splitAxes.[]'
     */
    let previous = this.get('previousRender'),
    now = {
      stacksCount : stacks.length,   // i.e. this.get('blockService.stacksCount'), or oa.stacks.stacksCount.count
      splitAxes : this.get('splitAxes').length
    },
    changed = ! isEqual(previous, now);
    if (changed) {
      console.log('stacksWidthChanged', previous, now);
      later(() => ! this.isDestroying && this.set('previousRender', now));
    }
    return changed;
  },

  resize : observer(
    'panelLayout.left.visible',
    'panelLayout.right.visible',
    'leftPanelShown',
    'controls.view.showAxisText',
    /* axisTicksOutside doesn't resize, but a redraw is required (and re-calc could be done) */
    'controls.view.axisTicksOutside',
    /* after 'controls.view.extraOutsideMargin' changes, axis x offsets are re-calculated.  related : 'oa.vc.axisXRange' */
    'controls.view.extraOutsideMargin',
    /* ChangeCount represents 'xOffsets.@each.@each', */
    'xOffsetsChangeCount',
    /** split-view : sizes of the components adjacent the resize gutter : 0: draw-map and 1 : tables panel. */
    'componentGeometry.sizes.0',
    'controls.window.tablesPanelRight',
    function() {
      console.log("resize", this, arguments);
        /** when called via .observes(), 'this' is draw-map object.  When called
         * via  window .on('resize' ... resizeThisWithTransition() ... resizeThis()
         * ... Ember.run.debounce(oa, me.resize, ), 'this' is oa.
         */
        let calledFromObserve = (arguments.length === 2),
      layoutChanged = calledFromObserve,
      /** This can be passed in along with transition in arguments,
       * when ! calledFromObserve.
       */
      windowResize = ! calledFromObserve,
            oa =  calledFromObserve ? this.oa : this;
      let me = calledFromObserve ? this : oa.eventBus;
      let redrawAxes = arguments[1] === 'controls.view.axisTicksOutside';
    // logWindowDimensions('', oa.vc.w);  // defined in utils/domElements.js
    function resizeDrawing() { 
      // if (windowResize)
        eltResizeToAvailableWidth(
          /*bodySel*/ 'div.ember-view > div > div.body > div',
          /*centreSel*/ '.resizable');
      oa.vc.calc(oa);
      let
        drawMap = oa.eventBus,
      widthChanged = (oa.vc.viewPort.w != oa.vc.viewPortPrev.w) || drawMap.stacksWidthChanged(),
      heightChanged = oa.vc.viewPort.h != oa.vc.viewPortPrev.h;

      // rerender each individual element with the new width+height of the parent node
      // need to recalc viewPort{} and all the sizes, (from document.documentElement.clientWidth,Height)
      // .attr('width', newWidth)
      /** Called from .resizable : .on(drag) .. resizeThis() , the browser has
       * already resized the <svg>, so a transition looks like 1 step back and 2
       * steps forward, hence pass transition=false to showResize().
      */
      let useTransition = layoutChanged;
      oa.showResize(widthChanged, heightChanged, useTransition);
    }
        console.log("oa.vc", oa.vc, arguments);
        if (oa.vc)
        {
            if (redrawAxes) {
              this.stacksRedraw();
            }
            if (false && ! layoutChanged)
                // Currently debounce-d in resizeThis(), so call directly here.
                resizeDrawing();
            else
            {
                console.log(arguments[1], arguments[0]);
                /* debounce is used to absorb the progressive width changes of
                 * the side panels when they open / close (open is more
                 * progressive).
                 * After the values panelLayout.{left,right}.visible change, DOM
                 * reflow will modify viewport width, so the delay helps with
                 * waiting for that.
                 */
                debounce(resizeDrawing, 300);
            }
        }

    }
  )
  /* could include in .observes() : 'panelLayout.left.tab', but the tab name should not affect the width.
   * (currently the value of panelLayout.left.tab seems to not change - it is just 'view').
   * stacksWidthChanges.{left,right} are equivalent to leftPanelShown and panelLayout.right.visible,
   * so there is some duplication of dependencies, since resizeEffect() depends on stacksWidthChanges.@each
   */


});

