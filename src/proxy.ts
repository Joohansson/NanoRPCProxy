import {Credentials, readCredentials} from "./credential-settings";
import ProxySettings, {proxyLogSettings, readProxySettings} from './proxy-settings';
import {ConfigPaths, log_levels, LogData, LogLevel, readConfigPathsFromENV} from "./common-settings";
import {loadDefaultUserSettings, readUserSettings, UserSettings, UserSettingsConfig} from "./user-settings";
import {PowSettings, readPowSettings} from "./pow-settings";
import SlowDown from "express-slow-down";
import FileSync from 'lowdb/adapters/FileSync.js';
import lowdb from 'lowdb'
import {OrderDB, OrderSchema, TrackedAccount, User, UserDB, UserSchema} from "./lowdb-schema";
import {Handler, Request, Response} from "express";
import {CorsOptions} from "cors";
import {RateLimiterRes} from "rate-limiter-flexible";
import {connection, IMessage, request as WSRequest, server as WSServer} from "websocket";
import ReconnectingWebSocket, { ErrorEvent } from "reconnecting-websocket";
import NodeCache from "node-cache";
import {PriceResponse} from "./price-api/price-api";
import * as Tools from './tools'
import * as Tokens from './tokens'
import {isTokensRequest, TokenAPIResponses} from "./node-api/token-api";
import {ProxyRPCRequest, VerifiedAccount} from "./node-api/proxy-api";
import {multiplierFromDifficulty} from "./tools";
import {MynanoVerifiedAccountsResponse, mynanoToVerifiedAccount} from "./mynano-api/mynano-api";
import process from 'process'
import {createPrometheusClient, MaybeTimedCall, PromClient} from "./prom-client";
import * as core from "express-serve-static-core";
import {createHttpServer, createHttpsServer, readHttpsOptions, websocketListener} from "./http";
import * as http from "http";
import * as https from "https";
import {createProxyAuthorizer, ProxyAuthorizer} from "./authorize-user";
import ipRangeCheck from "ip-range-check"
import BasicAuth from 'express-basic-auth'
import * as Fs from 'fs'
import Express from 'express'
import Cors from 'cors'
import { IpDeniedError, IpFilter } from 'express-ipfilter'
import { scheduleJob } from 'node-schedule'
import WebSocketServer from 'websocket'
import WS from 'ws'
import Helmet from 'helmet'
import { config } from 'dotenv'
import consoleStamp from 'console-stamp'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import * as crypto from 'crypto'

config() // load variables from .env into the environment
consoleStamp(console)

const configPaths: ConfigPaths = readConfigPathsFromENV()
const test_override_http = !process.env.OVERRIDE_USE_HTTP

// lowdb init
const order_db: OrderDB =  lowdb(new FileSync<OrderSchema>(configPaths.db_path))
const tracking_db: UserDB = lowdb(new FileSync<UserSchema>(configPaths.websocket_path))
order_db.defaults({orders: []}).write()
tracking_db.defaults({users: []}).write()
tracking_db.update('users', n => []).write() //empty db on each new run

// Custom VARS. DON'T CHANGE HERE. Change in settings.json file.

// default vars
let cache_duration_default: number = 60
let rpcCache: NodeCache | null = null
const price_url = 'https://api.coinpaprika.com/v1/tickers/nano-nano'
const mynano_ninja_url = 'https://mynano.ninja/api/accounts/verified'
//const price_url2 = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=1567'
//const CMC_API_KEY = 'xxx'
const API_TIMEOUT: number = 20000 // 10sec timeout for calling http APIs
const work_threshold_default: string = 'fffffff800000000'
const work_default_timeout: number = 10 // x sec timeout before trying next delegated work method (only when use_dpow or use_bpow)
const bpow_url: string = 'https://bpow.banano.cc/service/'
const dpow_url: string = 'https://dpow-api.nanos.cc/service'
const work_token_cost = 10 // work_generate will consume x token points
let ws: ReconnectingWebSocket | null = null
let global_tracked_accounts: string[] = [] // the accounts to track in websocket (synced with database)
let websocket_connections: Map<string, connection> = new Map<string, connection>() // active ws connections

// track daily requests and save to a log file (daily stat is reset if the server is restarted)
// ---
let rpcCount: number = 0
let logdata: LogData[] = []
try {
  // read latest count from file
  logdata = JSON.parse(Fs.readFileSync(configPaths.request_stat, 'utf-8'))
  rpcCount = logdata[logdata.length - 1].count
}
catch(e) {
  console.log(`Could not read ${configPaths.request_stat}. Normal for first run.`, e)
}

// save the stat file first time
if (logdata.length == 0) {
  try {
    // write log file
    Fs.writeFileSync(configPaths.request_stat, JSON.stringify(logdata, null, 2))
  }
  catch(e) {
    console.log(`Could not write ${configPaths.request_stat}`, e)
  }
}

