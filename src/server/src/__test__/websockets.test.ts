import {deleteConfigFiles} from "./test-commons";
import {User} from "../lowdb-schema";

const websocketPath = 'websocket.json';

describe('trackAccount', () => {
    process.env.CONFIG_WEBSOCKET_PATH = websocketPath
    process.env.OVERRIDE_USE_HTTP = 'false'
    const proxy = require('../proxy')

    test('given invalid nano address should return false', () => {
        const res = proxy.trackAccount('192.16.1.1', 'invalid-address')
        expect(res).toBeFalsy()
    });

    test('given valid nano address should return true and write to cache', () => {
        Date.now = jest.fn(() => 1609595113)
        const res = proxy.trackAccount('192.168.1.1', 'nano_3m497b1ghppe316aiu4o5eednfyueemzjf7a8wye3gi5rjrkpk1p59okghwb')
        expect(res).toBeTruthy()
        const expectedUser: User = {
            ip: '192.168.1.1',
            tracked_accounts: {
                nano_3m497b1ghppe316aiu4o5eednfyueemzjf7a8wye3gi5rjrkpk1p59okghwb: {
                    "timestamp": 1609595,
                }
            }
        }
        expect(proxy.tracking_db.get('users').value()).toStrictEqual([expectedUser])
    })
})

afterAll(() => deleteConfigFiles([websocketPath]))
