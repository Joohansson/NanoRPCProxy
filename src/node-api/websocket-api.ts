type WSTopic = 'confirmation'
type WSAction = 'subscribe' | 'update' | 'unsubscribe' | 'ping' | 'pong'

interface WSNodeSubscribe {
    action: WSAction
    topic: WSTopic
    ack: boolean
    id: string
    options: {
        all_local_accounts: boolean
        accounts: string[]
    }
}

interface WSNodeSubscribeAll {
    action: WSAction
    topic: WSTopic
    ack: boolean
    id: string
}

interface WSNodeReceive {
    topic: WSTopic
    message: {
        account: string
        block: {
            link_as_account: string
        }
    }
    ack: WSAction
    id: string
}

interface WSMessage {
    topic: WSTopic
    action: WSAction
    options: {
        accounts: string[]
    }
    id: string
}

interface WSError {
    error: string
}

interface WSSubscribe {
    ack: WSAction
    id: string
}

interface WSPong {
    ack: WSAction
    time: string
    id: string
}
