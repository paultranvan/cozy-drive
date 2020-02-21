import { encode as encodeArrayBuffer } from 'base64-arraybuffer'
import uuidv1 from 'uuid/v1'

export const DERIVED_PASSPHRASE_KEY_ID = 'io.cozy.derivedkey.passphrase'

// Encode a string into ArrayBuffer
export const encodeData = data => {
  var encoder = new TextEncoder('utf-8')
  return encoder.encode(data)
}

export const exportKey = async (format, key) => {
  return self.crypto.subtle.exportKey(format, key)
}

export const importKey = async (
  format,
  keyJWK,
  { algorithm, length, keyUsages } = {}
) => {
  return self.crypto.subtle.importKey(
    format,
    keyJWK,
    { name: algorithm || 'AES-GCM', length: length || 256 },
    true,
    keyUsages || ['encrypt', 'decrypt']
  )
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
      ? await self.crypto.subtle.exportKey('raw', data)
      : encodeData(data)
  return self.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: algorithm },
    false, //whether the key is extractable
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
  return self.crypto.subtle.deriveKey(
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
 *  Unwrap the given key with the wrappingKey.

 *  Other parameters tell WebCrypto the kind of CryptoKey we expect as output:
 *    - a key dedicated to a given cypher-mode (default is AES-GCM)
 *    - a key that will accept to be wrapped and unwrapped
 *    - a key that will be used for encryption and decryption purpose
 *
 * @param {ArrayBuffer} wrappedKey  The encrypted key
 * @param {CryptoKey} wrappingKey   The key used to wrap the wrapped key
 * @param {object} params           Additional parameters
 * @param {string} algorithm        The key algorithm. Default is "AES-GCM"
 * @param {number} length           The key length. Default is 256
 * @param {Array}  keyUsages        An array of key usages
 * @returns {CryptoKey}             The unwrapped key
 */
export const unwrapAESKey = async (
  wrappedKey,
  wrappingKey,
  { algorithm, length, keyUsages } = {}
) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/unwrapKey
  return self.crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    wrappingKey,
    'AES-KW',
    { name: algorithm || 'AES-GCM', length: length || 256 },
    true,
    keyUsages || ['encrypt', 'decrypt']
  )
}

/**
 * Wrap the given key with the wrappingKey in a JWK-like format.
 * @param {CryptoKey} key           The key to wrap
 * @param {CryptoKey} wrappingKey   The wrapping key used to encrypt the key. It must have the 'wrapKey' property
 * @param {string} wrappingKeyId    The id of the wrapping key, used to retrieve it for unwrapping
 * @param {object} params           Additional parameters
 * @param {string} iv               The initialization vector of the key
 * @returns {Object}             The wrapped key
 */
export const wrapAESKey = async (
  key,
  wrappingKey,
  wrappingKeyId,
  { iv } = {}
) => {
  const keyJwk = await self.crypto.subtle.exportKey('jwk', key)
  const wrappingKeyJwk = await self.crypto.subtle.exportKey('jwk', wrappingKey)
  // Generate a random key id, based on the current timestamp
  const kid = uuidv1()

  // Encrypt the key with AES Key Wrapping
  const encryptedKey = await self.crypto.subtle.wrapKey(
    'raw',
    key,
    wrappingKey,
    {
      name: 'AES-KW'
    }
  )
  const encodedEncryptedKey = encodeArrayBuffer(encryptedKey)

  // For more details on these fields, see https://tools.ietf.org/html/rfc7517
  const saveKey = {
    kid: kid, // The key id
    alg: keyJwk.alg, // The key algorithm
    kty: keyJwk.kty, // The key type
    ext: keyJwk.ext, // If the key is extractable or not
    key_ops: keyJwk.key_ops, // The operations allowed for this key
    encrypted_key: encodedEncryptedKey, // The encrypted key
    iv // The optional initialization vector
  }
  const saveWrap = {
    kid: wrappingKeyId,
    alg: wrappingKeyJwk.alg
  }
  return { wrappingKey: saveWrap, key: saveKey }
}

/**
 * Generate an AES key. Default are for AES256-GCM keys, meant to encrypt/decrypt.
 *
 * @param {string} algorithm      The key algorithm
 * @param {number} keyLength      The key length
 * @param {Array}  keyUsages      An array of key usages
 */
export const generateAESKey = async ({
  algorithm,
  keyLength,
  keyUsages
} = {}) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
  return self.crypto.subtle.generateKey(
    {
      name: algorithm || 'AES-GCM',
      length: keyLength || 256
    },
    true, //whether the key is extractable (i.e. can be used in exportKey)
    keyUsages || ['encrypt', 'decrypt']
  )
}
