const Nacl =       require('tweetnacl/nacl')
const Nano =       require('nanocurrency')
//import { wallet } from 'nanocurrency-web'
const Wallet =     require('nanocurrency-web')

module.exports = {
  // Generates and provides a payment address with seed backup
  requestTokenPayment: function () {
    let seed = genSecureKey().toUpperCase()
    let nanowallet = Wallet.wallet.generate(seed)
    let accounts = Wallet.wallet.accounts(nanowallet.seed, 0, 0)
    privKey = accounts[0].privateKey
    let pubKey = Nano.derivePublicKey(privKey)
    let address = Nano.deriveAddress(pubKey, {useNanoPrefix: true})
    return address
  },
  bar: function () {
    // whatever
  }
}

// Generate secure random 64 char hex
function genSecureKey() {
  const rand = Nacl.randomBytes(32)
  return rand.reduce((hex, idx) => hex + (`0${idx.toString(16)}`).slice(-2), '')
}
