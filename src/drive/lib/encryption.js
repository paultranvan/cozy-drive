export const generateAESKey = async ({ algorithm, keyLength } = {}) => {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
  return window.crypto.subtle.generateKey(
    {
      name: algorithm || 'AES-GCM',
      length: keyLength || 256
    },
    true, //whether the key is extractable (i.e. can be used in exportKey)
    ['encrypt', 'decrypt']
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
