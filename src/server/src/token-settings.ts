import {LogLevel} from "./common-settings";
import Fs from "fs";

export interface TokenSettings {
    // the work server for doing PoW (the node can be used as well, for example http://127.0.0.1:7076, but enable_control is needed in the node config)
    // To use bpow or dpow, just point the server to itself such as http://127.0.0.1:9950/proxy (requires bpow/dpow to be configured and work_generate as allowed command)
    work_server: string
    // Nano per token
    token_price: number
    // timeout after 120sec
    payment_timeout: number
    // time to wait for each check for pending Nano
    pending_interval: number
    // only allow pending tx above this raw value
    pending_threshold: string
    // max number of pending to process per account for each order (normally only 1 should be needed)
    pending_count: number
    // Multipliers used when using the node for PoW
    difficulty_multiplier: string
    // where to send the payment
    payment_receive_account: string
    // min allowed tokens to be purchased
    min_token_amount: number
    // max allowed tokens to be purchased
    max_token_amount: number
    // the log level to use (startup info is always logged): none=zero active logging, warning=only errors/warnings, info=both errors/warnings and info
    log_level: LogLevel
}

/** Try reading TokenSettings from file and merge with default settings. Fall back to default settings if no file found */
export function readTokenSettings(settingsPath: string): TokenSettings {
    const defaultSettings: TokenSettings = {
        work_server: "http://[::1]:7076",
        token_price: 0.0001,
        payment_timeout: 180,
        pending_interval: 2,
        pending_threshold: "100000000000000000000000",
        pending_count: 10,
        difficulty_multiplier: "1.0",
        payment_receive_account: "nano_1gur37mt5cawjg5844bmpg8upo4hbgnbbuwcerdobqoeny4ewoqshowfakfo",
        min_token_amount: 1,
        max_token_amount: 10000000,
        log_level: "info",
    }
    try {
        const readSettings: TokenSettings = JSON.parse(Fs.readFileSync(settingsPath, 'utf-8'))
        return {...defaultSettings, ...readSettings}
    }
    catch(e) {
        console.log("Could not read token_settings.json, returns default settings", e)
        return defaultSettings
    }
}

export function tokenLogSettings(logger: (...data: any[]) => void, settings: TokenSettings) {
    logger("TOKEN SETTINGS:\n-----------")
    logger("Work Server: " + settings.work_server)
    logger("Token Price: " + settings.token_price + " Nano/token")
    logger("Payment Timeout: " + settings.payment_timeout)
    logger("Pending Interval: " + settings.pending_interval)
    logger("Pending Threshold: " + settings.pending_threshold)
    logger("Pending Max Count: " + settings.pending_count)
    logger("Difficulty Multiplier: " + settings.difficulty_multiplier)
    logger("Min allowed tokens to purchase: " + settings.min_token_amount)
    logger("Max allowed tokens to purchase: " + settings.max_token_amount)
    logger("Token system log level: " + settings.log_level)
}
