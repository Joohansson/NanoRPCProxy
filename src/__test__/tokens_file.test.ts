import {copyConfigFiles, deleteConfigFiles} from "./test-commons";
import {readTokenSettings, tokenLogSettings} from "../token-settings";

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

const filePaths = ['token_settings.json'];

beforeAll(() => {
    process.env.CONFIG_TOKEN_SETTINGS = 'src/__test__/token_settings.json'
    copyConfigFiles(filePaths)
})

test('log tokens settings with default config from file', () => {
    let settings: string[] = []
    const readSettings = readTokenSettings(filePaths[0])
    tokenLogSettings((setting: string) => settings.push(setting), readSettings)
    expect(settings.length).toBe(11);
    expect(settings).toStrictEqual(expectedDefaultSettings)
});

afterAll(() => deleteConfigFiles(filePaths))
