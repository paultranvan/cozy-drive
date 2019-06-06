import { generateKey, encryptData } from './encryption'

//const crypto = require('crypto')
const crypto = require('@trust/webcrypto')

/*const open = jest.fn()
Object.defineProperty(window, 'open', open)
*/
const message = 'this is a top secret message'

describe('encryption', () => {
  it('Should encrypt data', async () => {
    console.log('')
    console.debug('crypto : ', window.crypto)
    console.debug('self : ', global.self.crypto)

    window.crypto = crypto
    console.debug('crypto : ', window.crypto)
    console.debug('crypto obj : ', crypto.Crypto)
    //  window.crypto.generateKey = jest.fn()

    const key = await generateKey()
    console.debug('key gen  : ', key)
    expect(window.crypto.generateKey).toHaveBeenCalled()
    /*const enc = new TextEncoder()
    const data = enc.encode(message)
    const encData = await encryptData(data, key)
    console.debug('enc data : ', encData)*/
  })
})
