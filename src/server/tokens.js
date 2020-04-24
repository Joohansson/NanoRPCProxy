const Nacl =       require('tweetnacl/nacl')
const Nano =       require('nanocurrency')
const Wallet =     require('nanocurrency-web')
const Fs =         require('fs')
const Tools =      require('./tools')

const API_TIMEOUT = 10000 // 10sec timeout for calling http APIs

var work_server = "http://127.0.0.1:7000" // the work server for doing PoW (the node can be used as well, for example http://127.0.0.1:7076, but enable_control is needed in the node config)
var token_price = 0.0001          // Nano per token
var payment_timeout = 120         // timeout after 120sec
var pending_interval = 2          // time to wait for each check for pending Nano
var pending_threshold = "1"       // only allow pending tx above this raw value
var pending_count = 10            // max number of pending to process per account for each order (normally only 1 should be needed)
var difficulty_multiplier = "1.0" // Multipliers used when using the node for PoW
var payment_receive_account = "nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue" // where to send the payment
var min_token_amount = 1          // min allowed tokens to be purchased
var max_token_amount = 10000000    // max allowed tokens to be purchased

// Read settings from file
// ---
try {
  const settings = JSON.parse(Fs.readFileSync('token_settings.json', 'UTF-8'))
  work_server = settings.work_server
  token_price = settings.token_price
  payment_timeout = settings.payment_timeout
  pending_interval = settings.pending_interval
  pending_threshold = settings.pending_threshold
  pending_count = settings.pending_count
  difficulty_multiplier = settings.difficulty_multiplier
  payment_receive_account = settings.payment_receive_account
  min_token_amount = settings.min_token_amount
  max_token_amount = settings.max_token_amount
}
catch(e) {
  console.log("Could not read token_settings.json", e)
}
// ---

// Log all initial settings for convenience
// ---
console.log("TOKEN SETTINGS:\n-----------")
console.log("Work Server: " + work_server)
console.log("Token Price: " + token_price + " Nano/token")
console.log("Payment Timeout: " + payment_timeout)
console.log("Pending Interval: " + pending_interval)
console.log("Pending Threshold: " + pending_threshold)
console.log("Pending Max Count: " + pending_count)
console.log("Difficulty Multiplier: " + difficulty_multiplier)
console.log("Min allowed tokens to purchase: " + min_token_amount)
console.log("Max allowed tokens to purchase: " + max_token_amount)
// ---

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

var node_url = "" // will be set by main script

