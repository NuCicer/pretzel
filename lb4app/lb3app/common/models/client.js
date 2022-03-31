'use strict';

/* global require */
/* global module */
/* global process */
/* global __dirname */


var path = require('path');

var loopback = require('loopback'); // for rendering template in custom methods

var acl = require('../utilities/acl')

module.exports = function(Client) {
  //send verification email after registration
  Client.afterRemote('create', function(context, userInstance, next) {
    // console.log('> user.afterRemote triggered');
    // console.log('process.env.EMAIL_ADMIN => ', process.env.EMAIL_ADMIN);
    // console.log(process.env.EMAIL_VERIFY)

    if (process.env.EMAIL_VERIFY == 'NONE') {
        // console.log('created user with no verification email');
        context.result.code = 'EMAIL_NO_VERIFY';
        next();
    } else if (process.env.EMAIL_ACTIVE == 'true') {
      var options = {
        type: 'email',
        to: userInstance.email,
        from: process.env.EMAIL_FROM,
        subject: 'Welcome to Pretzel',
        email_recipient: userInstance.email, // for template
        host: process.env.API_HOST,
        template: path.resolve(__dirname, '../../server/views/verify_user.ejs'),
        redirect: '/verified',
        user: userInstance
      };
      /** Commonly https is implemented by using a reverse proxy (e.g. nginx) to
       * wrap the backend server which is serving http on a local port e.g. 5000
       * and only port 80 / 443 are exposed to the web;
       * this means that the URLs generated by the server and sent out through
       * email should be relative to the outside of the proxy (https), whereas
       * by default they will address the node server (http, local port).  To
       * work with a reverse proxy, process.env.API_PORT_PROXY is defined
       * (normally 80); this indicates that :API_PORT_EXT should be omitted from
       * the URL.
       */
      if (process.env.API_PORT_PROXY) {
        options.port = '80';
      }

      userInstance.verify(options, null, function(err, response) {
        if (err) return next(err);

        context.result.code = 'EMAIL_USER_VERIFY';
        next()
      });
    } else {
      next(new Error('Email could not be sent, missing configuration'));
    }
  });
  
  Client.beforeRemote('confirm', function(context, result, next) {
    // Check whether admin also has to verify the user
    if (process.env.EMAIL_ACTIVE == 'true' && process.env.EMAIL_VERIFY == 'ADMIN' && context.args.redirect == '/verified') {
      if (process.env.EMAIL_ADMIN && process.env.EMAIL_ADMIN.length > 0) {

        //Send access request email to admin
        Client.findById(context.args.uid).then(function(userInstance) {
          var options = {
            type: 'email',
            to: process.env.EMAIL_ADMIN,
            from: process.env.EMAIL_FROM,
            subject: 'New Pretzel User Registration',
            email_user: userInstance.email, // for template
            email_recipient: process.env.EMAIL_ADMIN, // for template
            host: process.env.API_HOST,
            template: path.resolve(__dirname, '../../server/views/verify_admin.ejs'),
            redirect: '/admin-verified',
            user: userInstance
          };
          if (process.env.API_PORT_PROXY) {
            options.port = '80';
            /* If the URL is http, then reading loopback/common/models/user.js,
             * verifyOptions.protocol must be http and port=='80' should set
             * displayPort to '' and hence verifyHref to have no port.
             */
          }


          userInstance.verify(options, null, function(err, response) {
            if (err) return next(err);

            //Redirect to prevent the user from being verified by loopback
            let res = context.res;
            res.redirect('/access-request');
            return;
          });
        });
        
      } else {
        next(new Error('Email could not be sent, missing configuration'));
      }
    } else {
      next();
    }
  });

  Client.afterRemote('confirm', function(context, result, next) {
    if (process.env.EMAIL_VERIFY == 'ADMIN' && context.args.redirect == '/admin-verified') {
      // Notify user that admin has accepted their access request
      if (process.env.EMAIL_ACTIVE == 'true') {
        Client.findById(context.args.uid).then(function(userInstance) {
          var template = loopback.template(path.resolve(__dirname, '../../server/views/access_granted.ejs'));
          let
          /** if node app server is behind a proxy (e.g. nginx, for
           * https) then the req.host will be simply localhost;
           * in that case use API_HOST.
           */
          apiHost = 
            process.env.API_PORT_PROXY ? process.env.API_HOST : context.req.host,
          /** If behind a proxy then the port will be default (80)
           * expressed as ''.  Otherwise API_PORT_EXT is used.
           *
           * (If running node app server within docker then the API
           * port external to docker is API_PORT_EXT, and hence the
           * name suffix _EXT; the internal port is generally the same
           * and the same env var is used.)
           * Related : reset_href, verifyHref.
           */
          login_url = 
            context.req.protocol + '://' + apiHost +
            (process.env.API_PORT_PROXY ? '' : ':' + process.env.API_PORT_EXT) +
            '/login';
          var html = template({
            email_recipient: userInstance.email,
            login_url
          });

          Client.app.models.Email.send({
            to: userInstance.email,
            from: process.env.EMAIL_FROM,
            subject: 'Welcome to Pretzel',
            html: html,
          }, function(err) {
            if (err) {
              console.log(err);
              console.log('> error sending access granted notification email');
              return;
            }
            console.log('> sending access granted notification email to:', userInstance.email);
          });
        });
      }
    }
    next();
  });

  Client.on('resetPasswordRequest', function (info) {
    if (process.env.EMAIL_ACTIVE == 'true'){
      var url = 'http://' + process.env.API_HOST +
        (process.env.API_PORT_PROXY ? '' : ':' + process.env.API_PORT_EXT)
        + '/reset-password';
      var reset_href = url + '?access_token=' + info.accessToken.id;

      // when preparing non-standard emails, the template must
      // be built and provided as html to the send function
      let templateConfig = {
        email_recipient: info.email, // for template
        reset_href: reset_href, // for template
      }

      var template = loopback.template(path.resolve(__dirname, '../../server/views/password_reset.ejs'));
      var html = template(templateConfig);

      // requires AccessToken.belongsTo(User)
      // info.accessToken.user(function (err, user) {
      //   console.log(user); // the actual user
      // });

      Client.app.models.Email.send({
        to: info.email,
        from: process.env.EMAIL_FROM,
        subject: 'Pretzel Password Reset Request',
        html: html,
      }, function(err) {
        if (err) {
          console.log(err);
          console.log('> error sending password reset email');
          return;
        }
        console.log('> sending password reset email to:', info.email);
      });
    } else {
      // TODO should a 404 response be sent for this request?
      console.log('reset password request, no email sent')
    }
  });

  acl.assignRulesRecord(Client);
  // acl.limitRemoteMethodsRelated(Client)

  // Client.disableRemoteMethodByName("create");
  Client.disableRemoteMethodByName("upsert");
  Client.disableRemoteMethodByName("updateAll");
  Client.disableRemoteMethodByName("prototype.updateAttributes");

  Client.disableRemoteMethodByName("find");
  // Client.disableRemoteMethodByName("findById");
  Client.disableRemoteMethodByName("findOne");

  Client.disableRemoteMethodByName("deleteById");

  Client.disableRemoteMethodByName("createChangeStream");

  // Client.disableRemoteMethodByName("confirm"); // this method is required for user auth handling
  Client.disableRemoteMethodByName("count");
  Client.disableRemoteMethodByName("exists");
  // Client.disableRemoteMethodByName("resetPassword");
  Client.disableRemoteMethodByName("upsertWithWhere");
};
