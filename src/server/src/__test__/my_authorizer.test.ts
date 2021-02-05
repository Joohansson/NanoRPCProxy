import {createProxyAuthorizer} from "../authorize-user";
import {readUserSettings, UserSettings} from "../user-settings";
import {readCredentials} from "../credential-settings";

const defaultUserSettings: UserSettings = {
    allowed_commands: [],
    cached_commands: {},
    limited_commands: {},
    log_level: 'info',
    use_cache: false,
    use_output_limiter: false
};

const authorizer = createProxyAuthorizer(
    defaultUserSettings,
    readUserSettings('user_settings.json.default'),
    readCredentials('creds.json.default')
)

test('myAuthorizer should authorize existing user', () => {
    const authorized = authorizer.myAuthorizer('user1', 'user1')
    expect(authorized).toBeTruthy()
})

test('myAuthorizer should deny user with wrong password', () => {
    const authorized = authorizer.myAuthorizer('user2', 'wrong_password')
    expect(authorized).toBeFalsy()
})

test('myAuthorizer should override with custom settings', () => {
    const userSettings = authorizer.getUserSettings('user2', 'user2')
    expect(userSettings?.allowed_commands).toStrictEqual([ 'account_history', 'account_info', 'block_info', 'block_count' ])
    expect(userSettings?.use_cache).toStrictEqual(true)
})
