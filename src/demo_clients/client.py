import requests
import json
import argparse

commands = [
        {"action":"block_count"},
        {"action":"account_info","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"},
        {"action":"account_history", "account":"nano_3cpz7oh9qr5b7obbcb5867omqf8esix4sdd5w6mh8kkknamjgbnwrimxsaaf", "count":"20"},
        {"action":"active_difficulty"},
        {"action":"block_info","json_block":"true","hash":"87434F8041869A01C8F6F263B87972D7BA443A72E0A97D7A3FD0CCC2358FD6F9"},
        {"action":"pending","account":"nano_1111111111111111111111111111111111111111111111111117353trpda","count": "5"},
        {"action":"representatives_online"},
    ]

# Parse argument --c [int] to call different commands
parser = argparse.ArgumentParser(description="Call proxy server")
parser.add_argument("--c", default=1, type=int, choices=[1, 2, 3, 4, 5, 6, 7], required=True, help="The action to call")
args = parser.parse_args()
command = commands[int(args.c)-1]

try:
    r = requests.post("http://localhost:9950/api/node", json=command)
    status = r.status_code
    print("Status code: ", status)
    if (status == 200):
        print("Success!")
    print(r.json())

    r.raise_for_status()

except requests.exceptions.HTTPError as errh:
    print ("Http Error:",errh)
except requests.exceptions.ConnectionError as errc:
    print ("Error Connecting:",errc)
except requests.exceptions.Timeout as errt:
    print ("Timeout Error:",errt)
except requests.exceptions.RequestException as err:
    print ("Oops: Something Else",err)