// Stat file scheduler
scheduleJob('0 0 * * *', () => {
  appendFile(rpcCount)
  rpcCount = 0
  // update latest logdata from file
  try {
    logdata = JSON.parse(Fs.readFileSync(configPaths.request_stat, 'utf-8'))
  }
  catch(e) {
    console.log(`Could not read ${configPaths.request_stat}`, e)
  }
})
function appendFile(count: number) {
  try {
    // append new count entry
    let datestring: string = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
    logdata.push({
      date: datestring,
      count: count
    })

    // write updated log
    Fs.writeFileSync(configPaths.request_stat, JSON.stringify(logdata, null, 2))
    logThis("The request stat file was updated!", log_levels.info)
  }
  catch(e) {
    console.log(`Could not write ${configPaths.request_stat}`, e)
  }
}
// Read settings from file

// ---
const users: Credentials[] = readCredentials(configPaths.creds)
const settings: ProxySettings = readProxySettings(configPaths.settings)
const user_settings: UserSettingsConfig = readUserSettings(configPaths.user_settings)
const defaultUserSettings: UserSettings = loadDefaultUserSettings(settings)
const promClient: PromClient | undefined = settings.enable_prometheus_for_ips.length > 0 ? createPrometheusClient() : undefined
const userAuthorizer: ProxyAuthorizer | undefined = settings.use_auth ? createProxyAuthorizer(defaultUserSettings, user_settings, users, promClient) : undefined
const powSettings: PowSettings = readPowSettings(configPaths.pow_creds, settings)

proxyLogSettings(console.log, settings)

// Periodically check, recover and remove old invactive olders
if (settings.use_tokens) {
  // Each hour
  scheduleJob('0 * * * *', () => {
    checkOldOrders()
  })
}

async function checkOldOrders() {
  let now = Math.floor(Date.now()/1000)
  // get all orders older than 60min
  let orders = order_db.get('orders')
    .filter(order => order.timestamp < now - 3600)
    .value()
  // Process all old orders
  //logThis("Checking old orders", log_levels.info)
  orders.forEach(async function(order) {
    // Reset status in case the order was interrupted and set a small nano_amount to allow small pending to create tokens
    order_db.get('orders').find({priv_key: order.priv_key}).assign({order_waiting: false, processing: false, nano_amount: 0.000000001}).write()
    await Tokens.repairOrder(order.address, order_db, settings.node_url)

    // Remove if order has been unprocessed with a timeout for 1 month
    if (order.tokens === 0 && order.order_time_left === 0 && order.hashes.length === 0 && order.timestamp < now - 3600*24*31) {
      logThis("REMOVING ORDER:", log_levels.info)
      logThis(order_db.get('orders').remove({token_key:order.token_key}).write().toString(), log_levels.info)
    }
  })
}

// Define the proxy app
const app: core.Express = Express()
app.use(Helmet())

// Allow all origin in cors or a whitelist if present
if (settings.use_cors) {
  if (settings.cors_whitelist.length == 0) {
    app.use(Cors())
  }
  else {
    let corsOptions = function (req: Request, callback: (err: Error | null, options?: CorsOptions) => void) {
      if (settings.cors_whitelist.indexOf(req.header('Origin')) !== -1 || settings.cors_whitelist.indexOf(req.ip) !== -1) {
        callback(null, {origin: true}) // reflect (enable) the requested origin in the CORS response
      } else {
        callback(new Error('Not allowed')) // disable CORS for this request
      }
    }
    app.use(Cors(corsOptions))
  }
}

app.use(Express.json({type: '*/*'}))
app.use(Express.static('static'))

// Define the number of proxy hops on the system to detect correct source IP for the filters below
if (settings.proxy_hops > 0) {
  app.set('trust proxy', settings.proxy_hops)
}

// Set up blacklist and use the proxy number defined in the settings. Log only IP if blocked
if (settings.use_ip_blacklist) {
  app.use(IpFilter(settings.ip_blacklist, {log: false, logLevel: 'deny', trustProxy: settings.proxy_hops, logF: message => logThis(message, 'info')}))
}

// Error handling
app.use((err: Error, req: Request, res: Response, _next: any) => {
  if (err instanceof SyntaxError) {
    return res.status(400).json({error: err.message}); // Bad request
  }
  else if (err instanceof IpDeniedError) {
    return res.status(401).json({error: 'IP has been blocked'})
  }
  else {
    // @ts-ignore status field does not exist, only return err here?
    return res.status(500).json({error: err.status})
  }
})

