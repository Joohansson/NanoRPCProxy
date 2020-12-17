import lowdb from "lowdb";

export interface Order {
    address: string;
    token_key: string;
    priv_key: string;
    tokens: number;
    order_waiting: boolean;
    nano_amount: number;
    token_amount: number;
    order_time_left: number;
    processing: boolean;
    timestamp: number;
    previous: any;
    hashes: any[]
}
export interface OrderSchema {
    orders: Order[]
}

export type OrderDB = lowdb.LowdbSync<OrderSchema>

export interface TrackedAccount {
    timestamp: number
}

export interface User {
    ip: string
    tracked_accounts: Map<string, TrackedAccount>
}

export interface UserSchema {
    users: User[]
}
export type UserDB = lowdb.LowdbSync<UserSchema>
