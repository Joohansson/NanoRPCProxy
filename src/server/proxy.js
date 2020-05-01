require('dotenv').config() // load variables from .env into the environment
require('console-stamp')(console)
const NodeCache =     require("node-cache" )
const SlowDown =      require("express-slow-down")
const RateLimit =     require("express-rate-limit")
const BasicAuth =     require('express-basic-auth')
const Http =          require('http')
const Https =         require('https')
const Fs =            require('fs')
const Express =       require('express')
const Cors =          require('cors')
const IpFilter =      require('express-ipfilter').IpFilter
const IpDeniedError = require('express-ipfilter').IpDeniedError
const Promise =       require('promise')
const Schedule =      require('node-schedule')
const Tokens =        require('./tokens')
const Tools =         require('./tools')
const log_levels = {none:"none", warning:"warning", info:"info"}

// lowdb init
const Low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const Adapter = new FileSync('db.json')
const order_db = Low(Adapter)
order_db.defaults({orders: []}).write()

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
var use_ip_blacklist = false        // if blocking access to IPs listed in ip_blacklist
var use_tokens = false              // if activating the token system for purchase via Nano
var https_cert = ""                 // file path for pub cert file
var https_key = ""                  // file path for private key file
var allowed_commands = []           // only allow RPC actions in this list
var cached_commands = []            // a list of commands [key] that will be cached for corresponding duration in seconds as [value]
var limited_commands = []           // a list of commands [key] to limit the output response for with max count as [value]
var speed_limiter = {}              // contains the settings for slowing down clients with speed limiter
var ip_block = {}                   // contains the settings for blocking IP that does too many requests
var log_level = log_levels.none     // the log level to use (startup info is always logged): none=zero active logging, warning=only errors/warnings, info=both errors/warnings and info
var ip_blacklist = []               // a list of IPs to deny always
var proxy_hops = 0                  // if the NanoRPCProxy is behind other proxies such as apache or cloudflare the source IP will be wrongly detected and the filters will not work as intended. Enter the number of additional proxies here.

// default vars
cache_duration_default = 60
var rpcCache = null
var cacheKeys = []
var user_settings = {}
const PriceUrl = 'https://api.coinpaprika.com/v1/tickers/nano-nano'
//const PriceUrl2 = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=1567'
//const CMC_API_KEY = 'xxx'
const API_TIMEOUT = 10000 // 10sec timeout for calling http APIs

var user_use_cache = null
var user_use_output_limiter = null
var user_allowed_commands = null
var user_cached_commands = null
var user_limited_commands = null
var user_log_level = null

