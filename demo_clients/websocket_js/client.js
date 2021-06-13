const RPC_TIMEOUT = 10000 // 10sec timeout for calling RPC proxy
const WS_SERVER = 'ws://localhost:9952'

function sleep_simple(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

var socket_nano

function callWebsocketSubscribe() {
  callWebsocket('subscribe')
}

function callWebsocketUpdate() {
  callWebsocket('update')
}

function callWebsocket(action) {
  var nanoWebsocketOffline = false
  let tracked_accounts = document.getElementById("myInput").value.replace(" ", "").split(',')

  // Websocket for NANO with automatic reconnect
  async function socket_sleep(sleep=5000) {
    await sleep_simple(sleep)
    socket_nano = new WebSocket(WS_SERVER)
    socket_nano.addEventListener('open', socketOpenListener)
    socket_nano.addEventListener('error', socketErrorListener)
    socket_nano.addEventListener('message', socketMessageListener)
    socket_nano.addEventListener('close', socketCloseListener)
  }

  const socketMessageListener = (event) => {
    let res = JSON.parse(event.data)
    var output = document.getElementById("myTextarea").value
    document.getElementById("myTextarea").value = output + JSON.stringify(res, null, 2) + '\n-----------------\n'
  }

  const socketOpenListener = (event) => {
    console.log("NANO socket opened")
    nanoWebsocketOffline = false
    //Subscribe
    let msg = {
              "action": action,
              "topic": "confirmation",
              "id": "1",
              "ack": true,
              "options": {
                "accounts": tracked_accounts.length > 0 ? tracked_accounts : []
              }
          }
    socket_nano.send(JSON.stringify(msg))
  }

  const socketErrorListener = (event) => {
    console.error("Websocket looks offline. Please try again later.")
    nanoWebsocketOffline = true
  }

  const socketCloseListener = (event) => {
    if (socket_nano) {
      console.error('NANO socket disconnected due to inactivity.')
      // if socket offline, try again in 5min
      if (nanoWebsocketOffline) {
        socket_sleep(300000)
      }
      // or in one second
      else {
        socket_sleep(1000)
      }
    }
    else {
      socket_sleep(1000)
    }
  }

  // Start the websocket client
  socketCloseListener()
}
