const RPC_TIMEOUT = 10000 // 10sec timeout for calling RPC proxy
const RPC_LIMIT = 'You have done too many RPC requests. Try again later.'
const SAMPLE_COMMANDS = [
  '{"action":"block_count"}',
  '{"action":"account_info","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"}',
  '{"action":"account_history", "account":"nano_3cpz7oh9qr5b7obbcb5867omqf8esix4sdd5w6mh8kkknamjgbnwrimxsaaf", "count":"20"}',
  '{"action":"active_difficulty"}',
  '{"action":"block_info","json_block":"true","hash":"87434F8041869A01C8F6F263B87972D7BA443A72E0A97D7A3FD0CCC2358FD6F9"}',
  '{"action":"pending","account":"nano_1111111111111111111111111111111111111111111111111117353trpda","count": "5"}',
  '{"action":"representatives_online"}',
  '{"action":"price"}',
  '{"action":"tokens_buy","token_amount":10}',
  '{"action":"tokens_buy","token_amount":10,"token_key":"xxx"}',
  '{"action":"tokenorder_check","token_key":"xxx"}',
  '{"action":"tokens_check","token_key":"xxx"}',
  '{"action":"tokenorder_cancel","token_key":"xxx"}',
]
const NODE_SERVER = 'http://localhost:9950/proxy'
const CREDS = 'user1:user1'

// Custom error class
class RPCError extends Error {
  constructor(code, ...params) {
    super(...params)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RPCError)
    }
    this.name = 'RPCError'
    // Custom debugging information
    this.code = code
  }
}

function fillCommand(c) {
  document.getElementById("myInput").value = SAMPLE_COMMANDS[c]
}

function callRPC() {
  try {
    var command = JSON.parse(document.getElementById("myInput").value)
  }
  catch(e) {
    console.log("Could not parse json string")
    return
  }
  //postDataSimple(command)
  postData(command)
  .then((data) => {
    console.log(data)
    document.getElementById("myTextarea").value = JSON.stringify(data, null, 2)
  })
  .catch(function(error) {
    handleRPCError(error)
  })
}

function handleRPCError(error) {
  if (error.code) {
    // IP blocked
    if (error.code === 429) {
      console.log(RPC_LIMIT)
      document.getElementById("myTextarea").value = RPC_LIMIT
    }
    else {
      console.log("RPC request failed: "+error.message)
      document.getElementById("myTextarea").value = "RPC request failed: "+error.message
    }
  }
  else {
    console.log("RPC request failed: "+error)
    document.getElementById("myTextarea").value = "RPC request failed: "+error
  }
}

// Post RPC data with timeout and catch errors
async function postData(data = {}, server=NODE_SERVER) {
  let didTimeOut = false;

  return new Promise(function(resolve, reject) {
      const timeout = setTimeout(function() {
          didTimeOut = true;
          reject(new Error('Request timed out'));
      }, RPC_TIMEOUT);

      fetch(server, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Base64.encode(CREDS)
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *client
        body: JSON.stringify(data) // body data type must match "Content-Type" header
      })
      .then(function(response) {
          // Clear the timeout as cleanup
          clearTimeout(timeout);
          if(!didTimeOut) {
            if(response.status === 200) {
                resolve(response);
            }
            else {
              throw new RPCError(response.status, resolve(response))
            }
          }
      })
      .catch(function(err) {
          // Rejection already happened with setTimeout
          if(didTimeOut) return;
          // Reject with error
          reject(err);
      });
  })
  .then(async function(result) {
      // Request success and no timeout
      return await result.json()
  })
}

async function postDataSimple(data = {}, server=NODE_SERVER) {
  // Default options are marked with *
  const response = await fetch(server, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Base64.encode(CREDS)
    },
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  })
  return await response.json(); // parses JSON response into native JavaScript objects
}
