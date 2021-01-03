import {deleteConfigFiles} from "./test-commons";
import {User} from "../lowdb-schema";

let proxy: any;

describe('trackAccount', () => {

    beforeEach(() => {
        // deleteConfigFiles([websocketPath])
        process.env.CONFIG_WEBSOCKET_PATH = 'src/__test__/websocket.json'
        process.env.OVERRIDE_USE_HTTP = 'false'
        proxy = require('../proxy')
        deleteConfigFiles(['websocket.json'])
    })

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

    test('given same ip and different address, should append new address', () => {
        Date.now = jest.fn(() => 1609595113)
        proxy.trackAccount('192.168.1.1', 'nano_3m497b1ghppe316aiu4o5eednfyueemzjf7a8wye3gi5rjrkpk1p59okghwb')
        proxy.trackAccount('192.168.1.1', 'nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue')
        const expectedUser: User = {
            ip: '192.168.1.1',
            tracked_accounts: {
                nano_3m497b1ghppe316aiu4o5eednfyueemzjf7a8wye3gi5rjrkpk1p59okghwb: {
                    "timestamp": 1609595,
                },
                nano_3jsonxwips1auuub94kd3osfg98s6f4x35ksshbotninrc1duswrcauidnue: {
                    "timestamp": 1609595,
                }
            }
        }
        expect(proxy.tracking_db.get('users').value()).toStrictEqual([expectedUser])
    })

    afterEach(() => deleteConfigFiles(['websocket.json']))
})
