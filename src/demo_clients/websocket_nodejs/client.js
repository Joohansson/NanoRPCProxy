const ReconnectingWebSocket = require('reconnecting-websocket')
const WS =                    require('ws')

let ws_host = 'ws://localhost:9952'
// Subscribe to these accounts
let tracked_accounts = ['nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue', 'nano_3g81wxaobotd7ocqpqto4exxeei7mazufaq9xzfogtaqosy9orcnxuybnyjo']

console.log("Requesting to subscribe to accounts:\n", tracked_accounts)

// Create a websocket and reconnect if broken
ws = new ReconnectingWebSocket(ws_host, [], {
  WebSocket: WS,
  connectionTimeout: 1000,
  maxRetries: Infinity,
  maxReconnectionDelay: 8000,
  minReconnectionDelay: 3000
})

// A tracked account was detected
ws.onmessage = msg => {
  if (typeof msg.data === 'string') {
      console.log(msg.data)
  }
}

// As soon as we connect, subscribe to confirmations
ws.onopen = () => {
  console.log('WebSocket Client Connected')
  if (ws.readyState === ws.OPEN) {
    let msg = {
            "action": "subscribe",
            "topic": "confirmation",
            "options": {
              "accounts": tracked_accounts
            }
          }
    ws.send(JSON.stringify(msg))
  }
}
ws.onclose = () => {
  console.log("WebSocket Client Closed")
}
ws.onerror = (e) => {
  console.log("Websocket: " + e.error)
}
