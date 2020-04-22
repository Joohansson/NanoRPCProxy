const Nacl =       require('tweetnacl/nacl')
const Nano =       require('nanocurrency')
const Wallet =     require('nanocurrency-web')
const Fs =         require('fs')
const Tools =      require('./tools')

const API_TIMEOUT = 10000 // 10sec timeout for calling http APIs

var Work_Server = "http://127.0.0.1:7000" // the work server for doing PoW (the node can be used as well, for example http://127.0.0.1:7076, but enable_control is needed in the node config)
var Token_Price = 0.0001 // Nano per token
var Payment_Timeout = 120 // timeout after 120sec
var Pending_Interval = 2 // time to wait for each check for pending Nano
var Pending_Threshold = "1" // only allow pending tx above this raw value
var Pending_Count = 10 // max number of pending to process per account for each order (normally only 1 should be needed)
var Difficulty_Threshold = "fffffff800000000" // 8x threshold from the original (PoW increase introduced in v21). Only used when using a work server
var Difficulty_Multiplier = "1.0" // Multipliers used when using the node for PoW
var Payment_Receive_Account = "nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue" // where to send the payment

// Read settings from file
// ---
try {
  const settings = JSON.parse(Fs.readFileSync('token_settings.json', 'UTF-8'))
  Work_Server = settings.work_server
  Token_Price = settings.token_price
  Payment_Timeout = settings.payment_timeout
  Pending_Interval = settings.pending_interval
  Pending_Threshold = settings.pending_threshold
  Pending_Count = settings.pending_count
  Difficulty_Threshold = settings.difficulty_threshold
  Difficulty_Multiplier = settings.difficulty_multiplier
  Payment_Receive_Account = settings.payment_receive_account
}
catch(e) {
  console.log("Could not read token_settings.json", e)
}
// ---

// Log all initial settings for convenience
// ---
console.log("TOKEN SETTINGS:")
console.log("Work Server: " + Work_Server)
console.log("Token Price: " + Token_Price + " Nano/token")
console.log("Payment Timeout: " + Payment_Timeout)
console.log("Pending Interval: " + Pending_Interval)
console.log("Pending Threshold: " + Pending_Threshold)
console.log("Pending Max Count: " + Pending_Count)
console.log("Difficulty Threshold: " + Difficulty_Threshold)
console.log("Difficulty Multiplier: " + Difficulty_Multiplier)
console.log("Payment Receive Account: " + Payment_Receive_Account)
// ---

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

var node_url = "" // will be set by main script
var global_privKey = null
var global_previous = null
var global_subType = null
var global_pendingCallback = null
var global_representative = null
var global_pubKey = null
var global_blocks = null
var global_keys = null
var global_keyCount = null
var global_adjustedBalance = null

// Functions to be required from another file
module.exports = {
  // Generates and provides a payment address while checking for pending tx and collect them
  requestTokenPayment: function (token_amount, token_key="", order_db, url) {
    node_url = url
    const refill = token_key != "" ? true:false
    var priv_key = ""
    var address = ""
    let nano_amount = token_amount*Token_Price // the Nano to be received
    if (!refill) {
      token_key = genSecureKey()
      let seed = genSecureKey().toUpperCase()
      let nanowallet = Wallet.wallet.generate(seed)
      let accounts = Wallet.wallet.accounts(nanowallet.seed, 0, 0)
      priv_key = accounts[0].privateKey
      let pub_key = Nano.derivePublicKey(priv_key)
      address = Nano.deriveAddress(pub_key, {useNanoPrefix: true})
    }

    // If token_key was passed it means refill tokens and update db order
    if (refill) {
      order_db.get('orders').find({token_key: token_key}).assign({"order_waiting":true, "nano_amount":nano_amount, "order_time_left":Payment_Timeout, "timestamp":Math.floor(Date.now()/1000)}).write()
      address = order_db.get('orders').find({token_key: token_key}).value().address //reuse old address
    }
    // Store new order in db
    else {
      const order = {"address":address, "token_key":token_key, "priv_key":priv_key, "tokens":0, "order_waiting":true, "nano_amount":nano_amount, "order_time_left":Payment_Timeout, "timestamp":Math.floor(Date.now()/1000)}
      order_db.get("orders").push(order).write()
    }

    var res = {}
    // payment_amount is optional, client user can use any amount
    res = {"address":address, "token_key":token_key, "payment_amount":nano_amount}

    // Start checking for pending and cancel order if taking too long
    console.log("Start checking pending tx every " + Pending_Interval + "sec for a total of " + nano_amount + " Nano...")
    checkPending(address, order_db)

    // Return payment request
    return res
  },
  // Client checks if order has been processed
  checkOrder: function (token_key, order_db) {
    // Get the right order based on token_key
    const order = order_db.get('orders').find({token_key: token_key}).value()
    if (order) {
      if (order.order_waiting === false) {
        return {"tokens":order.tokens}
      }
      else {
        return {"order_time_left":order.order_time_left}
      }
    }
    else {
      return {"status":"error","msg":"Order not found"}
    }
  }
}

