import {bigAdd, MnanoToRaw, multiplierFromDifficulty, rawToMnano} from "../tools";


describe('rawToMnano', () => {
    test('given raw converts to mnano', () => {
        expect(rawToMnano('1')).toStrictEqual('0.000000000000000000000000000001')
    })
    test('given string should handle gracefully', () => {
        expect(rawToMnano('adsf')).toStrictEqual('N/A')
    })
})

describe('MnanoToRaw', () => {
    test('given mnano converts to raw', () => {
        expect(MnanoToRaw('0.1')).toStrictEqual('100000000000000000000000000000')
    })
    test('given string should handle gracefully', () => {
        expect(rawToMnano('adsf')).toStrictEqual('N/A')
    })
})

describe('bigAdd', () => {
    test('add two large numbers', () => {
        expect(bigAdd('100000000000000000000000', '100000000000000000000000')).toStrictEqual('200000000000000000000000')
    })
})

describe('multiplierFromDifficulty', () => {
    test('calculates multiplier given base and difficulty', () => {
        expect(multiplierFromDifficulty('fffffff800000000', 'fffffe0000000000')).toStrictEqual('64.00000000000000000000000000000000')
    })
})
