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
export type LimitedCommands = Map<Command, number>
export type CachedCommands = Map<Command, number>

export interface LogData {
    date: string;
    count: number;
}
