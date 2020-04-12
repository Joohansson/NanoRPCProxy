import requests
import json
import argparse
from requests.auth import HTTPBasicAuth

# Make sure the proxy server is running and call this with <python3 client.py --c 1> where the number represent one of the commands below
# The example is for MAIN NET and will show bad results on BETA NET

commands = [
        {"action":"block_count"},
        {"action":"account_info","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"},
        {"action":"account_history", "account":"nano_3cpz7oh9qr5b7obbcb5867omqf8esix4sdd5w6mh8kkknamjgbnwrimxsaaf", "count":"20"},
        {"action":"active_difficulty"},
        {"action":"block_info","json_block":"true","hash":"87434F8041869A01C8F6F263B87972D7BA443A72E0A97D7A3FD0CCC2358FD6F9"},
        {"action":"pending","account":"nano_1111111111111111111111111111111111111111111111111117353trpda","count": "5"},
        {"action":"representatives_online"},
    ]

username = "user1"
password = "user1"

# Parse argument --c [int] to call different commands
parser = argparse.ArgumentParser(description="Call proxy server")
parser.add_argument("--c", default=1, type=int, choices=[1, 2, 3, 4, 5, 6, 7], required=True, help="The action to call")
parser.add_argument("--a", action="store_true", help="Use authorization")
args = parser.parse_args()
command = commands[int(args.c)-1]

try:
    # If using auth or not
    if args.a:
        print("Authorizing with " + username + " | " + password)
        r = requests.post('http://localhost:9950/proxy', json=command, verify=False, auth=HTTPBasicAuth(username, password))
    else:
        r = requests.post("http://localhost:9950/proxy", json=command)
    status = r.status_code
    print("Status code: ", status)
    if (status == 200):
        print("Success!")

    try:
        print(r.json())
    except:
        print(r)

    r.raise_for_status()

except requests.exceptions.HTTPError as errh:
    print ("Http Error:",errh)
except requests.exceptions.ConnectionError as errc:
    print ("Error Connecting:",errc)
except requests.exceptions.Timeout as errt:
    print ("Timeout Error:",errt)
except requests.exceptions.RequestException as err:
    print ("Oops: Something Else",err)
except Exception as e:
    print("Fatal error", e)
