import request from 'supertest'
import {copyConfigFiles, deleteConfigFiles} from "./test-commons";

const settingsFilePath = 'settings.json';

beforeAll(() => {
    process.env.OVERRIDE_USE_HTTP = 'false'
    process.env.CONFIG_SETTINGS = 'src/__test__/settings.json'
    copyConfigFiles([settingsFilePath])
})

describe('/proxy with default config responds to GET/POST requests', () => {
    it("GET / - success", async () => {
        const app = require('../proxy').app
        const res = await request(app).get("/")
        expect(res.text).toStrictEqual('<html><head><title>RPCProxy API</title></head><body><h4>Bad API path</h4><p></p></body></html>')
    })
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

afterAll(() => deleteConfigFiles([settingsFilePath]))

