import Controller from '@ember/controller';
import { computed, action } from '@ember/object';
import { alias } from '@ember/object/computed';

import { removeGroupMember } from '../utils/data/group';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class GroupsController extends Controller {

  // @service apiServers;

  constructor() {
    super();
    this.newClientName = undefined;
  }

  /** lookup owner and services when required. */
  @computed() get services () {
    let owner = Ember.getOwner(this.target);
    let
    apiServers = owner.lookup('service:apiServers'),

    services = {
      apiServers
    };
    return services;
  }
  @alias('services.apiServers') apiServers;


  /**
   * @param clientGroup is from this.model.groupsIn, via #each in .hbs
   */
  @action
  removeGroupMember(clientGroup) {
    const
    fnName = 'removeGroupMember',
    msgName = fnName + 'Msg',
    apiServers = this.get('apiServers'),
    store = clientGroup.store,
    server = apiServers.lookupServerName(store.name),
    clientGroupId = clientGroup.id;

    this.set(msgName, '');
    let
    destroyP = removeGroupMember(apiServers, server, clientGroup, clientGroupId);
    destroyP
      .then((cg) => {
        this.set('selectedClientGroupId', null);
        this.send('refreshModel');
      })
      .catch((errorText) => {
        this.set(msgName, errorText);
      });
    return destroyP;
  };

}
