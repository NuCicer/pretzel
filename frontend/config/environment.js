"use strict";

module.exports = function (environment) {
  const env = process.env;
  var ENV = {
    modulePrefix: "pretzel-frontend",
    environment: environment,
    apiHost: process.env.API_URL || "http://localhost:5000",
    apiNamespace: "api",
    rootURL: "/pretzel",
    locationType: "auto",
    handsOnTableLicenseKey: null,

    "ember-local-storage": {
      namespace: true,
    },
    EmberENV: {
      FEATURES: {},
      EXTEND_PROTOTYPES: {
        Date: false,
      },
    },
    "ember-simple-auth": {},

    APP: {},
  };

  if (environment === "development") {
    if (env.germinate_username) {
      const username = env.germinate_username,
        password = env.germinate_password;
      ENV.germinate = { username, password };
    }
  }

  if (environment === "test") {
    // Testem prefers this...
    ENV.locationType = "none";

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = "#ember-testing";
    ENV.APP.autoboot = false;
  }

  if (environment === "production") {
    // here you can enable a production-specific feature
    //--------------------------------------------------------------------------
    // Added for Pretzel :
    ENV.rootURL = "/pretzel";
    ENV.apiHost = "/pretzel";
  }
  /** If handsOnTableLicenseKey is defined in the environment of npm / ember,
   * HandsOnTable is used for the spreadsheet-style tables in :
   *  components/panel/paths-table.js
   *  components/panel/upload/data-csv.js
   *  components/table-brushed.js
   * otherwise ember-contextual-table is used.
   *
   * In the last non-commercial HandsOnTable version 6.2.2, multiColumnSorting
   * is present but didn't work with 'multiColumnSorting:true'; it is fine for
   * all other features used.  To use this version, change "handsontable"
   * version dependency in frontend/bower.json (later this will be in
   * package.json)
   *
   * Also see : https://handsontable.com/blog/articles/2019/3/handsontable-drops-open-source-for-a-non-commercial-license
   * https://handsontable.com/docs/7.4.2/tutorial-license-key.html
   */
  ENV.handsOnTableLicenseKey = process.env.handsOnTableLicenseKey;

  return ENV;
};