// Functions to be required from another file
module.exports = {
  // Generates and provides a payment address while checking for pending tx and collect them
  requestTokenPayment: async function (token_amount, token_key="", order_db, url) {
    // Block request if amount is not within interval
    if (token_amount < min_token_amount) {
      return res = {"error":"Token amount must be larger than " + min_token_amount}
    }
    if (token_amount > max_token_amount) {
      return res = {"error":"Token amount must be smaller than " + max_token_amount}
    }

    node_url = url
    var priv_key = ""
    var address = ""
    let nano_amount = token_amount*token_price // the Nano to be received

    // If token_key was passed it means refill tokens and update db order
    // first check if key exist in DB and the order is not currently processing
    if (token_key != "" && order_db.get('orders').find({token_key: token_key}).value()) {
      if (!order_db.get('orders').find({token_key: token_key}).value().order_waiting) {
        order_db.get('orders').find({token_key: token_key}).assign({"order_waiting":true, "nano_amount":nano_amount, "token_amount":0, "order_time_left":payment_timeout, "processing":false, "timestamp":Math.floor(Date.now()/1000)}).write()
        address = order_db.get('orders').find({token_key: token_key}).value().address //reuse old address
      }
      else {
        return res = {"error":"This order is already processing or was interrupted. Please try again later or request a new key."}
      }
    }
    // Store new order in db
    else {
      token_key = genSecureKey()
      let seed = genSecureKey().toUpperCase()
      let nanowallet = Wallet.wallet.generate(seed)
      let accounts = Wallet.wallet.accounts(nanowallet.seed, 0, 0)
      priv_key = accounts[0].privateKey
      let pub_key = Nano.derivePublicKey(priv_key)
      address = Nano.deriveAddress(pub_key, {useNanoPrefix: true})

      const order = {"address":address, "token_key":token_key, "priv_key":priv_key, "tokens":0, "order_waiting":true, "nano_amount":nano_amount, "token_amount":0, "order_time_left":payment_timeout, "processing":false, "timestamp":Math.floor(Date.now()/1000)}
      order_db.get("orders").push(order).write()
    }

    var res = {}
    res = {"address":address, "token_key":token_key, "payment_amount":nano_amount}

    // Start checking for pending and cancel order if taking too long
    console.log("Start checking pending tx every " + pending_interval + "sec for a total of " + nano_amount + " Nano...")
    checkPending(address, order_db)

    // Return payment request
    return res
  },
  // Client checks if order has been processed
  checkOrder: async function (token_key, order_db) {
    // Get the right order based on token_key
    const order = order_db.get('orders').find({token_key: token_key}).value()
    if (order) {
      if (order.order_waiting === false && order.order_time_left > 0) {
        return {"tokens_ordered": order.token_amount, "tokens_total":order.tokens}
      }
      else if (order.order_time_left > 0){
        return {"order_time_left":order.order_time_left}
      }
      else {
        return {"error":"Order timed out"}
      }
    }
    else {
      return {"error":"Order not found"}
    }
  },
  // Cancel order by replacing the account and return the previous private key for client to claim the funds
  cancelOrder: async function (token_key, order_db) {
    // Get the right order based on token_key
    const order = order_db.get('orders').find({token_key: token_key}).value()
    if (order) {
      let previous_priv_key = order.priv_key
      let seed = genSecureKey().toUpperCase()
      let nanowallet = Wallet.wallet.generate(seed)
      let accounts = Wallet.wallet.accounts(nanowallet.seed, 0, 0)
      var priv_key = accounts[0].privateKey
      let pub_key = Nano.derivePublicKey(priv_key)
      var address = Nano.deriveAddress(pub_key, {useNanoPrefix: true})

      // Replace the address and private key and reset status
      if (order.processing === false) {
        order_db.get('orders').find({token_key: token_key}).assign({"address":address, "priv_key":priv_key, "order_waiting":false, "nano_amount":0, "order_time_left":payment_timeout, "processing":false, "timestamp":Math.floor(Date.now()/1000)}).write()
        console.log("Order was cancelled for " + token_key + ". Previous private key was " + previous_priv_key)
        return {"priv_key":previous_priv_key,"status":"Order canceled and account replaced. You can use the private key to claim any leftover funds."}
      }
      else {
        console.log("Order tried to cancel but still in process: " + token_key)
        return {"priv_key":"","status":"Order is currently processing, please try again later."}
      }

    }
    else {
      return {"error":"Order not found"}
    }
  },
  // Client checks status of owned tokens
  checkTokens: async function (token_key, order_db) {
    // Get the right order based on token_key
    const order = order_db.get('orders').find({token_key: token_key}).value()
    if (order) {
      if (order.order_waiting === false && order.order_time_left > 0) {
        return {"tokens_total":order.tokens,"status":"OK"}
      }
      else if (order.order_time_left > 0){
        return {"tokens_total":order.tokens,"status":'Something went wrong with the last order. You can try the buy command again with the same key to see if it register the pending or you can cancel it and claim private key with "action":"tokenorder_cancel"'}
      }
      else {
        return {"tokens_total":order.tokens,"status":'The last order timed out. If you sent Nano anyway you try the buy command again with the same key to see if it register the pending or you can cancel it and claim private key with "action":"tokenorder_cancel"'}
      }
    }
    else {
      return {"error":"Tokens not found for that key"}
    }
  },
  // Client checks status of owned tokens
  checkTokenPrice: async function () {
    return {"token_price":token_price}
  }
}

