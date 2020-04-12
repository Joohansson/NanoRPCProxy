# NanoRPCProxy
A relay and protection system sits between a client and a Nano node RPC interface.

## Features
* Fully customizable via a settings file
* Caching of defined request actions for defined duration
* Limit number of response objects, like number of pending transactions
* Slow down IPs that doing requests above limit
* Block IPs for a certain amount of time that are doing requests above limit
* IP black list (TODO)
* Supports basic authorization (username / password)
* Multiple users via authorization (TODO)
* Output log
* Additional request tokens purchasable with Nano (TODO)
* Listen on http and/or https with your own SSL cert (or use another proxy like Cloudflare to serve https)

## Install and run proxy server


## How customize the proxy server
The proxy server is configured via the settings.json file found in the server folder
* node_url: Nano node RPC url (default for main network is 'http://[::1]:7076' and for beta network 'http://[::1]:55000') [number]
* http_port: Port to listen on for http (enabled default with the setting <use_http>) [number]
* https_port: Port to listen on for https (disabled default with the setting <use_https>) [number]
* use_auth: If require username and password when connecting to the proxy [true/false]
* use_speed_limiter: If slowing down IPs when they request above set limit (defined in <speed_limiter>) [true/false]
* use_ip_block: If blocking IPs for a certain amount of time when they request above set limit (defined in <ip_block>) [true/false]
* use_cache: If caching certain commands set in <cached_commands> [true/false]
* use_http: Listen on http [true/false]
* use_https: Listen on https (a valid cert and key file is needed via <https_cert> and <https_key>) [true/false]
* use_output_limiter: If limiting number of response objects, like pending transactions, to a certain max amount set in <limited_commands>. Only valid for RPC actions that have a "count" key [true/false] [true/false]
* use_ip_blacklist: If always blocking certain IPs set in <ip_blacklist> [true/false]
* https_cert: File path for pub cert file [absolute path string]
* https_key: File path for private key file [absolute path string]
* allowed_commands: A list of RPC actions to allow [list]
* cached_commands: A list of commands [key] that will be cached for corresponding duration in seconds as [value]
* limited_commands: A list of commands [key] to limit the output response for with max count as [value]
* ip_blacklist: A list of IPs to always block
* speed_limiter: Contains the settings for slowing down clients. The rolling time slot is defined with <time_window> [ms]. When number of requests in that slot is exceeding <request_limit> it will start slowing down requests with increments of <delay_increment> [ms] with a maximum total delay defined in <max_delay> [ms]
* ip_block: Contains the settings for blocking IPs when they request too much. The rolling time slot is defined with <time_window> [ms]. When number of requests in that slot is exceeding <request_limit> it will block the IP until the time slot has passed. Then the IP can start requesting again. To permantenly ban IPs they have to be manually added to <ip_blacklist> and activating <use_ip_blacklist>
* log_level: It can be set to either "info" which will output all logs, "warning" which will only output warning messages or "none" which will only log the initial settings.

## How to call the proxy server
You call the proxy server just like you would call the node RPC. It's a normal POST request to "<YourProxyURL>/proxy" with json formatted data.
The node commands are found here: https://docs.nano.org/commands/rpc-protocol/

### Using curl
curl -X POST -H "Content-Type: application/json" -d '{"action":"block_count"}' http://localhost:9950/proxy

### Using python
No authorization

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

### Using JS

## How to install and test the demo clients
The proxy server can be tested and experimented with using provided demo clients. They can also help you getting starting with your own setup.

### Python client

### JS client


## Special Notes


## Developer instructions
Find this useful? Send me a Nano donation at `nano_1gur37mt5cawjg5844bmpg8upo4hbgnbbuwcerdobqoeny4ewoqshowfakfo`
