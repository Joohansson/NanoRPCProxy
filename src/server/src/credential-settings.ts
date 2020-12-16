interface Credentials {
    user: string
    password: string
}

export interface CredentialSettings {
    users: Credentials[]
}
