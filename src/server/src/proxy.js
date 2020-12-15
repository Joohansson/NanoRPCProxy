require('dotenv').config() // load variables from .env into the environment
require('console-stamp')(console)
const test_override_http = !process.env.OVERRIDE_USE_HTTP

const NodeCache =             require("node-cache" )
const SlowDown =              require("express-slow-down")
const BasicAuth =             require('express-basic-auth')
const Http =                  require('http')
const Https =                 require('https')
const Fs =                    require('fs')
const Express =               require('express')
const Cors =                  require('cors')
const IpFilter =              require('express-ipfilter').IpFilter
const IpDeniedError =         require('express-ipfilter').IpDeniedError
const Promise =               require('promise')
const Schedule =              require('node-schedule')
const WebSocketServer =       require('websocket').server
const ReconnectingWebSocket = require('reconnecting-websocket')
const WS =                    require('ws')
const Helmet =                require('helmet')
const Dec =                   require('bigdecimal') //https://github.com/iriscouch/bigdecimal.js
const RemoveTrailingZeros =   require('remove-trailing-zeros')
const Tokens =                require('./tokens')
const Tools =                 require('./tools')
const log_levels = {none:"none", warning:"warning", info:"info"}
const { RateLimiterMemory, RateLimiterUnion } = require('rate-limiter-flexible')

// lowdb init
const Low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const Adapter = new FileSync('db.json')
const Adapter2 = new FileSync('websocket.json')
const order_db = Low(Adapter)
const tracking_db = Low(Adapter2)
order_db.defaults({orders: []}).write()
tracking_db.defaults({users: []}).write()
tracking_db.update('users', n => []).write() //empty db on each new run

// Custom VARS. DON'T CHANGE HERE. Change in settings.json file.
var users = []                      // a list of base64 user/password credentials
var node_url = 'http://[::1]:7076'  // nano node RPC url (default for beta network is 'http://[::1]:55000')
var node_ws_url = "ws://127.0.0.1:57000" // node websocket server (only used if activated with use_websocket)
var http_port = 9950                // port to listen on for http (enabled default with use_http)
var https_port = 9951               // port to listen on for https (disabled default with use_https)
var websocket_http_port = 9952      // port to listen on for http websocket connection (only used if activated with use_websocket)
var websocket_https_port = 9953     // port to listen on for https websocket connection (only used if activated with use_websocket)
var request_path = '/proxy'         // Prefix in the request path, e.g. '/proxy' for 'https://server:port/proxy'
var use_auth = false                // if require username and password when connecting to proxy
var use_slow_down = false           // if slowing down requests for IPs doing above set limit (defined in slow_down)
var use_rate_limiter = false        // if blocking IPs for a certain amount of time when they request above set limit (defined in rate_limiter)
var use_cache = false               // if caching certain commands set in cached_commands
var use_http = true                 // listen on http (active by default)
var use_https = false               // listen on https (inactive by default) (a valid cert and key file is needed via https_cert and https_key)
var use_output_limiter = false      // if limiting number of response objects, like pending transactions, to a certain max amount set in limited_commands. Only supported for RPC actions that have a "count" key
var use_ip_blacklist = false        // if blocking access to IPs listed in ip_blacklist
var use_tokens = false              // if activating the token system for purchase via Nano
var use_websocket = false           // if enable subscriptions on the node websocket (protected by the proxy)
var use_cors = true                 // if handling cors policy here, if not taken care of in upstream proxy (cors_whitelist=[] means allow ANY ORIGIN)
var use_dpow = false                // if allow work_generate to be done by dPoW instead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "network current" will be used. (bpow will be used primary to dpow) (requires work_generate in allowed_commands and credentials to be set in pow_creds.json)
var use_bpow = false                // if allow work_generate to be done by BoomPoW intead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "network current" will be used. (bpow will be used primary to dpow) (requires work_generate in allowed_commands and credentials to be set in pow_creds.json)
var https_cert = ""                 // file path for pub cert file
var https_key = ""                  // file path for private key file
var allowed_commands = []           // only allow RPC actions in this list
var cached_commands = []            // a list of commands [key] that will be cached for corresponding duration in seconds as [value]
var limited_commands = []           // a list of commands [key] to limit the output response for with max count as [value]
var slow_down = {}                  // contains the settings for the slow down filter
var rate_limiter = {}               // contains the settings for the rate limiter
var ddos_protection = {}            // contains the settings for the ddos protection
var log_level = log_levels.none     // the log level to use (startup info is always logged): none=zero active logging, warning=only errors/warnings, info=both errors/warnings and info
var ip_blacklist = []               // a list of IPs to deny always
var proxy_hops = 0                  // if the NanoRPCProxy is behind other proxies such as apache or cloudflare the source IP will be wrongly detected and the filters will not work as intended. Enter the number of additional proxies here.
var websocket_max_accounts = 100    // maximum number of accounts allowed to subscribe to for block confirmations
var cors_whitelist = []             // whitelist requester ORIGIN for example https://mywallet.com or http://localhost:8080 (require use_cors) [list of hostnames]
var disable_watch_work = false      // forcefully set watch_work=false for process calls (to block node from doing rework)

