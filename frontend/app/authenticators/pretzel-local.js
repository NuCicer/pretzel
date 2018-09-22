import Ember from 'ember';
import Base from 'ember-simple-auth/authenticators/base';
const { inject: { service } } = Ember;

export default Base.extend({
  apiEndpoints: service('api-endpoints'),

  restore: function(data) {
    return new Ember.RSVP.Promise(function(resolve, reject){
      if(!Ember.isEmpty(data.token)) {
        resolve(data);
      } else {
        reject();
      }
    });
  },

  authenticate: function(identification, password) {
    let config = Ember.getOwner(this).resolveRegistration('config:environment')
    let
      apiEndpoints = this.get('apiEndpoints'),
    endpoint = config.apiHost + '/api/Clients/login';
    return new Ember.RSVP.Promise((resolve, reject) => {
      Ember.$.ajax({
        url: endpoint,
        type: 'POST',
        crossDomain: true,
        data: JSON.stringify({
            email:    identification,
            password: password
        }),
        accept: 'application/json',
        contentType: 'application/json'
      }).then(function(response){
        // console.log(response)
        Ember.run(function(){
          let host = endpoint.replace(/\/api\/Clients\/login/, '');
          console.log('resolve', 'host url', host, 'token', response.id, 'clientId', response.userId);
          let endpoints = apiEndpoints.addEndpoint(/*url*/ host, /*token*/ response.id);
          resolve({
            token: response.id,
            clientId: response.userId
          });
        });
      }, function(xhr, status, error) {
        var response = xhr.responseText;
        Ember.run(function(){
          reject(response);
        });
      });
    });
  },

  invalidate: function() {
    return Ember.RSVP.resolve();
  }

});
