import fs from "fs";
import {readUserSettings} from "../user-settings";

const filePath = 'user_settings.json';

beforeAll(() => {
    fs.copyFileSync(`${filePath}.default`, filePath, )
})

test('parseUserSettings should parse to Map', async () => {

    const settings = readUserSettings(filePath)
    expect(Array.from(settings.values()).length).toBe(2)
    const userSettings = settings.get('user2')
    expect(userSettings).toBeDefined()
    // @ts-ignore
    expect(userSettings.allowed_commands.length).toBe(4)
    // @ts-ignore
    expect(Array.from(userSettings.cached_commands.values()).length).toBe(1)
    // @ts-ignore
    expect(Array.from(userSettings.limited_commands.values()).length).toBe(4)
})

afterAll(() => {
    fs.unlinkSync(filePath)
})
