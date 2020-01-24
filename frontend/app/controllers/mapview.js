import Ember from 'ember';
import DS from 'ember-data';

const { computed : { readOnly } } = Ember;
const { inject: { service } } = Ember;

import ViewedBlocks from '../mixins/viewed-blocks';

/* global d3 */

const dLog = console.debug;

dLog("controllers/mapview.js");

let trace_dataflow = 0;
let trace_select = 0;

export default Ember.Controller.extend(Ember.Evented, ViewedBlocks, {
  dataset: service('data/dataset'),
  block: service('data/block'),

  /** Array of available datasets populated from model 
   */
  datasets: Ember.computed('model', 'model.availableMapsTask', 'model.availableMapsTask.value', function () {
    let task = this.get('model.availableMapsTask');
    let promise = task.then(function (value) { dLog('datasets from task', value); return value; });
    let resultP = DS.PromiseArray.create({ promise: promise });
    dLog(task, promise, 'resultP', resultP);
    return resultP;
  }),

  actions: {
    // layout configuration
    setVisibility: function(side) {
      // dLog("setVisibility", side);
      let visibility = this.get(`layout.${side}.visible`)
      this.set(`layout.${side}.visible`, !visibility);
    },
    setTab: function(side, tab) {
      // dLog("setTab", side, tab);
      this.set(`layout.${side}.tab`, tab);
    },
    updateSelectedFeatures: function(features) {
    	// dLog("updateselectedFeatures in mapview", features.length);
      this.set('selectedFeatures', features);
      this.send('setTab', 'right', 'selection');
    },
    /** goto-feature-list is given features by the user and finds them in
     * blocks; this is that result in a hash, indexed by block id, with value
     * being an array of features found in that block.
     */
    updateFeaturesInBlocks: function(featuresInBlocks) {
      // dLog("updateFeaturesInBlocks in mapview", featuresInBlocks);
      this.set('featuresInBlocks', featuresInBlocks);
    },

    /** Change the state of the named block to viewed.
     * If this block has a parent block, also add the parent.
     * @param mapName
     * (named map for consistency, but mapsToView really means block, and "name" is db ID)
     * Also @see components/record/entry-block.js : action get
     */
    addMap : function(mapName) {
      let block = this.get('blockFromId')(mapName),
      referenceBlock = block.get('referenceBlock');
      if (referenceBlock)
        referenceBlock.get('setViewed').apply(this, [referenceBlock.get('id'), true]);
      this.get('setViewed').apply(this, [mapName, true]);
    },

    updateRoute() {
      let block_viewedIds = this.get('block.viewedIds');
      dLog("controller/mapview", "updateRoute", this.target.currentURL, block_viewedIds);

      let queryParams =
        {'mapsToView' : block_viewedIds,
         highlightFeature : this.get('model.params.highlightFeature')
        };
      let me = this;
      Ember.run.later( function () {
        me.transitionToRoute({'queryParams': queryParams }); });
    },
    removeBlock: function(block) {
      let block_id = block.get('id');
      this.send('removeMap', block_id);
    },
    /** Change the state of the named block to not-viewed.
     */
    removeMap : function(mapName) {
      /* delay to avoid nextSibling of null in insertAfter() */
      Ember.run.later(() => this.get('setViewed').apply(this, [mapName, false]));
    },

    onDelete : function (modelName, id) {
      dLog('onDelete', modelName, id);
      if (modelName == 'block')
        this.send('removeMap', id); // block
      else
        dLog('TODO : undisplay child blocks of', modelName, id);
    },
    toggleShowUnique: function() {
      dLog("controllers/mapview:toggleShowUnique()", this);
      this.set('isShowUnique', ! this.get('isShowUnique'));
    }
    , isShowUnique: false
    , togglePathColourScale: function() {
      dLog("controllers/mapview:togglePathColourScale()", this);
      this.set('pathColourScale', ! this.get('pathColourScale'));
    }
    , pathColourScale: true,

    /** also load parent block */
    loadBlock : function loadBlock(block) {
      dLog('loadBlock', block);
      // also done in useTask() : (mixins/viewed-blocks)setViewed() : (data/block.js)setViewedTask()
      block.set('isViewed', true);
      let referenceBlock = block.get('referenceBlock');
      if (referenceBlock)
        loadBlock.apply(this, [referenceBlock]);

      /* Before progressive loading this would load the data (features) of the block.
       * Now it just loads summary information : featuresCount (block total) and
       * also featuresCounts (binned counts).
       * The block record itself is already loaded in the initial Datasets request;
       * - it is the parameter `block`.
       */
      if (true) {
        /** in result of featureSearch(), used in goto-feature-list, .block has .id but not .get */
        let id = block.get ? block.get('id') : block.id;
        let t = this.get('useTask');
        t.apply(this, [id]);
      }
    },
    blockFromId : function(blockId) {
      let store = this.get('store'),
      block = store.peekRecord('block', blockId);
      return block;
    },

    selectBlock: function(block) {
      dLog('SELECT BLOCK mapview', block.get('name'), block.get('mapName'), block.id, block);
      this.set('selectedBlock', block);
      d3.selectAll("ul#maps_aligned > li").classed("selected", false);
      d3.select('ul#maps_aligned > li[data-chr-id="' + block.id + '"]').classed("selected", true);

      function dataIs(id) { return function (d) { return d == id; }; }; 
      d3.selectAll("g.axis-outer").classed("selected", dataIs(block.id));
      if (trace_select)
      d3.selectAll("g.axis-outer").each(function(d, i, g) { dLog(this); });
      // this.send('setTab', 'right', 'block');
    },
    selectBlockById: function(blockId) {
      let store = this.get('store'),
      selectedBlock = store.peekRecord('block', blockId);
      /* Previous version traversed all blocks of selectedMaps to find one
       * matching blockId. */
      this.send('selectBlock', selectedBlock)
    },
    selectDataset: function(ds) {
      this.set('selectedDataset', ds);
      this.send('setTab', 'right', 'dataset');
    },
    /** Re-perform task to get all available maps.
     */
    updateModel: function() {
      let model = this.get('model');
      dLog('controller/mapview: updateModel()', model);
      let datasetsTaskPerformance = model.get('availableMapsTask'),
      newTaskInstance = datasetsTaskPerformance.task.perform();
      dLog('controller/mapview: updateModel()', newTaskInstance);
      model.set('availableMapsTask', newTaskInstance);

      /** If this is called as refreshDatasets from data-csv then we want to get
       * blockFeatureLimits for the added block.
       */
      newTaskInstance.then((datasets) => {
        this.get('block').ensureFeatureLimits();
      });
    }
  },

  layout: {
    'left': {
      'visible': true,
      'tab': 'view'
    },
    'right': {
      'visible': true,
      'tab': 'selection'
    }
  },

  controls : Ember.Object.create({ view : {  } }),

  queryParams: ['mapsToView'],
  mapsToView: [],

  selectedFeatures: [],


  scaffolds: undefined,
  scaffoldFeatures: undefined,
  showScaffoldFeatures : false,
  showAsymmetricAliases : false,

  init: function() {
    /** refn : https://discuss.emberjs.com/t/is-this-possible-to-turn-off-some-deprecations-warnings/8196 */
    let deprecationIds = ['ember-simple-auth.session.authorize'];
    Ember.Debug.registerDeprecationHandler((message, options, next) => {
      if (! deprecationIds.includes(options.id)) {
        next(message, options);
      }
    });

    this._super.apply(this, arguments);
  },

  currentURLDidChange: function () {
    dLog('currentURLDidChange', this.get('target.currentURL'));
  }.observes('target.currentURL'),


  blockTasks : readOnly('model.viewedBlocks.blockTasks'),
  /** all available */
  blockValues : readOnly('block.blockValues'),
  /** currently viewed */
  blockIds : readOnly('model.viewedBlocks.blockIds'),


  /** Used by the template to indicate when & whether any data is loaded for the graph.
   */
  hasData: Ember.computed(
    function() {
      let viewedBlocksLength = this.get('block.viewed.length');
      if (trace_dataflow)
        dLog("hasData", viewedBlocksLength);
      return viewedBlocksLength > 0;
    }),

  /** Update queryParams and URL.
   */
  queryParamsValue : Ember.computed(
    'block.viewedIds', 'block.viewedIds.[]', 'block.viewedIds.length',
    function() {
      dLog('queryParamsValue');
      this.send('updateRoute');
    }),

  /** Use the task taskGet() defined in services/data/block.js
   * to get the block data.
   */
  useTask : function (id) {
    dLog("useTask", id);
    let blockService = this.get('block');

    let getBlocks = blockService.get('getBlocksSummary');
    let blocksSummaryTasks = getBlocks.apply(blockService, [[id]]);
    /* get featureLimits if not already received.
     * Also adding a similar request to updateModal (refreshDatasets) so by this
     * time that result should have been received.
     */
    this.get('block').ensureFeatureLimits(id);

    /** Before progressive loading this would load the data (features) of the block. */
    const progressiveLoading = true;
    if (! progressiveLoading) {
      let taskGet = blockService.get('taskGet');
      let block = taskGet.perform(id);
      dLog("block", id, block);
      // block.set('isViewed', true);
    }
  }


});