// Check if order payment has arrived as a pending block, continue check at intervals until time is up
async function checkPending(address, order_db, total_received = 0) {
  // Check pending and claim
  let priv_key = order_db.get('orders').find({address: address}).value().priv_key
  let nano_amount = order_db.get('orders').find({address: address}).value().nano_amount
  order_db.get('orders').find({address: address}).assign({"processing":true}).write() // set processing status (to avoid stealing of the private key via orderCancel before pending has been retrieved)
  try {
    let pending_result = await processAccount(priv_key)
    order_db.get('orders').find({address: address}).assign({"processing":false}).write() // reset processing status

    // Payment is OK when combined pending is equal or larger than was ordered (to make sure spammed pending is not counted as an order)
    if('amount' in pending_result && pending_result.amount > 0) {
      total_received = total_received + pending_result.amount
      if(total_received >= nano_amount) {
        let tokens_purchased = Math.round(total_received / token_price)
        // Get the right order based on address
        const order = order_db.get('orders').find({address: address}).value()
        if (order) {
          // Update the total tokens count and actual nano paid
          console.log("Enough pending amount detected: Order successfully updated! Continuing processing pending internally")
          order_db.get('orders').find({address: address}).assign({tokens: order.tokens + tokens_purchased, nano_amount: total_received, token_amount:order.token_amount + tokens_purchased, order_waiting: false}).write()
          return
        }
        console.log("Address paid was not found in the DB")
        return
      }
      else {
        console.log("Still need " + (nano_amount - total_received)  + " Nano to finilize the order")
      }
    }
    else if (!'amount' in pending_result) {
      console.log("Amount is missing in the response from processAccount()")
    }
  }
  catch(err) {
    console.log(err.toString())
  }

  // pause 5sec and check again
  await sleep(pending_interval * 1000)

  // Find the order and update the timeout key
  const order = order_db.get('orders').find({address: address}).value()
  if (order) {
    // Update the order time left
    var new_time = order.order_time_left - pending_interval
    if (new_time < 0) {
      new_time = 0
    }
    order_db.get('orders').find({address: address}).assign({order_time_left: new_time}).write()

    // continue checking as long as the db order has time left
    if (order.order_time_left > 0) {
      checkPending(address, order_db, total_received) // check again
    }
    else {
      order_db.get('orders').find({address: address}).assign({order_waiting: false}).write()
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
    let pubKey = Nano.derivePublicKey(privKey)
    let address = Nano.deriveAddress(pubKey, {useNanoPrefix: true})

    // get account info required to build the block
    var command = {}
    command.action = 'account_info'
    command.account = address
    command.representative = true

    var balance = 0 // balance will be 0 if open block
    var adjustedBalance = balance
    var previous = null // previous is null if we create open block
    var representative = 'nano_1iuz18n4g4wfp9gf7p1s8qkygxw7wx9qfjq6a9aq68uyrdnningdcjontgar'
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
        representative = data.representative
        subType = 'receive'
        validResponse = true
      }
      else if (data.error === "Account not found") {
        validResponse = true
        adjustedBalance = 0
      }
      if (validResponse) {
        // create and publish all pending
        createPendingBlocks(privKey, address, balance, adjustedBalance, previous, subType, representative, pubKey, function(previous,newAdjustedBalance) {
          // the previous is the last received block and will be used to create the final send block
          if (parseInt(newAdjustedBalance) > 0) {
            processSend(privKey, previous, representative, () => {
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
async function createPendingBlocks(privKey, address, balance, adjustedBalance, previous, subType, representative, pubKey, callback, accountCallback) {
  // check for pending first
  var command = {}
  command.action = 'pending'
  command.account = address
  command.count = 10
  command.source = 'true'
  command.sorting = 'true' //largest amount first
  command.include_only_confirmed = 'true'
  command.threshold = pending_threshold

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

      processPending(pending.blocks, keys, 0, privKey, previous, subType, representative, pubKey, adjustedBalance, callback)
    }
    // no pending, create final block directly
    else {
      if (parseInt(adjustedBalance) > 0) {
        processSend(privKey, previous, representative, () => {
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
async function processPending(blocks, keys, keyCount, privKey, previous, subType, representative, pubKey, adjustedBalance, pendingCallback) {
  let key = keys[keyCount]
  var newAdjustedBalance = Tools.bigAdd(adjustedBalance,blocks[key].amount)

  // generate local work
  try {
    console.log("Started generating PoW...")

    // determine input work hash depending if open block or receive block
    var workInputHash = previous
    if (subType === 'open') {
      // input hash is the opening address public key
      workInputHash = pubKey
    }

    var command = {}
    command.action = "work_generate"
    command.hash = workInputHash
    command.multiplier = difficulty_multiplier
    command.use_peers = "true"

    // retrive from RPC
    try {
      let data = await Tools.postData(command, node_url, API_TIMEOUT)
      if ('work' in data) {
        let work = data.work
        // create the block with the work found
        let block = Nano.createBlock(privKey,{balance:newAdjustedBalance, representative:representative,
        work:work, link:key, previous:previous})
        // replace xrb with nano (old library)
        block.block.account = block.block.account.replace('xrb', 'nano')
        block.block.link_as_account = block.block.link_as_account.replace('xrb', 'nano')
        // new previous
        previous = block.hash

        // publish block for each iteration
        let jsonBlock = {action: "process",  json_block: "true",  subtype:subType, watch_work:"false", block: block.block}
        subType = 'receive' // only the first block can be an open block, reset for next loop

        try {
          let data = await Tools.postData(jsonBlock, node_url, API_TIMEOUT)
          if (data.hash) {
            console.log("Processed pending: " + data.hash)

            // continue with the next pending
            keyCount += 1
            if (keyCount < keys.length) {
              processPending(blocks, keys, keyCount, privKey, previous, subType, representative, pubKey, newAdjustedBalance, pendingCallback)
            }
            // all pending done, now we process the final send block
            else {
              console.log("All pending processed!")
              pendingCallback(previous, newAdjustedBalance)
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
async function processSend(privKey, previous, representative, sendCallback) {
  let pubKey = Nano.derivePublicKey(privKey)
  let address = Nano.deriveAddress(pubKey, {useNanoPrefix: true})

  console.log("Final transfer started for: " + address)
  var command = {}
  command.action = 'work_generate'
  command.hash = previous
  command.multiplier = difficulty_multiplier
  command.use_peers = "true"

  // retrive from RPC
  try {
    let data = await Tools.postData(command, work_server, API_TIMEOUT)
    if ('work' in data) {
      let work = data.work
      // create the block with the work found
      let block = Nano.createBlock(privKey, {balance:'0', representative:representative,
      work:work, link:payment_receive_account, previous:previous})
      // replace xrb with nano (old library)
      block.block.account = block.block.account.replace('xrb', 'nano')
      block.block.link_as_account = block.block.link_as_account.replace('xrb', 'nano')

      // publish block for each iteration
      let jsonBlock = {action: "process",  json_block: "true",  subtype:"send", watch_work:"false", block: block.block}
      try {
        let data = await Tools.postData(jsonBlock, node_url, API_TIMEOUT)
        if (data.hash) {
          console.log("Funds transferred at block: " + data.hash + " to " + payment_receive_account)
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
