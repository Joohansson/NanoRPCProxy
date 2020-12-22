import {CachedCommands, LimitedCommands, LogLevel} from "./common-settings";

export interface UserSettings {
    use_cache: boolean;
    use_output_limiter: boolean;
    allowed_commands: string[] | null;
    cached_commands: CachedCommands | null;
    limited_commands: LimitedCommands | null;
    log_level: LogLevel;
}

export type UserSettingsConfig = Map<string, UserSettings>
