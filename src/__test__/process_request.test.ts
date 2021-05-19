import {copyConfigFiles, deleteConfigFiles} from "./test-commons";

class MockResponse {
    statusCode: number | null = null
    jsonResponse: any | null = null

    status(statusCode: number): MockResponse {
        this.statusCode = statusCode
        return this;
    }
    json(json: any): MockResponse {
        this.jsonResponse = json
        return this;
    }
}

const filePaths = ['settings.json'];

beforeAll(() => {
    process.env.OVERRIDE_USE_HTTP = 'false'
    process.env.CONFIG_SETTINGS = 'src/__test__/settings.json'
    copyConfigFiles(filePaths)
})

test('processRequest should fail at unreachable node', async () => {
    const proxy = require('../proxy')

    let body = {
        action: 'block_info'
    }
    let request: any = {
        get: (name: string) => undefined
    }
    let mockResponse: MockResponse = new MockResponse()

    await proxy.processRequest(body, request, mockResponse)
    expect(mockResponse.statusCode).toBe(500)
    expect(mockResponse.jsonResponse.error).toContain('Error: Connection error: FetchError')
})

test('processRequest should fail on invalid command', async () => {
    const proxy = require('../proxy')

    let body = {
        action: 'not_supported_command'
    }
    let request: any = {}
    let mockResponse: MockResponse = new MockResponse()

    await proxy.processRequest(body, request, mockResponse)
    expect(mockResponse.statusCode).toBe(500)
    expect(mockResponse.jsonResponse).toStrictEqual({
        error: 'Action not_supported_command not allowed'
    })
})

afterAll(() => deleteConfigFiles(filePaths))
