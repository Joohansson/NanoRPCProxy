export interface TokenAPIError {
    error: string
}

export interface TokenInfo {
    address: string
    token_key: string
    payment_amount: number
}

export interface TokenResponse {
    token_key: string
    tokens_ordered: number
    tokens_total: number
}

export interface WaitingTokenOrder {
    token_key: string
    order_time_left: number
}

export interface CancelOrder {
    priv_key: string
    status: string
}

export interface TokenStatusResponse {
    tokens_total: number
    status: string
}
export interface TokenPriceResponse {
    token_price: number
}

export interface StatusCallback {
    amount: number
    hashes?: string[]
}

export type TokenAPIResponses = TokenResponse | TokenInfo | WaitingTokenOrder | CancelOrder | TokenStatusResponse | TokenAPIError | TokenPriceResponse
