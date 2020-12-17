import * as fs from 'fs';

const expectedDefaultSettings = [
    'TOKEN SETTINGS:\n-----------',
    'Work Server: http://[::1]:7076',
    'Token Price: 0.0001 Nano/token',
    'Payment Timeout: 180',
    'Pending Interval: 2',
    'Pending Threshold: 100000000000000000000000',
    'Pending Max Count: 10',
    'Difficulty Multiplier: 1.0',
    'Min allowed tokens to purchase: 1',
    'Max allowed tokens to purchase: 10000000',
    'Token system log level: info'
]

const filePath = 'token_settings.json';

beforeAll(() => {
    fs.copyFileSync(`${filePath}.default`, filePath, )
})

test('log tokens settings with default config from file', () => {
    let settings = []
    require('../tokens').tokenLogSettings((setting) => settings.push(setting))
    console.log(settings)
    expect(settings.length).toBe(11);
    expect(settings).toStrictEqual(expectedDefaultSettings)
});

afterAll(() => {
    fs.unlinkSync(filePath)
})
