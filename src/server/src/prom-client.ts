import client, {LabelValues} from "prom-client";
import {RPCAction} from "./node-api/proxy-api";
import {LogLevel} from "./common-settings";

export interface PromClient {
    metrics(): Promise<string>
    incRequest: (action: RPCAction, ip: string) => void
    incLogging: (logLevel: LogLevel) => void
    timeNodeRpc: (action: RPCAction) => (labels?: LabelValues<any>) => number
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

    let rpcHistogram = new client.Histogram({
        registers: [register],
        name: "rpcRequestTime",
        help: "Times the RPC calls to the Nano node",
        labelNames: ["action"]
    })

    return {
        metrics: async () => register.metrics(),
        incRequest: (action: RPCAction, ip: string) => processRequestCounter.labels(action, ip).inc(),
        incLogging: (logLevel: LogLevel) => logCounter.labels(logLevel).inc(),
        timeNodeRpc: (action: RPCAction) => rpcHistogram.startTimer({action: action})
    }
}
