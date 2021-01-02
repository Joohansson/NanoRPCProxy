import {TokenAPIActions} from "./token-api";

export type RPCAction = TokenAPIActions | 'mnano_to_raw' | 'mnano_from_raw' | 'process' | 'work_generate' | 'price'

export interface NanoRPCRequest {
    action: RPCAction
    token_amount: number
    token_key: string
    amount: string
    watch_work: string
    difficulty: string | undefined
    user: string | undefined
    api_key: string | undefined
    timeout: number
    count: number
    hash: string
}
