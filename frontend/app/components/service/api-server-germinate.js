import EmberObject, { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { A as Ember_A } from '@ember/array';
import { later } from '@ember/runloop';

import { removePunctuation, ApiServerAttributes } from './api-server';
import { Germinate } from '../../utils/data/germinate';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

export default EmberObject.extend(ApiServerAttributes, {

  componentClassName : 'ApiServerGerminate',

  //----------------------------------------------------------------------------
  /** override some methods of ApiServerAttributes */
  init() {
    this._super(...arguments);

    const groups = {groupsInOwnNone : []};
    this.set('groups', EmberObject.create(groups));
    /* .germinateInstance is set by ServerLogin()
    this.germinate = new Germinate(); */
    dLog('germinate', this);
    if (window.PretzelFrontend) {
      window.PretzelFrontend.apiServerGerminate = this;
    }
  },
  willDestroy() {
    this._super(...arguments);
  },

  //----------------------------------------------------------------------------

  get blockFeatureTraits() { return []; },
  get blockFeatureOntologies() { return []; },

  getVersion : function () { return ''; },
  /** generate a view dataset for each Germinate dataset, with a block for each
   * linkageGroup.
   */
  getDatasets : function () {
    const
    germinate = this.germinateInstance,
    datasetsP = germinate.maps()
      .then(datasets => {
        const p =
        datasets.result.data.map(dataset =>
          germinate.linkagegroups(dataset.mapDbId)
            .then(linkageGroups =>
              this.viewDatasetP(this.store, dataset, linkageGroups.result.data))
        )
        ; return p; }
      );
    return datasetsP;
  },
  /** Create view datasets in store which reference the Germinate datasets
   */
  viewDatasetP : function(store, germinateDataset, linkageGroups) {
    const
    apiServers = this.get('apiServers'),
    /** Record the created datasets and blocks in id2Server, as in :
     * services/data/dataset.js : taskGetList() : datasets.forEach()
     */
    id2Server = apiServers.get('id2Server'),
    datasetsBlocks = this.datasetsBlocks || this.set("datasetsBlocks", Ember_A()),
    blocksP = linkageGroups.map(linkageGroup => {
      const
      name = linkageGroup.linkageGroupName,
      blockAttributes = {
        name,
        id : germinateDataset.mapDbId + '_' + name,
        featureCount : linkageGroup.markerCount,
      },
      blockP = store.createRecord('Block', blockAttributes);
      return blockP;
    }),
    datasetP = Promise.all(blocksP).then(blocks => {
      const
      datasetAttributes = {
        name : germinateDataset.mapName,
        id : germinateDataset.mapDbId,
        // type
        tags : ['view', 'Genotype', 'Germinate'],
        meta : {paths : 'false', germinate : germinateDataset},
        // namespace
        blocks
      };
      blocks.forEach(block => {
        id2Server[block.get('id')] = this;
        block.set('mapName', germinateDataset.mapName);
      });
      const p = store.createRecord('Dataset', datasetAttributes);
      return p;
    });
    datasetP.then(dataset => {
      id2Server[dataset.get('id')] = this;
      if (! datasetsBlocks.findBy('name', dataset.name)) {
        datasetsBlocks.push(dataset);
        later(() => {
          apiServers.incrementProperty('datasetsBlocksRefresh');
          apiServers.trigger('receivedDatasets', datasetsBlocks);
        });
      }
    });
    return datasetP;
  },

  // : computed(function),
  featuresCountAllTaskInstance () {
    return [];
  },

  //----------------------------------------------------------------------------


});
