import client, {LabelValues} from "prom-client";
import {RPCAction} from "./node-api/proxy-api";
import {LogLevel} from "./common-settings";

export type MaybeTimedCall = ((labels?: LabelValues<any>) => number) | undefined

export interface PromClient {
    metrics(): Promise<string>
    incRequest: (action: RPCAction, ip: string) => void
    incLogging: (logLevel: LogLevel) => void
    incRateLimited: (ip: string) => void,
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
        name: "processRequest",
        help: "Counts processRequest per IP address",
        labelNames: ["action", "ip"]
    })

    let logCounter = new client.Counter({
        registers: [register],
        name: "log",
        help: "Counts number of logged events",
        labelNames: ["log_level"]
    })

    let countRateLimited = new client.Counter({
        registers: [register],
        name: "user_ratelimited",
        help: "Incremented a client is rate limited",
        labelNames: ["ip"]
    })

    let rpcHistogram = new client.Histogram({
        registers: [register],
        name: "time_rpc_call",
        help: "Times the RPC calls to the Nano node",
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
        incRequest: (action: RPCAction, ip: string) => processRequestCounter.labels(action, ip).inc(),
        incLogging: (logLevel: LogLevel) => logCounter.labels(logLevel).inc(),
        incRateLimited: (ip: string) => countRateLimited.labels(ip).inc(),
        timeNodeRpc: (action: RPCAction) => rpcHistogram.startTimer({action: action}),
        timePrice: () => priceHistogram.startTimer(),
        timeVerifiedAccounts: () => verifiedAccountsHistogram.startTimer(),
        path: '/prometheus'
    }
}
