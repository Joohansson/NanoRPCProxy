const Fetch = require('node-fetch')
const Promise =       require('promise')

// Custom error class
class APIError extends Error {
  constructor(code, ...params) {
    super(...params)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError)
    }
    this.name = 'APIError'
    // Custom debugging information
    this.code = code
  }
}

// Functions to be required from another file
module.exports = {
  // Post data, for example to RPC node
  getData: async function (server, timeout) {
    options = {
      method: 'get',
      timeout: timeout,
    }

    return new Promise(async (resolve, reject) => {
        // https://www.npmjs.com/package/node-fetch
        Fetch(server, options)
          .then(checkStatus)
          .then(res => res.json())
          .then(json => resolve(json))
          .catch(err => reject(new Error('Connection error: ' + err)))
    })
  },
  // Post data, for example to RPC node
  postData: async function (data, server, timeout) {
    options = {
      method: 'post',
      body:    JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      timeout: timeout,
    }

    return new Promise(async (resolve, reject) => {
        // https://www.npmjs.com/package/node-fetch
        Fetch(server, options)
          .then(checkStatus)
          .then(res => res.json())
          .then(json => resolve(json))
          .catch(err => reject(new Error('Connection error: ' + err)))
    })
  },
  // Check if a string is a valid JSON
  isValidJson: function (obj) {
    if (obj != null) {
      try {
          JSON.parse(JSON.stringify(obj))
          return true
      } catch (e) {
        return false
      }
    }
    else  {
      return false
    }
  }
}

function checkStatus(res) {
    if (res.ok) { // res.status >= 200 && res.status < 300
        return res
    } else {
        throw APIError(res.statusText)
    }
}
