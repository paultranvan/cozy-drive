const stringToArrayBuffer = string => {
  var encoder = new TextEncoder('utf-8')
  return encoder.encode(string)
}

const asDerivableKey = async (
  baseMaterial,
  keyDerivationAlgorithm = 'PBKDF2'
) => {
  let usableMaterial
  if (baseMaterial instanceof CryptoKey) {
    usableMaterial = await window.crypto.subtle.exportKey('raw', baseMaterial)
  } else {
    usableMaterial = stringToArrayBuffer(baseMaterial)
  }
  return await window.crypto.subtle.importKey(
    'raw',
    usableMaterial,
    { name: keyDerivationAlgorithm },
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

export const deriveKey = async (password, salt) => {
  const passwordAsKey = await asDerivableKey(password)
  const saltBuffer = stringToArrayBuffer(salt)
  const passwordBuffer = stringToArrayBuffer(password)
  // Chain 2 key derivations : first, derive a key from a password
  const preKey = await slowHashing(passwordAsKey, saltBuffer, {
    iterations: 100000
  })
  const key = await asDerivableKey(preKey)
  return slowHashing(key, passwordBuffer, { iterations: 1 })
}

export const exportKey = async (key, vaultKey) => {
  /*
    Way of safe exporting a key by
    1) encrypting it with the vaultKey using the AES-KW cypher mode
    2) exporting the result in a standardized format (JWK)
  */
  return window.crypto.subtle.wrapKey('jwk', key, vaultKey, { name: 'AES-KW' })
}

export const importKey = async (wrappedKey, vaultKey, { algorithm } = {}) => {
  /*
    Way of reading a previously exported/wrapped key. Since the export should
    have been done in a secure manner, the wrappedKey contains an encrypted 
    version of the real key. Providing vaultKey allows to decypher it.
    Other parameters tell WebCrypto the kind of CryptoKey we expect as output:
    - a key dedicated to a given cypher-mode (default is AES-GCM)
    - a key that will accept to be wrapped and unwrapped
    - a key that will be used for encryption and decryption purpose
  */
  return window.crypto.subtle.unwrapKey(
    'jwk',
    wrappedKey,
    vaultKey,
    'AES-KW',
    { name: algorithm || 'AES-GCM', length: 256 },
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
