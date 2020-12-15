/** Contains the settings for the slow down filter */
interface SlowDownConfig {
    // rolling time window in ms
    time_window: number
    // allow x requests per time window, then start slowing down
    request_limit: number
    // begin adding X ms of delay per request when delayAfter has been reached
    delay_increment: number
    // max delay in ms to slow down
    max_delay: number
}
/** Contains the settings for the rate limiter */
interface RateLimiterConfig {
    // Limit each IP to x requests per duration
    request_limit: number
    // Rolling time window in sec
    time_window: number
}
/** Contains the settings for the ddos protection */
interface DDOSProtectionConfig {
    // Limit each IP to x requests per duration
    request_limit: number
    // Rolling time window in sec
    time_window: number
}
