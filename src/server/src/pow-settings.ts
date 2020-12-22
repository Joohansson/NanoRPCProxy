interface UserKeyPair {
    user: string;
    key: string;
}

export interface PowSettings {
    dpow: UserKeyPair | undefined;
    bpow: UserKeyPair | undefined
}