// Check if order payment has arrived as a pending block, continue check at intervals until time is up
async function checkPending(address, order_db, total_received = 0) {
  // Check pending and claim
  let priv_key = order_db.get('orders').find({address: address}).value().priv_key
  let nano_amount = order_db.get('orders').find({address: address}).value().nano_amount
  try {
    let pending_result = await processAccount(priv_key)

    // Payment is OK when combined pending is equal or larger than was ordered (to make sure spammed pending is not counted as an order)
    if('amount' in pending_result && pending_result.amount > 0) {
      total_received = total_received + pending_result.amount
      if(total_received >= nano_amount) {
        let nano_received = pending_result.amount
        let tokens_purchased = nano_received / Token_Price
        // Get the right order based on address
        const order = order_db.get('orders').find({address: address}).value()
        if (order) {
          // Update the total tokens count
          console.log("Enough pending amount detected: Order successfully updated! Continuing processing pending internally")
          order_db.get('orders').find({address: address}).assign({tokens: order.tokens + tokens_purchased, order_waiting: false}).write()
          return
        }
        console.log("Address paid was not found in the DB")
        return
      }
      else {
        console.log("Still need " + (nano_amount - total_received)  + " Nano to finilize the order")
      }
    }
  }
  catch(err) {
    console.log(err.toString())
  }

  // pause 5sec and check again
  await sleep(Pending_Interval * 1000)

  // Find the order and update the timeout key
  const order = order_db.get('orders').find({address: address}).value()
  if (order) {
    // Update the order time left
    var new_time = order.order_time_left - Pending_Interval
    if (new_time < 0) {
      new_time = 0
    }
    order_db.get('orders').find({address: address}).assign({order_time_left: new_time}).write()

    // continue checking as long as the db order has time left
    if (order.order_time_left > 0) {
      checkPending(address, order_db, total_received) // check again
    }
    else {
      console.log("Payment timed out for " + address)
    }
    return
  }
  console.log("Address paid was not found in the DB")
  return
}

// Generate secure random 64 char hex
function genSecureKey() {
  const rand = Nacl.randomBytes(32)
  return rand.reduce((hex, idx) => hex + (`0${idx.toString(16)}`).slice(-2), '')
}

// Process an account
async function processAccount(privKey) {
  let promise = new Promise(async (resolve, reject) => {
    global_pubKey = Nano.derivePublicKey(privKey)
    let address = Nano.deriveAddress(global_pubKey, {useNanoPrefix: true})

    // get account info required to build the block
    var command = {}
    command.action = 'account_info'
    command.account = address
    command.representative = true

    var balance = 0 // balance will be 0 if open block
    global_adjustedBalance = balance
    var previous = null // previous is null if we create open block
    global_representative = 'nano_1iuz18n4g4wfp9gf7p1s8qkygxw7wx9qfjq6a9aq68uyrdnningdcjontgar'
    var subType = 'open'

    // retrive from RPC
    try {
      let data = await Tools.postData(command, node_url, API_TIMEOUT)
      var validResponse = false
      // if frontier is returned it means the account has been opened and we create a receive block
      if (data.frontier) {
        validResponse = true
        balance = data.balance
        adjustedBalance = balance
        previous = data.frontier
        global_representative = data.representative
        subType = 'receive'
        validResponse = true
      }
      else if (data.error === "Account not found") {
        validResponse = true
        adjustedBalance = 0
      }
      if (validResponse) {
        // create and publish all pending
        createPendingBlocks(privKey, address, balance, previous, subType, function(previous) {
          // the previous is the last received block and will be used to create the final send block
          if (parseInt(global_adjustedBalance) > 0) {
            processSend(privKey, previous, () => {
              console.log("Done processing final send")
            })
          }
          else {
            console.log("Balance is 0")
            resolve({'amount':0})
          }
        },
        // callback for status (accountCallback)
        (status) => {
          resolve(status)
        })
      }
      else {
        console.log("Bad RPC response")
        reject(new Error('Bad RPC response'))
      }
    }
    catch (err) {
      console.log(err.toString())
      reject(new Error('Connection error: ' + err))
    }
  })
  return await promise
}

// Create pending blocks based on current balance and previous block (or start with an open block)
async function createPendingBlocks(privKey, address, balance, previous, subType, callback, accountCallback) {
  global_privKey = privKey
  global_previous = previous
  global_subType = subType
  global_pendingCallback = callback

  // check for pending first
  var command = {}
  command.action = 'pending'
  command.account = address
  command.count = 10
  command.source = 'true'
  command.sorting = 'true' //largest amount first
  command.include_only_confirmed = 'true'
  command.threshold = Pending_Threshold

  // retrive from RPC
  try {
    let data = await Tools.postData(command, node_url, API_TIMEOUT)
    // if there are any pending, process them
    if (data.blocks) {
      // sum all raw amounts
      var raw = '0'
      Object.keys(data.blocks).forEach(function(key) {
        raw = Tools.bigAdd(raw,data.blocks[key].amount)
      })
      let nanoAmount = Tools.rawToMnano(raw)
      let pending = {count: Object.keys(data.blocks).length, raw: raw, NANO: nanoAmount, blocks: data.blocks}
      let row = "Found " + pending.count + " pending containing total " + pending.NANO + " NANO"
      console.log(row)
      accountCallback({'amount':parseFloat(nanoAmount)})

      // create receive blocks for all pending
      var keys = []
      // create an array with all keys to be used recurively
      Object.keys(pending.blocks).forEach(function(key) {
        keys.push(key)
      })

      processPending(pending.blocks, keys, 0)
    }
    // no pending, create final block directly
    else {
      if (parseInt(global_adjustedBalance) > 0) {
        processSend(global_privKey, global_previous, () => {
          accountCallback({'amount':0}) // tell that we are ok to continue with next step
        })
      }
      else {
        accountCallback({'amount':0}) // tell that we are ok to continue with next step
      }
    }
  }
  catch(err) {
    console.log(err)
  }
}

