import client, {LabelValues} from "prom-client";
import {RPCAction} from "./node-api/proxy-api";
import {LogLevel} from "./common-settings";

export type MaybeTimedCall = ((labels?: LabelValues<any>) => number) | undefined

export interface PromClient {
    metrics(): Promise<string>
    incRequest: (action: RPCAction, ip: string, token_used: boolean) => void
    incLogging: (logLevel: LogLevel) => void
    incRateLimited: (ip: string) => void,
    incSlowDown: (ip: string) => void,
    incDDOS: (ip: string) => void,
    incWebsocketSubscription: (ip: string) => void,
    incWebsocketMessage: (ip: string) => void,
    incAuthorizeAttempt: (username: string, wasAuthorized: boolean) => void
    timeNodeRpc: (action: RPCAction) => MaybeTimedCall,
    timePrice: () => MaybeTimedCall,
    timeVerifiedAccounts: () => MaybeTimedCall,
    path: string
}

export function createPrometheusClient(): PromClient {
    const collectDefaultMetrics = client.collectDefaultMetrics;
    const Registry = client.Registry;
    const register = new Registry();
    collectDefaultMetrics({ register });

    let processRequestCounter = new client.Counter({
        registers: [register],
        name: "process_request",
        help: "Counts processRequest per IP address and action",
        labelNames: ["action", "ip", "token_used"]
    })

    let logCounter = new client.Counter({
        registers: [register],
        name: "log",
        help: "Counts number of logged events",
        labelNames: ["log_level"]
    })

    let countRateLimited = new client.Counter({
        registers: [register],
        name: "user_rate_limited",
        help: "Counts number of times an IP address is rate limited",
        labelNames: ["ip"]
    })

    let countSlowDown = new client.Counter({
        registers: [register],
        name: "user_slow_down",
        help: "Counts number of times an IP address is rate limited with slow down",
        labelNames: ["ip"]
    })

    let countDDOS = new client.Counter({
        registers: [register],
        name: "user_ddos",
        help: "Counts number of times an IP address is rate limited from DDOS",
        labelNames: ["ip"]
    })

    let countWebsocketSubscription = new client.Counter({
        registers: [register],
        name: "websocket_subscription",
        help: "Counts number of times an IP has subscribed to websocket",
        labelNames: ["ip"]
    })

    let countWebsocketMessage = new client.Counter({
        registers: [register],
        name: "websocket_message",
        help: "Counts number of times an IP has received a websocket message",
        labelNames: ["ip"]
    })

    let countAuthorizedAttempts = new client.Counter({
        registers: [register],
        name: "authorized_attempts",
        help: "Counts basic auth attempts for a given user",
        labelNames: ["username", "success"]
    })

    let rpcHistogram = new client.Histogram({
        registers: [register],
        name: "time_rpc_call",
        help: "Times RPC calls to the Nano backend",
        labelNames: ["action"]
    })

    let priceHistogram = new client.Histogram({
        registers: [register],
        name: "time_price_call",
        help: "Times external call to get price information"
    })

    let verifiedAccountsHistogram = new client.Histogram({
        registers: [register],
        name: "time_verified_call",
        help: "Times external call to get verified accounts"
    })

    return {
        metrics: async () => register.metrics(),
        incRequest: (action: RPCAction, ip: string, token_used: boolean) => processRequestCounter.labels(action, ip, token_used?"1":"0").inc(),
        incLogging: (logLevel: LogLevel) => logCounter.labels(logLevel).inc(),
        incRateLimited: (ip: string) => countRateLimited.labels(ip).inc(),
        incSlowDown: (ip: string) => countSlowDown.labels(ip).inc(),
        incDDOS: (ip: string) => countDDOS.labels(ip).inc(),
        incWebsocketSubscription: (ip: string) => countWebsocketSubscription.labels(ip).inc(),
        incWebsocketMessage: (ip: string) => countWebsocketMessage.labels(ip).inc(),
        incAuthorizeAttempt: (username, wasAuthorized) => countAuthorizedAttempts.labels(username, wasAuthorized ? 'authorized' : 'denied').inc(),
        timeNodeRpc: (action: RPCAction) => rpcHistogram.startTimer({action: action}),
        timePrice: () => priceHistogram.startTimer(),
        timeVerifiedAccounts: () => verifiedAccountsHistogram.startTimer(),
        path: '/prometheus'
    }
}
