import { generateAESKey, wrapAESKey } from 'drive/web//modules/encryption/keys'
import { encryptData } from 'drive/web/modules/encryption/data'
import { encode as encodeArrayBuffer } from 'base64-arraybuffer'

export const encryptFile = async (file, vault) => {
  // Encrypt the file with a newly generated AES key
  const aesKey = await generateAESKey()
  const encryptedFile = await encryptData(aesKey, file)
  const iv = encodeArrayBuffer(encryptedFile.iv)
  // Wrap the AES key with the vault key and save it in database
  const wrap = await wrapAESKey(aesKey, vault.key, vault.id, { iv })
  return { file: encryptedFile, wrappedKey: wrap }
}
