import {CachedCommands, LimitedCommands, log_levels, LogLevel} from "./common-settings";
import * as Fs from "fs";

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
    // if allow work_generate to be done by dPoW instead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "default send difficulty" will be used. (The priority order is bpow > dpow > work server. If all three are set to false, it will use the node to generate work) (requires work_generate in allowed_commands and credentials to be set in pow_creds.json)
    use_dpow: boolean;
    // if allow work_generate to be done by BoomPoW intead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "default send difficulty" will be used. (The priority order is bpow > dpow > work server. If all three are set to false, it will use the node to generate work) (requires work_generate in allowed_commands and credentials to be set in pow_creds.json)
    use_bpow: boolean;
    // if allow work_generate to be done by external work server instead of local node. Work will consume 10 token points. If "difficulty" is not provided with the work_generate request the "default send difficulty" will be used. (The priority order is bpow > dpow > work server. If all three are set to false, it will use the node to generate work) (requires work_generate in allowed_commands)
    use_work_server: boolean;
    // if allow work_generate implicitly add "use_peers": "true" to the request to use work_peers configured in the nano node.
    use_work_peers: boolean;
    // file path for pub cert file
    https_cert: string;
    // file path for private key file
    https_key: string;
    // only allow RPC actions in this list
    allowed_commands: string[];
    // a list of commands [key] that will be cached for corresponding duration in seconds as [value]
    cached_commands: CachedCommands;
    // a list of commands [key] to limit the output response for with max count as [value]
    limited_commands: LimitedCommands;
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
    // IP addresses to enable prometheus for. Typically '127.0.0.1', or '::ffff:127.0.0.1' for IPv6
    enable_prometheus_for_ips: string[];
}

function logObjectEntries(logger: (...data: any[]) => void, title: string, object: any) {
    let log_string = title + "\n"
    for (const [key, value] of Object.entries(object)) {
        if(key) {
            log_string = log_string + key + " : " + value + "\n"
        } else {
            log_string = log_string + " " + value + "\n"
        }
    }
    logger(log_string)
}

export function proxyLogSettings(logger: (...data: any[]) => void, settings: ProxySettings) {
    logger("PROXY SETTINGS:\n-----------")
    logger("Node url: " + settings.node_url)
    logger("Websocket url: " + settings.node_ws_url)
    logger("Http port: " + String(settings.http_port))
    logger("Https port: " + String(settings.https_port))
    logger("Request path: " + settings.request_path)
    if (settings.use_websocket) {
        logger("Websocket http port: " + String(settings.websocket_http_port))
        logger("Websocket https port: " + String(settings.websocket_https_port))
        logger("Websocket nax accounts: " + String(settings.websocket_max_accounts))
    }
    logger("Use authentication: " + settings.use_auth)
    logger("Use slow down: " + settings.use_slow_down)
    logger("Use rate limiter: " + settings.use_rate_limiter)
    logger("Use cached requests: " + settings.use_cache)
    logger("Use output limiter: " + settings.use_output_limiter)
    logger("Use IP blacklist: " + settings.use_ip_blacklist)
    logger("Use token system: " + settings.use_tokens)
    logger("Use websocket system: " + settings.use_websocket)
    logger("Use dPoW: " + settings.use_dpow)
    logger("Use bPoW: " + settings.use_bpow)
    logger("Use work server: " + settings.use_work_server)
    logger("Use work peers: " + settings.use_work_peers)
    logger("Disabled watch_work for process: " + settings.disable_watch_work)
    logger("Listen on http: " + settings.use_http)
    logger("Listen on https: " + settings.use_https)

    logObjectEntries(logger, "Allowed commands:\n-----------\n", settings.allowed_commands)
    if(settings.use_cache)  {
        logObjectEntries(logger, "Cached commands:\n", settings.cached_commands)
    }
    if (settings.use_output_limiter) {
        logObjectEntries(logger, "Limited commands:\n", settings.limited_commands)
    }
    if(settings.use_slow_down) {
        logObjectEntries(logger, "Slow down settings:\n", settings.slow_down)
    }
    if (settings.use_rate_limiter) {
        logObjectEntries(logger, "Rate limiter settings:\n", settings.rate_limiter)
    }
    logObjectEntries(logger, "DDOS protection settings:\n", settings.ddos_protection)

    if (settings.use_ip_blacklist) {
        logObjectEntries(logger, "IPs blacklisted:\n", settings.ip_blacklist)
    }
    if(settings.enable_prometheus_for_ips.length > 0) {
        logObjectEntries(logger, "Prometheus enabled for the following addresses:\n", settings.enable_prometheus_for_ips)
    }

    if (settings.proxy_hops > 0) {
        logger("Additional proxy servers: " + settings.proxy_hops)
    }
    if (settings.use_cors) {
        if (settings.cors_whitelist.length == 0) {
            logger("Use cors. Any ORIGIN allowed")
        }
        else {
            logObjectEntries(logger, "Use cors. Whitelisted ORIGINs or IPs:\n", settings.cors_whitelist)
        }
    }
    logger("Main log level: " + settings.log_level)
}

export function readProxySettings(settingsPath: string): ProxySettings {
    const defaultSettings: ProxySettings = {
        node_url: "http://[::1]:7076",
        node_ws_url: "ws://127.0.0.1:7078",
        http_port: 9950,
        https_port: 9951,
        websocket_http_port: 9952,
        websocket_https_port: 9953,
        request_path: '/proxy',
        use_auth: false,
        use_slow_down: false,
        use_rate_limiter: false,
        use_cache: false,
        use_http: true,
        use_https: false,
        use_output_limiter: false,
        use_ip_blacklist: false,
        use_tokens: false,
        use_websocket: false,
        use_cors: true,
        use_dpow: false,
        use_bpow: false,
        use_work_server: false,
        use_work_peers: false,
        https_cert: '',
        https_key: '',
        allowed_commands: [],
        cached_commands: {},
        limited_commands: {},
        slow_down: {},
        rate_limiter: {},
        ddos_protection: {},
        ip_blacklist: [],
        proxy_hops: 0,
        websocket_max_accounts: 100,
        cors_whitelist: [],
        log_level: log_levels.none,
        disable_watch_work: true,
        enable_prometheus_for_ips: [],
    }
    try {
        const settings: ProxySettings = JSON.parse(Fs.readFileSync(settingsPath, 'utf-8'))
        const requestPath = settings.request_path || defaultSettings.request_path
        const normalizedRequestPath = requestPath.startsWith('/') ? requestPath : '/' + requestPath
        return {...defaultSettings, ...settings, request_path: normalizedRequestPath }
    } catch(e) {
        console.log("Could not read settings.json", e)
        return defaultSettings;
    }
}
