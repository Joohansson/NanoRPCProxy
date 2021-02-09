import {readTokenSettings, tokenLogSettings} from "../token-settings";

export {}

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

test('log token settings with no config', () => {
    let settings: string[] = []
    const readSettings = readTokenSettings('path-does-not-exist.json')
    tokenLogSettings((setting: string) => settings.push(setting), readSettings)
    expect(settings.length).toBe(11);
    expect(settings).toStrictEqual(expectedDefaultSettings)
});