// track daily requests and save to a log file (daily stat is reset if the server is restarted)
// ---
var rpcCount = 0
Schedule.scheduleJob('0 0 * * *', () => {
    appendFile(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + ": " + rpcCount + "\n")
    rpcCount = 0
})
function appendFile(msg) {
  Fs.appendFile("request-stat.log", msg, function(err) {
    if(err) {
        return logThis("Error saving request stat file: " + err.toString(), log_levels.info)
    }
    logThis("The request stat file was updated!", log_levels.info)
  });
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
  http_port = settings.http_port
  https_port = settings.https_port
  use_auth = settings.use_auth
  use_speed_limiter = settings.use_speed_limiter
  use_ip_block = settings.use_ip_block
  use_cache = settings.use_cache
  use_output_limiter = settings.use_output_limiter
  use_http = settings.use_http
  use_https = settings.use_https
  use_ip_blacklist = settings.use_ip_blacklist
  use_tokens = settings.use_tokens
  https_cert = settings.https_cert
  https_key = settings.https_key
  cached_commands = settings.cached_commands
  allowed_commands = settings.allowed_commands
  limited_commands = settings.limited_commands
  log_level = settings.log_level
  speed_limiter = settings.speed_limiter
  ip_block = settings.ip_block
  ip_blacklist = settings.ip_blacklist
  proxy_hops = settings.proxy_hops

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
// ---

// Log all initial settings for convenience
// ---
console.log("PROXY SETTINGS:\n-----------")
console.log("Node url: " + node_url)
console.log("Http port: " + String(http_port))
console.log("Https port: " + String(https_port))
console.log("Use authentication: " + use_auth)
console.log("Use speed limiter: " + use_speed_limiter)
console.log("Use IP block: " + use_ip_block)
console.log("Use cached requests: " + use_cache)
console.log("Use output limiter: " + use_output_limiter)
console.log("Use IP blacklist: " + use_ip_blacklist)
console.log("Use token system: " + use_tokens)
console.log("Listen on http: " + use_http)
console.log("Listen on https: " + use_https)

log_string = "Allowed commands:\n-----------\n"
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

if (use_ip_blacklist) {
  log_string = "IPs blacklisted:\n"
  for (const [key, value] of Object.entries(ip_blacklist)) {
    log_string = log_string + value + "\n"
  }
  console.log(log_string)
}

if (proxy_hops > 0) {
  console.log("Additional proxy servers: " + proxy_hops)
}

console.log("Main log level: " + log_level)
// ---

// Define the proxy app
const app = Express()
app.set('view engine', 'pug')
app.use(Cors())
app.use(Express.json())
app.use(Express.static('static'))

// Define authentication service
if (use_auth) {
  app.use(BasicAuth({ authorizer: myAuthorizer }))
}

// Define the number of proxy hops on the system to detect correct source IP for the filters below
if (proxy_hops > 0) {
  app.set('trust proxy', proxy_hops)
}

// Limit by slowing down requests
if (use_speed_limiter) {
  const speed_limiter_settings = SlowDown({
    windowMs: speed_limiter.time_window, // rolling time window in ms
    delayAfter: speed_limiter.request_limit, // allow x requests per time window, then start slowing down
    delayMs: speed_limiter.delay_increment, // begin adding X ms of delay per request when delayAfter has been reached
    maxDelayMs: speed_limiter.max_delay, // max delay in ms to slow down
    // skip limit for certain requests
    skip: function(req, res) {
      if (use_tokens) {
        if (req.body.action === 'tokenorder_check' || req.query.action === 'tokenorder_check') {
          return true
        }
      }
      return false
    }
  })
  app.use(speed_limiter_settings)
}

// Block IP if requesting too much but skipped if a valid token_key is provided
if (use_ip_block) {
  const ip_block_settings = RateLimit({
    windowMs: ip_block.time_window, // rolling time window in ms
    max: ip_block.request_limit, // limit each IP to x requests per windowMs
    message: 'You have sent too many RPC requests. You can try again later.',
    // Check if token key exist in DB and have enough tokens, then skip IP block by returning true
    skip: function(req, res) {
      if (use_tokens) {
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
        if (req.body.action === 'tokenorder_check' || req.query.action === 'tokenorder_check') {
          return true
        }
      }
      return false
    }
  })
  app.use(ip_block_settings)
}

// Set up cache
if (use_cache) {
  rpcCache = new NodeCache( { stdTTL: cache_duration_default, checkperiod: 10 } )
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
    if (BasicAuth.safeCompare(username, value.user) & BasicAuth.safeCompare(password, value.password)) {
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
function useToken(token_key) {
  // Find token_key in order DB
  if (order_db.get('orders').find({token_key: token_key}).value()) {
    let tokens = order_db.get('orders').find({token_key: token_key}).value().tokens
    if (tokens > 0) {
      // Count down token by 1 and store new value in DB
      order_db.get('orders').find({token_key: token_key}).assign({tokens:tokens-1}).write()
      logThis("A token was used by: " + token_key, log_levels.info)
      return tokens-1
    }
    else {
      return -1
    }
  }
  return -2
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
app.get('/', async (req, res) => {
  res.render('index', { title: 'RPCProxy API', message: 'Bad API path' })
})

// Process any API requests
app.get('/proxy', (req, res) => {
  processRequest(req.query, req, res)
})

// Define the request listener
app.post('/proxy', (req, res) => {
  processRequest(req.body, req, res)
})

async function processRequest(query, req, res) {
  if (query.action !== 'tokenorder_check') {
    logThis('RPC request received from ' + req.ip + ': ' + query.action, log_levels.info)
    rpcCount++
  }

  if (use_tokens) {
    // Initiate token purchase
    if (query.action === 'tokens_buy') {
      var token_amount = 0
      var token_key = ""
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
      var token_key = ""
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
      var token_key = ""
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
      var token_key = ""
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
    return res.json(status)
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
      let status = useToken(query.token_key)
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
        return res.json(cachedValue)
      }

      let data = await Tools.getData(PriceUrl, API_TIMEOUT)

      // Store the price in cache for 10sec
      if (!rpcCache.set('price', data, 10)) {
        logThis("Failed saving cache for " + 'price', log_levels.warning)
      }
      //res.json({"Price USD":data.data["1567"].quote.USD.price}) // sending back json price response (CMC)
      //res.json({"Price USD":data.quotes.USD.price}) // sending back json price response (Coinpaprika)
      if (tokens_left != null) {
        data.tokens_total = tokens_left
      }
      res.json(data) // sending back full json price response (Coinpaprika)
    }
    catch(err) {
      res.status(500).json({error: err.toString()})
    }
    return
  }
  // ---

  // Read cache for current request action, if there is one
  if (user_use_cache) {
    for (const [key, value] of Object.entries(user_cached_commands)) {
      if (query.action === key) {
        const cachedValue = rpcCache.get(key)
        if (Tools.isValidJson(cachedValue)) {
          logThis("Cache requested: " + key, log_levels.info)
          if (tokens_left != null) {
            cachedValue.tokens_total = tokens_left
          }
          return res.json(cachedValue)
        }
        break
      }
    }
  }

  // Limit response count (if count parameter is provided)
  if (user_use_output_limiter) {
    for (const [key, value] of Object.entries(user_limited_commands)) {
      if (query.action === key) {
        if (parseInt(query.count) > value) {
          logThis("Response count was limited to " + value.toString(), log_levels.info)
          query.count = value
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
    res.json(data) // sending back json response
  }
  catch(err) {
    res.status(500).json({error: err.toString()})
    logThis("Node conection error: " + err.toString())
  }
}

// Create an HTTP service
if (use_http) {
  console.log("Starting http server")
  Http.createServer(app).listen(http_port)
}

// Create an HTTPS service
if (use_https) {
  // Verify that cert files exists
  var cert_exists = false
  var key_exists = false
  Fs.access(https_cert, fs.F_OK, (err) => {
    if (err) {
      console.log("Warning: Https cert file does not exist!")
    }
    cert_exists = true
  })
  Fs.access(https_key, fs.F_OK, (err) => {
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
    console.log("Starting https server")
    Https.createServer(https_options, app).listen(https_port)
  }
  else {
    console.log("Warning: Will not listen on https!")
  }
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
