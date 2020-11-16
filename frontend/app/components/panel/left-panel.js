import Component from '@ember/component';

export default Component.extend({
  style: 'height:100%',
  attributeBindings: ['style:style'],
  view: 'mapview',

  actions: {
    toggleLeftPanel() {
      $(".left-panel-shown").toggle();
      $(".left-panel-hidden").toggle();
      $(".left-panel-shown").trigger('toggled');
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    changeTab(tab) {
      $('.nav-tabs a[href="#left-panel-' + tab + '"]').tab('show');
    },
    selectBlock(block) {
      this.sendAction('selectBlock', block);
    },
    removeBlock(block) {
      this.sendAction('removeBlock', block);
    },
    selectDataset(dataset) {
      this.sendAction('selectDataset', dataset);
    },
    updateFeaturesInBlocks(featuresInBlocks) {
      this.sendAction('updateFeaturesInBlocks', featuresInBlocks);
    }
  }
});
