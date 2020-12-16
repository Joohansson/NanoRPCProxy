import {CachedCommands, LimitedCommands, LogLevel} from "./common-settings";

/** Contains the settings for the slow down filter */
export interface SlowDown {
    // rolling time window in ms
    time_window: number
    // allow x requests per time window, then start slowing down
    request_limit: number
    // begin adding X ms of delay per request when delayAfter has been reached
    delay_increment: number
    // max delay in ms to slow down
    max_delay: number
}

/** Contains the settings for the rate limiter */
export interface RateLimiter {
    // Limit each IP to x requests per duration
    request_limit: number
    // Rolling time window in sec
    time_window: number
}

/** Contains the settings for the ddos protection */
export interface DdosProtection {
    // Limit each IP to x requests per duration
    request_limit: number
    // Rolling time window in sec
    time_window: number
}

/** Base config for the Proxy */
export default interface ProxySettings {
    // nano node RPC url (default for beta network is 'http://[::1]:55000')
    node_url: string;
    // node websocket server (only used if activated with use_websocket)
    node_ws_url: string;
    // port to listen on for http (enabled default with use_http)
    http_port: number;
    // port to listen on for https (disabled default with use_https)
    https_port: number;
    // port to listen on for http websocket connection (only used if activated with use_websocket)
    websocket_http_port: number;
    // port to listen on for https websocket connection (only used if activated with use_websocket)
    websocket_https_port: number;
    // Prefix in the request path, e.g. '/proxy' for 'https://server:port/proxy'
    request_path: string;
    // if require username and password when connecting to proxy
    use_auth: boolean;
    // if slowing down requests for IPs doing above set limit (defined in slow_down)
    use_slow_down: boolean;
    // if blocking IPs for a certain amount of time when they request above set limit (defined in rate_limiter)
    use_rate_limiter: boolean;
    // if caching certain commands set in cached_commands
    use_cache: boolean;
    // listen on http (active by default)
    use_http: boolean;
    // listen on https (inactive by default) (a valid cert and key file is needed via https_cert and https_key)
    use_https: boolean;
    // if limiting number of response objects, like pending transactions, to a certain max amount set in limited_commands. Only supported for RPC actions that have a "count" key
    use_output_limiter: boolean;
    // if blocking access to IPs listed in ip_blacklist
    use_ip_blacklist: boolean;
    // if activating the token system for purchase via Nano
    use_tokens: boolean;
    // if enable subscriptions on the node websocket (protected by the proxy)
    use_websocket: boolean;
    // if handling cors policy here, if not taken care of in upstream proxy (cors_whitelist=[] means allow ANY ORIGIN)
    use_cors: boolean;
    // if allow work_generate to be done by dPoW instead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "network current" will be used. (bpow will be used primary to dpow) (requires work_generate in allowed_commands and credentials to be set in pow_creds.json)
    use_dpow: boolean;
    // if allow work_generate to be done by BoomPoW intead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "network current" will be used. (bpow will be used primary to dpow) (requires work_generate in allowed_commands and credentials to be set in pow_creds.json)
    use_bpow: boolean;
    // file path for pub cert file
    https_cert: string;
    // file path for private key file
    https_key: string;
    // only allow RPC actions in this list
    allowed_commands: string[];
    // a list of commands [key] that will be cached for corresponding duration in seconds as [value]
    cached_commands: CachedCommands[];
    // a list of commands [key] to limit the output response for with max count as [value]
    limited_commands: LimitedCommands[];
    slow_down: SlowDown | any;
    rate_limiter: RateLimiter | any;
    ddos_protection: DdosProtection | any;
    // a list of IPs to deny always
    ip_blacklist: string[];
    // if the NanoRPCProxy is behind other proxies such as apache or cloudflare the source IP will be wrongly detected and the filters will not work as intended. Enter the number of additional proxies here.
    proxy_hops: number;
    // // maximum number of accounts allowed to subscribe to for block confirmations
    websocket_max_accounts: number;
    // whitelist requester ORIGIN for example https://mywallet.com or http://localhost:8080 (require use_cors) [list of hostnames]
    cors_whitelist: any[];
    // the log level to use (startup info is always logged): none=zero active logging, warning=only errors/warnings, info=both errors/warnings and info
    log_level: LogLevel;
    // forcefully set watch_work=false for process calls (to block node from doing rework)
    disable_watch_work: boolean;
}
