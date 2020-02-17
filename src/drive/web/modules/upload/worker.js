import { generateAESKey, wrapAESKey } from 'drive/web//modules/encryption/keys'
import { encryptData } from 'drive/web/modules/encryption/data'
import { encode as encodeArrayBuffer } from 'base64-arraybuffer'

export const encryptFile = async (file, vault, name) => {
  const tEnc0 = performance.now()
  // Encrypt the file with a newly generated AES key
  const aesKey = await generateAESKey()
  const encryptedFile = await encryptData(aesKey, file)
  const iv = encodeArrayBuffer(encryptedFile.iv)
  // Wrap the AES key with the vault key and save it in database
  const wrap = await wrapAESKey(aesKey, vault.key, vault.id, { iv })
  const tEnc1 = performance.now()
  console.log('Encryption ' + name + ' : ' + (tEnc1 - tEnc0) + ' ms')
  return { file: encryptedFile, wrappedKey: wrap, perf:  tEnc1 - tEnc0}
}
