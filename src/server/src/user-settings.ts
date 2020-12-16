import {CachedCommands, LimitedCommands} from "./common-settings";

export interface UserSettings {
    use_cache: boolean;
    use_output_limiter: boolean;
    allowed_commands: string[] | undefined;
    cached_commands: CachedCommands[] | undefined;
    limited_commands: LimitedCommands[] | undefined;
    log_level: string;
}

export type UserSettingsConfig = Map<string, UserSettings>
