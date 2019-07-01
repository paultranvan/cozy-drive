import { encode } from 'base64-arraybuffer'

// Encode a string into ArrayBuffer
export const encodeData = data => {
  var encoder = new TextEncoder('utf-8')
  return encoder.encode(data)
}

// TODO: remove this in the future (use wrapKey)
export const exportKeyJwk = async key => {
  return window.crypto.subtle.exportKey('jwk', key)
}

/**
 * Build a CryptoKey from an input data
 *
 * @param {string} data      The base material to derive
 * @param {object} params    Additional parameters
 * @param {string} algorithm The derivation algorithm. Default is PBKDF2
 * @returns {CryptoKey}      The derived key
 */
const makeDerivableKey = async (data, { algorithm = 'PBKDF2' } = {}) => {
  const keyData =
    data instanceof CryptoKey
      ? await window.crypto.subtle.exportKey('raw', data)
      : encodeData(data)
  return window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: algorithm },
    true, //whether the key is extractable
    ['deriveKey']
  )
}

const slowHashing = async (
  baseKey,
  saltBuffer,
  { keyDerivationAlgorithm, iterations, hash } = {},
  { algorithm, keyLength } = {}
) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey
  return window.crypto.subtle.deriveKey(
    {
      name: keyDerivationAlgorithm || 'PBKDF2',
      salt: saltBuffer,
      iterations: iterations || 100000,
      hash: hash || 'SHA-256'
    },
    baseKey,
    {
      name: algorithm || 'AES-KW',
      length: keyLength || 256
    },
    true, //whether the key is extractable
    ['wrapKey', 'unwrapKey']
  )
}

/**
 * Derive an encryption key from a given password
 *
 * @param {string} password  The user password
 * @param {string} salt      A random salt
 * @returns {CryptoKey}      The derived key
 */
export const deriveKey = async (password, salt) => {
  const passwordAsKey = await makeDerivableKey(password)
  const saltBuffer = encodeData(salt)
  const passwordBuffer = encodeData(password)

  // Chain 2 key derivations : first, derive a key from a password
  const preKey = await slowHashing(passwordAsKey, saltBuffer, {
    iterations: 100000
  })
  const key = await makeDerivableKey(preKey)
  return slowHashing(key, passwordBuffer, { iterations: 1 })
}

/**
 *  Way of reading a previously exported/wrapped key. Since the export should
 *  have been done in a secure manner, the wrappedKey contains an encrypted
 *  version of the real key. Providing vaultKey allows to decypher it.
 *  Other parameters tell WebCrypto the kind of CryptoKey we expect as output:
 *    - a key dedicated to a given cypher-mode (default is AES-GCM)
 *    - a key that will accept to be wrapped and unwrapped
 *    - a key that will be used for encryption and decryption purpose
 *
 * @param {ArrayBuffer} wrappedKey  The key to import
 * @param {CryptoKey} vaultKey      The key used to encrypt the imported key. It must have the unwrapKey property.
 * @param {object} params           Additional parameters
 * @param {string} algorithm        The key algorithm. Default is "AES-GCM"
 * @param {number} length           The key length. Default is 256
 * @returns {CryptoKey}             The derived key
 */
export const importKey = async (
  wrappedKey,
  vaultKey,
  { algorithm, length } = {}
) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/unwrapKey
  return window.crypto.subtle.unwrapKey(
    'jwk',
    wrappedKey,
    vaultKey,
    'AES-KW',
    { name: algorithm || 'AES-GCM', length: length || 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  )
}

/**
 * Wrap the given key with the wrappingKey in a JWE-like format.
 * @param {CryptoKey} key  The key to wrap
 * @param {CryptoKey} wrappingKey      The wrapping key used to encrypt the key. It must have the 'wrapKey' property
 * @param {string} wrappingKeyId      The id of the wrapping key, used to retrieve it for unwrapping
 * @param {object} params           Additional parameters
 * @param {string} iv        The initialization vector of the key

 * https://tools.ietf.org/html/rfc7516
 */
export const wrapAESKey = async (
  key,
  wrappingKey,
  wrappingKeyId,
  { iv } = {}
) => {
  const keyJwk = await window.crypto.subtle.exportKey('jwk', key)
  const wrappingKeyJwk = await window.crypto.subtle.exportKey('jwk', key)
  const encryptedKey = encode(
    await window.crypto.subtle.wrapKey('raw', key, wrappingKey, {
      name: 'AES-KW'
    })
  )
  // "alg"" is the algorithm used to encrypt the key
  // "enc" is the algorithm of the encrypted key
  // "kid" is the id of the wrapping key
  const header = {
    alg: wrappingKeyJwk.alg,
    enc: keyJwk.alg,
    kid: wrappingKeyId
  }
  return { header, encrypted_key: encryptedKey, iv: iv }
}

// TODO: all keys are not meant to wrap/unwrap or encrypt/decrypt
export const generateAESFileKey = async ({ algorithm, keyLength } = {}) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
  return window.crypto.subtle.generateKey(
    {
      name: algorithm || 'AES-GCM',
      length: keyLength || 256
    },
    true, //whether the key is extractable (i.e. can be used in exportKey)
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  )
}

export const generateAESVaultKey = async () => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey

  return window.crypto.subtle.generateKey(
    {
      name: 'AES-KW',
      length: 256
    },
    true, //whether the key is extractable (i.e. can be used in exportKey)
    ['wrapKey', 'unwrapKey']
  )
}

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
    name === 'AES-GCM'
      ? window.crypto.getRandomValues(new Uint8Array(16))
      : null
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
  const cipher = await crypto.subtle.encrypt({ name, iv }, key, data)
  return { cipher, iv }
}

export const decryptData = async (key, data, { algorithm, iv } = {}) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt
  return window.crypto.subtle.decrypt(
    {
      name: algorithm || 'AES-GCM',
      iv: iv
    },
    key,
    data
  )
}
