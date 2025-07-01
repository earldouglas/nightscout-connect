/**
 * This file tests the Glooko REST API client implementation, maintained
 * in `lib/sources/glooko/api.js`, in isolation from the rest of the
 * project's components.
 */
const glookoApi = require('../../../lib/sources/glooko/api.js');
const assert = require('assert');

describe('Glooko API', () => {

  var session = null;

  /**
   * Sign in to Glooko using the standard `CONNECT_GLOOKO_EMAIL` and
   * `CONNECT_GLOOKO_PASSWORD` environment variables, and make sure we
   * get back a session with both a cookie and a patient identifier.
   *
   * Save the session for use in the data retrieval tests below.
   */
  describe('signIn()', () => {
    it('should create a valid session', () => {

      const glookoEmail = process.env['CONNECT_GLOOKO_EMAIL'];
      assert.ok(glookoEmail, 'CONNECT_GLOOKO_EMAIL must be set');

      const glookoPassword = process.env['CONNECT_GLOOKO_PASSWORD'];
      assert.ok(glookoPassword, 'CONNECT_GLOOKO_PASSWORD must be set');

      return glookoApi
        .signIn(glookoEmail, glookoPassword)
        .then((x) => {
          session = x;
        }).then(() => {
          assert.ok(session.cookie.startsWith('_logbook-web_session='));
          assert.ok(session.glookoCode.length > 0);
          return session;
        });
    });
  });

  const lastKnown = null;

  /**
   * Retrieve CGM readings from Glooko using the session created above.
   */
  describe('getCgmReadings()', () => {
    it('should retrieve cgm readings', () => {
      assert.ok(session, 'session must be valid');
      return glookoApi
        .getCgmReadings(session.cookie, session.glookoCode, lastKnown)
        .then((result) => {
          assert.ok(Array.isArray(result.readings));
        });
    });
  });

  /**
   * Retrieve normal boluses from Glooko using the session created
   * above.
   */
  describe('getNormalBoluses()', () => {
    it('should retrieve normal boluses', () => {
      assert.ok(session, 'session must be valid');
      return glookoApi
        .getNormalBoluses(session.cookie, session.glookoCode, lastKnown)
        .then((result) => {
          assert.ok(Array.isArray(result.normalBoluses));
        });
    });
  });

  /**
   * Retrieve scheduled basals from Glooko using the session created
   * above.
   */
  describe('getScheduledBasals()', () => {
    it('should retrieve scheduled basals', () => {
      assert.ok(session, 'session must be valid');
      return glookoApi
        .getScheduledBasals(session.cookie, session.glookoCode, lastKnown)
        .then((result) => {
          assert.ok(Array.isArray(result.scheduledBasals));
        });
    });
  });

});