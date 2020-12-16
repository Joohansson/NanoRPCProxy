const fs = require('fs');

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
    'Disabled watch_work for process: false',
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
    '16 : block_count_type\n' +
    '17 : blocks_info\n' +
    '18 : chain\n' +
    '19 : confirmation_quorum\n' +
    '20 : delegators\n' +
    '21 : delegators_count\n' +
    '22 : frontiers\n' +
    '23 : key_create\n' +
    '24 : pending\n' +
    '25 : pending_exists\n' +
    '26 : process\n' +
    '27 : representatives\n' +
    '28 : representatives_online\n' +
    '29 : sign\n' +
    '30 : successors\n' +
    '31 : price\n' +
    '32 : mnano_to_raw\n' +
    '33 : mnano_from_raw\n' +
    '34 : work_validate\n' +
    '35 : validate_account_number\n' +
    '36 : version\n',
    'Cached commands:\n' +
    '\n' +
    'block_count : 30\n' +
    'available_supply : 3600\n' +
    'active_difficulty : 30\n' +
    'representatives_online : 300\n',
    'Limited commands:\n' +
    '\n' +
    'account_history : 500\n' +
    'chain : 500\n' +
    'frontiers : 500\n' +
    'pending : 500\n',
    'Slow down settings:\n' +
    '\n' +
    'time_window : 600000\n' +
    'request_limit : 100\n' +
    'delay_increment : 200\n' +
    'max_delay : 5000\n',
    'Rate limiter settings:\n\ntime_window : 86400000\nrequest_limit : 1000\n',
    'DDOS protection settings:\n\ntime_window : 1000\nrequest_limit : 2\n',
    'IPs blacklisted:\n\n0 : 8.8.8.8\n',
    'Use cors. Any ORIGIN allowed',
    'Main log level: info'
]

const settingsPath = 'settings.json';

test('log proxy settings with default config from file', () => {
    let settings = []
    fs.copyFileSync('settings.json.default', settingsPath, )
    process.env.OVERRIDE_USE_HTTP = 'false'
    require('../proxy').logSettings((setting) => settings.push(setting))
    expect(settings.length).toBe(28);
    expect(settings).toStrictEqual(expectedSettingsWithFile)
    fs.unlinkSync(settingsPath)
})
