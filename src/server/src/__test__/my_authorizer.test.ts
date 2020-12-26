import fs from "fs";

const filePaths = ['creds.json', 'user_settings.json'];

beforeAll(() => {
    filePaths.forEach(filePath => {
        fs.copyFileSync(`${filePath}.default`, filePath, )
    })
})

test('myAuthorizer should authorize existing user', () => {
    process.env.OVERRIDE_USE_HTTP = 'false'
    const authorized = require('../proxy').myAuthorizer('user1', 'user1')
    expect(authorized).toBeTruthy()
})

test('myAuthorizer should deny user with wrong password', () => {
    process.env.OVERRIDE_USE_HTTP = 'false'
    const authorized = require('../proxy').myAuthorizer('user2', 'wrong_password')
    expect(authorized).toBeFalsy()
})

test('myAuthorizer should override with custom settings', () => {
    process.env.OVERRIDE_USE_HTTP = 'false'
    const proxy = require('../proxy')
    proxy.myAuthorizer('user2', 'user2')
    expect(proxy.getUserSettings().allowed_commands).toStrictEqual([ 'account_history', 'account_info', 'block_info', 'block_count' ])
})

afterAll(() => {
    filePaths.forEach(filePath => {
        fs.unlinkSync(filePath)
    })
})
