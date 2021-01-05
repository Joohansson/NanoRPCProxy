import {VerifiedAccount} from "../node-api/proxy-api";

/** @see https://mynano.ninja/api/accounts/verified */
interface MynanoVerifiedAccount {
    votingweight: number
    delegators: number
    uptime: number
    score: number
    account: string
    alias: string
}

export type MynanoVerifiedAccountsResponse = MynanoVerifiedAccount[]

export const mynanoToVerifiedAccount: (a: MynanoVerifiedAccount, tokensTotal?: number) => VerifiedAccount = (verifiedAccount, tokensTotal) => {
    return {
        votingweight: verifiedAccount.votingweight,
        delegators: verifiedAccount.delegators,
        uptime: verifiedAccount.uptime,
        score: verifiedAccount.score,
        account: verifiedAccount.account,
        alias: verifiedAccount.alias,
    }
}
