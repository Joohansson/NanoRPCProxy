# NanoRPCProxy

NanoRPCProxy is a relay and protection system that operates between a client and a Nano node RPC interface. It makes it possible to set the RPC interface public to the Internet without compromising the security of the node itself. The Nano node has no built-in functionality for user authentication, rate-limiting or caching which makes it dangerous to open up without protection as this proxy provides. With NanoRPCProxy you can, for example, serve a mobile app or web frontend with indirect node calls.

**In reality, it can be used for Nano wallets, exchanges, block explorers, public APIs, monitor systems, Point of Sale or anything that communicates with a node.**

The built-in token system makes it possible to serve requests beyond the default limits and monetize your backend via direct Nano token purchases. More info in the [token section](#the-token-system).

Demo clients/code for Curl, JS, REACT, Python and Flask are available to test your own server.

**Public API demo client with token support: https://api.nanos.cc**

- [Video - Full features / settings walk-through with live demo](https://youtu.be/j6qxOYWWpSE)
- [Video - Demo purchasing request tokens](https://youtu.be/PEKiYhJbi5o)

---

In addition to the RPC interface, NanoRPCProxy also has built-in support for certain websocket subscriptions offered by the Nano node, for example block confirmations.
Similar to the RPC, the websocket is DDOS protected and acts as a secure layer between the client and the node. This allows, for example, a public websocket open to everyone who needs to track certain accounts in real-time, without the need to set up their own node. That could be, but not limited to:

- Microprocessors controlling hardware (IoT) like animal feeder, beer dispenser, door locks, arcade machines, exhibition demos, hobby projects, etc
- Web apps with features activated by payments, wallet alert/tracking, payment listener, games, etc

Demo clients for websocket is available for JS (web) and Node.js. More info in the [websocket section](#the-websocket-system).

**Public websocket demo: https://api.nanos.cc/socket**

Apart from increased security, NanoRPCProxy solves the scalability issue where a node can't serve too many clients and lets the node do what it's supposed to do, ie. process blocks as fast as possible. The system can be scaled up to serve thousands of clients with only one connection to the node per proxy server.

## Features

- Fully customizable via a settings file
- Supports any RPC command for any remote client; like wallets, exchanges, apps, games, bots or public API
- Supports websocket subscriptions for block confirmations; like account tracking (multiple accounts allowed) and public endpoint
- Caching of certain request actions to lower the RPC burden
- Limits the number of response objects, like the number of pending transactions
- Slows down IPs that doing requests above limit (Overridden by purchased tokens)
- IP filter for max allowed requests per time window (Overridden by purchased tokens)
- Extra DDOS protection layer (defaults to max 100 requests/ 10sec, also for purchased tokens)
- IP black list (also for purchased tokens)
- Supports basic authentication (username / password) (also for purchased tokens)
- Supports multiple users via authentication
- User-specific settings override
- Optional token system for requests with built-in Nano purchases => independent of any 3rd party payment processors => unlimited implementation possibilities
- Supports POST requests like the RPC, ie. payload = {"action":"block_count"}
- Supports GET requests, ie. URL query = /proxy/?action=block_count
- Both RPC and websocket support http and/or https with your own SSL cert (or use another proxy like Cloudflare to serve https)
- Works with both beta and main Nano network
- Support for [BoomPoW](https://boompow.banano.cc) (bPoW)
- Multiple demo clients for developers
- Available as docker container [https://hub.docker.com/r/nanojson/nanorpcproxy](https://hub.docker.com/r/nanojson/nanorpcproxy)
- Built-in support for Prometheus data scraping that can be visualized with Grafana

**Possible use cases**
![NanoRPCProxy](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/NanoRPCPRoxy.png)

## Index

- [Install and run the proxy server](#install-and-run-the-proxy-server)
- [How to customize the proxy server](#how-to-customize-the-proxy-server)
- [How to use the proxy server](#how-to-use-the-proxy-server)
- [How to install and test the demo clients](#how-to-install-and-test-the-demo-clients)
- [Developer Donations](#developer-donations)

---

---

---

## Install and run the proxy server

### Setup nodejs and test server

1. Make sure you have node.js installed. [Windows Guide](https://www.liquidweb.com/kb/install-react-js-windows/) | [Ubuntu Guide](https://medium.com/@DanielSayidi/install-and-setup-react-app-on-ubuntu-18-04-3-lts-fcd2c875885a)
2. Copy the default setting files to your own editable ones:

These will not be affected if later updating the server via git pull

    cp creds.json.default creds.json
    cp settings.json.default settings.json
    cp user_settings.json.default user_settings.json
    cp token_settings.json.default token_settings.json

3. Install required libraries: **npm install**
4. Build Typescript sources: **npm run build**
5. Start and test the server: **node dist/proxy.js**

---

### Option1: Install as a service using PM2 (Recommended)

https://pm2.keymetrics.io/docs/usage/quick-start/

_Make sure you have build the project (npm run build) first as specified in the `Setup nodejs and test server` section._
**Setting files need to be in the `dist` folder for the proxy to read them properly.**

1. Locate the directory ./dist
2. Install pm2: **npm install pm2@latest -g**
3. Start the server: **pm2 start proxy.js**

#### Other useful pm2 commands

- **pm2 restart proxy.js, pm2 stop proxy.js, pm2 delete proxy.js**
- Make pm2 auto-boot at server restart: **pm2 startup**
- Realtime online monitor: **pm2 monitor**
- Status: **pm2 status**
- Realtime logs: **pm2 logs** (or specifically for this app: **pm2 logs proxy.js**)
- Terminal dashboard: **pm2 monit**

Before making changes, stop any running servers with "pm2 stop dist/proxy.js" and delete the process with "pm delete proxy.js"

- Specify log location: **pm2 start dist/proxy.js --log ~/NanoRPCProxy.log**
- Restart app when file changes: **pm2 start proxy.js --watch**

#### Update pm2:

1. npm install pm2@latest -g
2. pm2 update

Example of PM2 web monitor. Can track all your apps and with realtime logs.
![PM2 Web Monitor](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/pm2_monitor.png)

---

### Option2: Install as a service using systemd on Linux

https://expeditedsecurity.com/blog/deploy-node-on-linux/#node-linux-service-systemd

_Make sure you have build the project (npm run build) first as specified in the `Setup nodejs and test server` section._
**Setting files need to be in the `dist` folder for the proxy to read them properly.**

1. Create a file /etc/systemd/system/nanorpcproxy.service
2. Paste this

**change to your actual location of proxy.js**

    [Unit]
    Description=NanoRPCProxy
    After=network.target

    [Service]
    ExecStart=/usr/local/bin/node /home/NanoRPCProxy/dist/proxy.js
    Restart=always
    RestartSec=10 #wait 10sec before restart
    #User=nobody
    #Group=nogroup
    Environment=PATH=/usr/bin:/usr/local/bin
    Environment=NODE_ENV=production
    WorkingDirectory=/home/NanoRPCProxy/

    [Install]
    WantedBy=multi-user.target

3. Make the file executable: **sudo chmod +x /home/NanoRPCProxy/dist/proxy.js**
4. Make systemd aware: **sudo systemctl daemon-reload**
5. Test the service: **sudo systemctl start nanorpcproxy**
6. Check status: **sudo systemctl status nanorpcproxy**
7. Start service on boot: **sudo systemctl enable nanorpcproxy.service**
8. Follow logs in realtime: **sudo journalctl --follow -u nanorpcproxy**

---

### Updating the server

1. Go to the root folder -> git pull
2. Update dependencies -> npm install
3. Build sources -> npm run build
4. Restart the proxy.js

It may happen that the settings files are expanded. In that case, you need to do this again in order for the new variables to be modified by you (or insert them manually). Save your old settings first!

    cp settings.json.default settings.json
    cp user_settings.json.default user_settings.json
    cp token_settings.json.default token_settings.json

---

### Option3: With Docker

The docker image is available publicly on **[nanojson/nanorpcproxy](https://hub.docker.com/r/nanojson/nanorpcproxy)** but if you want to build it yourself:

Ensure that [Docker](https://docs.docker.com/get-docker/) is installed.

In order to run the latest stable image with default (no) config:

    $ docker run -it nanojson/nanorpcproxy:latest

You can also pull the master branch (:master) or previous release tags. To build and run from source:

    $ docker build . -t nanorpcproxy

Then run it without the public "nanojson" registry

    $ docker run -it nanorpcproxy:latest

To run with configuration, first copy default settings:

    $ cp creds.json.default creds.json
    $ cp settings.json.default settings.json
    $ cp user_settings.json.default user_settings.json
    $ cp token_settings.json.default token_settings.json

To run the docker container with configuration you have to map the configuration files inside the container to `/root`.
Here's an example mounting `settings.json` from the current work directory, to `/root/settings.json` in the container:

    $ docker run -it -p 9950:9950 -v $(pwd)/:/root nanojson/nanorpcproxy:latest

The same goes for rest of the settings files. You can place them in a separate folder (settings) if you like and map that instead of the base folder.

    $ docker run -it -p 9950:9950 -v $(pwd)/settings:/root nanojson/nanorpcproxy:latest

Here is an example how to run it indefinitely in the background and restart on fail or machine boot (with the name rpcproxy):

    $ docker run -d --restart unless-stopped --name rpcproxy -p 9950:9950 -v $(pwd)/:/root nanojson/nanorpcproxy:latest

There's also a `docker-compose.yml` file present. To run with docker compose,
first copy files as above. Then run image with:

    $ docker-compose up

All files but settings.json is disabled in the docker-compose file by default.

#### Example docker-compose.yml for running a Nano node and the proxy

1. Copy the settings.json.default to a new folder nano_proxy/settings.json (or other setting files mentioned above)
2. Edit settings.json and make sure "node_url":"http://node:7076" and "node_ws_url":"ws://node:7078". That means the proxy will connect to the node service (name=node) internally.
3. Create a docker-compose.yml and paste this (at the root of the nano_proxy folder). It will download the latest node and proxy. Then forward the node port 7075, RPC port 9950 and Websocket port 9952. Those will be the ones exposed.

docker-compose.yml

    version: "3"
    services:
      node:
        image: "nanocurrency/nano:latest"
        restart: "unless-stopped"
        ports:
          - "7075:7075"
        volumes:
          - "./nano_node:/root"
      nanorpcproxy:
        image: "nanojson/nanorpcproxy:latest"
        restart: "unless-stopped"
        ports:
          - "9950:9950"
          - "9952:9952"
        volumes:
          - ./:/root

4. Create a folder called nano_node (same level as the settings folder)
5. Run this in the same folder as the docker-compose.yml

Terminal

    $ docker-compose up

6. Now in the nano_node folder the node will start saving the ledger, logs and settings. You can alter the config-node.toml or config-rpc.toml and just restart the compose. For example, you want the RPC and websocket to be enabled. And if you are going to request node PoW (not using bpow), you also need enable_control in the config-rpc.toml (if not using work_peers) and in the settings/settings.json you will need "work_generate" as an "allowed command".

Example of config-node.toml

    [node.websocket]
    address = "::ffff:0.0.0.0"
    enable = true

    [rpc]
    enable = true

7. When everything is up and running you can for example connect [Nault](https://nault.cc) to it via the app settings. Using http://127.0.0.1:9950/proxy and ws://127.0.0.1:9952

#### Upgrading docker

To upgrade you need to first turn off running container ("docker stop xxx", or "docker-compose down"). Also remove the container if you want to keep the same name (label)

- Normal container: docker pull nanojson/nanorpcproxy:latest
- Composer: docker-compose pull

If you used docker compose to build from local source (nanorpcproxy:latest) you will have to rebuild:

- docker-compose build

---

---

---

## How to customize the proxy server

The proxy server is configured via the **settings.json** file found in the server folder

- **node_url:** Nano node RPC url (default for main network is 'http://[::1]:7076' and for beta network 'http://[::1]:55000') [url]
- **node_ws_url:** Nano node websocket url (default for main network is 'http://[::1]:7078' and for beta network 'http://[::1]:57000') [url]
- **http_port:** Port to listen on for http (requires <use_http>) [number]
- **https_port:** Port to listen on for https (requires <use_https>) [number]
- **websocket_http_port:** Port to listen on for http websocket connection (requires <use_http> and <use_websocket>) [number]
- **websocket_https_port:** Port to listen on for https websocket connection (requires <use_https> and <use_websocket>) [number]
- **use_auth:** If require username and password when connecting to the proxy. Defined in **creds.json** [true/false]
- **use_slow_down:** If slowing down requests for IPs doing above set limit (defined in <slow_down>) [true/false]
- **use_rate_limiter:** If blocking IPs for a certain amount of time when they request above set limit (defined in <rate_limiter>). This request limit, requests remaining and timestamp for reset will also be included in the response header as "X-RateLimit-Limit", "X-RateLimit-Remaining", and "X-RateLimit-Reset". Additionally included in the json response as well as "requestsLimit", "requestsRemaining" and "requestLimitReset". For example if 1000 / day is allowed for free, the user will see how many are left to use. This filter is skipped when using tokens. [true/false]
- **use_cache:** If caching certain commands set in <cached_commands> [true/false]
- **use_http:** Listen on http [true/false]
- **use_https:** Listen on https (a valid cert and key file is needed via <https_cert> and <https_key>) [true/false]
- **use_output_limiter:** If limiting number of response objects, like pending transactions, to a certain max amount set in <limited_commands>. Only valid for RPC actions that have a "count" key [true/false] [true/false]
- **use_ip_blacklist:** If always blocking certain IPs set in <ip_blacklist> [true/false]
- **use_tokens** If activating the token system for purchase via Nano [true/false] (more information further down)
- **use_websocket** If activating the websocket system [true/false] (more information further down)
- **allow_websocket_all** If allowing users to subscribe to ALL accounts (more traffic) [true/false]
- **use_cors** If handling cors policy here, if not taken care of in upstream proxy (cors_whitelist=[] means allow ANY ORIGIN)
- **use_bpow** If allow work_generate to be done by BoomPoW intead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "default send difficulty" will be used. (The priority order is bpow > work server. If all three are set to false, it will use the node to generate work) (requires work_generate in allowed_commands and credentials to be set in pow_creds.json)
- **use_work_server** If allow work_generate to be done by an external work server intead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "default send difficulty" will be used. (The priority order is bpow > work server. If all three are set to false, it will use the node to generate work) (requires work_generate in allowed_commands and url to be set in pow_creds.json). [true/false]
- **use_work_peers** If the node is used to generate work (bpow and work server all set to false) this will set the "use_peers" to true and let the node use its internally configured work peers [true/false]
- **disable_watch_work** Forcefully set watch_work=false for process calls (to block node from doing rework). Deprecated since node v22. [true/false]
- **https_cert:** File path for pub cert file (requires <use_https>) [absolute path string]
- **https_key:** File path for private key file (requires <use_https>) [absolute path string]
- **enable_prometheus_for_ips:** IP addresses to enable prometheus for. Typically ["127.0.0.1"] but can also be a combination of ipv4/ipv6 CIDR subnets like ["127.0.0.1", "::1/128", "172.16.0.0/12"] [comma separated list]
- **allowed_commands:** A list of RPC actions to allow [list]
- **cached_commands:** A list of commands [key] that will be cached for corresponding duration in seconds as [value]
- **limited_commands:** A list of commands [key] to limit the output response for with max count as [value]. Also limits account arrays such as accounts_pending, which also limit the pending count per account as value\*10.
- **ip_blacklist:** A list of IPs to always block. Also supports CIDR like ["172.16.0.0/12"]. If calling from localhost you can test this with ["127.0.0.1"] (::ffff:127.0.0.1 for ipv6) [comma separated list]
- **slow_down:** Contains the settings for slowing down requests. The rolling time slot is defined with <time_window> [ms]. When number of requests in that slot is exceeding <request_limit> it will start slowing down requests with increments of <delay_increment> [ms] with a maximum total delay defined in <max_delay> [ms]
- **rate_limiter:** Contains the settings for the rate limiter. The rolling time slot is defined with <time_window> [ms]. When number of requests in that slot is exceeding <request_limit> it will block the IP until the time slot has passed. Then the IP can start requesting again. To permanently ban IPs they have to be manually added to <ip_blacklist> and activating <use_ip_blacklist>.
- **proxy_hops** If the NanoRPCProxy is behind other proxies such as apache or cloudflare the source IP will be wrongly detected and the filters will not work as intended. Enter the number of additional proxies here. Example: api.example.com is proxied through Cloudflare to IP 1.1.1.1 and then local Nginx server is proxying api.example.com to localhost:9950. Proxyhops will be 2.
- **websocket_max_accounts** Maximum number of accounts per IP allowed for block confirmation subscription [number]
- **cors_whitelist** Whitelist requester ORIGIN header or IP for example "https://mywallet.com", "http://localhost:8080" or "8.8.8.8" (requires use_cors) [comma separated list of hostnames]
- **log_level:** It can be set to either "info" which will output all logs, "warning" which will only output warning messages or "none" which will only log the initial settings.

---

The following parameters can be set in **user_settings.json** to override the default ones for specific users defined in **creds.json**. Anything in this file will override even if there are less sub entries like only 1 allowed command or 2 limited commands.

- **use_cache**
- **use_output_limiter**
- **allowed_commands**
- **cached_commands**
- **limited_commands**
- **log_level**

---

The following parameters can be set in **token_settings.json** for configuration of the token system. The system require the <use_tokens> to be active in **settings.json**

More info about the token system [in this section](#the-token-system)

- **work_server** Source for calculating PoW. Can be a node (http://[::1]:7076) (with enable_control active) or a [work server](https://github.com/nanocurrency/nano-work-server) which can be run as "./nano-work-server --gpu 0:0 -l 127.0.0.1:7000" and then set work_server to http://127.0.0.1:7000. To use bpow, just point the server to itself such as http://127.0.0.1:9950/proxy (requires bpow to be configured and work_generate as allowed command)
- **token_price**: Purchase price per token [Nano]
- **payment_timeout**: Payment window before timeout and cancelled [seconds]
- **pending_interval**: How often to check for deposit during the payment window (may be removed if websocket is implemented)
- **pending_threshold**: Skip processing pending transactions below this raw amount
- **pending_count**: The maximum number of pending transactions to process each time a new order comes in
- **difficulty_multiplier**: The PoW multiplier from base difficulty
- **payment_receive_account**: The account to send the incoming money
- **min_token_amount**: The minimum amount of tokens to allow for purchase
- **max_token_amount**: The maximum amount of tokens to allow for purchase
- **log_level**: It can be set to either "info" which will output all logs, "warning" which will only output warning messages or "none" which will only log the initial settings.

---

**The effect of the settings**
![Protection System](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/NanoRPCProxy_limiter.png)

---

---

---

## How to use the proxy server

You call the proxy server just like you would call the node RPC. It's a normal POST request to "/proxy" with json formatted data.
The node commands are found here: https://docs.nano.org/commands/rpc-protocol/

It also support URL queries via GET request, which means you can even run the commands from a web browser via links such as "/proxy/?action=block_count" and get a json response.
However, if authentication is activated in the server settings, basic auth headers are needed so that won't work in a browser.

### Special RPC commands

The proxy server also support special commands not supported in the Nano RPC. They need to be listed in the **settings.json** under "allowed_commands"

- **{"action":"price"}**

Returns the latest Nano price quote from Coinpaprika. Will always be cached for 10sec.

    {
      "id": "nano-nano",
      "name": "Nano",
      "symbol": "NANO",
      "rank": 62,
      "circulating_supply": 133248297,
      "total_supply": 133248297,
      "max_supply": 133248290,
      "beta_value": 0.975658,
      "last_updated": "2020-05-28T12:34:54Z",
      "quotes": {
        "USD": {
          "price": 0.86498056,
          "volume_24h": 5450637.5460105,
          "volume_24h_change_24h": 12,
          "market_cap": 115257186,
          "market_cap_change_24h": -5.21,
          "percent_change_1h": -0.59,
          "percent_change_12h": -5.67,
          "percent_change_24h": -5.21,
          "percent_change_7d": -6.96,
          "percent_change_30d": 45.21,
          "percent_change_1y": -49.99,
          "ath_price": 37.6212,
          "ath_date": "2018-01-02T06:39:00Z",
          "percent_from_price_ath": -97.7
        }
      }
    }

- **{"action":"verified_accounts"}**

Returns a list of verified accounts from https://mynano.ninja/. These can be used as suggestions for representative accounts.
This response is cached for 1 minute:

    [
      {
        "votingweight": 7.231803912122739e+35,
        "delegators": 1359,
        "uptime": 99.72967712635973,
        "score": 99,
        "account": "nano_33ad5app7jeo6jfe9ure6zsj8yg7knt6c1zrr5yg79ktfzk5ouhmpn6p5d7p",
        "alias": "warai"
      },
      ...
    ]

- **{"action":"mnano_to_raw","amount":"1"}**

Converts NANO to raw

    {
      "amount": "1000000000000000000000000000000"
    }

- **{"action":"mnano_from_raw","amount":"1"}**

Converts raw to NANO

    {
      "amount": "0.000000000000000000000000000001"
    }

---

### Using curl

The curl command looks just a tiny bit different than for a direct node request. You just have to define it with a json content type. You can also use the -i flag to include response headers.

**POST: No authentication**

    curl -d '{"action":"block_count"}' http://localhost:9950/proxy

**POST: With authentication**

    curl --user user1:user1 -d '{"action":"block_count"}' http://127.0.0.1:9950/proxy

**GET: No authentication**

    curl http://localhost:9950/proxy?action=block_count

**GET: With authentication**

    curl --user user1:user1 http://localhost:9950/proxy?action=block_count

![Curl demo](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/demo_curl.png)

**Using Windows Powershell 7 - Escape quotes**

    curl -d '{\"action\":\"block_count\"}' http://localhost:9950/proxy

---

### Using python

**POST: No authentication**

    import requests
    import json
    try:
        r = requests.post("http://localhost:9950/proxy", json={"action":"block_count"})
        status = r.status_code
        print("Status code: ", status)
        if (status == 200):
            print("Success!")
        try:
            print(r.json())
        except:
            print(r)
            except Exception as e:
        print("Fatal error", e)

**POST: With authentication**
Note: verify=False means we ignore possible SSL certificate errors. Recommended to set to True

    r = requests.post('http://localhost:9950/proxy', json={"action":"block_count"}, verify=False, auth=HTTPBasicAuth(username, password))

**GET: With authentication**

    r = requests.get('http://localhost:9950/proxy?action=block_count', auth=HTTPBasicAuth(username, password))

---

### Using JS

**POST: Async with authentication (Without: remove the Authorization header)**

See the js demo client for full example with error handling

    For html file: <script src="https://cdn.jsdelivr.net/npm/js-base64@2.5.2/base64.min.js"></script>

    async function postData(data = {}, server='http://localhost:9950/proxy') {
      const response = await fetch(server, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
          'Authorization': 'Basic ' + Base64.encode('user1:user1')
        },
        body: JSON.stringify(data)
      })
      return await response.json()
    }

    postData({"action":"block_count"})
    .then((data) => {
      console.log(JSON.stringify(data, null, 2))
    })
    .catch(function(error) {
      console.log(error)
    })

**GET: No authentication using jquery**

    $.get("http://localhost:9950/proxy?action=block_count", function(data, status){
      console.log(data)
    })

**GET: Authentication using jquery and ajax**

    $.ajax({
         url: "http://localhost:9950/proxy?action=block_count",
         type: "GET",
         beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Basic ' + Base64.encode('user1:user1'))},
         success: function(data, status) {console.log(data)}
      })

---

### The Token System

Only a certain amount of requests per time period is allowed and configured in the settings. Users who need more requests (however still affected by the "slow down rate limiter") can purchase tokens with Nano. The system requires the <use_tokens> to be active in **settings.json**. The system will also check orders older than 1h one time per hour and repair broken orders (by assigning tokens for any pending found), also removing unprocessed and empty orders older than one month.

![Token System](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/NanoRPCPRoxy_tokens.png)

#### Available Commands

- **{"action":"block_count","token_key":"815c8c736756da0965ca0994e9ac59a0da7f635aa0675184eff96a3146c49d74"}**

Any RPC command can be made by including a request key. For each request 1 token will be deducted and the total left will be included in each response as tokens_total.

    {
      "count": "24613996",
      "unchecked": "0",
      "cemented": "24613996",
      "tokens_total": 4999
    }

As an alternative, it's also valid to include the token key via the header "Token: xyz".

    curl -H "Token: 815c8c736756da0965ca0994e9ac59a0da7f635aa0675184eff96a3146c49d74" -d '{"action":"block_count"}' http://127.0.0.1:9950/proxy

- **{"action":"tokens_buy","token_amount":10}**

Initiates a new order of 10 tokens and respond with a deposit account, a token key and the amount of Nano to pay

    {
      "address": "nano_3m497b1ghppe316aiu4o5eednfyueemzjf7a8wye3gi5rjrkpk1p59okghwb",
      "token_key": "815c8c736756da0965ca0994e9ac59a0da7f635aa0675184eff96a3146c49d74",
      "payment_amount": 0.001
    }

- **{"action":"tokens_buy","token_amount":10,"token_key":"815c8c736756da0965ca0994e9ac59a0da7f635aa0675184eff96a3146c49d74"}**

Initiates a refill order of existing key for 10 tokens

    {
      "address": "nano_3m497b1ghppe316aiu4o5eednfyueemzjf7a8wye3gi5rjrkpk1p59okghwb",
      "token_key": "815c8c736756da0965ca0994e9ac59a0da7f635aa0675184eff96a3146c49d74",
      "payment_amount": 0.001
    }

- **{"action":"tokenorder_check","token_key":"815c8c736756da0965ca0994e9ac59a0da7f635aa0675184eff96a3146c49d74"}**

Check status of initiated order. Either the time left to pay the order:

    {
      "token_key": "741eb3ad2df88427e19c9b01ec326c36c184fbcbd0bf25004982e9bb223e1acf",
      "order_time_left": 135
    }

Or status:

    {
      "error": "Order timed out for key: 741eb3ad2df88427e19c9b01ec326c36c184fbcbd0bf25004982e9bb223e1acf"
    }

Or final tokens bought based on the amount paid:

    {
      "token_key": "741eb3ad2df88427e19c9b01ec326c36c184fbcbd0bf25004982e9bb223e1acf",
      "tokens_ordered": 1000,
      "tokens_total": 2000
    }

- **{"action":"tokenorder_cancel","token_key":"815c8c736756da0965ca0994e9ac59a0da7f635aa0675184eff96a3146c49d74"}**

Reset the deposit account and return last private key to be used for recovery

    {
      "priv_key": "2aad399e19f926c7358a2d21d3c320e32bfedb774e0a43dba684853a1ca2cf56",
      "status": "Order canceled and account replaced. You can use the private key to claim any leftover funds."
    }

- **{"action":"tokens_check","token_key":"815c8c736756da0965ca0994e9ac59a0da7f635aa0675184eff96a3146c49d74"}**

Returns the total amount of tokens bound to the key and status of last order

    {
      "tokens_total": 10,
      "status": "OK"
    }

- **{"action":"tokenprice_check"}**

Returns the current price set by the server

    {
      "token_price": 0.0001
    }

Demo of purchasing tokens using the React demo client:
![React demo app - Token purchase](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_react_02.png)

Order completed:
![React demo app - Token purchase complete](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_react_03.png)

---

### The Websocket System

A Nano node provides a websocket that can be subscribed to for real-time messages, for example block confirmation, voting analysis and telemetry. More info can be found [here](https://docs.nano.org/integration-guides/websockets/).
Like with the RPC interface, NanoRPCProxy provides a websocket server with blacklist / DDOS protection and bandwidth limitation by only allowing certain subscriptions and data amount. It subscribes to the Nano node locally with the clients subscribing to the proxy itself to act as a secure layer and protect the node. This means only one node subscription is needed to serve all clients and several clients can listen on the same account with no increase in node communication. Thus, the node websocket does not need to be exposed publicly.

![NanoRPCProxy](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/NanoRPCProxy_ws.png)

The supported messages are shown below:

**Subscribe to block confirmations**
Just like the node you can subscribe to confirmed blocks on the network. However, one exception is you MUST specify a list of accounts. The maximum allowed number is defined in the settings parameter <websocket_max_accounts>. The account is tracked based on both "account" or "link_as_account" which means it can be used also to detect pending transactions (which would be subtype=send and the tracked account as "link_as_account").

    {
        "action": "subscribe",
        "topic": "confirmation",
        "options": {
          "accounts": [<account1>,<account2>]
        }
    }

**Response**

    {
      "topic": "confirmation",
      "time": "1590331435605",
      "message": {
        "account": "nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue",
        "amount": "10000000",
        "hash": "2B779B43B3CF95AFAA63AD696E6546DB7945BCE5CC5A78F670FFD41BCA998D1E",
        "confirmation_type": "active_quorum",
        "block": {
          "type": "state",
          "account": "nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue",
          "previous": "FC5AE29E3BD13A5D8D26EA2632871D2CFE7856BF4E83E75FA90B72AC95054635",
          "representative": "nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue",
          "balance": "946740088999999996972769989996",
          "link": "90A12364A96F6F31EDC3ADA115E88B3AEAEA05C6A78A79023CFDEFB4D901FCD6",
          "link_as_account": "nano_36736fkckuuh89pw9df34qnapgqcxa4wfbwch635szhhpmei5z8pttkxawk1",
          "signature": "9C6A45460C946387A267EE6B5AEFE17C4C036C7B5E10239BC492CAAD180B4E0AD42A02875DC7B4FEF52B5FE8FD73BA3D28E0CCF8FDCFF86AA2938822E88A600B",
          "work": "bed7a7d8ab438039",
          "subtype": "send"
        }
      }
    }

---

### Error handling

If error or warnings occurs in the server when calling it the client will need to handle that. The response is (along with a http status code != 200):

---

### Logging and Stats

The server will write a standard log depending on the "log_level" in settings.json and token_settings.json. Additionally, a request-stat.log is written in the server dir every day at midnight with a daily request count and timestamp.

---

---

---

## How to install and test the demo clients

The proxy server can be tested and experimented with using provided demo clients. They can also help you getting starting with your own setup.

### Python client

1. Locate the directory demo_clients/python/
2. If you haven't, install pipenv to run the app in a virtual environment: **pip install pipenv** for Linux or **py -m pip install --user pipenv** for Windows. To call "pipenv" in Windows instead of "py -m pipenv" you can add the python script folder (provided by the installation log) to your environment PATH.
3. Start the environment: **pipenv shell**
4. Install the packages required: **pipenv sync**
5. Test a request with "python client.py --c 1" where 1 means command example 1. Run "python client.py --help" to find out more. In windows you use "py client.py".
6. To test a server that is using authentication: "python client.py --c 1 --a"

Exit pipenv: **exit**

![Python demo app](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_python.png)

---

### JS client

1. Locate the directory demo_clients/js
2. Open index.html in a browser

Note: The credentials for authentication is hard coded in the javascript and to my knowledge it's not possible to hide. However, the reactjs client is compiled and thus have the creds hidden inside the app. As far as I know, that should be safe as long as the source code cred file is not shared publicly.

![JS demo app](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_js.png)

---

### REACT client

The only demo client that has full functionality for purchasing request tokens

**To run the pre-built app:**

1. Locate the directory demo_clients/reactjs/build
2. Open index.html in a browser (Chrome/Firefox recommended)
3. If you change the user credentials in the server <creds.json> you will also need to change the reactjs/src/rpc.js credentials and re-build the app from source (instructions below). Don't share your creds file if you are going to make it live!

![React demo app](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_react_01.png)

**To run or build the app from source**

1. Make sure you have node.js (and react) installed. [Windows Guide](https://www.liquidweb.com/kb/install-react-js-windows/) | [Ubuntu Guide](https://medium.com/@DanielSayidi/install-and-setup-react-app-on-ubuntu-18-04-3-lts-fcd2c875885a)
2. Locate the directory demo_clients/reactjs
3. Install required libraries: "npm install" or "yarn install"
4. Test the app in development mode: "npm start" or "yarn start"
5. Navigate to http://localhost:3000/
6. To build from source: "npm run-script build"
7. The final build is located in clients/reactjs/build

---

### Flask client

1. Locate the directory demo_clients/python/
2. If you haven't, install pipenv to run the app in a virtual environment: **pip install pipenv** for Linux or **py -m pip install --user pipenv** for Windows. To call "pipenv" in Windows instead of "py -m pipenv" you can add the python script folder (provided by the installation log) to your environment PATH.
3. Start the environment: **pipenv shell**
4. Install the packages required: **pipenv sync**
5. Test the app: **python client.py** (In windows you use "py client.py")
6. Open in browser: **http://127.0.0.1:5000/** (If site not reachable in Windows, you may have to disable third party firewall)

Exit pipenv: **exit**

![Flask demo app](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_js.png)

---

### Websocket JS client

1. Locate the directory demo_clients/websocket_js
2. Open index.html in a browser

![JS demo app](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_websocket_js.png)

---

### Websocket Node.js client

1. Locate the directory demo_clients/websocket_nodejs
2. Install required libraries: "npm install"
3. Open client.js and edit the accounts to track (and possibly the ws_host url)
4. Test the app in development mode: "node client.js"
5. Watch the console when the Nano network detects a new confirmed block

![JS demo app](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_websocket_nodejs.png)

---

### Websocket Python client

1. Locate the directory demo_clients/websocket_python/
2. If you haven't, install pipenv to run the app in a virtual environment: **pip install pipenv** for Linux or **py -m pip install --user pipenv** for Windows. To call "pipenv" in Windows instead of "py -m pipenv" you can add the python script folder (provided by the installation log) to your environment PATH.
3. Start the environment: **pipenv shell**
4. Install the packages required: **pipenv sync**
5. Open client.js and edit the accounts to track (and possibly the ws_host url)
6. Test the subscription with "python client.py --a nano_xxx nano_yyy". In windows you use "py client.py".

Exit pipenv: **exit**

![Python demo app](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/client_demo_websocket_python.png)

---

---

---

## How to use Prometheus and Grafana

The proxy allows data scraping using Prometheus. That can for example be visualized in Grafana in your browser.

![Grafana Example](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/grafana_01.png)

The following data points are enabled (prom-client.ts):

- **process_request:** Counts processRequest per IP address and action
- **log:** Counts number of logged events
- **user_rate_limited:** Counts number of times an IP address is rate limited
- **user_slow_down:** Counts number of times an IP address is rate limited with slow down
- **user_ddos:** Counts number of times an IP address is rate limited from DDOS
- **websocket_subscription:** Counts number of times an IP has subscribed to websocket
- **websocket_message:** Counts number of times an IP has received a websocket message
- **time_rpc_call:** Times RPC calls to the Nano backend
- **time_price_call:** Times external call to get price information
- **time_verified_call:** Times external call to get verified accounts

You can whitelist Prometheus per IP or subnet via the setting: "enable_prometheus_for_ips"
If you are using docker it's recommended to whitelist the whole docker subnet since a container IP can change.

Easiest way to get started with Prometheus and Grafana is to use docker-compose. That works fine together with other node or RPCProxy containers you may be running. You can put them all in the same composer or you can use a **local network** as shown below called "mynet" that allow different containers to talk to each other. For example several other proxy servers running in different containers.

For persistant storage you can use docker volumes or local data folders (prom_data and graf_data) as shown below (you need to create them first).
For access rights in this case you need your user ID, which was "0" in this example. To get ID you can run "id -u in linux".

More info in the section about [docker](#option3-with-docker)

**Node + proxy + prometheus + grafana: docker-compose.yml.**

    version: "3.7"
    services:
      node:
        image: "nanocurrency/nano:latest"
        restart: "unless-stopped"
        ports:
          - "7075:7075"
        volumes:
          - "./nano_node:/root"
      nanorpcproxy:
        image: "nanojson/nanorpcproxy:latest"
        restart: "unless-stopped"
        ports:
          - "9950:9950"
          - "9952:9952"
        volumes:
          - ./:/root

      prometheus:
        image: prom/prometheus
        user: "0"
        volumes:
          - ./prom_data:/prometheus
          - ./prometheus.yml:/etc/prometheus/prometheus.yml
        depends_on:
          - nanorpcproxy
        ports:
          - 9090:9090

      grafana:
        image: grafana/grafana:latest
        user: "0"
        volumes:
          - ./graf_data:/var/lib/grafana
        depends_on:
          - prometheus
        ports:
          - 3000:3000

**prometheus + grafana using a docker network: docker-compose.yml.**

    version: '3.7'

    services:
      prometheus:
        image: prom/prometheus
        user: "0"
        volumes:
          - ./prom_data:/prometheus
          - ./prometheus.yml:/etc/prometheus/prometheus.yml
        ports:
          - 9090:9090

      grafana:
        image: grafana/grafana:latest
        user: "0"
        volumes:
          - ./graf_data:/var/lib/grafana
        depends_on:
          - prometheus
        ports:
          - 3000:3000

    networks:
      default:
        external:
          name: mynet

Before you start prometheus you also need a config file. You can have as many different jobs or targets as you like. That can be filtered later in grafana:

prometheus.yml

    global:
      scrape_interval: 30s
      scrape_timeout: 10s

    scrape_configs:
      - job_name: proxy
        metrics_path: /prometheus
        static_configs:
          - targets:
              - 'nanorpcproxy:9950'

- Prometheus frontend can be accessed at http://localhost:9090
- Grafana frontend can be accessed at http://localhost:3000
- Once in grafana you can add the prometheus data source at "http://prometheus:9090"

Then you can add panels and attach to the prometheus data points that are measured by the RPCproxy. Some examples below:

- Requests per hour (1h average) grouped by RPC action (Bar gauge panel):

`sum by (action)(round(rate(process_request{job="proxy"}[1h])*3600))`

- Requests per hour stacked by RPC action (Graph with bars, stacked):

`sum by (action)(increase(process_request{job="proxy"}[1h]))`

- Total RPC requests per hour (Graph):

`sum(rate(process_request{job="proxy"}[1h])*3600)`

- RPC delays per RPC action (Graph):

`sum by (action)(rate(time_rpc_call_sum{job="proxy"}[1h]) / rate(time_rpc_call_count{job="proxy"}[1h]))`

- Websocket messages per hour (Graph):

`sum(rate(websocket_message{job="proxy"}[1h])) * 3600`

- Most active IPs requesting PoW with a threshold of 100 (Graph):

`sum by (ip)(round(increase(process_request{job="proxy", action="work_generate"}[1d]))) > 100`

- IPs DDOSed per hour grouped by IP with threshold of 1 (Graph):

`sum by (ip)(round(rate(user_ddos{job="proxy"}[1h])*3600 + 1)) > 1`

- Top 20 most active IPs counted as requests per day (Bar gauge, instant, horizontal):

`topk(20,sum by (ip)(increase(process_request{job="proxy"}[1d])))`

- Top 20 most slowed downed IPs per week (Bar gauge, instant, horizontal):

`topk(20,sum by (ip)(max_over_time(user_slow_down{job="proxy"}[1w])))`

---

---

---

## Developer Donations

Find this useful? Consider sending me a Nano donation at nano_1gur37mt5cawjg5844bmpg8upo4hbgnbbuwcerdobqoeny4ewoqshowfakfo

Discord support server and feedback: https://discord.gg/RVCuFvc
