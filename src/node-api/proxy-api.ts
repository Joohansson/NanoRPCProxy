import {TokenAPIActions} from "./token-api";

export type RPCAction = TokenAPIActions | 'mnano_to_raw' | 'mnano_from_raw' | 'process' | 'work_generate' | 'price' | 'verified_accounts'

export interface ProxyRPCRequest {
    action: RPCAction
    token_amount: number
    token_key: string
    amount: string
    watch_work: string
    difficulty: string | undefined
    use_peers: string | undefined
    user: string | undefined
    api_key: string | undefined
    timeout: number
    count: number
    hash: string
}

export interface VerifiedAccount {
    votingweight: number
    delegators: number
    uptime: number
    score: number
    account: string
    alias: string
}
