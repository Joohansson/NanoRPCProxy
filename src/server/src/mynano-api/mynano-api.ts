/** @see https://mynano.ninja/api/accounts/verified */
interface VerifiedAccount {
    votingweight: number
    delegators: number
    uptime: number
    score: number
    account: string
    alias: string
    tokens_total?: number
}

type VerifiedAccountsResponse = VerifiedAccount[]