// default vars
let cache_duration_default = 60
var rpcCache = null
var user_settings = {}
const price_url = 'https://api.coinpaprika.com/v1/tickers/nano-nano'
//const price_url2 = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=1567'
//const CMC_API_KEY = 'xxx'
const API_TIMEOUT = 10000 // 10sec timeout for calling http APIs
const work_threshold_default = 'fffffff800000000'
const work_default_timeout = 10 // x sec timeout before trying next delegated work method (only when use_dpow or use_bpow)
const bpow_url = 'https://bpow.banano.cc/service/'
const dpow_url = 'https://dpow.nanocenter.org/service/'
const work_token_cost = 10 // work_generate will consume x token points
var ws = null
var global_tracked_accounts = [] // the accounts to track in websocket (synced with database)
var websocket_connections = {} // active ws connections

var user_use_cache = null
var user_use_output_limiter = null
var user_allowed_commands = null
var user_cached_commands = null
var user_limited_commands = null
var user_log_level = null
var dpow_user = null
var dpow_key = null
var bpow_user = null
var bpow_key = null

// track daily requests and save to a log file (daily stat is reset if the server is restarted)
// ---
var rpcCount = 0
var logdata = []
try {
  // read latest count from file
  logdata = JSON.parse(Fs.readFileSync('request-stat.json', 'UTF-8'))
  rpcCount = logdata[logdata.length - 1].count
}
catch(e) {
  console.log("Could not read request-stat.json. Normal for first run.", e)
}

// save the stat file first time
if (logdata.length == 0) {
  try {
    // write log file
    Fs.writeFileSync('request-stat.json', JSON.stringify(logdata, null, 2))
  }
  catch(e) {
    console.log("Could not write request-stat.json", e)
  }
}

// Stat file scheduler
Schedule.scheduleJob('0 0 * * *', () => {
  appendFile(rpcCount)
  rpcCount = 0
  // update latest logdata from file
  try {
    logdata = JSON.parse(Fs.readFileSync('request-stat.json', 'UTF-8'))
  }
  catch(e) {
    console.log("Could not read request-stat.json.", e)
  }
})
function appendFile(count) {
  try {
    // append new count entry
    let datestring = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
    logdata.push({"date":datestring,"count":rpcCount})

    // write updated log
    Fs.writeFileSync('request-stat.json', JSON.stringify(logdata, null, 2))
    logThis("The request stat file was updated!", log_levels.info)
  }
  catch(e) {
    console.log("Could not write request-stat.json", e)
  }
}
// ---

// Read credentials from file
// ---
try {
  const creds = JSON.parse(Fs.readFileSync('creds.json', 'UTF-8'))
  users = creds.users
}
catch(e) {
  console.log("Could not read creds.json", e)
}
// ---

// Read settings from file
// ---
try {
  const settings = JSON.parse(Fs.readFileSync('settings.json', 'UTF-8'))
  node_url = settings.node_url
  node_ws_url = settings.node_ws_url
  http_port = settings.http_port
  https_port = settings.https_port
  request_path = settings.request_path
  websocket_http_port = settings.websocket_http_port
  websocket_https_port = settings.websocket_https_port
  use_auth = settings.use_auth
  use_slow_down = settings.use_slow_down
  use_rate_limiter = settings.use_rate_limiter
  use_cache = settings.use_cache
  use_output_limiter = settings.use_output_limiter
  use_http = settings.use_http
  use_https = settings.use_https
  use_ip_blacklist = settings.use_ip_blacklist
  use_tokens = settings.use_tokens
  use_websocket = settings.use_websocket
  use_cors = settings.use_cors
  use_dpow = settings.use_dpow
  use_bpow = settings.use_bpow
  https_cert = settings.https_cert
  https_key = settings.https_key
  cached_commands = settings.cached_commands
  allowed_commands = settings.allowed_commands
  limited_commands = settings.limited_commands
  log_level = settings.log_level
  slow_down = settings.slow_down
  rate_limiter = settings.rate_limiter
  ddos_protection = settings.ddos_protection
  ip_blacklist = settings.ip_blacklist
  proxy_hops = settings.proxy_hops
  websocket_max_accounts = settings.websocket_max_accounts
  cors_whitelist = settings.cors_whitelist
  disable_watch_work = settings.disable_watch_work

  // normalize request_path, add starting /
  request_path = request_path.startsWith('/') ? request_path : '/' + request_path

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
  user_settings = JSON.parse(Fs.readFileSync('user_settings.json', 'UTF-8'))
}
catch(e) {
  console.log("Could not read user_settings.json", e)
}

