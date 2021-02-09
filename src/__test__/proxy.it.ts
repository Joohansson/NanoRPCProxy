import request from 'supertest'
import {copyConfigFiles, deleteConfigFiles} from "./test-commons";
import * as Fs from "fs";

const settingsFilePath = 'settings.json';
const configSettings = 'src/__test__/settings.json';

beforeAll(() => {
    process.env.OVERRIDE_USE_HTTP = 'false'
    process.env.CONFIG_SETTINGS = configSettings
    copyConfigFiles([settingsFilePath])
    let settings = JSON.parse(Fs.readFileSync(configSettings, 'utf-8'))
    settings.enable_prometheus_for_ips = ['0.0.0.0/0']
    Fs.writeFileSync(configSettings, JSON.stringify(settings), 'utf-8')
})

describe('root request', () => {
    it("GET / - success", async () => {
        const app = require('../proxy').app
        const res = await request(app).get("/")
        expect(res.text).toStrictEqual('<html lang="en"><head><title>RPCProxy API</title></head><body><h4>Bad API path</h4><p></p></body></html>')
    })
})

describe('/proxy with default config responds to GET/POST requests', () => {
    it("GET /proxy - success", async () => {
        const app = require('../proxy').app
        const res = await request(app).get("/proxy?action=account_history");
        expect(res.status).toStrictEqual(500)
        expect(res.text).toStrictEqual(`{"error":"Error: Connection error: FetchError: request to http://[::1]:7076/ failed, reason: connect ECONNREFUSED ::1:7076"}`)
    })
    it("POST /proxy - success", async () => {
        const app = require('../proxy').app
        const res = await request(app).post("/proxy").send({action: 'account_history'});
        expect(res.status).toStrictEqual(500)
        expect(res.text).toStrictEqual(`{"error":"Error: Connection error: FetchError: request to http://[::1]:7076/ failed, reason: connect ECONNREFUSED ::1:7076"}`)
    })
})

describe('/prometheus', () => {
    it("GET /prometheus - success", async () => {
        const app = require('../proxy').app
        const res = await request(app).get("/prometheus");
        expect(res.text.split('\n').length).toBeGreaterThan(100)
        expect(res.status).toStrictEqual(200)
    })
})

afterAll(() => deleteConfigFiles([settingsFilePath]))

