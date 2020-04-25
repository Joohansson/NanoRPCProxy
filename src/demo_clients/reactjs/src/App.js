import React, { Component } from 'react';
import './App.css';
import * as rpc from './rpc' //rpc creds not shared on github
import { Base64 } from 'js-base64';
import { Dropdown, DropdownButton, InputGroup, FormControl, Button} from 'react-bootstrap'
import QrImageStyle from './components/qrImageStyle'
import * as Nano from 'nanocurrency'
import $ from 'jquery'

const RPC_TIMEOUT = 10000 // 10sec timeout for calling RPC proxy

//CONSTANTS
export const constants = {
  // These are taken from the creds file
  RPC_SERVER: rpc.RPC_SERVER,
  RPC_CREDS: rpc.RPC_CREDS,

  // Nano sample commands
  SAMPLE_COMMANDS: [
    '{"action":"account_history", "account":"nano_3cpz7oh9qr5b7obbcb5867omqf8esix4sdd5w6mh8kkknamjgbnwrimxsaaf","count":"20"}',
    '{"action":"account_info","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"}',
    '{"account_representative","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"}',
    '{"action":"active_difficulty"}',
    '{"action":"available_supply"}',
    '{"action":"block_info","json_block":"true","hash":"87434F8041869A01C8F6F263B87972D7BA443A72E0A97D7A3FD0CCC2358FD6F9"}',
    '{"action":"block_count"}',
    '{"action":"chain","block":"87434F8041869A01C8F6F263B87972D7BA443A72E0A97D7A3FD0CCC2358FD6F9","count":"20"}',
    '{"action":"delegators","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"}',
    '{"action":"delegators_count","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"}',
    '{"action":"frontiers", "account":"nano_3cpz7oh9qr5b7obbcb5867omqf8esix4sdd5w6mh8kkknamjgbnwrimxsaaf","count":"20"}',
    '{"action":"pending","account":"nano_1111111111111111111111111111111111111111111111111117353trpda","count":"5"}',
    '{"action": "process","json_block": "true","subtype": "send","block": {"type": "state","account": "nano_1qato4k7z3spc8gq1zyd8xeqfbzsoxwo36a45ozbrxcatut7up8ohyardu1z","previous": "6CDDA48608C7843A0AC1122BDD46D9E20E21190986B19EAC23E7F33F2E6A6766","representative": "nano_3pczxuorp48td8645bs3m6c3xotxd3idskrenmi65rbrga5zmkemzhwkaznh","balance": "40200000001000000000000000000000000","link": "87434F8041869A01C8F6F263B87972D7BA443A72E0A97D7A3FD0CCC2358FD6F9","link_as_account":"nano_33t5by1653nt196hfwm5q3wq7oxtaix97r7bhox5zn8eratrzoqsny49ftsd","signature": "A5DB164F6B81648F914E49CAB533900C389FAAD64FBB24F6902F9261312B29F730D07E9BCCD21D918301419B4E05B181637CF8419ED4DCBF8EF2539EB2467F07","work": "000bc55b014e807d"}}',
    '{"action":"representatives_online"}',
    '{"action":"price"}',
  ],
  // For dropdown titles
  SAMPLE_COMMAND_NAMES: [
    "account_history",
    "account_info",
    "account_representative",
    "active_difficulty",
    "available_supply",
    "block_info",
    "block_count",
    "chain",
    "delegators",
    "delegators_count",
    "frontiers",
    "pending",
    "process",
    "representatives_online",
    "Nano price"
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

    // QR css
    this.qrClassesContainer = ["QR-container", "QR-container-2x", "QR-container-4x"]
    this.qrClassesImg = ["QR-img", "QR-img-2x", "QR-img-4x"]

    this.state = {
      command: '',
      key: '',
      amount: 10,
      nanoAmount: 0,
      output: '',
      validKey: false,
      fetchingRPC: false,
      paymentActive: false,
      activeCommandId: 0,
      activeCommandName: 'Select a sample',
      useAuth: true,
      tokenText1: "",
      tokenText2: "",
      tokenText3: "",
      qrContent: '',
      qrSize: 512,
      qrState: 0,  //qr size
      qrHidden: true,
      payinfoHidden: true,
      apiText: "",
      tokenPrice: 0.0001, //temp price, real price grabbed from server
    }

    this.getRPC = this.getRPC.bind(this)
    this.buyTokens = this.buyTokens.bind(this)
    this.checkTokens = this.checkTokens.bind(this)
    this.cancelOrder = this.cancelOrder.bind(this)
    this.prepareForPayment = this.prepareForPayment.bind(this)
    this.handleCommandChange = this.handleCommandChange.bind(this)
    this.handleKeyChange = this.handleKeyChange.bind(this)
    this.handleAmountChange = this.handleAmountChange.bind(this)
    this.handleNanoChange = this.handleNanoChange.bind(this)
    this.handleRPCError = this.handleRPCError.bind(this)
    this.selectCommand = this.selectCommand.bind(this)
    this.postData = this.postData.bind(this)
    this.handleOptionChange = this.handleOptionChange.bind(this)
    this.updateQR = this.updateQR.bind(this)
    this.double = this.double.bind(this)
  }

  // Init component
  componentDidMount() {
    // try update the price
    var command = {
      action: "tokenprice_check",
    }
    this.postData(command)
    .then((data) => {
      if ("token_price" in data) {
        let nano = this.state.amount * parseFloat(data.token_price)
        this.setState({
          nanoAmount: nano
        })
      }
    })
    .catch(function(error) {
      this.handleRPCError(error)
    }.bind(this))

    // calculate nano cost regardless of if server respond or not
    let nano = this.state.amount * this.state.tokenPrice
    this.setState({
      nanoAmount: nano
    })
  }

  handleCommandChange(event) {
    let command = event.target.value
    try {
      let query = $.param(JSON.parse(command)) //convert json to query string
      this.setState({
        apiText: query
      })
    }
    catch {
      this.setState({
        apiText: "Bad json format"
      })
    }

    this.setState({
      command: command
    })
  }

  handleKeyChange(event) {
    let key = event.target.value
    if (key.length === 64) {
      this.setState({
        validKey: true
      })
    }
    else {
      this.setState({
        validKey: false
      })
    }
    this.setState({
      key: key
    })
  }

  handleAmountChange(event) {
    if (event.target.value !== "") {
      let amount = parseInt(event.target.value)
      if (Number.isSafeInteger(amount)) {
        // calculate nano cost
        let nano = amount * this.state.tokenPrice
        this.setState({
          amount: amount,
          nanoAmount: nano
        })
      }
    }
    else {
      this.setState({
        amount: event.target.value
      })
    }
  }

  handleNanoChange(event) {
    if (event.target.value !== "") {
      let amount = event.target.value
      if (Number.isSafeInteger(parseInt(amount)) || this.isFloat(parseFloat(amount))) {
        // calculate tokens
        let tokens = Math.round(parseFloat(amount) / this.state.tokenPrice)
        this.setState({
          nanoAmount: event.target.value,
          amount: tokens
        })
      }
    }
    else {
      this.setState({
        nanoAmount: event.target.value
      })
    }
  }

  // Select Auth
  handleOptionChange = changeEvent => {
    this.setState({
      useAuth: !this.state.useAuth
    })
  }

  updateQR(address, amount=0) {
    let raw = this.MnanoToRaw(amount.toString())
    this.setState({
      qrContent: "nano:"+address+"?amount="+raw+"&message=RPC Proxy Tokens",
    })
    if (address === "") {
      this.setState({
        qrHidden: true,
      })
    }
    else {
      this.setState({
        qrHidden: false,
      })
    }
  }

  // loop qr state 1x, 2x, 4x
  double() {
    var state = this.state.qrState
    state = state + 1
    if (state >= this.qrClassesContainer.length) {
      state = 0
    }
    this.setState({
      qrState: state
    })
  }

  MnanoToRaw(input) {
    return this.isNumeric(input) ? Nano.convert(input, {from: Nano.Unit.NANO, to: Nano.Unit.raw}) : 'N/A'
  }

  // Check if numeric string
  isNumeric(val) {
    //numerics and last character is not a dot and number of dots is 0 or 1
    let isnum = /^-?\d*\.?\d*$/.test(val)
    if (isnum && String(val).slice(-1) !== '.') {
      return true
    }
    else {
      return false
    }
  }

  // Check if float string
  isFloat(x) {
    return !!(x % 1)
  }

  // Change tool to view on main page
  selectCommand(eventKey) {
    let command = constants.SAMPLE_COMMANDS[eventKey]
    let query = $.param(JSON.parse(command)) //convert json to query string
    this.setState({
      command: constants.SAMPLE_COMMANDS[eventKey],
      activeCommandId: eventKey,
      activeCommandName: constants.SAMPLE_COMMAND_NAMES[eventKey],
      apiText: query
    })
  }

  handleRPCError(error) {
    this.setState({fetchingRPC: false})
    if (error.code) {
      console.log("RPC request failed: "+error.message)
      this.writeOutput({error:"RPC request failed: "+error.message})
    }
    else {
      console.log("RPC request failed: "+error)
      this.writeOutput({error:"RPC request failed: "+error})
    }
  }

  buyTokens(event) {
    this.setState({payinfoHidden: false})

    let amount = parseInt(this.state.amount)
    if (Number.isInteger(amount) && amount > 0) {
      var command = {
        action: "tokens_buy",
        token_amount: this.state.amount
      }
      if (this.state.key.length === 64) {
        command.token_key = this.state.key
      }
      this.getRPC(null, command)
    }
  }

  checkTokens(event) {
    this.setState({payinfoHidden: true})
    var command = {
      action: "tokens_check",
    }
    if (this.state.key.length === 64) {
      command.token_key = this.state.key
      this.getRPC(null, command)
    }
  }

  cancelOrder(event) {
    this.setState({payinfoHidden: true})
    var command = {
      action: "tokenorder_cancel",
    }
    if (this.state.key.length === 64) {
      command.token_key = this.state.key
      this.getRPC(null, command)
    }
  }

  // Make RPC call
  getRPC(event, command="") {
    this.updateQR("")

    // Read command from text box if not provided from other function
    if (command === "") {
      this.setState({payinfoHidden: true})
      try {
        command = JSON.parse(this.state.command)
        if (this.state.key.length === 64) {
          command.token_key = this.state.key
        }
      }
      catch(e) {
        console.log("Could not parse json string")
        return
      }
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

  // Inform user how to pay and check status
  prepareForPayment(json) {
    this.setState({
      tokenText1: "Pay " + json.payment_amount + " Nano to " + json.address,
      tokenText2: "Your request key is: " + json.token_key,
      paymentActive: true
    })
    this.updateQR(json.address, json.payment_amount)

    let command = {action:"tokenorder_check",token_key:json.token_key}

    // Check status every second until payment completed or timed out
    var timer = setInterval(() => {
      this.postData(command)
      .then((data) => {
        if ("order_time_left" in data) {
          if (parseInt(data.order_time_left) > 0) {
            this.setState({tokenText3: "You have " + data.order_time_left + "sec to pay"})
          }
        }
        else if ("tokens_total" in data && "tokens_ordered" in data) {
          this.writeOutput(data)
          this.setState({
            tokenText1: "Payment completed for " + data.tokens_ordered + " tokens! You now have " + data.tokens_total + " tokens to use",
            tokenText2: "Your request key is: " + json.token_key,
            tokenText3: "",
            paymentActive: false,
          })
          clearInterval(timer)
          this.updateQR("")
        }
        else if ("error" in data) {
          this.writeOutput(data)
          this.setState({
            tokenText1: data.error,
            tokenText2: "",
            tokenText3: "",
            paymentActive: false,
          })
          clearInterval(timer)
          this.updateQR("")
        }
        else {
          this.writeOutput(data)
          this.setState({
            tokenText1: "Unknown error occured",
            tokenText2: "",
            tokenText3: "",
            paymentActive: false,
          })
          clearInterval(timer)
          this.updateQR("")
        }
      })
      .catch(function(error) {
        this.setState({
          tokenText1: "",
          tokenText2: "",
          tokenText3: "",
          paymentActive: false,
        })
        clearInterval(timer)
        this.updateQR("")
        this.handleRPCError(error)
      }.bind(this))
    },1000)
  }

  // Write result in output area
  writeOutput(json) {
    if ('address' in json) {
      this.prepareForPayment(json)
    }
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
    var headers = {'Content-Type': 'application/json'}
    if (this.state.useAuth) {
      headers.Authorization = 'Basic ' + Base64.encode(constants.RPC_CREDS)
    }

    return new Promise(function(resolve, reject) {
        const timeout = setTimeout(function() {
            didTimeOut = true;
            reject(new Error('Request timed out'))
        }, RPC_TIMEOUT);

        fetch(server, {
          method: 'POST', // *GET, POST, PUT, DELETE, etc.
          mode: 'cors', // no-cors, *cors, same-origin
          cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
          credentials: 'same-origin', // include, *same-origin, omit
          headers: headers,
          redirect: 'follow', // manual, *follow, error
          referrerPolicy: 'no-referrer', // no-referrer, *client
          body: JSON.stringify(data) // body data type must match "Content-Type" header
        })
        .then(async function(response) {
            // Clear the timeout as cleanup
            clearTimeout(timeout)
            if(!didTimeOut) {
              if(response.status === 200) {
                  resolve(await response.json())
              }
              // catch blocked (to display on the site)
              else if(response.status === 429) {
                  resolve({"error":await response.text()})
              }
              // catch unauthorized (to display on the site)
              else if(response.status === 401) {
                  resolve({"error": "unauthorized"})
              }
              else {
                throw new RPCError(response.status, resolve(response))
              }
            }
        })
        .catch(function(err) {
            // Rejection already happened with setTimeout
            if(didTimeOut) return
            // Reject with error
            reject(err)
        })
    })
    .then(async function(result) {
        // Request success and no timeout
        return result
    })
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h3>Demo client for communicating with <a href="https://github.com/Joohansson/NanoRPCProxy">NanoRPCProxy</a></h3>
          <p>Send to a live Nano node using <a href="https://docs.nano.org/commands/rpc-protocol/">RPC json requests</a></p>
          <ul>
            <li> Everyone are allowed 1000 requests/day. Purchase optional tokens if you need more.</li>
            <li> Tokens can be refilled/extended using the same Request Key. The order is done when said Nano (or more) is registered.</li>
            <li> If you send nano but order fail you can claim the private key. The old deposit account will be destroyed/replaced.</li>
          </ul>
          <DropdownButton
            className="command-dropdown"
            title={this.state.activeCommandName}
            key={this.state.activeCommandId}
            id={`dropdown-basic-${this.state.activeCommandId}`}>
            {constants.SAMPLE_COMMAND_NAMES.map(function(command, index){
              return <Dropdown.Item eventKey={index} key={index} onSelect={this.selectCommand}>{command}</Dropdown.Item>;
            }.bind(this))}
          </DropdownButton>

          <InputGroup size="sm" className="mb-3">
            <InputGroup.Prepend>
              <InputGroup.Text id="command">
                RPC Command
              </InputGroup.Text>
            </InputGroup.Prepend>
            <FormControl id="command" aria-describedby="command" value={this.state.command} title="Command to send" maxLength="200" placeholder='RPC command' onChange={this.handleCommandChange} autoComplete="off"/>
          </InputGroup>

          <InputGroup size="sm" className="mb-3">
            <InputGroup.Prepend>
              <InputGroup.Text id="key">
                Request Key
              </InputGroup.Text>
            </InputGroup.Prepend>
            <FormControl id="key" aria-describedby="key" value={this.state.key} title="Your personal token key" maxLength="64" placeholder='Optional: Get key by purchase tokens. Key can also be used to refill/check your tokens or claim priv key.' onChange={this.handleKeyChange} autoComplete="off"/>
          </InputGroup>

          <div className="token-text">
            <span>GET Query Equivalent (need basic auth headers if using server auth):<br/></span><a href={constants.RPC_SERVER+"/?"+this.state.apiText}>{constants.RPC_SERVER+"/?"+this.state.apiText}</a>
          </div>

          <InputGroup size="sm" className="mb-3 hidden">
            <div className="auth-title" title="Use authentication">Use Auth:</div>
            <div className="form-check form-check-inline index-checkbox">
              <input className="form-check-input" type="checkbox" id="auth-check" value={this.state.useAuth} checked={this.state.useAuth} onChange={this.handleOptionChange}/>
            </div>
          </InputGroup>

          <InputGroup size="sm" className="mb-3">
            <Button className="btn-medium" variant="primary" disabled={this.state.fetchingRPC || this.state.paymentActive} onClick={this.getRPC}>Server Request</Button>
          </InputGroup>

          <div className="line"></div>
          <div className="line"></div>

          <InputGroup size="sm" className="mb-3">
            <InputGroup.Prepend>
              <InputGroup.Text id="amount">
                Token Amount
              </InputGroup.Text>
            </InputGroup.Prepend>
            <FormControl className="edit-short" id="amount" aria-describedby="amount" value={this.state.amount} title="Number of tokens to purchase" maxLength="9" placeholder='' onChange={this.handleAmountChange} autoComplete="off"/>
            <InputGroup.Prepend>
              <InputGroup.Text id="nano">
                Nano Amount
              </InputGroup.Text>
            </InputGroup.Prepend>
            <FormControl id="nano" aria-describedby="nano" value={this.state.nanoAmount} title="Amount of Nano to pay" maxLength="9" placeholder='' onChange={this.handleNanoChange} autoComplete="off"/>
          </InputGroup>

          <InputGroup size="sm" className="mb-3">
            <Button className="btn-medium" variant="primary" disabled={this.state.fetchingRPC || this.state.paymentActive} onClick={this.buyTokens}>Buy/Refill tokens</Button>
            <Button className="btn-medium" variant="primary" disabled={this.state.fetchingRPC || !this.state.validKey} onClick={this.checkTokens}>Check my tokens</Button>
            <Button className="btn-medium" variant="primary" disabled={this.state.fetchingRPC || !this.state.validKey} onClick={this.cancelOrder}>Claim back order</Button>
          </InputGroup>

          <div className={ this.state.payinfoHidden ? "hidden token-text" : "token-text"}>
            <span>{this.state.tokenText1}<br/>{this.state.tokenText2}<br/>{this.state.tokenText3}<br/></span>
          </div>

          <div className={ this.state.qrHidden ? "hidden" : ""}>
            <div className={this.qrClassesContainer[this.state.qrState]}>
              <QrImageStyle className={this.qrClassesImg[this.state.qrState]} content={this.state.qrContent} onClick={this.double} title="Click to toggle size" size={this.state.qrSize} />
            </div>
          </div>

          <InputGroup size="sm" className="mb-3">
            <FormControl id="output-area" aria-describedby="output" as="textarea" rows="12" placeholder="" value={this.state.output} readOnly/>
          </InputGroup>
        </header>
      </div>
    )
  }
}

export default App;
