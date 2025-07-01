/**
 * This module implements a client for Glooko's REST API.  It is used by
 * the Glooko source module to authenticate with and fetch data from
 * Glooko's servers.
 */

const axios = require('axios');
const tough = require('tough-cookie');

// The Glooko host URL that REST API endpoints are relative to
const baseUrl = (() => {

  // api.glooko.com by default, or eu.api.glooko.com for EU users.
  const glookoServerSetting =
    process.env['CONNECT_GLOOKO_SERVER'] || 'default';

  const glookoServer =
    glookoServerSetting === 'default' ?
    'api.glooko.com' :
    glookoServerSetting;

  return `https://${glookoServer}`;
})();

// A reusable HTTP client with common settings configured
const http = axios.create({
  baseURL: baseUrl
  , maxRedirects: 0
  , headers: {
    'Accept': 'application/json'
    , 'User-Agent': 'Mozilla/5.0 (compatible; nightscout-connect; +https://github.com/nightscout/nightscout-connect)'
  }
});


/**
 * Signs into a Glooko account using an email address and password to
 * retrieve a session cookie.
 *
 * @param {string} email     The Glooko account's email address
 * @param {string} password  The Glooko account's password
 *
 * @return {promise<string>} A promise containing a session cookie
 */
const createSession = (email, password) => {

  const requestBody = {
    "userLogin": {
      "email": email
      , "password": password
    }
    , "deviceInformation": {
      "applicationType": "logbook"
      , "os": "android"
      , "osVersion": "33"
      , "device": "Google Pixel 4a"
      , "deviceManufacturer": "Google"
      , "deviceModel": "Pixel 4a"
      , "serialNumber": "ab43bfjdj3423421fb"
      , "clinicalResearch": false
      , "deviceId": "716c34bac673f4b9"
      , "applicationVersion": "6.1.3"
      , "buildNumber": "0"
      , "gitHash": "g4fbed2011b"
    }
  };

  return http.post(
      '/api/v2/users/sign_in'
      , requestBody
      , {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    .then((response) => {
      const sessionCookie =
        (response.headers['set-cookie'] || [])
        .map(tough.parse)
        .map((x) => x.cookieString())
        .join('; ');
      return sessionCookie;
    })
    .catch((error) => {
      console.error('Glooko API: Error signing in', error)
    });
};

/**
 * Retrieves a patient's identifier to use with Glooko's data retrieval
 * APIs.
 *
 * @param {string} cookie    The session cookie
 *
 * @return {promise<string>} The patient's identifier
 */
const getGlookoCode = (cookie) => {
  return http.get('/api/v3/session/users', {
      headers: {
        'Cookie': cookie
        , 'Accept': 'application/json'
      , }
    , })
    .then(function(response) {
      return response.data.currentPatient.glookoCode;
    })
    .catch(function(error) {
      console.error('Glooko API: Error retrieving session info', error);
    });
};

/**
 * Signs into a Glooko account using an email address and password and
 * retrieves both a session cookie and a patient's identifier to use
 * with Glooko's data retrieval APIs.
 *
 * @param {string} email     The Glooko account's email address
 * @param {string} password  The Glooko account's password
 *
 * @return {promise<session>} A promise containing an object containing
 *     the session cookie and the patient's identifier
 */
const signIn = (email, password) => {
  return createSession(email, password)
    .then((cookie) => {
      return getGlookoCode(cookie)
        .then((glookoCode) => {
          return {
            cookie: cookie
            , glookoCode: glookoCode
          };
        });
    });
};

/**
 * Retrieves data from the given Glooko API endpoint.
 *
 * @param {string} endpoint   The Glooko REST API endpoint to call
 * @param {string} cookie     An authenticated session cookie
 * @param {string} glookoCode A patient identifier
 * @param {string} lastKnown  The time in milliseconds, of the last
 *     time this data was retrieved (optional)
 *
 * @return {promise<object>}  The raw response data from Glooko
 */
const fetch = (endpoint, cookie, glookoCode, lastKnown) => {

  // This is a hardcoded, random guid; there are no Glooko docs to
  // explain the need for this param or why random data works
  const lastGuid = "1e0c094e-1e54-4a4f-8e6a-f94484b53789"

  const twoDaysAgo = new Date().getTime() - (2 * 24 * 60 * 60 * 1000);
  var lastMillis = Math.max(twoDaysAgo, (lastKnown && lastKnown.entries) ? lastKnown.entries.getTime() : twoDaysAgo);
  var lastGlucoseAt = new Date(lastMillis);
  var maxCount = Math.ceil(((new Date()).getTime() - lastMillis) / (1000 * 60 * 5));
  var minutes = 5 * maxCount;
  var lastUpdatedAt = lastGlucoseAt.toISOString();
  var body = {};
  var params = {
    lastGuid: lastGuid
    , lastUpdatedAt
    , limit: maxCount
  , };

  const myDate = new Date();
  const startDate = new Date(twoDaysAgo);

  const url = `${endpoint}?patient=${glookoCode}&startDate=${startDate.toISOString()}&endDate=${myDate.toISOString()}`;

  var requestHeaders = {
    'Cookie': cookie
  };

  return axios
    .get(url, {
      baseURL: baseUrl
      , headers: requestHeaders
      , params: params
    })
    .then((resp) => resp.data)
    .catch((error) => console.error('Glooko API: Axios error', error));
};

/**
 * Retrieves CGM readings from Glooko.
 *
 * @param {string} cookie     An authenticated session cookie
 * @param {string} glookoCode A patient identifier
 * @param {string} lastKnown  The time in milliseconds, of the last
 *     time this data was retrieved (optional)
 *
 * @return {promise<object>}  The raw CGM readings data from Glooko
 */
const getCgmReadings = (cookie, glookoCode, lastKnown) => {
  return fetch('/api/v2/cgm/readings', cookie, glookoCode, lastKnown);
};

/**
 * Retrieves normal boluses from Glooko.
 *
 * @param {string} cookie     An authenticated session cookie
 * @param {string} glookoCode A patient identifier
 * @param {string} lastKnown  The time in milliseconds, of the last
 *     time this data was retrieved (optional)
 *
 * @return {promise<object>}  The raw boluses data from Glooko
 */
const getNormalBoluses = (cookie, glookoCode, lastKnown) => {
  return fetch('/api/v2/pumps/normal_boluses', cookie, glookoCode, lastKnown);
};

/**
 * Retrieves scheduled basals from Glooko.
 *
 * @param {string} cookie     An authenticated session cookie
 * @param {string} glookoCode A patient identifier
 * @param {string} lastKnown  The time in milliseconds, of the last
 *     time this data was retrieved (optional)
 *
 * @return {promise<object>}  The raw basals data from Glooko
 */
const getScheduledBasals = (cookie, glookoCode, lastKnown) => {
  return fetch('/api/v2/pumps/scheduled_basals', cookie, glookoCode, lastKnown);
};

/**
 * This module exports the sign-in and data retrieval endpoints, as well
 * as the http client so it can be passed to the Axios tracer for
 * tracking.
 */
module.exports = {
  signIn: signIn
  , getCgmReadings: getCgmReadings
  , getNormalBoluses: getNormalBoluses
  , getScheduledBasals: getScheduledBasals
  , http: http
};