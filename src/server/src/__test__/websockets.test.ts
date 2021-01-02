export {}

describe('trackAccount', () => {
    process.env.OVERRIDE_USE_HTTP = 'false'
    const proxy = require('../proxy')

    test('given invalid nano address should return false', () => {
        const res = proxy.trackAccount('192.16.1.1', 'invalid-address')
        expect(res).toBeFalsy()
    });

    test('given valid nano address should return true', () => {
        const res = proxy.trackAccount('192.168.1.1', 'nano_3m497b1ghppe316aiu4o5eednfyueemzjf7a8wye3gi5rjrkpk1p59okghwb')
        expect(res).toBeTruthy()
    })
})
