import {copyConfigFiles, deleteConfigFiles, getTestPath} from "./test-commons";
import {proxyLogSettings, readProxySettings} from "../proxy-settings";

const expectedSettingsWithFile = [
    'PROXY SETTINGS:\n-----------',
    'Node url: http://[::1]:7076',
    'Websocket url: ws://127.0.0.1:7078',
    'Http port: 9950',
    'Https port: 9951',
    'Request path: /proxy',
    'Use authentication: false',
    'Use slow down: true',
    'Use rate limiter: true',
    'Use cached requests: true',
    'Use output limiter: true',
    'Use IP blacklist: true',
    'Use token system: false',
    'Use websocket system: false',
    'Use dPoW: false',
    'Use bPoW: false',
    'Use work server: false',
    'Use work peers: false',
    'Disabled watch_work for process: true',
    'Listen on http: true',
    'Listen on https: false',
    'Allowed commands:\n' +
    '-----------\n' +
    '\n' +
    '0 : account_history\n' +
    '1 : account_info\n' +
    '2 : account_balance\n' +
    '3 : accounts_balances\n' +
    '4 : account_key\n' +
    '5 : account_representative\n' +
    '6 : account_weight\n' +
    '7 : accounts_frontiers\n' +
    '8 : accounts_pending\n' +
    '9 : active_difficulty\n' +
    '10 : available_supply\n' +
    '11 : block_account\n' +
    '12 : block_info\n' +
    '13 : block_count\n' +
    '14 : block_create\n' +
    '15 : block_confirm\n' +
    '16 : blocks_info\n' +
    '17 : chain\n' +
    '18 : confirmation_quorum\n' +
    '19 : delegators_count\n' +
    '20 : frontiers\n' +
    '21 : key_create\n' +
    '22 : pending\n' +
    '23 : pending_exists\n' +
    '24 : process\n' +
    '25 : representatives\n' +
    '26 : representatives_online\n' +
    '27 : sign\n' +
    '28 : successors\n' +
    '29 : price\n' +
    '30 : mnano_to_raw\n' +
    '31 : mnano_from_raw\n' +
    '32 : work_validate\n' +
    '33 : validate_account_number\n' +
    '34 : version\n' +
    '35 : verified_accounts\n',
    'Cached commands:\n' +
    '\n' +
    'block_count : 30\n' +
    'available_supply : 3600\n' +
    'active_difficulty : 30\n' +
    'representatives_online : 300\n',
    'Limited commands:\n' +
    '\n' +
    'account_history : 500\n' +
    'accounts_frontiers : 500\n' +
    'accounts_balances : 500\n' +
    'accounts_pending : 50\n' +
    'chain : 500\n' +
    'frontiers : 500\n' +
    'pending : 500\n',
    'Slow down settings:\n' +
    '\n' +
    'time_window : 600000\n' +
    'request_limit : 400\n' +
    'delay_increment : 100\n' +
    'max_delay : 2000\n',
    'Rate limiter settings:\n\ntime_window : 86400000\nrequest_limit : 5000\n',
    'DDOS protection settings:\n\ntime_window : 10000\nrequest_limit : 100\n',
    'IPs blacklisted:\n\n0 : 8.8.8.8\n',
    'Use cors. Any ORIGIN allowed',
    'Main log level: info'
]

const settingsFilePath = 'settings.json';

beforeAll(() => copyConfigFiles([settingsFilePath]))

test('log proxy settings with default config from file', () => {
    let settings: string[] = []
    const readSettings = readProxySettings(getTestPath(settingsFilePath))
    proxyLogSettings((setting: string) => settings.push(setting), readSettings)
    expect(settings.length).toBe(30);
    expect(settings).toStrictEqual(expectedSettingsWithFile)
})

afterAll(() => deleteConfigFiles([settingsFilePath]))
