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

// Default vars. DON'T CHANGE. Change in json file.
var usr = ''                        // access base64 username
var psw = ''                        // access base64 password
var node_url = 'http://[::1]:7076'  // nano node RPC url (default for beta network is 'http://[::1]:55000')
var http_port = 9950                // port to listen on for http (enabled default with use_http)
var https_port = 9951               // port to listen on for https (disabled default with use_https)
var cache_duration = 60             // how long to store cache if not specified
var max_request_count = 500                 // max count of various rpc responses like pending transactions
var use_auth = false                // if require username and password when connecting to proxy
var use_speed_limiter = false       // if slowing down IPs when they request above set limit
var use_ip_block = false            // if blocking IPs for a certain amount of time when they request above set limit
var use_cache = false               // if caching certain commands set in cached_commands
var use_http = true                 // listen on http (active by default)
var use_https = false               // listen on https (inactive by default) (a valid cert and key file is needed via https_cert and https_key)
var myCache = null
var https_cert = ""
var https_key = ""

// Read credentials from file
try {
  const creds = JSON.parse(fs.readFileSync('creds.json', 'UTF-8'))
  usr = creds.user
  psw = creds.password
}
catch(e) {
  console.log("Could not read creds.json")
}

// Read settings from file
try {
  const settings = JSON.parse(fs.readFileSync('settings.json', 'UTF-8'))
  node_url = settings.node_url
  http_port = settings.http_port
  https_port = settings.https_port
  cache_duration = settings.cache_duration
  max_request_count = settings.max_request_count
  use_auth = settings.use_auth
  use_speed_limiter = settings.use_speed_limiter
  use_ip_block = settings.use_ip_block
  use_cache = settings.use_cache
  use_http = settings.use_http
  use_https = settings.use_https
  https_cert = settings.https_cert
  https_key = settings.https_key
}
catch(e) {
  console.log("Could not read settings.json")
}

console.log("Node url: " + node_url)
console.log("Http port: " + String(http_port))
console.log("Https port: " + String(https_port))
console.log("Cache duration: " + String(cache_duration))
console.log("Max request count: " + String(max_request_count))
console.log("Use authorization: " + use_auth)
console.log("Use speed limiter: " + use_speed_limiter)
console.log("Use IP block: " + use_ip_block)
console.log("Use cached requests " + use_cache)
console.log("Listen on http: " + use_http)
console.log("Listen on https: " + use_https)



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
  myCache = new NodeCache( { stdTTL: cache_duration, checkperiod: 10 } )
}

// To verify username and password provided via basicAuth
function myAuthorizer(username, password) {
  return basicAuth.safeCompare(username, usr) & basicAuth.safeCompare(password, psw)
}

// Redirect all bad GET requests to default page
app.get('', (req, res) => res.sendFile(`${__dirname}/index.html`))

//app.listen(listeningPort, () => console.log(`App listening on port ${listeningPort}!`));

// Create an HTTP service
if (use_http) {
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
    https.createServer(https_options, app).listen(https_port)
  }
  else {
    console.log("Warning: Will not listen on https!")
  }
}
