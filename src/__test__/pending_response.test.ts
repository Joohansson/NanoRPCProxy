const expectedResponse = `
    {
      "blocks" : {
        "000D1BAEC8EC208142C99059B393051BAC8380F9B5A2E6B2489A277D81789F3F": {
          "amount": "6000000000000000000000000000000",
          "source": "nano_3dcfozsmekr1tr9skf1oa5wbgmxt81qepfdnt7zicq5x3hk65fg4fqj58mbr"
        }
      }
    }
`

test('pending response should deserialize to Record', async () => {
    const pending: PendingResponse = JSON.parse(expectedResponse)
    const pendingBlock = pending.blocks['000D1BAEC8EC208142C99059B393051BAC8380F9B5A2E6B2489A277D81789F3F']
    expect(pendingBlock.amount).toStrictEqual('6000000000000000000000000000000')
    expect(pendingBlock.source).toStrictEqual('nano_3dcfozsmekr1tr9skf1oa5wbgmxt81qepfdnt7zicq5x3hk65fg4fqj58mbr')
})