function logObjectEntries(logger, title, object) {
  let log_string = title + "\n"
  for (const [key, value] of Object.entries(object)) {
    if(key) {
      log_string = log_string + key + " : " + value + "\n"
    } else {
      log_string = log_string + " " + value + "\n"
    }
  }
  logger(log_string)
}
// ---
// Log all initial settings for convenience
function logSettings(logger) {
  logger("PROXY SETTINGS:\n-----------")
  logger("Node url: " + node_url)
  logger("Websocket url: " + node_ws_url)
  logger("Http port: " + String(http_port))
  logger("Https port: " + String(https_port))
  logger("Request path: " + request_path)
  if (use_websocket) {
    logger("Websocket http port: " + String(websocket_http_port))
    logger("Websocket https port: " + String(websocket_https_port))
    logger("Websocket nax accounts: " + String(websocket_max_accounts))
  }
  logger("Use authentication: " + use_auth)
  logger("Use slow down: " + use_slow_down)
  logger("Use rate limiter: " + use_rate_limiter)
  logger("Use cached requests: " + use_cache)
  logger("Use output limiter: " + use_output_limiter)
  logger("Use IP blacklist: " + use_ip_blacklist)
  logger("Use token system: " + use_tokens)
  logger("Use websocket system: " + use_websocket)
  logger("Use dPoW: " + use_dpow)
  logger("Use bPoW: " + use_bpow)
  logger("Disabled watch_work for process: " + disable_watch_work)
  logger("Listen on http: " + use_http)
  logger("Listen on https: " + use_https)

  logObjectEntries(logger, "Allowed commands:\n-----------\n", allowed_commands)
  if(use_cache)  {
    logObjectEntries(logger, "Cached commands:\n", cached_commands)
  }
  if (use_output_limiter) {
    logObjectEntries(logger, "Limited commands:\n", limited_commands)
  }
  if(use_slow_down) {
    logObjectEntries(logger, "Slow down settings:\n", slow_down)
  }
  if (use_rate_limiter) {
    logObjectEntries(logger, "Rate limiter settings:\n", rate_limiter)
  }
  logObjectEntries(logger, "DDOS protection settings:\n", ddos_protection)

  if (use_ip_blacklist) {
    logObjectEntries(logger, "IPs blacklisted:\n", ip_blacklist)
  }
  if (proxy_hops > 0) {
    logger("Additional proxy servers: " + proxy_hops)
  }
  if (use_cors) {
    if (cors_whitelist.length == 0) {
      logger("Use cors. Any ORIGIN allowed")
    }
    else {
      logObjectEntries(logger, "Use cors. Whitelisted ORIGINs or IPs:\n", cors_whitelist)
    }
  }
  logger("Main log level: " + log_level)

}
logSettings(console.log)

module.exports = {
  logSettings: logSettings
}
// ---

// Read dpow and bpow credentials from file
// ---
if (use_dpow || use_bpow) {
  try {
    const powcreds = JSON.parse(Fs.readFileSync('pow_creds.json', 'UTF-8'))
    if (use_dpow) {
      dpow_user = powcreds.dpow.user
      dpow_key = powcreds.dpow.key
    }
    if (use_bpow) {
      bpow_user = powcreds.bpow.user
      bpow_key = powcreds.bpow.key
    }
  }
  catch(e) {
    console.log("Could not read pow_creds.json", e)
  }
}
// ---


// Periodically check, recover and remove old invactive olders
if (use_tokens) {
  // Each hour
  Schedule.scheduleJob('0 * * * *', () => {
    checkOldOrders()
  })
}

async function checkOldOrders() {
  let now = Math.floor(Date.now()/1000)
  // get all orders older than 60min
  let orders = order_db.get('orders')
    .filter(order => parseInt(order.timestamp) < now - 3600)
    .value()
  // Process all old orders
  //logThis("Checking old orders", log_levels.info)
  orders.forEach(async function(order) {
    // Reset status in case the order was interrupted and set a small nano_amount to allow small pending to create tokens
    order_db.get('orders').find({priv_key: order.priv_key}).assign({order_waiting: false, processing: false, nano_amount: 0.000000001}).write()
    await Tokens.repairOrder(order.address, order_db, node_url)

    // Remove if order has been unprocessed with a timeout for 1 month
    if (order.tokens === 0 && order.order_time_left === 0 && order.hashes.length === 0 && order.timestamp < now - 3600*24*31) {
      logThis("REMOVING ORDER:", log_levels.info)
      logThis(order_db.get('orders').remove({token_key:order.token_key}).write(), log_levels.info)
    }
  })
}

// Define the proxy app
const app = Express()
app.set('view engine', 'pug')
app.use(Helmet())

// Allow all origin in cors or a whitelist if present
if (use_cors) {
  if (cors_whitelist.length == 0) {
    app.use(Cors())
  }
  else {
    var corsOptions = function (req, callback) {
      if (cors_whitelist.indexOf(req.header('Origin')) !== -1 || cors_whitelist.indexOf(req.ip) !== -1) {
        callback(null, {origin: true}) // reflect (enable) the requested origin in the CORS response
      } else {
        callback(new Error('Not allowed')) // disable CORS for this request
      }
    }
    app.use(Cors(corsOptions))
  }
}

app.use(Express.json())
app.use(Express.static('static'))

// Define the number of proxy hops on the system to detect correct source IP for the filters below
if (proxy_hops > 0) {
  app.set('trust proxy', proxy_hops)
}

// Set up blacklist and use the proxy number defined in the settings. Log only IP if blocked
if (use_ip_blacklist) {
  app.use(IpFilter(ip_blacklist, {logLevel: 'deny', trustProxy: proxy_hops}))
}

// Error handling
app.use((err, req, res, _next) => {
  if (err instanceof IpDeniedError) {
    return res.status(401).json({error: 'IP has been blocked'})
  }
  else {
    return res.status(500).json({error: err.status})
  }
})

// Define authentication service
if (use_auth) {
  app.use(BasicAuth({ authorizer: myAuthorizer }))
}

