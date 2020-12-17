export {}

const expectedDefaultSettings = [
    'TOKEN SETTINGS:\n-----------',
    'Work Server: http://127.0.0.1:7000',
    'Token Price: 0.0001 Nano/token',
    'Payment Timeout: 120',
    'Pending Interval: 2',
    'Pending Threshold: 1',
    'Pending Max Count: 10',
    'Difficulty Multiplier: 1.0',
    'Min allowed tokens to purchase: 1',
    'Max allowed tokens to purchase: 10000000',
    'Token system log level: none'
]

test('log token settings with no config', () => {
    let settings: string[] = []
    require('../tokens').tokenLogSettings((setting) => settings.push(setting))
    console.log(settings)
    expect(settings.length).toBe(11);
    expect(settings).toStrictEqual(expectedDefaultSettings)
});
