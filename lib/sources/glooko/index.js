/*
*
* https://github.com/jonfawcett/glooko2nightscout-bridge/blob/master/index.js#L146
* Authors:
* Jeremy Pollock
* https://github.com/jpollock
* Jon Fawcett
* and others.
*/

var qs = require('qs');
var url = require('url');
var uid = require('uid');

var helper = require('./convert');
const glookoApi = require('./api.js');

function glookoSource (opts, axios) {
  var impl = {
    authFromCredentials ( ) {
      return glookoApi
        .signIn(opts.glookoEmail, opts.glookoPassword)
        .then((session) => {
          return {
            cookies: session.cookie,
            user: {
              userLogin: {
                glookoCode: session.glookoCode
              }
            }
          };
        });
    },
    sessionFromAuth (auth) {
      return Promise.resolve(auth);
    },
    dataFromSesssion (session, last_known) {
      return Promise.all([
        glookoApi.getScheduledBasals(last_known),
        glookoApi.getNormalBoluses(last_known),
        glookoApi.getCgmReadings(last_known),
        ]).then(function (results) {
         return {
           scheduledBasals: results[0].scheduledBasals
           , normalBoluses: results[1].normalBoluses
           , readings: results[2].readings
         };
        });
    },
    align_to_glucose ( ) {
      // TODO
    },
    transformData (batch) {
      // TODO
      console.log('GLOOKO passing batch for transforming');
      //console.log("TODO TRANSFORM", batch);
      var treatments = helper.generate_nightscout_treatments(batch, opts.glookoTimezoneOffset);
      return { entries: [ ], treatments };
    },
  };
  function tracker_for ( ) {
    var AxiosTracer = require('../../trace-axios');
    var tracker = AxiosTracer(glookoApi.http);
    return tracker;
  }
  function generate_driver (builder) {
    builder.support_session({
      authenticate: impl.authFromCredentials,
      authorize: impl.sessionFromAuth,
      // refresh: impl.refreshSession,
      delays: {
        REFRESH_AFTER_SESSSION_DELAY: (1000 * 60 * 60 * 24 * 1) - 600000,
        EXPIRE_SESSION_DELAY: 1000 * 60 * 60 * 24 * 1,
      }
    });

    builder.register_loop('Glooko', {
      tracker: tracker_for,
      frame: {
        impl: impl.dataFromSesssion,
        align_schedule: impl.align_to_glucose,
        transform: impl.transformData,
        backoff: {
        // wait 2.5 minutes * 2^attempt
          interval_ms: 2.5 * 60 * 1000

        },
        // only try 3 times to get data
        maxRetries: 1
      },
      // expect new data 5 minutes after last success
      expected_data_interval_ms: 5 * 60 * 1000,
      backoff: {
        // wait 2.5 minutes * 2^attempt
        interval_ms: 2.5 * 60 * 1000
      },
    });
    return builder;
  }
  impl.generate_driver = generate_driver;
  return impl;
}

glookoSource.validate = function validate_inputs (input) {
  var ok = false;

  const offset = !isNaN(input.glookoTimezoneOffset) ? input.glookoTimezoneOffset * -60 * 60 * 1000 : 0
  console.log('GLOOKO using ms offset:', offset, input.glookoTimezoneOffset);

  var config = {
    glookoEnv: input.glookoEnv,
    glookoServer: input.glookoServer,
    glookoEmail: input.glookoEmail,
    glookoPassword: input.glookoPassword,
    glookoTimezoneOffset: offset,
  };
  var errors = [ ];
  if (!config.glookoEmail) {
    errors.push({desc: "The Glooko User Login Email is required.. CONNECT_GLOOKO_EMAIL must be an email belonging to an active Glooko User to log in.", err: new Error('CONNECT_GLOOKO_EMAIL') } );
  }
  if (!config.glookoPassword) {
    errors.push({desc: "Glooko User Login Password is required. CONNECT_GLOOKO_PASSWORD must be the password for the Glooko User Login.", err: new Error('CONNECT_GLOOKO_PASSWORD') } );
  }
  ok = errors.length == 0;
  config.kind = ok ? 'glooko' : 'disabled';
  return { ok, errors, config };
}
module.exports = glookoSource;
