# NanoRPCProxy
NanoRPCProxy is a relay and protection system that sits between a client and a Nano node RPC interface. It makes it possible to set the RPC interface public to the Internet without compromising the security of the node itself. The Nano node has no built in functionality for user authentication, rate limiting or caching which makes it dangerous to open up without protection like this. With NanoRPCProxy you can for example serve a mobile app or web frontend with direct node calls.

## Features
* Fully customizable via a settings file
* Caching of certain request actions to lower the RPC burden
* Limit number of response objects, like number of pending transactions
* Slow down IPs that doing requests above limit
* Block IPs for a certain amount of time that are doing requests above limit
* IP black list (TODO)
* Supports basic authentication (username / password)
* Supports multiple users via authentication
* Additional request tokens purchasable with Nano (TODO)
* Listen on http and/or https with your own SSL cert (or use another proxy like Cloudflare to serve https)

## Install and run proxy server


## How customize the proxy server
The proxy server is configured via the settings.json file found in the server folder
* **node_url:** Nano node RPC url (default for main network is 'http://[::1]:7076' and for beta network 'http://[::1]:55000') [number]
* **http_port:** Port to listen on for http (enabled default with the setting <use_http>) [number]
* **https_port:** Port to listen on for https (disabled default with the setting <use_https>) [number]
* **use_auth:** If require username and password when connecting to the proxy [true/false]
* **use_speed_limiter:** If slowing down IPs when they request above set limit (defined in <speed_limiter>) [true/false]
* **use_ip_block:** If blocking IPs for a certain amount of time when they request above set limit (defined in <ip_block>) [true/false]
* **use_cache:** If caching certain commands set in <cached_commands> [true/false]
* **use_http:** Listen on http [true/false]
* **use_https:** Listen on https (a valid cert and key file is needed via <https_cert> and <https_key>) [true/false]
* **use_output_limiter:** If limiting number of response objects, like pending transactions, to a certain max amount set in <limited_commands>. Only valid for RPC actions that have a "count" key [true/false] [true/false]
* **use_ip_blacklist:** If always blocking certain IPs set in <ip_blacklist> [true/false]
* **https_cert:** File path for pub cert file [absolute path string]
* **https_key:** File path for private key file [absolute path string]
* **allowed_commands:** A list of RPC actions to allow [list]
* **cached_commands:** A list of commands [key] that will be cached for corresponding duration in seconds as [value]
* **limited_commands:** A list of commands [key] to limit the output response for with max count as [value]
* **ip_blacklist:** A list of IPs to always block
* **speed_limiter:** Contains the settings for slowing down clients. The rolling time slot is defined with <time_window> [ms]. When number of requests in that slot is exceeding <request_limit> it will start slowing down requests with increments of <delay_increment> [ms] with a maximum total delay defined in <max_delay> [ms]
* **ip_block:** Contains the settings for blocking IPs when they request too much. The rolling time slot is defined with <time_window> [ms]. When number of requests in that slot is exceeding <request_limit> it will block the IP until the time slot has passed. Then the IP can start requesting again. To permantenly ban IPs they have to be manually added to <ip_blacklist> and activating <use_ip_blacklist>
* **log_level:** It can be set to either "info" which will output all logs, "warning" which will only output warning messages or "none" which will only log the initial settings.

## How to call the proxy server
You call the proxy server just like you would call the node RPC. It's a normal POST request to "<YourProxyURL>/proxy" with json formatted data.
The node commands are found here: https://docs.nano.org/commands/rpc-protocol/

### Using curl
The curl command looks just a tiny bit different than for a direct node request. You just have to define it with a json content type. You can also use the -i flag to include response headers.

**No authentication**

    curl -H "Content-Type: application/json" -d '{"action":"block_count"}' http://localhost:9950/proxy

**With authentication**

    curl --user user1:user1 -H "Content-Type: application/json" -H '{"action":"block_count"}' http://127.0.0.1:9950/proxy

### Using python
**No authentication**

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

**With authentication**
Note: verify=False means we ignore possible SSL certificate errors. Recommended to set to True

    import requests
    import json
    from requests.auth import HTTPBasicAuth
    try:
        r = requests.post('http://localhost:9950/proxy', json={"action":"block_count"}, verify=False, auth=HTTPBasicAuth(username, password))
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

### Using JS

## How to install and test the demo clients
The proxy server can be tested and experimented with using provided demo clients. They can also help you getting starting with your own setup.

### Python client
1. Make sure you have at least python3 installed
2. Locate the directory demo_clients/python/
3. Run this to install required libraries: "pip3 install -r requirements.txt"
4. Make sure you have the proxy server running locally
5. Test a request with "python3 client.py --c 1" where 1 means command example 1. Run "python3 client.py --help" to find out more.
6. To test a server that is using authentication: "python3 client.py --c 1 --a"

### JS client

### REACT client
**To run the pre-built app:**

1. Locate the directory demo_clients/reactjs/build
2. Open index.html in a browser (Chrome/Firefox recommended)
3. Test the sample buttons or paste any RPC command from the [docs](https://docs.nano.org/commands/rpc-protocol/)(including the {}). The available commands are set in the server settings.json file.
4. If you change the user credentials in the server <creds.json> you will also need to change the reactjs/src/rpc.js credentials and re-build the app from source (instructions below)

![ReactJS demo app](https://github.com/Joohansson/NanoRPCProxy/raw/master/media/reactjs_client.png)

**To run or build the app from source**

1. Make sure you have node.js (and react) installed. [Windows Guide](https://www.liquidweb.com/kb/install-react-js-windows/) | [Ubuntu Guide](https://medium.com/@DanielSayidi/install-and-setup-react-app-on-ubuntu-18-04-3-lts-fcd2c875885a)
2. Locate the directory demo_clients/reactjs
3. Install required libraries" "npm install" or "yarn install"
3. Test the app in development mode: "npm start" or "yarn start"
4. Navigate to http://localhost:3000/
5. To build from source: "npm build" or "yarn build"
6. The final build is located in clients/reactjs/build

## Special Notes


## Developer instructions
Find this useful? Send me a Nano donation at `nano_1gur37mt5cawjg5844bmpg8upo4hbgnbbuwcerdobqoeny4ewoqshowfakfo`
