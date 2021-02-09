import * as Fs from "fs";

export interface Credentials {
    user: string
    password: string
}

export interface CredentialSettings {
    users: Credentials[]
}

export function readCredentials(path: string): Credentials[] {
    try {
        const credentials: CredentialSettings = JSON.parse(Fs.readFileSync(path, 'utf-8'))
        return credentials.users
    }
    catch(e) {
        console.log("Could not read creds.json", e)
        return []
    }
}
