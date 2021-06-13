import {readUserSettings} from "../user-settings";
import {copyConfigFiles, deleteConfigFiles} from "./test-commons";

const filePaths = ['user_settings.json'];

beforeAll(() => {
    copyConfigFiles(filePaths)
})

test('parseUserSettings should parse to Map', async () => {
    const settings = readUserSettings('src/__test__/user_settings.json')
    expect(Object.entries(settings).length).toBe(2)
    const userSettings = settings['user2']
    expect(userSettings).toBeDefined()
    expect(userSettings.allowed_commands.length).toBe(4)
    expect(Object.entries(userSettings.cached_commands).length).toBe(1)
    expect(Object.entries(userSettings.limited_commands).length).toBe(7)
})

afterAll(() => deleteConfigFiles(filePaths))
