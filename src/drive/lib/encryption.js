import crypto from 'crypto'

const crypto = crypto.subtle

async const generateKey = () => {
    const key = await crypto.generateKey(
        {
            name: "AES-GCM",
            length: 256
        },
        true, //whether the key is extractable (i.e. can be used in exportKey)
        ["encrypt", "decrypt", "wrap", "unwrap"] 
    )
    return key
}

async const stringToKey = str => {
    const key = await crypto.importKey(
        "raw",
        stringToArrayBuffer(str),
        {"name": "PBKDF2"},
        false,
        ["deriveKey"])
    return key
}

async const deriveKey = (password, salt) => {
    const hash = "SHA-256"
    const iterations1 = 1000
    const iterations2 = 1
    const passAsKey = stringToKey(password) // need to cast string to cryptoKey
    // Chain 2 key derivations
    const preKey = crypto.deriveKey(
        {
            "name": "PBKDF2",
            "salt": stringToArrayBuffer(salt),
            "iterations": iterations1,
            "hash": hash
        },
        passAsKey,
        {"name": "AES-CBC", "length": 128}, // Key we want
        true,                               // Extrable
        ["encrypt", "decrypt"]              // For new key
        )
    // Second derivation
    const key = await crypto.deriveKey(
        {
            "name": "PBKDF2",
            "salt": stringToArrayBuffer(password),
            "iterations": iterations2,
            "hash": hash
        },
        preKey,
        {"name": "AES-CBC", "length": 128}, // Key we want
        true,                               // Extrable
        ["encrypt", "decrypt"]              // For new key
        )
    return key
}