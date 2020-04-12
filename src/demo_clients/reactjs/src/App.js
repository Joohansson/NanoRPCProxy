import React, { Component } from 'react';
import './App.css';
import * as rpc from './rpc' //rpc creds not shared on github
import { Base64 } from 'js-base64';
import { InputGroup, FormControl, Button} from 'react-bootstrap'

const RPC_TIMEOUT = 10000 // 10sec timeout for calling RPC proxy

//CONSTANTS
export const constants = {
  // These are taken from the creds file
  RPC_SERVER: rpc.RPC_SERVER,
  RPC_LIMIT: rpc.RPC_LIMIT,
  RPC_CREDS: rpc.RPC_CREDS,
  // Nano sample commands
  SAMPLE_COMMANDS: [
    '{"action":"block_count"}',
    '{"action":"account_info","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"}',
    '{"action":"account_history", "account":"nano_3cpz7oh9qr5b7obbcb5867omqf8esix4sdd5w6mh8kkknamjgbnwrimxsaaf", "count":"20"}',
    '{"action":"active_difficulty"}',
    '{"action":"block_info","json_block":"true","hash":"87434F8041869A01C8F6F263B87972D7BA443A72E0A97D7A3FD0CCC2358FD6F9"}',
    '{"action":"pending","account":"nano_1111111111111111111111111111111111111111111111111117353trpda","count": "5"}',
    '{"action":"representatives_online"}',
  ]
}

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

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      command: '',
      output: '',
      fetchingRPC: false,
    }

    this.getRPC = this.getRPC.bind(this)
    this.sample = this.sample.bind(this)
    this.handleCommandChange = this.handleCommandChange.bind(this)
    this.handleRPCError = this.handleRPCError.bind(this)
  }

  handleCommandChange(event) {
    let command = event.target.value
    this.setState({
      command: command
    })
  }

  // Generate sample request string
  sample(event) {
    this.setState({
      command: constants.SAMPLE_COMMANDS[event.target.value]
    })
  }

  handleRPCError(error) {
    this.setState({fetchingRPC: false})
    alert("Error: see console")
    if (error.code) {
      // IP blocked
      if (error.code === 429) {
        console.log(constants.RPC_LIMIT)
      }
      else {
        console.log("RPC request failed: "+error.message)
      }
    }
    else {
      console.log("RPC request failed: "+error)
    }
  }

  // Make RPC call
  getRPC(event) {
    try {
      var command = JSON.parse(this.state.command)
    }
    catch(e) {
      console.log("Could not parse json string")
      return
    }

    if (Object.keys(command).length > 0) {
      this.setState({fetchingRPC: true})
      this.postData(command)
      .then((data) => {
        this.setState({fetchingRPC: false})
        this.writeOutput(data)
      })
      .catch(function(error) {
        this.handleRPCError(error)
      }.bind(this))
    }
  }

  // Write result in output area
  writeOutput(json) {
    try {
      this.setState({
        output: JSON.stringify(json, null, 2)
      })
    }
    catch(error) {
      console.log("Bad JSON: "+error)
    }
  }

  // Post RPC data with timeout and catch errors
  async postData(data = {}, server=constants.RPC_SERVER) {
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
            'Authorization': 'Basic ' + Base64.encode(constants.RPC_CREDS)
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
                throw new RPCError(response.status, "HTTP status "+response.status)
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

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h3>RPC demo client for communicating with <a href="https://github.com/Joohansson/NanoRPCProxy">NanoRPCProxy</a></h3>
          <p>Requesting a live Nano node using RPC json requests<br/>
          See <a href="https://docs.nano.org/commands/rpc-protocol/">documentation</a> for more commands<br/>
          </p>
          <InputGroup size="sm" className="mb-3">
            <InputGroup.Prepend>
              <InputGroup.Text id="command">
                RPC Command
              </InputGroup.Text>
            </InputGroup.Prepend>
            <FormControl id="command" aria-describedby="command" value={this.state.command} title="" maxLength="200" placeholder='RPC command' onChange={this.handleCommandChange} autoComplete="off"/>
          </InputGroup>

          <InputGroup size="sm" className="mb-3">
            <FormControl id="output-area" aria-describedby="output" as="textarea" rows="15" placeholder="" value={this.state.output} readOnly/>
          </InputGroup>

          <InputGroup size="sm" className="mb-3">
            <Button className="btn-small" variant="primary" value="0" onClick={this.sample}>Sample1</Button>
            <Button className="btn-small" variant="primary" value="1" onClick={this.sample}>Sample2</Button>
            <Button className="btn-small" variant="primary" value="2" onClick={this.sample}>Sample3</Button>
            <Button className="btn-small" variant="primary" value="3" onClick={this.sample}>Sample4</Button>
            <Button className="btn-small" variant="primary" value="4" onClick={this.sample}>Sample5</Button>
            <Button className="btn-small" variant="primary" value="5" onClick={this.sample}>Sample6</Button>
            <Button className="btn-small" variant="primary" value="6" onClick={this.sample}>Sample7</Button>
            <Button className="btn-medium" variant="primary" disabled={this.state.fetchingRPC} onClick={this.getRPC}>Node Request</Button>
          </InputGroup>
        </header>
      </div>
    )
  }
}

export default App;
