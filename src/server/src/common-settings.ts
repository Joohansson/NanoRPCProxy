export type LOG_LEVEL = 'none' | 'warning' | 'info'

interface LogLevels {
    none: LOG_LEVEL
    info: LOG_LEVEL
    warning: LOG_LEVEL
}
export const log_levels: LogLevels = {
    none: 'none',
    info: 'info',
    warning: 'warning'
}


export interface LimitedCommands {
    account_history: number;
    chain: number;
    frontiers: number;
    pending: number;
}

export interface CachedCommands {
    block_count: number;
    available_supply: number;
    active_difficulty: number;
    representatives_online: number;
}
