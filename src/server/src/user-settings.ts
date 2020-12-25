import {CachedCommands, Command, LimitedCommands, LogLevel} from "./common-settings";
import * as Fs from "fs";

export interface UserSettings {
    use_cache: boolean;
    use_output_limiter: boolean;
    allowed_commands: string[] | null;
    cached_commands: CachedCommands | null;
    limited_commands: LimitedCommands | null;
    log_level: LogLevel;
}

export type UserSettingsConfig = Map<string, UserSettings>

const EMPTY_USER_SETTINGS = new Map<string, UserSettings>()

export function readUserSettings(settingsPath: string): UserSettingsConfig {
    try {
        const userSettings: any = JSON.parse(Fs.readFileSync(settingsPath, 'utf-8'))
        const parsed: UserSettingsConfig = new Map(Object.entries(userSettings))
        parsed.forEach((v: UserSettings, k: string, m: Map<string, UserSettings>) => {
            v.cached_commands = v.cached_commands ? new Map(Object.entries(v.cached_commands)) : new Map<Command, number>()
            v.limited_commands = v.limited_commands ? new Map(Object.entries(v.limited_commands)) : new Map<Command, number>()
        })
        return parsed
    } catch (e) {
        console.log("Could not read user_settings.json, returns empty settings.", e)
        return EMPTY_USER_SETTINGS;
    }
}
