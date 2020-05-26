import asyncio
import websockets
import json
import argparse

# Connect to this host
ws_host = 'ws://localhost:9952'

parser = argparse.ArgumentParser()
parser.add_argument('--a', nargs='+', dest='accounts', required=True, help="The accounts to track (space separated)")
args = parser.parse_args()

print ("Requesting to subscribe to accounts:\n", args.accounts)

def pretty(message):
    return json.dumps(message, indent=2)

async def main():
    # Predefined subscription message
    msg = {
        "action": "subscribe",
        "topic": "confirmation",
        "options": {
          "accounts": args.accounts
        }
    }
    try:
        async with websockets.connect(ws_host) as websocket:
            await websocket.send(json.dumps(msg))
            while 1:
                rec = json.loads(await websocket.recv())
                print(pretty(rec))
    except:
        print("Websocket connection error")
        # wait 5sec and reconnect
        await asyncio.sleep(5)
        await main()

try:
    asyncio.get_event_loop().run_until_complete(main())
except KeyboardInterrupt:
    pass