// Block IP if requesting too much but skipped if a valid token_key is provided (long interval)
if (use_rate_limiter) {
  const limiter1 = new RateLimiterMemory({
    keyPrefix: 'limit1',
    points: rate_limiter.request_limit, // limit each IP to x requests per duration
    duration: Math.round(rate_limiter.time_window/1000), // rolling time window in sec
  })

  const rateLimiterMiddleware1 = (req, res, next) => {
    if (use_tokens) {
      // Check if token key exist in DB and have enough tokens, then skip IP block by returning true
      if ('token_key' in req.body && order_db.get('orders').find({token_key: req.body.token_key}).value()) {
        if (order_db.get('orders').find({token_key: req.body.token_key}).value().tokens > 0) {
          next()
          return
        }
      }
      if ('token_key' in req.query && order_db.get('orders').find({token_key: req.query.token_key}).value()) {
        if (order_db.get('orders').find({token_key: req.query.token_key}).value().tokens > 0) {
          next()
          return
        }
      }
      // Don't count order check here, we do that in the ddos protection step
      if (req.body.action === 'tokenorder_check' || req.query.action === 'tokenorder_check' ||
          req.body.action === 'tokens_buy' || req.query.action === 'tokens_buy' ||
          req.body.action === 'tokenorder_cancel' || req.query.action === 'tokenorder_cancel' ||
          req.body.action === 'tokens_check' || req.query.action === 'tokens_check' ||
          req.body.action === 'tokenprice_check' || req.query.action === 'tokenprice_check') {
        next()
        return
      }
    }
    var points_to_consume = 1
    // work is more costly
    if (req.body.action === 'work_generate') {
      points_to_consume = work_token_cost
    }
    limiter1.consume(req.ip, points_to_consume)
      .then((response) => {
        res.set("X-RateLimit-Limit", rate_limiter.request_limit)
        res.set("X-RateLimit-Remaining", rate_limiter.request_limit-response.consumedPoints)
        res.set("X-RateLimit-Reset", new Date(Date.now() + response.msBeforeNext))
        next()
      })
      .catch((rej) => {
        res.set("X-RateLimit-Limit", rate_limiter.request_limit)
        res.set("X-RateLimit-Remaining", Math.max(rate_limiter.request_limit-rej.consumedPoints, 0))
        res.set("X-RateLimit-Reset", new Date(Date.now() + rej.msBeforeNext))
        res.status(429).send('Max allowed requests of ' + rate_limiter.request_limit + ' reached. Time left: ' + Math.round(rej.msBeforeNext/1000) + 'sec')
      })
   }

   app.use(rateLimiterMiddleware1)
}

// Ddos protection for all requests (short interval)
const limiter2 = new RateLimiterMemory({
  keyPrefix: 'limit2',
  points: ddos_protection.request_limit, // limit each IP to x requests per duration
  duration: Math.round(ddos_protection.time_window/1000), // rolling time window in sec
})

const rateLimiterMiddleware2 = (req, res, next) => {
  limiter2.consume(req.ip, 1)
    .then((response) => {
      next()
    })
    .catch((rej) => {
      res.status(429).send('You are making requests too fast, please slow down!')
    })
 }

 app.use(rateLimiterMiddleware2)

