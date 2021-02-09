from flask import Flask, render_template, flash, request
from wtforms import Form
import json
import requests
from requests.auth import HTTPBasicAuth

# App config.
DEBUG = False
app = Flask(__name__)
app.config.from_object(__name__)
app.config['SECRET_KEY'] = 'F8756EC47915E4D5CD7700517E22FF2DFE90C1F787EEE42FE07305551DB56AEE'

commands = [
        '{"action":"block_count"}',
        '{"action":"account_info","account":"nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3"}',
        '{"action":"account_history","account":"nano_3cpz7oh9qr5b7obbcb5867omqf8esix4sdd5w6mh8kkknamjgbnwrimxsaaf","count":"20"}',
        '{"action":"active_difficulty"}',
        '{"action":"block_info","json_block":"true","hash":"87434F8041869A01C8F6F263B87972D7BA443A72E0A97D7A3FD0CCC2358FD6F9"}',
        '{"action":"pending","account":"nano_1111111111111111111111111111111111111111111111111117353trpda","count":"5"}',
        '{"action":"representatives_online"}',
        '{"action":"price"}',
        '{"action":"tokens_buy","token_amount":10}',
        '{"action":"tokens_buy","token_amount":10,"token_key":"xxx"}',
        '{"action":"tokenorder_check","token_key":"xxx"}',
        '{"action":"tokens_check","token_key":"xxx"}',
        '{"action":"tokenorder_cancel","token_key":"xxx"}',
    ]

username = "user1"
password = "user1"
proxy_server = "http://localhost:9950/proxy"

# Use html form to collect input data
class ReusableForm(Form):
    @app.route("/", methods=['GET', 'POST'])
    def GetCommand():
        form = ReusableForm(request.form)
        active_command = ''
        result_formatted = ''

        if request.method == 'POST':
            action = request.form['action']
            try:
                # If any input command button with a number
                action_number = int(action)
                active_command = commands[action_number]
            except ValueError:
                # Proxy request submit button
                active_command = action
                result = getRPC(active_command)
                # Be able to print both json and error messages
                try:
                    result_formatted = json.dumps(result, indent=2)
                except:
                    result_formatted = result

        # Render the html template
        return render_template('index.html', form=form, active_command=active_command, result=result_formatted)

# Call the proxy server
def getRPC(command):
    try:
        r = requests.post(proxy_server, json=json.loads(command), verify=False, auth=HTTPBasicAuth(username, password))
        status = r.status_code
        #print("Status code: ", status)
        if (status == 200):
            print("Success!")
        try:
            #print(r.json())
            return(r.json())
        except:
            print(r)
            return r
    except Exception as e:
        print("Fatal error", e)
        return "Fatal error", e

if __name__ == "__main__":
    app.run()
