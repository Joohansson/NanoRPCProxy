const Nacl =       require('tweetnacl/nacl')
const Nano =       require('nanocurrency')
const Wallet =     require('nanocurrency-web')
const Tools =      require('./tools')

const Token_Price = 0.0001 // 10k tokens per Nano
const Payment_Timeout = 120 // timeout after 120sec
const Pending_Interval = 5 // time to wait for each check for pending Nano
const API_TIMEOUT = 10000 // 10sec timeout for calling http APIs

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

var node_url = "" // will be set by main script

// Functions to be required from another file
module.exports = {
  // Generates and provides a payment address with seed backup
  requestTokenPayment: function (token_amount=0, token_key="", order_db, url) {
    node_url = url
    const refill = token_key != "" ? true:false
    var priv_key = ""
    var address = ""
    if (!refill) {
      token_key = genSecureKey()
      let seed = genSecureKey().toUpperCase()
      let nanowallet = Wallet.wallet.generate(seed)
      let accounts = Wallet.wallet.accounts(nanowallet.seed, 0, 0)
      priv_key = accounts[0].privateKey
      let pub_key = Nano.derivePublicKey(priv_key)
      address = Nano.deriveAddress(pub_key, {useNanoPrefix: true})
      console.log(priv_key)
    }

    // If token_key was passed it means refill and update db order
    if (refill) {
      order_db.get('orders').find({token_key: token_key}).assign({"order_waiting":true, "order_time_left":Payment_Timeout, "timestamp":Math.floor(Date.now()/1000)}).write()
      address = order_db.get('orders').find({token_key: token_key}).value().address //reuse old address
    }
    // Store new order in db
    else {
      const order = {"address":address, "token_key":token_key, "priv_key":priv_key, "tokens":0, "order_waiting":true, "order_time_left":Payment_Timeout, "timestamp":Math.floor(Date.now()/1000)}
      order_db.get("orders").push(order).write()
    }

    var res = {}
    // payment_amount is optional, client user can use any amount
    if (token_amount > 0) {
      res = {"address":address, "token_key":token_key, "payment_amount":token_amount*Token_Price}
    }
    else {
      res = {"address":address, "token_key":token_key}
    }

    // Start checking for pending and cancel order if taking too long
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
async function checkPending(address, order_db) {
  console.log("Start checking for pending tx...")
  // TODO: check pending and claim
  Tools.postData({"action":"pending","account":address,"count": 10,"threshold":"1000000000000000000000000","sorting":"true","include_only_confirmed":"true"}, node_url, API_TIMEOUT)
  .then((pending) => {
    if ("blocks" in pending) {
      // Send all pending to main account
      for (const [key, value] of Object.entries(pending)) {
        const priv_key = order_db.get('orders').find({address: address}).value().priv_key
        console.log(priv_key)

        // get account info required to build the open block (to retrieve the pending before we can send it home)
        var command = {}
        command.action = 'account_info'
        command.account = address
        command.representative = true

        var balance = 0 // balance will be 0 if open block
        this.adjustedBalance = balance
        var previous = null // previous is null if we create open block
        this.representative = 'nano_1iuz18n4g4wfp9gf7p1s8qkygxw7wx9qfjq6a9aq68uyrdnningdcjontgar'
        var subType = 'open'

        // Request the node
        Tools.postData(command, node_url, API_TIMEOUT)
        .then((account_info) => {
          console.log()
        })
        // If promise was rejected
        .catch(function(error) {
          console.log(error.toString())
        })
      }
    }
  })
  // If promise was rejected
  .catch(function(error) {
    console.log(error.toString())
  })


  let nano_received = 1
  let tokens_purchased = nano_received / Token_Price

  // Payment is OK
  if(true) {
    // Get the right order based on address
    const order = order_db.get('orders').find({address: address}).value()
    if (order) {
      // Update the total tokens count
      order_db.get('orders').find({address: address}).assign({tokens: order.tokens + tokens_purchased, order_waiting: false}).write()
      return
    }
    console.log("Address paid was not found in the DB")
    return
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
      checkPending(address, order_db) // check again
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
