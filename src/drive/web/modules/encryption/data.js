/* global cozy */
import { decode as decodeArrayBuffer } from 'base64-arraybuffer'
import { unwrapAESKey } from './keys'

/**
  Encrypt data with the given key

  * @param {CryptoKey} key      The encryption key
  * @param {ArrayBuffer} data   The data to encrypt
  * @param {object} params           Additional parameters
  * @param {string} algorithm        The key algorithm. Default is "AES-GCM"
  * @returns {object}

*/
export const encryptData = async (key, data, { algorithm } = {}) => {
  const name = algorithm || 'AES-GCM'
  // The NIST recommands 96 bits iv for AES-GCM: https://web.cs.ucdavis.edu/~rogaway/ocb/gcm.pdf
  const iv =
    name === 'AES-GCM' ? self.crypto.getRandomValues(new Uint8Array(16)) : null
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
  const cipher = await crypto.subtle.encrypt({ name, iv }, key, data)
  return { cipher, iv }
}

export const decryptData = async (key, data, { algorithm, iv } = {}) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt
  return self.crypto.subtle.decrypt(
    {
      name: algorithm || 'AES-GCM',
      iv: iv
    },
    key,
    data
  )
}

export const createDecryptedFileURL = async (vaultKey, file) => {
  // Prepare key + binary decryption
  const encryption = file.metadata.encryption
  const wrappedKey = decodeArrayBuffer(encryption.key.encrypted_key)
  const key = await unwrapAESKey(wrappedKey, vaultKey)
  const iv = decodeArrayBuffer(encryption.key.iv)

  // Now fetch data
  const resp = await cozy.client.files.downloadById(file.id || file._id)
  const encBuff = await resp.arrayBuffer()
  const data = await decryptData(key, encBuff, { iv })
  return URL.createObjectURL(new Blob([data], { type: file.type }))
}
