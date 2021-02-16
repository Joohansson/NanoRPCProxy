import {UserSettings, UserSettingsConfig} from "./user-settings";
import {Credentials} from "./credential-settings";
import BasicAuth from 'express-basic-auth'
import {PromClient} from "./prom-client";

export interface ProxyAuthorizer {
    getUserSettings: (username: string, password: string) => UserSettings | undefined
    myAuthorizer: (username: string, password: string) => boolean
}

function validUser({user, password}: Credentials, suppliedUsername: string, suppliedPassword: string): boolean {
    return BasicAuth.safeCompare(suppliedUsername, user) && BasicAuth.safeCompare(suppliedPassword, password)
}

export function createProxyAuthorizer(
    defaultSettings: UserSettings,
    userSettings: UserSettingsConfig,
    users: Credentials[],
    promClient?: PromClient
): ProxyAuthorizer {

    const findValidUserSettings = (username: string, password: string): UserSettings | undefined => {
        return users
            .filter(user => validUser(user, username, password))
            .map(validUser => {
                const settings: UserSettings | undefined = userSettings[validUser.user]
                return {
                    ...defaultSettings,
                    ...settings
                }
            })[0]
    }

    return {
        myAuthorizer: (username: string, password: string) => {
            const authorized = findValidUserSettings(username, password) !== undefined
            promClient?.incAuthorizeAttempt(username, authorized)
            return authorized
        },
        getUserSettings: (username: string, password: string) => findValidUserSettings(username, password),
    }
}
