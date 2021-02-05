import ProxySettings from "./proxy-settings";
import * as Fs from "fs";

interface UserKeyPair {
    user: string;
    key: string;
}

export interface PowSettings {
    dpow?: UserKeyPair
    bpow?: UserKeyPair
}

/** Reads proof-of-work settings from file */
export function readPowSettings(path: string, settings: ProxySettings): PowSettings {
    try {
        const readSettings: PowSettings = JSON.parse(Fs.readFileSync(path, 'utf-8'))
        return {
            dpow: settings.use_dpow ? readSettings.dpow : undefined,
            bpow: settings.use_bpow ? readSettings.bpow : undefined,
        }
    }
    catch(e) {
        console.log("Could not read pow_creds.json", e)
        return {
            dpow: undefined,
            bpow: undefined,
        }
    }
}
