require('dotenv').config() // load variables from .env into the environment
require('console-stamp')(console)
const NodeCache =     require("node-cache" )
const slowDown =      require("express-slow-down")
const rateLimit =     require("express-rate-limit")
const basicAuth =     require('express-basic-auth')
const http =          require('http')
const https =         require('https')
const fs =            require('fs')
const express =       require('express')
const request =       require('request-promise-native')
const cors =          require('cors')
const { promisify } = require('util')

log_levels = {none:"none", warning:"warning", info:"info"}

// Custom VARS. DON'T CHANGE HERE. Change in settings.json file.
var usr = ''                        // access base64 username
var psw = ''                        // access base64 password
var node_url = 'http://[::1]:7076'  // nano node RPC url (default for beta network is 'http://[::1]:55000')
var http_port = 9950                // port to listen on for http (enabled default with use_http)
var https_port = 9951               // port to listen on for https (disabled default with use_https)
var cache_duration = 60             // how long to store cache if not specified [seconds]
var max_request_count = 500         // max count of various rpc responses like pending transactions
var use_auth = false                // if require username and password when connecting to proxy
var use_speed_limiter = false       // if slowing down IPs when they request above set limit
var use_ip_block = false            // if blocking IPs for a certain amount of time when they request above set limit
var use_cache = false               // if caching certain commands set in cached_commands
var use_output_limiter = false      // if limiting number of response objects, like pending transactions, to a certain max amount set in limited_commands. Only supported for RPC actions that have a "count" key
var use_http = true                 // listen on http (active by default)
var use_https = false               // listen on https (inactive by default) (a valid cert and key file is needed via https_cert and https_key)
var https_cert = ""                 // file path for pub cert file
var https_key = ""                  // file path for private key file
var cached_commands = []            // commands that will be cached with corresponding specified duration in seconds as value
var allowed_commands = []           // only allow RPC actions in this list
var limited_commands = []           // a list of commands to limit the output response for with max count as value
var log_level = log_levels.none     // the log level to use (startup info is always logged): none=zero active logging, warning=only errors/warnings, info=both errors/warnings and info

// default vars
cache_duration_default = 60
var rpcCache = null
var cacheKeys = []

// Read credentials from file
try {
  const creds = JSON.parse(fs.readFileSync('creds.json', 'UTF-8'))
  usr = creds.user
  psw = creds.password
}
catch(e) {
  console.log("Could not read creds.json", e)
}

// Read settings from file
try {
  const settings = JSON.parse(fs.readFileSync('settings.json', 'UTF-8'))
  node_url = settings.node_url
  http_port = settings.http_port
  https_port = settings.https_port
  cache_duration = settings.cache_duration
  use_auth = settings.use_auth
  use_speed_limiter = settings.use_speed_limiter
  use_ip_block = settings.use_ip_block
  use_cache = settings.use_cache
  use_output_limiter = settings.use_output_limiter
  use_http = settings.use_http
  use_https = settings.use_https
  https_cert = settings.https_cert
  https_key = settings.https_key
  cached_commands = settings.cached_commands
  allowed_commands = settings.allowed_commands
  limited_commands = settings.limited_commands
  log_level = settings.log_level
}
catch(e) {
  console.log("Could not read settings.json", e)
}

console.log("Node url: " + node_url)
console.log("Http port: " + String(http_port))
console.log("Https port: " + String(https_port))
console.log("Cache duration: " + String(cache_duration))
console.log("Use authorization: " + use_auth)
console.log("Use speed limiter: " + use_speed_limiter)
console.log("Use IP block: " + use_ip_block)
console.log("Use cached requests: " + use_cache)
console.log("Use output limiter: " + use_output_limiter)
console.log("Listen on http: " + use_http)
console.log("Listen on https: " + use_https)
console.log("Allowed commands:\n", allowed_commands)
if (use_cache) {
  console.log("Cached commands:\n", cached_commands)
}
if (use_output_limiter) {
  console.log("Limited commands:\n", limited_commands)
}
console.log("Log level: " + log_level)

