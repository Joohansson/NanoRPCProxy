import fs from "fs";
import {readUserSettings} from "../user-settings";

const filePath = 'user_settings.json';

beforeAll(() => {
    fs.copyFileSync(`${filePath}.default`, filePath, )
})

test('parseUserSettings should parse to Map', async () => {

    const settings = readUserSettings(filePath)
    expect(Object.entries(settings).length).toBe(2)
    const userSettings = settings['user2']
    expect(userSettings).toBeDefined()
    expect(userSettings.allowed_commands.length).toBe(4)
    expect(Object.entries(userSettings.cached_commands).length).toBe(1)
    expect(Object.entries(userSettings.limited_commands).length).toBe(4)
})

afterAll(() => {
    fs.unlinkSync(filePath)
})
