/** @see https://docs.nano.org/commands/rpc-protocol/#active_difficulty */

interface ProcessDataResponse {
    difficulty: any
    multiplier: string
    tokens_total: number
    error: string | null
    work: string | null
}

interface PendingBlock {
    amount: string
    source: string
}

/** @see https://docs.nano.org/commands/rpc-protocol/#pending */
interface PendingResponse {
    blocks: Record<string, PendingBlock>
    error: string | null
}

/** @see https://docs.nano.org/commands/rpc-protocol/#account_info */
interface AccountInfoResponse {
    frontier: string
    balance: string
    representative: string
    error: string | null
}

/** @see https://docs.nano.org/commands/rpc-protocol/#work_generate */
interface WorkGenerateResponse {
    work: string
    difficulty: string
    multiplier: string
    hash: string
}

/** @see https://docs.nano.org/commands/rpc-protocol/#process */
interface ProcessResponse {
    hash: string
    error: string | null
}