// Block IP if requesting too much but skipped if a valid token_key is provided (long interval)
if (settings.use_rate_limiter) {
  const limiter1 = new RateLimiterMemory({
    keyPrefix: 'limit1',
    points: settings.rate_limiter.request_limit,
    duration: Math.round(settings.rate_limiter.time_window/1000),
  })

  const rateLimiterMiddleware1 = (req: Request, res: Response, next: (err?: any) => any) => {
    if(promClient && req.path === promClient.path) {
      next();
      return
    }
    if (settings.use_tokens) {
      // Check if token key exist in DB and have enough tokens, then skip IP block by returning true
      if ('token_key' in req.body && order_db.get('orders').find({token_key: req.body.token_key}).value()) {
        if (order_db.get('orders').find({token_key: req.body.token_key}).value().tokens > 0) {
          next()
          return
        }
      }
      // @ts-ignore overloaded method not found
      if ('token_key' in req.query && order_db.get('orders').find({token_key: req.query.token_key}).value()) {
        // @ts-ignore overloaded method not found
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
    let points_to_consume = 1
    // work is more costly
    if (req.body.action === 'work_generate') {
      points_to_consume = work_token_cost
    }
    limiter1.consume(req.ip, points_to_consume)
      .then((response: RateLimiterRes) => {
        res.set("X-RateLimit-Limit", settings.rate_limiter.request_limit)
        res.set("X-RateLimit-Remaining", `${settings.rate_limiter.request_limit-response.consumedPoints}`)
        res.set("X-RateLimit-Reset", `${new Date(Date.now() + response.msBeforeNext)}`)
        next()
      })
      .catch((rej: any) => {
        promClient?.incRateLimited(req.ip)
        res.set("X-RateLimit-Limit", settings.rate_limiter.request_limit)
        res.set("X-RateLimit-Remaining", `${Math.max(settings.rate_limiter.request_limit-rej.consumedPoints, 0)}`)
        res.set("X-RateLimit-Reset", `${new Date(Date.now() + rej.msBeforeNext)}`)
        res.status(429).send('Max allowed requests of ' + settings.rate_limiter.request_limit + ' reached. Time left: ' + Math.round(rej.msBeforeNext/1000) + 'sec')
      })
   }

   app.use(rateLimiterMiddleware1)
}

// Ddos protection for all requests (short interval)
const limiter2 = new RateLimiterMemory({
  keyPrefix: 'limit2',
  points: settings.ddos_protection.request_limit, // limit each IP to x requests per duration
  duration: Math.round(settings.ddos_protection.time_window/1000), // rolling time window in sec
})

const rateLimiterMiddleware2 = (req: Request, res: Response, next: (err?: any) => any) => {
  limiter2.consume(req.ip, 1)
    .then((response: RateLimiterRes) => {
      next()
    })
    .catch((error?: Error) => {
      promClient?.incDDOS(req.ip)
      res.status(429).send('You are making requests too fast, please slow down!')
    })
 }

 app.use(rateLimiterMiddleware2)

// Limit by slowing down requests
if (settings.use_slow_down) {
  const slow_down_settings = SlowDown({
    windowMs: settings.slow_down.time_window,
    delayAfter: settings.slow_down.request_limit,
    delayMs: settings.slow_down.delay_increment,
    maxDelayMs: settings.slow_down.max_delay,
    // skip limit for certain requests
    skip: function(req, res) {
      if (settings.use_tokens) {
        // Check if token key exist in DB and have enough tokens, then skip IP block by returning true
        if ('token_key' in req.body && order_db.get('orders').find({token_key: req.body.token_key}).value()) {
          if (order_db.get('orders').find({token_key: req.body.token_key}).value().tokens > 0) {
            return true
          }
        }
        // @ts-ignore overloaded method not found
        if ('token_key' in req.query && order_db.get('orders').find({token_key: req.query.token_key}).value()) {
          // @ts-ignore overloaded method not found
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
    },
    onLimitReached(req, res, options) {
      promClient?.incSlowDown(req.ip)
    }
  })
  app.use(slow_down_settings)
}

// Set up cache
if (settings.use_cache) {
  rpcCache = new NodeCache( { stdTTL: cache_duration_default, checkperiod: 10 } )
}

// Deduct token count for given token_key
function useToken(query: ProxyRPCRequest) {
  let token_key = query.token_key
  // Find token_key in order DB
  if (order_db.get('orders').find({token_key: token_key}).value()) {
    let tokens = order_db.get('orders').find({token_key: token_key}).value().tokens
    if (tokens > 0) {
      let decrease_by = 1
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
function appendRateLimiterStatus(res: Response, data: any) {
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

// Update current list of tracked accounts by resubscribing
function subscribeTrackedAccounts(update: boolean, id: string, updatedAccounts: string[] = []) {
  const confirmation_subscription: WSNodeSubscribe = {
    // update does not seem to work as expected, subscribe will do for now
    // the acknowledge will be "subscribe"
    //"action": update ? "update" : "subscribe",
    "action": "subscribe",
    "topic": "confirmation",
    "ack": true,
    "id": id,
    "options": { "all_local_accounts": false,
      "accounts": global_tracked_accounts
    }
  }
  if(ws != null) {
    ws.send(JSON.stringify(confirmation_subscription))
  }
}

// Subscribe to all
function subscribeAll(id: string) {
  const confirmation_subscription : WSNodeSubscribeAll = {
    "action": "subscribe",
    "topic": "confirmation",
    "ack": true,
    "id": id
  }
  if(ws != null) {
    ws.send(JSON.stringify(confirmation_subscription))
  }
}

// Log function
function logThis(str: string, level: LogLevel) {
  if (settings.log_level == log_levels.info || level == settings.log_level) {
    if (level == log_levels.info) {
      console.info(str)
    }
    else {
      console.warn(str)
    }
  }
  promClient?.incLogging(level)
}

const renderRoot = (title: string, message: string) => {
  return `<html lang="en"><head><title>${title}</title></head><body><h4>${message}</h4><p></p></body></html>`
}

// Default get requests
if (settings.request_path != '/') {
  app.get('/', async (req: Request, res: Response) => {
    res.set('content-type', 'text/html').send(renderRoot('RPCProxy API', 'Bad API path'))
  })
}

if(promClient) {
  app.get(promClient.path, async (req: Request, res: Response) => {
    const remoteAddress: string | undefined = req.connection.remoteAddress;
    if(remoteAddress && ipRangeCheck(remoteAddress, settings.enable_prometheus_for_ips)) {
      let metrics = await promClient.metrics();
      res.set('content-type', 'text/plain').send(metrics)
    } else {
      logThis(`Prometheus not enabled for ${remoteAddress}`, log_levels.info)
      res.status(403).send()
    }
  })
}

let expressHandlers: Handler[] = []
if(userAuthorizer) {
  expressHandlers.push(BasicAuth({ authorizer: userAuthorizer.myAuthorizer }))
}

// Process any API requests
app.get(settings.request_path, expressHandlers, (req: Request, res: Response) => {
  // @ts-ignore
  processRequest(req.query, req, res)
})

// Define the request listener
app.post(settings.request_path, expressHandlers, (req: Request, res: Response) => {
  processRequest(req.body, req, res)
})

async function processTokensRequest(query: ProxyRPCRequest, req: Request, res: Response<TokenAPIResponses>): Promise<Response> {
  switch (query.action) {
    // Initiate token purchase
    case 'tokens_buy':
      let token_key = ""
      let token_amount = 0
      if (query.token_amount) {
        token_amount = Math.round(query.token_amount)
      }
      else {
        return res.status(500).json({ error: 'The amount of tokens (token_amount) to purchase must be provided'})
      }
      if (query.token_key) {
        token_key = query.token_key
      }

      let payment_request = await Tokens.requestTokenPayment(token_amount, token_key, order_db, settings.node_url)
      return res.json(payment_request)

    // Verify order status
    case 'tokenorder_check':
      if (query.token_key) {
        let token_key = query.token_key
        let status = await Tokens.checkOrder(token_key, order_db)
        return res.json(status)
      }
      else {
        return res.status(500).json({ error: 'No token key provided'})
      }

    // Claim back private key and replace the account
    case 'tokenorder_cancel':
      if (query.token_key) {
        let token_key = query.token_key
        let status = await Tokens.cancelOrder(token_key, order_db)
        return res.json(status)
      }
      else {
        return res.status(500).json({ error: 'No token key provided'})
      }

    // Verify order status
    case 'tokens_check':
      if ('token_key' in query) {
        let token_key = query.token_key
        let status = await Tokens.checkTokens(token_key, order_db)
        return res.json(status)
      }
      else {
        return res.status(500).json({ error: 'No token key provided'})
      }

    // Check token price
    case 'tokenprice_check':
      let status = await Tokens.checkTokenPrice()
      return res.json(appendRateLimiterStatus(res, status))

    default:
      logThis(`Unable to handle token api=${query.action}, this is probably a developer error`, log_levels.warning)
      return res.status(500).json({ error: 'Invalid token API request'})
  }
}

/** Returns a price lookup from cache, or fetches from third party API */
async function getOrFetchPrice(): Promise<PriceResponse | undefined> {
  const cachedValue: PriceResponse | undefined = rpcCache?.get('price')
  if (cachedValue && Tools.isValidJson(cachedValue)) {
    logThis("Cache requested: " + 'price', log_levels.info)
    return cachedValue
  } else {
    let endPriceTimer: MaybeTimedCall = promClient?.timePrice()
    try {
      let data: PriceResponse = await Tools.getData(price_url, API_TIMEOUT)
      // Store the price in cache for 10sec
      if (!rpcCache?.set('price', data, 10)) {
        logThis(`Failed saving cache for price`, log_levels.warning)
      }
      //res.json({"Price USD":data.data["1567"].quote.USD.price}) // sending back json price response (CMC)
      //res.json({"Price USD":data.quotes.USD.price}) // sending back json price response (Coinpaprika)
      return data // sending back full json price response (Coinpaprika)
    } catch (err) {
      logThis(`Failed looking up price: ${err.toString()}`, log_levels.warning)
      return undefined
    } finally {
      endPriceTimer?.()
    }
  }
}

async function processRequest(query: ProxyRPCRequest, req: Request, res: Response<ProcessResponse | TokenAPIResponses>): Promise<Response> {

  // @ts-ignore
  const userSettings = (userAuthorizer && req.auth) ?
      // @ts-ignore
      (userAuthorizer.getUserSettings(req.auth.user, req.auth.password) || defaultUserSettings) : defaultUserSettings

  if (query.action !== 'tokenorder_check') {
    logThis('RPC request received from ' + req.ip + ': ' + query.action, log_levels.info)
    rpcCount++
  }

  if(settings.use_tokens && isTokensRequest(query.action)) {
    return processTokensRequest(query, req, res);
  }

  // Block non-allowed RPC commands
  if (!query.action || userSettings.allowed_commands.indexOf(query.action) === -1) {
    logThis('RPC request is not allowed: ' + query.action, log_levels.info)
    return res.status(500).json({ error: `Action ${query.action} not allowed`})
  }
  
  // Block pending on specific account
  if (query.action === 'pending' && query.account?.toLowerCase().replace('xrb_','nano_') === 'nano_1111111111111111111111111111111111111111111111111111hifc8npp') {
    return res.status(403).json({error: 'Account not allowed'})
  }

  // Decrease user tokens and block if zero left
  let tokens_left: number | null = null
  let token_header: string | undefined = req.get('Token')
  if (settings.use_tokens) {
    // If token supplied via header, use it instead
    if (token_header) {
      query.token_key = token_header
    }
    if (query.token_key) {
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

  const tokenUsed: boolean =  (tokens_left && tokens_left >= 0) ? true:false
  promClient?.incRequest(query.action, req.ip, tokenUsed)

  // Respond directly if non-node-related request
  //  --
  if (query.action === 'price') {
    const priceResponse: PriceResponse | undefined = await getOrFetchPrice()
    if(priceResponse) {
      if (tokens_left != null) {
        priceResponse.tokens_total = tokens_left
      }
      return res.json(appendRateLimiterStatus(res, priceResponse))
    } else {
      return res.status(500).json({error: "Unable to lookup price"})
    }
  }

  if(query.action === 'verified_accounts') {
    let endVerifiedAccountsTimer: MaybeTimedCall = undefined
    try {
      // Use cached value first
      const cachedValue: MynanoVerifiedAccountsResponse | undefined = rpcCache?.get('verified_accounts')
      if (cachedValue && Tools.isValidJson(cachedValue)) {
        logThis("Cache requested: " + 'verified_accounts', log_levels.info)
        return res.json(appendRateLimiterStatus(res, cachedValue.map(mynanoToVerifiedAccount)))
      }
      endVerifiedAccountsTimer = promClient?.timeVerifiedAccounts()
      let data: MynanoVerifiedAccountsResponse = await Tools.getData(mynano_ninja_url, API_TIMEOUT)
      // Store the list in cache for 60 sec
      if (!rpcCache?.set('verified_accounts', data, 60)) {
        logThis("Failed saving cache for " + 'verified_accounts', log_levels.warning)
      }
      return res.json(appendRateLimiterStatus(res, data.map(mynanoToVerifiedAccount)))
    }
    catch(err) {
      return res.status(500).json({error: err.toString()})
    } finally {
      endVerifiedAccountsTimer?.()
    }
  }

  if (query.action === 'mnano_to_raw') {
    if (query.amount) {
      let amount = Tools.MnanoToRaw(query.amount)
      return res.json(appendRateLimiterStatus(res, {"amount":amount}))
    }
    else {
      return res.status(500).json({ error: 'Amount not provided!'})
    }
  }

  if (query.action === 'mnano_from_raw') {
    if (query.amount) {
      let amount = Tools.rawToMnano(query.amount)
      return res.json(appendRateLimiterStatus(res, {"amount":amount}))
    }
    else {
      return res.status(500).json({ error: 'Amount not provided!'})
    }
  }

  // Force no watch_work (don't want the node to perform pow). Deprecated in node v22 but keep this code for now.
  if (settings.disable_watch_work) {
    if (query.action === 'process') {
      query.watch_work = 'false'
    }
  }

  // Handle work generate via dpow and/or bpow
  if (query.action === 'work_generate' && (settings.use_dpow || settings.use_bpow || settings.use_work_server || settings.use_work_peers)) {
    if (query.hash) {
      let bpow_failed = false
      let dpow_failed = false
      // Set difficulty to SEND default if it was not defined
      if (!query.difficulty) {
        query.difficulty = work_threshold_default;
      }

      if (!(query.timeout)) {
        query.timeout = work_default_timeout
      }

      if (settings.use_work_peers && !settings.use_bpow && !settings.use_dpow && !settings.use_work_server) {
        //Only add use_peers when _NOT_ using any of bpow or dpow.
        query.use_peers = "true"
      }

      // Try bpow first
      if (settings.use_bpow && powSettings.bpow) {
        logThis("Requesting work using bpow with diff: " + query.difficulty, log_levels.info)
        query.user = powSettings.bpow.user
        query.api_key = powSettings.bpow.key

        try {
          let data: ProcessDataResponse = await Tools.postData(query, bpow_url, work_default_timeout*1000*2)
          data.difficulty = query.difficulty
          data.multiplier = multiplierFromDifficulty(data.difficulty, work_threshold_default)
          if (tokens_left != null) {
            data.tokens_total = tokens_left
          }
          // if bpow time out
          if (data.error) {
            logThis("bPoW failed: " + data.error, log_levels.warning)
          }
          if ((data.error) || !(data.work)) {
            bpow_failed = true
            if (!settings.use_dpow) {
              return res.json(appendRateLimiterStatus(res, data)) // forward error if not retrying with dpow
            }
          }
          else if (data.work) {
            return res.json(appendRateLimiterStatus(res, data)) // sending back successful json response
          }
        }
        catch(err) {
          bpow_failed = true
          logThis("Bpow connection error: " + err.toString(), log_levels.warning)
          if (!settings.use_dpow) {
            return res.status(500).json({error: err.toString()})
          }
        }
      }
      // Use dpow only if not already used bpow or bpow timed out
      if ((!settings.use_bpow || bpow_failed) && settings.use_dpow && powSettings.dpow) {
        logThis("Requesting work using dpow with diff: " + query.difficulty, log_levels.info)
        query.user = powSettings.dpow.user
        query.api_key = powSettings.dpow.key

        try {
          let data: ProcessDataResponse = await Tools.postData(query, dpow_url, work_default_timeout*1000*2)
          data.difficulty = query.difficulty
          data.multiplier = multiplierFromDifficulty(data.difficulty, work_threshold_default)
          if (tokens_left != null) {
            data.tokens_total = tokens_left
          }
          if (data.error) {
            logThis("dPoW failed: " + data.error, log_levels.warning)
          }
          if ((data.error) || !(data.work)) {
            dpow_failed = true
            if (!settings.use_work_server) {
              return res.json(appendRateLimiterStatus(res, data)) // forward error if not retrying with work server
            }
          }
          else if (data.work) {
            return res.json(appendRateLimiterStatus(res, data)) // sending back json response (regardless if timeout error)
          }
        }
        catch(err) {
          dpow_failed = true
          logThis("Dpow connection error: " + err.toString(), log_levels.warning)
          if (!settings.use_work_server) {
            return res.status(500).json({error: err.toString()})
          }
        }
      }
      // Use work server only if not already used bpow/dpow or bpow/dpow timed out
      if (((!settings.use_bpow && !settings.use_dpow) || (bpow_failed || dpow_failed)) && settings.use_work_server && powSettings.work_server) {
        logThis("Requesting work using work server with diff: " + query.difficulty, log_levels.info)

        try {
          let data: ProcessDataResponse = await Tools.postData(query, powSettings.work_server.url+':'+powSettings.work_server.port, work_default_timeout*1000*2)
          data.difficulty = query.difficulty
          data.multiplier = multiplierFromDifficulty(data.difficulty, work_threshold_default)
          if (tokens_left != null) {
            data.tokens_total = tokens_left
          }
          if (data.error) {
            logThis("work server failed: " + data.error, log_levels.warning)
          }
          return res.json(appendRateLimiterStatus(res, data)) // sending back json response (regardless if timeout error)
        }
        catch(err) {
          logThis("Work server connection error: " + err.toString(), log_levels.warning)
          return res.status(500).json({error: err.toString()})
        }
      }
    }
    else {
      return res.status(500).json({ error: 'Hash not provided!'})
    }
  }

  // ---

  // Read cache for current request action, if there is one
  if (userSettings.use_cache) {
    const value: number | undefined = userSettings.cached_commands[query.action]
    if(value !== undefined) {
      const cachedValue: any = rpcCache?.get(query.action)
      if (Tools.isValidJson(cachedValue)) {
        logThis("Cache requested: " + query.action, log_levels.info)
        if (tokens_left != null) {
          cachedValue.tokens_total = tokens_left
        }
        return res.json(appendRateLimiterStatus(res, cachedValue))
      }
    }
  }

  // Limit response count (if count parameter is provided)
  if (userSettings.use_output_limiter) {
    const value: number | undefined = userSettings.limited_commands[query.action]
    if (value !== undefined) {
      // Handle multi-account calls a bit different since it's an array of accounts
      if (query.action === 'accounts_frontiers' || query.action === 'accounts_balances' || query.action === 'accounts_pending') {
        if (query.accounts?.length > value) {
          query.accounts = query.accounts.slice(0, value)
          logThis("Query accounts was limited to " + value.toString(), log_levels.info)
        }
        // also limit count for accounts_pending
        if (query.action === 'accounts_pending') {
          if (query.count > value * 10 || !(query.count)) {
            query.count = value * 10
            logThis("Response count was limited to " + (value * 10).toString(), log_levels.info)
          }
        }
      } else if (query.count > value || !(query.count)) {
        query.count = value
        logThis("Response count was limited to " + value.toString(), log_levels.info)
      }
      // disallow use of account_filter because it can be misused
      if (query.account_filter) {
        delete query.account_filter
      }
    }
  }

  // Send the request to the Nano node and return the response
  let endNodeTimer: MaybeTimedCall = promClient?.timeNodeRpc(query.action)
  try {
    let data: ProcessDataResponse = await Tools.postData(query, settings.node_url, API_TIMEOUT)
    // Save cache if applicable
    if (settings.use_cache) {
      const value: number | undefined = userSettings.cached_commands[query.action]
      if(value !== undefined) {
        if (!rpcCache?.set(query.action, data, value)) {
          logThis("Failed saving cache for " + query.action, log_levels.warning)
        }
      }
    }
    if (tokens_left != null) {
      data.tokens_total = tokens_left
    }
    return res.json(appendRateLimiterStatus(res, data)) // sending back json response
  }
  catch(err) {
    logThis("Node conection error: " + err.toString(), log_levels.warning)
    return res.status(500).json({error: err.toString()})
  } finally {
    endNodeTimer?.()
  }
}

module.exports = {
  processRequest: processRequest,
  trackAccount: trackAccount,
  tracking_db: tracking_db,
  app: app,
}

process.on('SIGINT', () => {
  logThis('Proxy shut down', log_levels.info)
  process.exit(0)
})

// Create an HTTP service
if (settings.use_http && test_override_http) {
  createHttpServer(app, settings.http_port)
}
const httpsOptions: https.ServerOptions | undefined = settings.use_https ? readHttpsOptions(settings) : undefined;
// Create an HTTPS service
if (settings.use_https && httpsOptions) {
  createHttpsServer(app, settings.https_port, httpsOptions)
}

let websocket_servers: (http.Server | https.Server)[] = []
if(settings.use_websocket) {
  if(settings.use_http && test_override_http) {
    websocket_servers.push(createHttpServer(websocketListener, settings.websocket_http_port, "websocket (http)"))
  }
  if(settings.use_https && httpsOptions) {
    websocket_servers.push(createHttpsServer(websocketListener, settings.websocket_https_port, httpsOptions, "websocket (https)"))
  }
}

// WEBSOCKET SERVER
//---------------------
if (settings.use_websocket) {
  let wsServer: WSServer = new WebSocketServer.server({
    httpServer: websocket_servers,
    autoAcceptConnections: false
  })

  // websocket ddos protection settings
  const websocket_limiter = new RateLimiterMemory({
    keyPrefix: 'limit_websocket',
    points: settings.ddos_protection.request_limit,
    duration: Math.round(settings.ddos_protection.time_window/1000),
  })

  wsServer.on('request', async function(request: WSRequest) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject()
      //logThis('Connection from origin ' + request.origin + ' rejected.', log_levels.info)
      return
    }

    let remote_ip = request.remoteAddress
    logThis('Websocket Connection requested from: ' + remote_ip, log_levels.info)
    promClient?.incWebsocketSubscription(remote_ip)

    // Black list protection
    if (settings.ip_blacklist.includes(remote_ip)) {
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

    connection.on('message', function(message: IMessage) {
      if (message.type === 'utf8' && message.utf8Data) {
          //console.log('Received Message: ' + message.utf8Data + ' from ' + remote_ip)
          try {
            let msg: WSMessage = JSON.parse(message.utf8Data)
            if (msg.topic === 'confirmation') {
              let newId = crypto.randomBytes(16).toString("hex")
              // New subscription
              if ((msg.action === 'subscribe' || msg.action === 'update') && msg.options && msg.options.accounts &&
                msg.options.accounts.length > 0 && msg.options.accounts[0] !== '') {
                {
                  // check if new unique accounts + existing accounts exceed max limit
                  // get existing tracked accounts
                  let current_user = tracking_db.get('users').find({ip: remote_ip}).value()
                  var current_tracked_accounts = {} //if not in db, use empty dict
                  if (current_user !== undefined) {
                    current_tracked_accounts = current_user.tracked_accounts
                    // reuse the ID if it exist
                    if (current_user.rpcId && current_user.rpcId !== '') {
                      newId = current_user.rpcId
                    }
                  }

                  // count new accounts that are not already tracked
                  let unique_new = 0
                  msg.options.accounts.forEach(function (address: string) {
                    var address_exists = false
                    for (const [key] of Object.entries(current_tracked_accounts)) {
                      if (key === address) {
                        address_exists = true
                      }
                    }
                    if (!address_exists) {
                      unique_new++
                    }
                  })
                  if (unique_new + Object.keys(current_tracked_accounts).length <= settings.websocket_max_accounts) {
                    // save connection to global dicionary to reuse when getting messages from the node websocket
                    websocket_connections.set(remote_ip, connection)

                    // mirror the subscription to the real websocket
                    var tracking_updated = false
                    msg.options.accounts.forEach(function (address: string) {
                      if (trackAccount(connection.remoteAddress, address, newId, 'id' in msg ? msg.id : "")) {
                        tracking_updated = true
                      }
                    })
                    if (tracking_updated) {
                      if (msg.action === 'subscribe') {
                        subscribeTrackedAccounts(false, newId) //update the websocket subscription (resubscribe)
                      } else if (msg.action === 'update') {
                        subscribeTrackedAccounts(true, newId) //update the websocket subscription
                      }
                    } else {
                      // if not updating the tracking because already tracking, acknowledge the user anyway
                      logThis('Client already subscribed to the node but now updated internally', log_levels.info)
                      const seconds = Math.round(Date.now() / 1000).toString()
                      if (msg.action === 'subscribe') {
                        wsSend(connection, {ack: 'subscribe', time: seconds, id: 'id' in msg ? msg.id : ""})
                      } else if (msg.action === 'update') {
                        wsSend(connection, {ack: 'update', time: seconds, id: 'id' in msg ? msg.id : ""})
                      }
                    }
                  } else {
                    wsSend(connection, {error: 'Too many accounts subscribed. Max is ' + settings.websocket_max_accounts})
                  }
                }

                // subscribe to all
              } else if (msg.action === 'subscribe') {
                if(settings.allow_websocket_all) {
                  trackAccount(connection.remoteAddress, 'all', newId, 'id' in msg ? msg.id : "")
                  websocket_connections.set(remote_ip, connection)
                  subscribeAll(newId)
                } else {
                  wsSend(connection, {error: 'Subscribe to ALL not allowed. Please include an array of accounts.'})
                }
                
              } else if (msg.action === 'unsubscribe') {
                logThis('User unsubscribed from confirmation: ' + remote_ip, log_levels.info)
                tracking_db.get('users').find({ip: remote_ip}).assign({'tracked_accounts': []}).write()
                const seconds = Math.round(Date.now() / 1000).toString()
                wsSend(connection, {ack: 'unsubscribe', time: seconds, id: 'id' in msg ? msg.id : ""})
              }
            }
            else if (msg.action === 'ping') {
              wsSend(connection, {ack: 'pong', time: new Date().getTime().toString(), id: 'id' in msg ? msg.id : ""})
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
      websocket_connections.delete(remote_ip)
    })
  })
}

function wsSend(connection: connection, val: WSSubscribe | WSError | WSPong): void {
  connection.sendUTF(JSON.stringify(val, null, 2))
}

function originIsAllowed(origin: string) {
  // put logic here to detect whether the specified origin is allowed.
  // TODO
  return true
}

// Start websocket subscription for an address
function trackAccount(remote_ip: string, address: string, rpcId: string, clientId: string): boolean {
  if (address !== 'all' && !Tools.validateAddress(address)) {
    return false
  }
  // get existing tracked accounts
  let current_user = tracking_db.get('users').find({ip: remote_ip}).value()
  let current_tracked_accounts: Record<string, TrackedAccount> = {} //if not in db, use empty dict
  if (current_user !== undefined) {
    current_tracked_accounts = current_user.tracked_accounts
  }

  // check if account is not already tracked
  let address_exists = false
  for (const [key] of Object.entries(current_tracked_accounts)) {
    if (key === address)  {
      address_exists = true
    }
  }

  // start tracking new address
  if (!address_exists) {
    current_tracked_accounts[address] = { timestamp: Math.floor(Date.now()/1000) } // append new tracking

    // add user and tracked account to db
    if (current_user === undefined) {
      const userinfo: User = {
        ip : remote_ip,
        rpcId : rpcId,
        clientId: clientId,
        tracked_accounts : current_tracked_accounts
      }
      tracking_db.get('users').push(userinfo).write()
    }
    // update existing user
    else {
      tracking_db.get('users').find({ip: remote_ip}).assign({tracked_accounts: current_tracked_accounts, rpcId: rpcId, clientId: clientId}).write()
    }

    // check if account is already tracked globally or start tracking
    let tracking_exists = false
    global_tracked_accounts.forEach(function(tracked_address) {
      if (tracked_address === address) {
        tracking_exists = true
      }
    })
    if (!tracking_exists && address !== 'all') {
      global_tracked_accounts.push(address)
      return true
    }
  }
  return false
}

//WEBSOCKET CLIENT FOR NANO NODE
// Create a reconnecting WebSocket.
// we wait a maximum of 2 seconds before retrying.
if (settings.use_websocket) {
  let newWebSocket: ReconnectingWebSocket = new ReconnectingWebSocket(settings.node_ws_url, [], {
    WebSocket: WS,
    connectionTimeout: 1000,
    maxRetries: Infinity,
    maxReconnectionDelay: 8000,
    minReconnectionDelay: 3000
  })

  // A tracked account was detected
  newWebSocket.onmessage = (msg: MessageEvent) => {
    let data_json: WSNodeReceive = JSON.parse(msg.data)

    // Check if the tracked account belongs to a user
    if (data_json.topic === "confirmation") {
      let observed_account = data_json.message.account
      let observed_link = data_json.message.block.link_as_account

      // FOR ACCOUNT TRACKING
      let websocketUsers = tracking_db.get('users').value()
      // loop all existing tracked accounts as subscribed to by users
      websocketUsers.forEach(async function(user) {
        if (user.tracked_accounts && user.ip) {
          let allFound = false
          // user is tracking all accounts
          for (const [key] of Object.entries(user.tracked_accounts)) {
            if (key === 'all') {
              websocket_connections.get(user.ip)?.sendUTF(msg.data)
              promClient?.incWebsocketMessageAll(user.ip)
              allFound = true
              break
            }
          }

          // user is tracking all accounts, no need to send account specific messages
          if (!allFound) {
            for (const [key] of Object.entries(user.tracked_accounts)) {
              if (key === observed_account || key === observed_link) {
                // send message to each subscribing user for this particular account
                logThis('A tracked account was pushed to client: ' + key, log_levels.info)
                websocket_connections.get(user.ip)?.sendUTF(msg.data)
                promClient?.incWebsocketMessage(user.ip)
              }
            }
          }
        }
      })
    }
    else if (data_json.ack === "subscribe" || data_json.ack === "update") {
      logThis("Websocket acknowledged " + data_json.ack + " for ID: " + data_json.id, log_levels.info)
      let tracked_accounts = tracking_db.get('users').value()
      // loop all users and find correct id
      tracked_accounts.forEach(async function(user) {
        if (user.ip && user.rpcId) {
          // send back acknowledge to the correct user but replace the unique ID with the client ID
          if (data_json.id === user.rpcId) {
            data_json.id = user.clientId
            websocket_connections.get(user.ip)?.sendUTF(JSON.stringify(data_json))
          }
        }
      })
    }
  }

  // As soon as we connect, subscribe to confirmations (as of now there are none while we start up the server)
  newWebSocket.onopen = () => {
    logThis("Node websocket is open", log_levels.info)
    subscribeTrackedAccounts(false, 'global')
  }
  newWebSocket.onclose = () => {
    logThis("Node websocket is closed", log_levels.info)
  }
  newWebSocket.onerror = (e: ErrorEvent) => {
    logThis("Main websocket: " + e.error, log_levels.warning)
  }
  ws = newWebSocket
}