// Limit by slowing down requests
if (use_slow_down) {
  const slow_down_settings = SlowDown({
    windowMs: slow_down.time_window, // rolling time window in ms
    delayAfter: slow_down.request_limit, // allow x requests per time window, then start slowing down
    delayMs: slow_down.delay_increment, // begin adding X ms of delay per request when delayAfter has been reached
    maxDelayMs: slow_down.max_delay, // max delay in ms to slow down
    // skip limit for certain requests
    skip: function(req, res) {
      if (use_tokens) {
        // Check if token key exist in DB and have enough tokens, then skip IP block by returning true
        if ('token_key' in req.body && order_db.get('orders').find({token_key: req.body.token_key}).value()) {
          if (order_db.get('orders').find({token_key: req.body.token_key}).value().tokens > 0) {
            return true
          }
        }
        if ('token_key' in req.query && order_db.get('orders').find({token_key: req.query.token_key}).value()) {
          if (order_db.get('orders').find({token_key: req.query.token_key}).value().tokens > 0) {
            return true
          }
        }

        if (req.body.action === 'tokenorder_check' || req.query.action === 'tokenorder_check' ||
            req.body.action === 'tokens_buy' || req.query.action === 'tokens_buy' ||
            req.body.action === 'tokenorder_cancel' || req.query.action === 'tokenorder_cancel' ||
            req.body.action === 'tokens_check' || req.query.action === 'tokens_check' ||
            req.body.action === 'tokenprice_check' || req.query.action === 'tokenprice_check') {
          return true
        }
      }
      return false
    }
  })
  app.use(slow_down_settings)
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
    if (BasicAuth.safeCompare(username, value.user) && BasicAuth.safeCompare(password, value.password)) {
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

// Deduct token count for given token_key
function useToken(query) {
  let token_key = query.token_key
  // Find token_key in order DB
  if (order_db.get('orders').find({token_key: token_key}).value()) {
    let tokens = order_db.get('orders').find({token_key: token_key}).value().tokens
    if (tokens > 0) {
      var decrease_by = 1
      // work is more costly
      if (query.action === 'work_generate') {
        decrease_by = work_token_cost
      }
      // Count down token by x and store new value in DB
      order_db.get('orders').find({token_key: token_key}).assign({tokens:tokens-decrease_by}).write()
      logThis("A token was used by: " + token_key, log_levels.info)
      return tokens-1
    }
    else {
      return -1
    }
  }
  return -2
}

// Read headers and append result
function appendRateLimiterStatus(res, data) {
  let requestsLimit = res.get("X-RateLimit-Limit")
  let requestsRemaining = res.get("X-RateLimit-Remaining")
  let requestLimitReset = res.get("X-RateLimit-Reset")
  if (requestsLimit && requestsRemaining && requestLimitReset) {
    data.requestsLimit = requestsLimit
    data.requestsRemaining = requestsRemaining
    data.requestLimitReset = requestLimitReset
  }
  return data
}

// Update current list of tracked accounts
function updateTrackedAccounts() {
  const confirmation_subscription = {
    "action": "subscribe",
    "topic": "confirmation",
    "ack":true,
    "options": { "all_local_accounts": false,
      "accounts": global_tracked_accounts
    }}
  ws.send(JSON.stringify(confirmation_subscription))
}

// Log function
function logThis(str, level) {
  if (user_log_level == log_levels.info || level == user_log_level) {
    if (level == log_levels.info) {
      console.info(str)
    }
    else {
      console.warn(str)
    }
  }
}

// Compare two hex strings, returns 0 if equal, -1 if A<B and 1 if A>B
function compareHex(a, b) {
  a = parseInt('0x' + a, 16)
  b = parseInt('0x' + b, 16)
  let result = 0
  if (a > b) result = 1
  else if(a < b) result = -1
  return result
}

// Determine new multiplier from base difficulty (hexadecimal string) and target difficulty (hexadecimal string). Returns float
function multiplierFromDifficulty(difficulty, base_difficulty) {
  let big64 = Dec.BigDecimal(2).pow(64)
  let big_diff = Dec.BigDecimal(Dec.BigInteger(difficulty,16))
  let big_base = Dec.BigDecimal(Dec.BigInteger(base_difficulty,16))
  let mode = Dec.RoundingMode.HALF_DOWN()
  return big64.subtract(big_base).divide(big64.subtract(big_diff),32,mode).toPlainString()
}

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

// Default get requests
if (request_path != '/') {
  app.get('/', async (req, res) => {
    res.render('index', { title: 'RPCProxy API', message: 'Bad API path' })
  })
}

// Process any API requests
app.get(request_path, (req, res) => {
  processRequest(req.query, req, res)
})

// Define the request listener
app.post(request_path, (req, res) => {
  processRequest(req.body, req, res)
})

async function processRequest(query, req, res) {
  if (query.action !== 'tokenorder_check') {
    logThis('RPC request received from ' + req.ip + ': ' + query.action, log_levels.info)
    rpcCount++
  }

  if (use_tokens) {
    // Initiate token purchase
    var token_key = ""
    if (query.action === 'tokens_buy') {
      var token_amount = 0
      if ('token_amount' in query) {
        token_amount = Math.round(query.token_amount)
      }
      else {
        return res.status(500).json({ error: 'The amount of tokens (token_amount) to purchase must be provided'})
      }
      if ('token_key' in query) {
        token_key = query.token_key
      }

      let payment_request = await Tokens.requestTokenPayment(token_amount, token_key, order_db, node_url)

      res.json(payment_request)
      return
    }

    // Verify order status
    if (query.action === 'tokenorder_check') {
      token_key = ""
      if ('token_key' in query) {
        token_key = query.token_key
        let status = await Tokens.checkOrder(token_key, order_db)
        return res.json(status)
      }
      else {
        return res.status(500).json({ error: 'No token key provided'})
      }
    }

    // Claim back private key and replace the account
    if (query.action === 'tokenorder_cancel') {
      token_key = ""
      if ('token_key' in query) {
        token_key = query.token_key
        let status = await Tokens.cancelOrder(token_key, order_db)
        return res.json(status)
      }
      else {
        return res.status(500).json({ error: 'No token key provided'})
      }
    }

    // Verify order status
    if (query.action === 'tokens_check') {
      token_key = ""
      if ('token_key' in query) {
        token_key = query.token_key
        let status = await Tokens.checkTokens(token_key, order_db)
        return res.json(status)
      }
      else {
        return res.status(500).json({ error: 'No token key provided'})
      }
    }
  }

  // Check token price
  if (query.action === 'tokenprice_check') {
    let status = await Tokens.checkTokenPrice()
    return res.json(appendRateLimiterStatus(res, status))
  }

  // Block non-allowed RPC commands
  if (!query.action || user_allowed_commands.indexOf(query.action) === -1) {
    logThis('RPC request is not allowed: ' + query.action, log_levels.info)
    return res.status(500).json({ error: `Action ${query.action} not allowed`})
  }

  // Decrease user tokens and block if zero left
  var tokens_left = null
  if (use_tokens) {
    if ('token_key' in query) {
      let status = useToken(query)
      if (status === -1) {
        return res.status(500).json({ error: 'You have no more tokens to use!'})
      }
      else if (status === -2) {
        return res.status(500).json({ error: 'Provided key does not exist!'})
      }
      else {
        tokens_left = status
      }
    }
  }

  // Respond directly if non-node-related request
  //  --
  if (query.action === 'price') {
    try {
      // Use cached value first
      const cachedValue = rpcCache.get('price')
      if (Tools.isValidJson(cachedValue)) {
        logThis("Cache requested: " + 'price', log_levels.info)
        if (tokens_left != null) {
          cachedValue.tokens_total = tokens_left
        }
        return res.json(appendRateLimiterStatus(res, cachedValue))
      }

      let data = await Tools.getData(price_url, API_TIMEOUT)

      // Store the price in cache for 10sec
      if (!rpcCache.set('price', data, 10)) {
        logThis("Failed saving cache for " + 'price', log_levels.warning)
      }
      //res.json({"Price USD":data.data["1567"].quote.USD.price}) // sending back json price response (CMC)
      //res.json({"Price USD":data.quotes.USD.price}) // sending back json price response (Coinpaprika)
      if (tokens_left != null) {
        data.tokens_total = tokens_left
      }
      res.json(appendRateLimiterStatus(res, data)) // sending back full json price response (Coinpaprika)
    }
    catch(err) {
      res.status(500).json({error: err.toString()})
    }
    return
  }

  if (query.action === 'mnano_to_raw') {
    if ('amount' in query) {
      let amount = Tools.MnanoToRaw(query.amount)
      res.json(appendRateLimiterStatus(res, {"amount":amount}))
    }
    else {
      return res.status(500).json({ error: 'Amount not provided!'})
    }
    return
  }

  if (query.action === 'mnano_from_raw') {
    if ('amount' in query) {
      let amount = Tools.rawToMnano(query.amount)
      res.json(appendRateLimiterStatus(res, {"amount":amount}))
    }
    else {
      return res.status(500).json({ error: 'Amount not provided!'})
    }
    return
  }

  // Force no watch_work (don't want the node to perform pow)
  if (disable_watch_work) {
    if (query.action === 'process') {
      query.watch_work = 'false'
    }
  }

  // Handle work generate via dpow and/or bpow
  if (query.action === 'work_generate' && (use_dpow || use_bpow)) {
    if ('hash' in query) {
      var bpow_failed = false
      if (!("difficulty" in query)) {
        // Use cached value first
        const cachedValue = rpcCache.get('difficulty')
        if (Tools.isValidJson(cachedValue)) {
          logThis("Cache requested: " + 'difficulty', log_levels.info)
          query.difficulty = cachedValue
        }
        else {
          // get latest difficulty from network
          let data = await Tools.postData({"action":"active_difficulty"}, node_url, API_TIMEOUT)
          if ('network_current' in data) {
            // Store the difficulty in cache for 60sec
            if (!rpcCache.set('difficulty', data.network_current, 60)) {
              logThis("Failed saving cache for " + 'difficulty', log_levels.warning)
            }
            query.difficulty = data.network_current
            logThis("New difficulty: " + query.difficulty, log_levels.info)
          }
          else {
            query.difficulty = work_threshold_default
            logThis("Using default difficulty: " + query.difficulty, log_levels.info)
          }
        }
        if (compareHex(work_threshold_default, query.difficulty)) {
          query.difficulty = work_threshold_default
        }
      }
      if (!("timeout" in query)) {
        query.timeout = work_default_timeout
      }

      // Try bpow first
      if (use_bpow) {
        logThis("Requesting work using bpow with diff: " + query.difficulty, log_levels.info)
        query.user = bpow_user
        query.api_key = bpow_key

        try {
          let data = await Tools.postData(query, bpow_url, work_default_timeout*1000*2)
          data.difficulty = query.difficulty
          data.multiplier = RemoveTrailingZeros(multiplierFromDifficulty(data.difficulty, work_threshold_default).toString())
          if (tokens_left != null) {
            data.tokens_total = tokens_left
          }
          // if bpow time out
          if ('error' in data) {
            logThis("bPoW failed: " + data.error, log_levels.warning)
          }
          if (('error' in data) || !('work' in data)) {
            bpow_failed = true
            if (!use_dpow) {
              res.json(appendRateLimiterStatus(res, data)) // forward error if not retrying with dpow
              return
            }
          }
          else if ('work' in data) {
            res.json(appendRateLimiterStatus(res, data)) // sending back successful json response
            return
          }
        }
        catch(err) {
          bpow_failed = true
          if (!use_dpow) {
            res.status(500).json({error: err.toString()})
            return
          }
          logThis("Bpow connection error: " + err.toString(), log_levels.warning)
        }
      }
      // Use dpow only if not already used bpow or bpow timed out
      if (use_dpow && (!use_bpow || bpow_failed)) {
        logThis("Requesting work using dpow with diff: " + query.difficulty, log_levels.info)
        query.user = dpow_user
        query.api_key = dpow_key

        try {
          let data = await Tools.postData(query, dpow_url, work_default_timeout*1000*2)
          data.difficulty = query.difficulty
          data.multiplier = RemoveTrailingZeros(multiplierFromDifficulty(data.difficulty, work_threshold_default).toString())
          if (tokens_left != null) {
            data.tokens_total = tokens_left
          }
          if ('error' in data) {
            logThis("dPoW failed: " + data.error, log_levels.warning)
          }
          res.json(appendRateLimiterStatus(res, data)) // sending back json response (regardless if timeout error)
        }
        catch(err) {
          res.status(500).json({error: err.toString()})
          logThis("Dpow connection error: " + err.toString(), log_levels.warning)
        }
      }
    }
    else {
      return res.status(500).json({ error: 'Hash not provided!'})
    }
    return
  }

  // ---

  // Read cache for current request action, if there is one
  if (user_use_cache) {
    for (const [key] of Object.entries(user_cached_commands)) {
      if (query.action === key) {
        const cachedValue = rpcCache.get(key)
        if (Tools.isValidJson(cachedValue)) {
          logThis("Cache requested: " + key, log_levels.info)
          if (tokens_left != null) {
            cachedValue.tokens_total = tokens_left
          }
          return res.json(appendRateLimiterStatus(res, cachedValue))
        }
        break
      }
    }
  }

  // Limit response count (if count parameter is provided)
  if (user_use_output_limiter) {
    for (const [key, value] of Object.entries(user_limited_commands)) {
      if (query.action === key) {
        if (parseInt(query.count) > value || !("count" in query)) {
          query.count = value
          if (parseInt(query.count) > value) {
            logThis("Response count was limited to " + value.toString(), log_levels.info)
          }
        }
      }
    }
  }

  // Send the request to the Nano node and return the response
  try {
    let data = await Tools.postData(query, node_url, API_TIMEOUT)
    // Save cache if applicable
    if (use_cache) {
      for (const [key, value] of Object.entries(user_cached_commands)) {
        if (query.action === key) {
          // Store the response (proxyRes) in cache with key (action name) with a TTL=value
          if (!rpcCache.set(key, data, value)) {
            logThis("Failed saving cache for " + key, log_levels.warning)
          }
          break
        }
      }
    }
    if (tokens_left != null) {
      data.tokens_total = tokens_left
    }
    res.json(appendRateLimiterStatus(res, data)) // sending back json response
  }
  catch(err) {
    res.status(500).json({error: err.toString()})
    logThis("Node conection error: " + err.toString(), log_levels.warning)
  }
}

var websocket_servers = []
// Create an HTTP service
if (use_http && test_override_http) {
  Http.createServer(app).listen(http_port, function() {
    console.log("Http server started on port: " + http_port)
  })

  // websocket
  if (use_websocket) {
    var ws_http_server = Http.createServer(function(request, response) {
      response.writeHead(404)
      response.end()
    })
    ws_http_server.listen(websocket_http_port, function() {
      console.log('Websocket server is listening on port ' + websocket_http_port)
    })
    websocket_servers.push(ws_http_server)
  }
}

// Create an HTTPS service
if (use_https) {
  // Verify that cert files exists
  var cert_exists = false
  var key_exists = false
  Fs.access(https_cert, Fs.F_OK, (err) => {
    if (err) {
      console.log("Warning: Https cert file does not exist!")
    }
    cert_exists = true
  })
  Fs.access(https_key, Fs.F_OK, (err) => {
    if (err) {
      console.log("Warning: Https key file does not exist!")
    }
    key_exists = true
  })
  if (cert_exists && key_exists) {
    var https_options = {
      cert: Fs.readFileSync(https_cert),
      key: Fs.readFileSync(https_key)
    }

    Https.createServer(https_options, app).listen(https_port, function() {
      console.log("Https server started on port: " + https_port)
    })

    // websocket
    if (use_websocket) {
      var ws_https_server = Https.createServer(https_options, function(request, response) {
        response.writeHead(404)
        response.end()
      })
      ws_https_server.listen(websocket_https_port, function() {
        console.log('Websocket server is listening on port ' + websocket_https_port)
      })
      websocket_servers.push(ws_https_server)
    }
  }
  else {
    console.log("Warning: Will not listen on https!")
  }
}

// WEBSOCKET SERVER
//---------------------
if (use_websocket) {
  let wsServer = new WebSocketServer({
    httpServer: websocket_servers,
    autoAcceptConnections: false
  })

  // websocket ddos protection settings
  const websocket_limiter = new RateLimiterMemory({
    keyPrefix: 'limit_websocket',
    points: ddos_protection.request_limit, // limit each IP to x requests per duration
    duration: Math.round(ddos_protection.time_window/1000), // rolling time window in sec
  })

  wsServer.on('request', async function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject()
      //logThis('Connection from origin ' + request.origin + ' rejected.', log_levels.info)
      return
    }

    let remote_ip = request.remoteAddress
    logThis('Websocket Connection requested from: ' + remote_ip, log_levels.info)

    // Black list protection
    if (ip_blacklist.includes(remote_ip)) {
      request.reject()
      return
    }

    // DDOS Protection
    try {
      await websocket_limiter.consume(remote_ip, 1) // consume 1 point
    }
    // max amount of connections reached
    catch (rlRejected) {
      if (rlRejected instanceof Error) {
        throw rlRejected;
      } else {
        request.reject()
        return
      }
    }
    try {
      var connection = request.accept()
    } catch (error) {
      logThis('Bad protocol from connecting client', log_levels.info)
      return
    }

    connection.on('message', function(message) {
      if (message.type === 'utf8') {
          //console.log('Received Message: ' + message.utf8Data + ' from ' + remote_ip)
          try {
            let msg = JSON.parse(message.utf8Data)
            // new subscription
            if ('action' in msg && 'topic' in msg && msg.action === 'subscribe') {
              if (msg.topic === 'confirmation') {
                if ('options' in msg && 'accounts' in msg.options) {
                  if (msg.options.accounts.length <= websocket_max_accounts) {
                    // check if new unique accounts + existing accounts exceed max limit
                    // get existing tracked accounts
                    let current_user = tracking_db.get('users').find({ip: remote_ip}).value()
                    var current_tracked_accounts = {} //if not in db, use empty dict
                    if (current_user !== undefined) {
                      current_tracked_accounts = current_user.tracked_accounts
                    }

                    // count new accounts that are not already tracked
                    let unique_new = 0
                    msg.options.accounts.forEach(function(address) {
                      var address_exists = false
                      for (const [key] of Object.entries(current_tracked_accounts)) {
                        if (key === address)  {
                          address_exists = true
                        }
                      }
                      if (!address_exists) {
                        unique_new++
                      }
                    })
                    if (parseInt(unique_new) + Object.keys(current_tracked_accounts).length <= websocket_max_accounts) {

                      // save connection to global dicionary to reuse when getting messages from the node websocket
                      websocket_connections[remote_ip] = connection

                      // mirror the subscription to the real websocket
                      var tracking_updated = false
                      msg.options.accounts.forEach(function(address) {
                        if (trackAccount(connection, address)) {
                          tracking_updated = true
                        }
                      })
                      if (tracking_updated) {
                        updateTrackedAccounts() //update the websocket subscription
                      }
                      connection.sendUTF(JSON.stringify({'ack':'subscribe','id':'id' in msg ? msg.id:""}, null, 2))
                    }
                    else {
                      connection.sendUTF(JSON.stringify({'error':'Too many accounts subscribed. Max is ' + websocket_max_accounts}, null, 2))
                    }
                  }
                  else {
                    connection.sendUTF(JSON.stringify({'error':'Too many accounts subscribed. Max is ' + websocket_max_accounts}, null, 2))
                  }
                }
                else {
                  connection.sendUTF(JSON.stringify({'error':'You must provide the accounts to track via the options parameter'}, null, 2))
                }
              }
            }
            else if ('action' in msg && 'topic' in msg && msg.action === 'unsubscribe') {
              if (msg.topic === 'confirmation') {
                logThis('User unsubscribed from confirmation: ' + remote_ip, log_levels.info)
                tracking_db.get('users').find({ip: remote_ip}).assign({'tracked_accounts':[]}).write()
              }
            }
          }
          catch (e) {
            //console.log(e)
          }
      }
    })
    connection.on('close', function(reasonCode, description) {
      logThis('Websocket disconnected for: ' + remote_ip, log_levels.info)
      // clean up db and dictionary
      tracking_db.get('users').remove({ip: remote_ip}).write()
      delete websocket_connections[remote_ip]
    })
  })
}

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  // TODO
  return true
}

