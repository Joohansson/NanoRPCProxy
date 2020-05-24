var W3CWebSocket = require('websocket').w3cwebsocket

let ws_host = 'ws://localhost:9952'
// Subscribe to these accounts
let tracked_accounts = ['nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue', 'nano_3g81wxaobotd7ocqpqto4exxeei7mazufaq9xzfogtaqosy9orcnxuybnyjo']

var client = new W3CWebSocket(ws_host)
console.log("Requesting to subscribe to accounts:\n", tracked_accounts)

client.onerror = function() {
    console.log('Connection Error')
};

client.onopen = function() {
    console.log('WebSocket Client Connected')
    if (client.readyState === client.OPEN) {
      let msg = {
              "action": "subscribe",
              "topic": "confirmation",
              "options": {
                "accounts": tracked_accounts
              }
            }
      client.send(JSON.stringify(msg))
    }
}

client.onclose = function() {
    console.log('echo-protocol Client Closed')
}

client.onmessage = function(e) {
    if (typeof e.data === 'string') {
        console.log(e.data)
    }
}