// Define the proxy app
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('static'))
if (use_auth) {
  app.use(basicAuth({ authorizer: myAuthorizer }))
}
if (use_speed_limiter) {
  app.use(speed_limiter)
}
if (use_ip_block) {
  app.use(ip_block)
}
if (use_cache) {
  // Set up cache
  rpcCache = new NodeCache( { stdTTL: cache_duration_default, checkperiod: 10 } )
}

// To verify username and password provided via basicAuth
function myAuthorizer(username, password) {
  return basicAuth.safeCompare(username, usr) & basicAuth.safeCompare(password, psw)
}

// Redirect all bad GET requests to default page
app.get('', (req, res) => res.sendFile(`${__dirname}/index.html`))

// Define the request listener
app.post('/api/node', async (req, res) => {
  logThis('rpc request received: ' + req.body.action, log_levels.info)

  // Block non-allowed RPC commands
  if (!req.body.action || allowed_commands.indexOf(req.body.action) === -1) {
    logThis('RPC request is not allowed: ' + req.body.action, log_levels.info)
    return res.status(500).json({ error: `Action ${req.body.action} not allowed`})
  }

  // Read cache for current request action, if there is one
  if (use_cache) {
    for (const [key, value] of Object.entries(cached_commands)) {
      if (req.body.action === key) {
        const cachedValue = rpcCache.get(key)
        if (isValidJson(cachedValue)) {
          logThis("Cache requested: " + key, log_levels.info)
          return res.json(cachedValue)
        }
        break
      }
    }
  }

  // Limit response count
  if (use_output_limiter) {
    for (const [key, value] of Object.entries(limited_commands)) {
      if (req.body.action === key) {
        if (parseInt(req.body.count) > value) {
          logThis("Response count was limited to " + value.toString(), log_levels.info)
          req.body.count = value
        }
      }
    }
  }

  // Send the request to the Nano node and return the response
  request({ method: 'post', uri: node_url, body: req.body, json: true })
    .then(async (proxyRes) => {
      if (!isValidJson(proxyRes)) {
        logThis("Bad json response from the node", log_levels.warning)
        res.status(500).json({error: "Bad json response from the node"})
        return
      }
      // Save cache if applicable
      if (use_cache) {
        for (const [key, value] of Object.entries(cached_commands)) {
          if (req.body.action === key) {
            // Store the response (proxyRes) in cache with key (action name) with a TTL=value
            if (!rpcCache.set(key, proxyRes, value)) {
              logThis("Failed saving cache for " + key, log_levels.warning)
            }
            break
          }
        }
      }
      res.json(proxyRes) // sending back json response
    })
    .catch(err => res.status(500).json(err.toString()))
})

// Create an HTTP service
if (use_http) {
  console.log("Starting http server")
  http.createServer(app).listen(http_port)
}

// Create an HTTPS service
if (use_https) {
  // Verify that cert files exists
  var cert_exists = false
  var key_exists = false
  fs.access(https_cert, fs.F_OK, (err) => {
    if (err) {
      console.log("Warning: Https cert file does not exist!")
    }
    cert_exists = true
  })
  fs.access(https_key, fs.F_OK, (err) => {
    if (err) {
      console.log("Warning: Https key file does not exist!")
    }
    key_exists = true
  })
  if (cert_exists && key_exists) {
    var https_options = {
      cert: fs.readFileSync(https_cert),
      key: fs.readFileSync(https_key)
    }
    console.log("Starting https server")
    https.createServer(https_options, app).listen(https_port)
  }
  else {
    console.log("Warning: Will not listen on https!")
  }
}

// Check if a string is a valid JSON
function isValidJson(obj) {
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

// Log function
function logThis(str, level) {
  if (log_level == "info" || level == log_level) {
    console.log(str)
  }
}
