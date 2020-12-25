import {CachedCommands, Command, LimitedCommands, LogLevel} from "./common-settings";
import * as Fs from "fs";
import ProxySettings from "./proxy-settings";

export interface UserSettings {
    use_cache: boolean;
    use_output_limiter: boolean;
    allowed_commands: string[];
    cached_commands: CachedCommands;
    limited_commands: LimitedCommands;
    log_level: LogLevel;
}

export type UserSettingsConfig = Map<string, UserSettings>

/** Clone default settings for custom user specific vars, to be used if no auth */
export function loadDefaultUserSettings(settings: ProxySettings): UserSettings {
    const defaultUserSettings: UserSettings = {
        allowed_commands: [],
        cached_commands: new Map<Command, number>(),
        limited_commands: new Map<Command, number>(),
        log_level: 'info',
        use_cache: false,
        use_output_limiter: false
    };
    if (!settings.use_auth) {
        return {
            use_cache: settings.use_cache,
            use_output_limiter: settings.use_output_limiter,
            allowed_commands: settings.allowed_commands,
            cached_commands: settings.cached_commands,
            limited_commands: settings.limited_commands,
            log_level: settings.log_level
        }
    } else {
        return defaultUserSettings
    }
}

/** Read user settings from file, override default settings if they exist for specific users */
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
        return new Map<string, UserSettings>();
    }
}
