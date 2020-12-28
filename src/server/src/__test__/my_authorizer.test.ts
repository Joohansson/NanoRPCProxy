import {copyConfigFiles, deleteConfigFiles} from "./test-commons";

const filePaths = ['creds.json', 'user_settings.json'];

beforeAll(() => {
    copyConfigFiles(filePaths)
    process.env.OVERRIDE_USE_HTTP = 'false'
    process.env.CONFIG_CREDS_SETTINGS = 'src/__test__/creds.json'
    process.env.CONFIG_USER_SETTINGS = 'src/__test__/user_settings.json'
})

test('myAuthorizer should authorize existing user', () => {
    const authorized = require('../proxy').myAuthorizer('user1', 'user1')
    expect(authorized).toBeTruthy()
})

test('myAuthorizer should deny user with wrong password', () => {
    const authorized = require('../proxy').myAuthorizer('user2', 'wrong_password')
    expect(authorized).toBeFalsy()
})

test('myAuthorizer should override with custom settings', () => {
    const proxy = require('../proxy')
    proxy.myAuthorizer('user2', 'user2')
    expect(proxy.getUserSettings().allowed_commands).toStrictEqual([ 'account_history', 'account_info', 'block_info', 'block_count' ])
})

afterAll(() => deleteConfigFiles(filePaths))