// For each pending block: Create block, generate work and process
async function processPending(blocks, keys, keyCount) {
  let key = keys[keyCount]
  global_blocks = blocks
  global_keys = keys
  global_keyCount = keyCount
  global_adjustedBalance = Tools.bigAdd(global_adjustedBalance,blocks[key].amount)

  // generate local work
  try {
    console.log("Started generating PoW...")

    // determine input work hash depending if open block or receive block
    var workInputHash = global_previous
    if (global_subType === 'open') {
      // input hash is the opening address public key
      workInputHash = global_pubKey
    }

    var command = {}
    command.action = "work_generate"
    command.hash = workInputHash
    command.multiplier = Difficulty_Multiplier
    command.threshold = Difficulty_Threshold
    command.use_peers = "true"

    // retrive from RPC
    try {
      let data = await Tools.postData(command, node_url, API_TIMEOUT)
      if ('work' in data) {
        let work = data.work
        // create the block with the work found
        let block = Nano.createBlock(global_privKey,{balance:global_adjustedBalance, representative:global_representative,
        work:work, link:key, previous:global_previous})
        // replace xrb with nano (old library)
        block.block.account = block.block.account.replace('xrb', 'nano')
        block.block.link_as_account = block.block.link_as_account.replace('xrb', 'nano')
        // new previous
        global_previous = block.hash

        // publish block for each iteration
        let jsonBlock = {action: "process",  json_block: "true",  subtype:global_subType, watch_work:"false", block: block.block}
        global_subType = 'receive' // only the first block can be an open block, reset for next loop

        try {
          let data = await Tools.postData(jsonBlock, node_url, API_TIMEOUT)
          if (data.hash) {
            console.log("Processed pending: " + data.hash)

            // continue with the next pending
            global_keyCount += 1
            if (global_keyCount < global_keys.length) {
              processPending(global_blocks, global_keys, global_keyCount)
            }
            // all pending done, now we process the final send block
            else {
              console.log("All pending processed!")
              global_pendingCallback(global_previous)
            }
          }
          else {
            console.log("Failed processing block: " + data.error)
          }
        }
        catch(err) {
          console.log(err)
        }
      }
      else {
        console.log("Bad PoW result")
      }
    }
    catch(err) {
      console.log(err)
    }
  }
  catch(error) {
    if(error.message === 'invalid_hash') {
      console.log("Block hash must be 64 character hex string")
    }
    else {
      console.log("An unknown error occurred while generating PoW" + error)
    }
    return
  }
}

// Process final send block to payment destination
async function processSend(privKey, previous, sendCallback) {
  let pubKey = Nano.derivePublicKey(privKey)
  let address = Nano.deriveAddress(pubKey, {useNanoPrefix: true})

  console.log("Final transfer started for: " + address)
  var command = {}
  command.action = 'work_generate'
  command.hash = previous
  command.multiplier = Difficulty_Multiplier
  command.threshold = Difficulty_Threshold
  command.use_peers = "true"

  // retrive from RPC
  try {
    let data = await Tools.postData(command, Work_Server, API_TIMEOUT)
    if ('work' in data) {
      let work = data.work
      // create the block with the work found
      let block = Nano.createBlock(privKey, {balance:'0', representative:global_representative,
      work:work, link:Payment_Receive_Account, previous:previous})
      // replace xrb with nano (old library)
      block.block.account = block.block.account.replace('xrb', 'nano')
      block.block.link_as_account = block.block.link_as_account.replace('xrb', 'nano')

      // publish block for each iteration
      let jsonBlock = {action: "process",  json_block: "true",  subtype:"send", watch_work:"false", block: block.block}
      try {
        let data = await Tools.postData(jsonBlock, node_url, API_TIMEOUT)
        if (data.hash) {
          console.log("Funds transferred at block: " + data.hash)
          console.log(global_adjustedBalance + " raw transferred to " + Payment_Receive_Account)
        }
        else {
          console.log("Failed processing block: " + data.error)
        }
        sendCallback()
      }
      catch(err) {
        console.log(err)
      }
    }
    else {
      console.log("Bad PoW result")
    }
  }
  catch(err) {
    console.log(err)
    sendCallback()
  }
}