// Start websocket subscription for an address
function trackAccount(connection, address) {
  if (!Tools.validateAddress(address)) {
    return false
  }
  let remote_ip = connection.remoteAddress
  // get existing tracked accounts
  let current_user = tracking_db.get('users').find({ip: remote_ip}).value()
  var current_tracked_accounts = {} //if not in db, use empty dict
  if (current_user !== undefined) {
    current_tracked_accounts = current_user.tracked_accounts
  }

  // check if account is not already tracked
  var address_exists = false
  for (const [key] of Object.entries(current_tracked_accounts)) {
    if (key === address)  {
      address_exists = true
    }
  }

  // start tracking new address
  if (!address_exists) {
    current_tracked_accounts[address] = {timestamp: Math.floor(Date.now()/1000)} // append new tracking

    // add user and tracked account to db
    if (current_user === undefined) {
      const userinfo = {
        ip : remote_ip,
        tracked_accounts : current_tracked_accounts
      }
      tracking_db.get('users').push(userinfo).write()
    }
    // update existing user
    else {
      tracking_db.get('users').find({ip: remote_ip}).assign({tracked_accounts: current_tracked_accounts}).write()
    }

    // check if account is already tracked globally or start tracking
    var tracking_exists = false
    global_tracked_accounts.forEach(function(tracked_address) {
      if (tracked_address === address) {
        tracking_exists = true
      }
    })
    if (!tracking_exists) {
      global_tracked_accounts.push(address)
      return true
    }
  }
  return false
}

