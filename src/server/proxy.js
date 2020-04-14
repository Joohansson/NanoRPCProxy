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
var users = []                      // a list of base64 user/password credentials
var node_url = 'http://[::1]:7076'  // nano node RPC url (default for beta network is 'http://[::1]:55000')
var http_port = 9950                // port to listen on for http (enabled default with use_http)
var https_port = 9951               // port to listen on for https (disabled default with use_https)
var max_request_count = 500         // max count of various rpc responses like pending transactions
var use_auth = false                // if require username and password when connecting to proxy
var use_speed_limiter = false       // if slowing down IPs when they request above set limit (defined in speed_limiter)
var use_ip_block = false            // if blocking IPs for a certain amount of time when they request above set limit (defined in ip_block)
var use_cache = false               // if caching certain commands set in cached_commands
var use_http = true                 // listen on http (active by default)
var use_https = false               // listen on https (inactive by default) (a valid cert and key file is needed via https_cert and https_key)
var use_output_limiter = false      // if limiting number of response objects, like pending transactions, to a certain max amount set in limited_commands. Only supported for RPC actions that have a "count" key
var https_cert = ""                 // file path for pub cert file
var https_key = ""                  // file path for private key file
var allowed_commands = []           // only allow RPC actions in this list
var cached_commands = []            // a list of commands [key] that will be cached for corresponding duration in seconds as [value]
var limited_commands = []           // a list of commands [key] to limit the output response for with max count as [value]
var speed_limiter = {}              // contains the settings for slowing down clients with speed limiter
var ip_block = {}                   // contains the settings for blocking IP that does too many requests
var log_level = log_levels.none     // the log level to use (startup info is always logged): none=zero active logging, warning=only errors/warnings, info=both errors/warnings and info

// default vars
cache_duration_default = 60
var rpcCache = null
var cacheKeys = []
var user_settings = {}

var user_use_cache = null
var user_use_output_limiter = null
var user_allowed_commands = null
var user_cached_commands = null
var user_limited_commands = null
var user_log_level = null

// Read credentials from file
// ---
try {
  const creds = JSON.parse(fs.readFileSync('creds.json', 'UTF-8'))
  users = creds.users
}
catch(e) {
  console.log("Could not read creds.json", e)
}
// ---

// Read settings from file
// ---
try {
  const settings = JSON.parse(fs.readFileSync('settings.json', 'UTF-8'))
  node_url = settings.node_url
  http_port = settings.http_port
  https_port = settings.https_port
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
  speed_limiter = settings.speed_limiter
  ip_block = settings.ip_block

  // Clone default settings for custom user specific vars, to be used if no auth
  if (!use_auth) {
    user_use_cache = use_cache
    user_use_output_limiter = use_output_limiter
    user_allowed_commands = allowed_commands
    user_cached_commands = cached_commands
    user_limited_commands = limited_commands
    user_log_level = log_level
  }
}
catch(e) {
  console.log("Could not read settings.json", e)
}
// ---

// Read user settings from file, override default settings if they exist for specific users
// ---
try {
  user_settings = JSON.parse(fs.readFileSync('user_settings.json', 'UTF-8'))
}
catch(e) {
  console.log("Could not read user_settings.json", e)
}
// ---

// Log all initial settings for convenience
// ---
console.log("Node url: " + node_url)
console.log("Http port: " + String(http_port))
console.log("Https port: " + String(https_port))
console.log("Use authentication: " + use_auth)
console.log("Use speed limiter: " + use_speed_limiter)
console.log("Use IP block: " + use_ip_block)
console.log("Use cached requests: " + use_cache)
console.log("Use output limiter: " + use_output_limiter)
console.log("Listen on http: " + use_http)
console.log("Listen on https: " + use_https)

log_string = "Allowed commands:\n"
for (const [key, value] of Object.entries(allowed_commands)) {
  log_string = log_string + value + "\n"
}
console.log(log_string)

if (use_cache) {
  log_string = "Cached commands:\n"
  for (const [key, value] of Object.entries(cached_commands)) {
    log_string = log_string + key + " : " + value + "\n"
  }
  console.log(log_string)
}

