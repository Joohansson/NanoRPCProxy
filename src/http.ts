import ProxySettings from "./proxy-settings";
import * as Fs from "fs";
import * as http from "http";
import * as https from "https";

const listeningListener = (type: string, port: number) => () => {
    console.log(`${type} started on port: ${port}`)
}

export function createHttpServer(requestListener: http.RequestListener, httpPort: number, type: string = "Http"): http.Server {
    return http.createServer(requestListener).listen(httpPort, listeningListener(type, httpPort))
}

export function readHttpsOptions(settings: ProxySettings): https.ServerOptions | undefined {
    try {
        return {
            cert: Fs.readFileSync(settings.https_cert),
            key: Fs.readFileSync(settings.https_key)
        }
    } catch(err) {
        console.error("Problem reading https cert/key file. Will not be able to create HTTPS server.")
        console.error(err)
        return undefined
    }
}

export function createHttpsServer(requestListener: http.RequestListener, httpsPort: number, httpOptions: https.ServerOptions, type: string = "Https"): https.Server {
    return https.createServer(httpOptions, requestListener).listen(httpsPort, listeningListener(type, httpsPort))
}

export function websocketListener(request: http.IncomingMessage, response: http.ServerResponse): void {
    response.writeHead(404)
    response.end()
}