//WEBSOCKET CLIENT FOR NANO NODE
// Create a reconnecting WebSocket.
// we wait a maximum of 2 seconds before retrying.
if (use_websocket) {
  ws = new ReconnectingWebSocket(node_ws_url, [], {
    WebSocket: WS,
    connectionTimeout: 1000,
    maxRetries: Infinity,
    maxReconnectionDelay: 8000,
    minReconnectionDelay: 3000
  })

  // A tracked account was detected
  ws.onmessage = msg => {
    let data_json = JSON.parse(msg.data)

    // Check if the tracked account belongs to a user
    if (data_json.topic === "confirmation") {
      let observed_account = data_json.message.account
      let observed_link = data_json.message.block.link_as_account

      // FOR ACCOUNT TRACKING
      let tracked_accounts = tracking_db.get('users').value()
      // loop all existing tracked accounts as subscribed to by users
      tracked_accounts.forEach(async function(user) {
        if ("tracked_accounts" in user && "ip" in user) {
          // loop all existing accounts for that user
          for (const [key] of Object.entries(user.tracked_accounts)) {
            if (key === observed_account || key === observed_link) {
              // send message to each subscribing user for this particular account
              logThis('A tracked account was pushed to client: ' + key, log_levels.info)
              websocket_connections[user.ip].sendUTF(msg.data)
            }
          }
        }
      })
    }
    else if ("ack" in data_json) {
      if (data_json.ack === "subscribe") {
        logThis("Websocket subscription updated", log_levels.info)
      }
    }
  }

  // As soon as we connect, subscribe to confirmations (as of now there are none while we start up the server)
  ws.onopen = () => {
    logThis("Node websocket is open", log_levels.info)
    updateTrackedAccounts()
  }
  ws.onclose = () => {
    logThis("Node websocket is closed", log_levels.info)
  }
  ws.onerror = (e) => {
    logThis("Main websocket: " + e.error, log_levels.warning)
  }
}
