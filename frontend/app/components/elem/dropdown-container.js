import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  tagName: 'span',
  // attributes
  click: function() {
    this.sendAction('onClick');
  },
  // classes
  // classNames: ['btn'],
  classNameBindings: ['pullRight'],
  pullRight: computed('right', function() {
    let prop = this.get('right')
    if (prop === true) {
      return 'pull-right'
    } else {
      return ''
    }
  }),
  menuRight: computed('right', function() {
    let prop = this.get('right')
    if (prop === true) {
      return 'dropdown-menu dropdown-menu-right'
    } else {
      return 'dropdown-menu'
    }
  })
  // actions
});
