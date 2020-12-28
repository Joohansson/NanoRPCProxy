export type LogLevel = 'none' | 'warning' | 'info'

interface LogLevels {
    none: LogLevel
    info: LogLevel
    warning: LogLevel
}
export const log_levels: LogLevels = {
    none: 'none',
    info: 'info',
    warning: 'warning'
}

export type Command = string
export type LimitedCommands = Record<Command, number>
export type CachedCommands = Record<Command, number>

export interface LogData {
    date: string;
    count: number;
}

type ConfigPath = string
export interface ConfigPaths {
    request_stat: ConfigPath
    token_settings: ConfigPath
    creds: ConfigPath
    pow_creds: ConfigPath
    settings: ConfigPath
    user_settings: ConfigPath
}

export function readConfigPathsFromENV(): ConfigPaths {
    return {
        creds: process.env.CONFIG_CREDS_SETTINGS || 'creds.json',
        pow_creds: process.env.CONFIG_POW_CREDS_SETTINGS || 'pow_creds.json',
        request_stat: process.env.CONFIG_REQUEST_STAT || 'request-stat.json',
        settings: process.env.CONFIG_SETTINGS || 'settings.json',
        token_settings: process.env.CONFIG_TOKEN_SETTINGS || 'token_settings.json',
        user_settings: process.env.CONFIG_USER_SETTINGS || 'user_settings.json'
    }
}
