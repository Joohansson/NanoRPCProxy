import Fetch, {Response} from 'node-fetch'
import BigInt from 'big-integer'
import * as Nano from 'nanocurrency'
const Dec = require('bigdecimal') //https://github.com/iriscouch/bigdecimal.js

// Custom error class
class APIError extends Error {

  private code: any

  constructor(code: string, ...params: any[]) {
    super(...params)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError)
    }
    this.name = 'APIError'
    // Custom debugging information
    this.code = code
  }
}

// Get data from URL. let data = await getData("url", TIMEOUT)
export async function getData<data>(server: string, timeout: number): Promise<data> {
  let options: any = {
    method: 'get',
    timeout: timeout,
  }

  let promise = new Promise(async (resolve: (value: data) => void, reject) => {
    // https://www.npmjs.com/package/node-fetch
    Fetch(server, options)
        .then(checkStatus)
        .then(res => res.json())
        .then(json => resolve(json))
        .catch(err => reject(new Error('Connection error: ' + err)))
  })
  return await promise // return promise result when finished instead of returning the promise itself, to avoid nested ".then"
}

// Post data, for example to RPC node. let data = await postData({"action":"block_count"}, "url", TIMEOUT)
export  async function postData<ResponseData>(data: any, server: string, timeout: number): Promise<ResponseData> {
  let options: any = {
    method: 'post',
    body:    JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
    timeout: timeout,
  }

  let promise = new Promise(async (resolve: (value: ResponseData) => void, reject) => {
    // https://www.npmjs.com/package/node-fetch
    Fetch(server, options)
        .then(checkStatus)
        .then(res => res.json())
        .then(json => resolve(json))
        .catch(err => reject(new Error('Connection error: ' + err)))
  })
  return await promise // return promise result when finished instead of returning the promise itself, to avoid nested ".then"
}
// Check if a string is a valid JSON
export function isValidJson(obj: any) {
  if (obj != null) {
    try {
        JSON.parse(JSON.stringify(obj))
        return true
    } catch (e) {
      return false
    }
  }
  else  {
    return false
  }
}
// Add two big integers
export function bigAdd(input: string, value: string): string {
  let insert = BigInt(input)
  let val = BigInt(value)
  return insert.add(val).toString()
}
export function rawToMnano(input: string) {
  return isNumeric(input) ? Nano.convert(input, {from: Nano.Unit.raw, to: Nano.Unit.NANO}) : 'N/A'
}
export function MnanoToRaw(input: string) {
  return isNumeric(input) ? Nano.convert(input, {from: Nano.Unit.NANO, to: Nano.Unit.raw}) : 'N/A'
}
// Validate nano address, both format and checksum
export function validateAddress(address: string) {
  return Nano.checkAddress(address)
}

function checkStatus(res: Response) {
    if (res.ok) { // res.status >= 200 && res.status < 300
        return res
    } else {
        throw new APIError(res.statusText)
    }
}

// Check if numeric string
function isNumeric(val: string): boolean {
  //numerics and last character is not a dot and number of dots is 0 or 1
  let isnum = /^-?\d*\.?\d*$/.test(val)
  if (isnum && String(val).slice(-1) !== '.') {
    return true
  }
  else {
    return false
  }
}

// Determine new multiplier from base difficulty (hexadecimal string) and target difficulty (hexadecimal string). Returns float
export function multiplierFromDifficulty(difficulty: string, base_difficulty: string): string {
  let big64 = Dec.BigDecimal(2).pow(64)
  let big_diff = Dec.BigDecimal(Dec.BigInteger(difficulty,16))
  let big_base = Dec.BigDecimal(Dec.BigInteger(base_difficulty,16))
  let mode = Dec.RoundingMode.HALF_DOWN()
  return big64.subtract(big_base).divide(big64.subtract(big_diff),32,mode).toPlainString()
}
