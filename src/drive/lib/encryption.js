// Encode a string into ArrayBuffer
export const encodeData = data => {
  var encoder = new TextEncoder('utf-8')
  return encoder.encode(data)
}

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
    true,
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
      name: algorithm || 'AES-GCM',
      length: keyLength || 256
    },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
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
 * Way of safe exporting a key by:
 *   1) encrypting it with the vaultKey using the AES-KW cypher mode
 *   2) exporting the result in a standardized format (JWK)
 *
 * @param {CryptoKey} key       The key to export
 * @param {CryptoKey} vaultKey  The key used to encrypt the exported key. It must have the wrapKey property.
 * @returns {ArrayBuffer}         The derived key
 */
export const exportKey = async (key, vaultKey) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/wrapKey
  return window.crypto.subtle.wrapKey('jwk', key, vaultKey, { name: 'AES-KW' })
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

export const generateAESKey = async ({ algorithm, keyLength } = {}) => {
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
