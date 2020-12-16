import {LOG_LEVEL} from "./common-settings";

export interface TokenSettings {
    // the work server for doing PoW (the node can be used as well, for example http://127.0.0.1:7076, but enable_control is needed in the node config)
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
    log_level: LOG_LEVEL
}
