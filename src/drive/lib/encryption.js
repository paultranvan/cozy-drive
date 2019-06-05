const stringToArrayBuffer = string => {
  var encoder = new TextEncoder('utf-8')
  return encoder.encode(string)
}

const generateKey = async () => {
  const key = await crypto.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, //whether the key is extractable (i.e. can be used in exportKey)
    ['encrypt', 'decrypt', 'wrap', 'unwrap']
  )
  return key
}

const importAsKey = async str => {
  const key = await crypto.subtle.importKey(
    'raw',
    stringToArrayBuffer(str),
    { name: 'PBKDF2' },
    true,
    ['deriveKey', 'deriveBits']
  )
  return key
}

export const deriveKey = async (password, salt) => {
  const hash = 'SHA-256'
  const iterations1 = 1000
  const iterations2 = 1
  const passAsKey = await importAsKey(password) // need to cast string to cryptoKey
  const saltBuffer = stringToArrayBuffer(salt)
  const passwordBuffer = stringToArrayBuffer(password)
  console.log('etape 1', passAsKey, saltBuffer)
  // Chain 2 key derivations
  const preKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: iterations1,
      hash: hash
    },
    passAsKey,
    { name: 'AES-CBC', length: 256 }, // Key we want
    true, // Extractable
    ['encrypt', 'decrypt'] // For new key
  )
  console.log('Pre key derived', preKey)
  // Second derivation
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: passwordBuffer,
      iterations: iterations2,
      hash: hash
    },
    preKey,
    { name: 'AES-GCM', length: 256 }, // Key we want
    true, // Extractable
    ['encrypt', 'decrypt', 'wrap', 'unwrap'] // For new key
  )
  console.log('key derived', key)
  return key
}

export const exportKey = async (key, vaultKey) => {
  return crypto.subtle.exportKey('jwk', key, vaultKey, 'AES-KW')
}

export const importKey = async (wrappedKey, vaultKey) => {
  return crypto.subtle.importKey(
    'jwk',
    wrappedKey,
    vaultKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrap', 'unwrap']
  )
}

export const encryptData = async (data, key) => {
  // data is suppose to be an ArrayBuffer
  // const bits = key
  // TODO
  const initializationVector = crypto.getRandomValues()

  return crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: initializationVector,
      tagLength: 128,
      additionalData: ''
    },
    key,
    data
  )
}
