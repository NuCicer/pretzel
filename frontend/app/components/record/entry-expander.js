import { later, scheduleOnce } from '@ember/runloop';
import { computed } from '@ember/object';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

import { elt0 } from '../../utils/ember-devel';

import { ontologyIdFromIdText } from '../../utils/value-tree';

// -----------------------------------------------------------------------------

const dLog = console.debug;

const trace_entryExpander = 1;

// -----------------------------------------------------------------------------



/**
 * @param nodeName  text to display in the expandable node
 * @param hoverText hover text
 */
export default Component.extend({
  ontology : service('data/ontology'),

  tagName: '',

  active: false,

  entryTab : computed(function () {
    /** the parent entry-tab will be passed in as an argument; improvising to
     * trial the setLayoutActive feature. */
    let parent = this.parentView;
    while (parent && (parent._debugContainerKey !== "component:record/entry-tab"))
    {
      parent = parent.parentView;
    }
    /** The topmost entry-expander in the Ontology tab, set active to true.
     * The immediate hierarchy is : entry-tab : bs-tab/pane : entry-values : entry-level : entry-expander
     */
    let immediateParent = this.parentView.parentView.parentView.parentView;
    let viewOntology = immediateParent._debugContainerKey === 'component:panel/ontologies';
    let explorerOntology = (immediateParent._debugContainerKey === "component:record/entry-tab") &&
        (immediateParent.name === 'Ontology');
    if (viewOntology || (explorerOntology && this.controlOptions.showHierarchy)) {
      later(() => !this.isDestroying && this.set('active', true));
    }


    return parent;
  }),
  allActive : computed('entryTab', 'entryTab.allActive', 'entryTab.autoAllActive', function () {
    let allActive = this.get('entryTab.allActive');
    let autoAllActive = this.get('entryTab.autoAllActive');
    // side effect : when allActive changes, it sets active.
    // compare !a !== !b, because (false !== undefined).
    if (! this.get('active') !== ! allActive) {
      if (trace_entryExpander > 1)
        console.log('allActive setting', this.get('active'), allActive,
                    elt0(this.elementId || this.parentView.elementId));
      scheduleOnce('afterRender', this, 'toggleActive');
    }
    if (trace_entryExpander > 1)
      console.log('allActive', allActive, elt0(this.elementId || this.parentView.elementId), autoAllActive);
    return allActive || autoAllActive;
  }),
  toggleActive : function () {
    this.toggleProperty('active');
  },
  combinedActive : computed('active', 'allActive', function () {
    let active = this.get('active');
    let allActive = this.get('allActive');
    if (trace_entryExpander > 1)
      console.log('combinedActive', active, allActive, elt0(this.elementId || this.parentView.elementId));
    return active;
  }),
  /** initTabActionBus(), termTabActionBus() are replaced by allActive(), combinedActive(). */
  initTabActionBus : function() {
    let parent = this.get('entryTab');
    if (parent && ! this.get('tabActionBus')) {
      if (trace_entryExpander > 2)
        // parent is entry-tab so use id not .elementId
        console.log('tabActionBus', parent, elt0(parent.get('id')),
                    elt0(this.parentView.elementId));
      this.set('tabActionBus', parent);
      let me = this;
      parent.on('setLayoutActive', setLayoutActive);
      function setLayoutActive (active) {
        let id = me.elementId || me.parentView.elementId;
        console.log('setLayoutActive', active, me.get('active'),
                    elt0(id));
        if (me.get('active') !== active) {
          let id = me.elementId || me.parentView.elementId;
          console.log('setLayoutActive', active, me.get('active'), me,
                      elt0(id));
          me.toggleProperty('active');
        }
      }
    }
  }, // .on('willRender'),
  termTabActionBus : function() {
    let parent = this.get('tabActionBus');
    if (parent)
      parent.off('setLayoutActive');
  },
  didInsertElement() {
    this._super(...arguments);
    /* initialise service used by dependencies */
    this.get('ontology');
  },
  willDestroyElement() {
    // this.termTabActionBus();
  },

  /** expandIcon() and actions: switch() are replaced by using icon-toggle, with
   * .active bound.
   */

  // ---------------------------------------------------------------------------

  valuesColour : computed('values', 'ontology.ontologyColourScaleUpdateCount', function () {
    let
    ontologyId = this.get('values.id'),
    colour = ontologyId && this.get('ontology').ontologyIdToColour(ontologyId);
    return colour;
  }),

  // ---------------------------------------------------------------------------

  checked : computed('ontology.ontologyIsVisibleChangeCount', function () {
    /** only called when this.checkbox is defined. */
    let
    checked = this.checkbox.checked(this.values);
    dLog('checked', checked, this.values);
    return checked;
  }),


  get checkbox() {
    let checkbox;
    if (this.levelMeta) {
      checkbox = this.levelMeta.get(this.values)?.checkbox;
    }
    return checkbox;
  }

  // ---------------------------------------------------------------------------


});