if (use_output_limiter) {
  log_string = "Limited commands:\n"
  for (const [key, value] of Object.entries(limited_commands)) {
    log_string = log_string + key + " : " + value + "\n"
  }
  console.log(log_string)
}

if (use_speed_limiter) {
  log_string = "Speed limiter settings:\n"
  for (const [key, value] of Object.entries(speed_limiter)) {
    log_string = log_string + key + " : " + value + "\n"
  }
  console.log(log_string)
}

if (use_ip_block) {
  log_string = "IP block settings:\n"
  for (const [key, value] of Object.entries(ip_block)) {
    log_string = log_string + key + " : " + value + "\n"
  }
  console.log(log_string)
}

console.log("Log level: " + log_level)
// ---

// Define the proxy app
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('static'))

// Define authentication service
if (use_auth) {
  app.use(basicAuth({ authorizer: myAuthorizer }))
}

// Limit by slowing down requests
if (use_speed_limiter) {
  const speed_limiter_settings = slowDown({
    windowMs: speed_limiter.time_window, // rolling time window in ms
    delayAfter: speed_limiter.request_limit, // allow x requests per time window, then start slowing down
    delayMs: speed_limiter.delay_increment, // begin adding X ms of delay per request when delayAfter has been reached
    maxDelayMs: speed_limiter.max_delay // max delay in ms to slow down
  })
  app.use(speed_limiter_settings)
}

// Block IP if requesting too much
if (use_ip_block) {
  const ip_block_settings = rateLimit({
    windowMs: ip_block.time_window, // rolling time window in ms
    max: ip_block.request_limit, // limit each IP to x requests per windowMs
    message: 'You have sent too many RPC requests. You can try again later.'
  })
  app.use(ip_block_settings)
}

// Set up cache
if (use_cache) {
  rpcCache = new NodeCache( { stdTTL: cache_duration_default, checkperiod: 10 } )
}

// To verify username and password provided via basicAuth. Support multiple users
function myAuthorizer(username, password) {
  // Set default settings specific for authenticated users
  user_use_cache = use_cache
  user_use_output_limiter = use_output_limiter
  user_allowed_commands = allowed_commands
  user_cached_commands = cached_commands
  user_limited_commands = limited_commands
  user_log_level = log_level

  var valid_user = false
  for (const [key, value] of Object.entries(users)) {
    if (basicAuth.safeCompare(username, value.user) & basicAuth.safeCompare(password, value.password)) {
      valid_user = true

      // Override default settings if exists
      for (const [key, value] of Object.entries(user_settings)) {
        // Username found in user_settings
        if (key == username) {
          // Loop all defined user settings for the requesting user
          for (const [key2, value2] of Object.entries(value)) {
            switch (key2) {
              case 'use_cache':
              user_use_cache = value2
              break
              case 'use_output_limiter':
              user_use_output_limiter = value2
              break
              case 'allowed_commands':
              user_allowed_commands = value2
              break
              case 'cached_commands':
              user_cached_commands = value2
              break
              case 'limited_commands':
              user_limited_commands = value2
              break
              case 'log_level':
              user_log_level = value2
              break
            }
          }
          break
        }
      }
      break
    }
  }
  return valid_user
}

// Redirect all bad GET requests to default page
app.get('', (req, res) => res.sendFile(`${__dirname}/index.html`))

// Define the request listener
app.post('/proxy', async (req, res) => {
  logThis('rpc request received: ' + req.body.action, log_levels.info)

  // Block non-allowed RPC commands
  if (!req.body.action || user_allowed_commands.indexOf(req.body.action) === -1) {
    logThis('RPC request is not allowed: ' + req.body.action, log_levels.info)
    return res.status(500).json({ error: `Action ${req.body.action} not allowed`})
  }

  // Read cache for current request action, if there is one
  if (user_use_cache) {
    for (const [key, value] of Object.entries(user_cached_commands)) {
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
  if (user_use_output_limiter) {
    for (const [key, value] of Object.entries(user_limited_commands)) {
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
        for (const [key, value] of Object.entries(user_cached_commands)) {
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
  if (user_log_level == "info" || level == user_log_level) {
    console.log(str)
  }
}
