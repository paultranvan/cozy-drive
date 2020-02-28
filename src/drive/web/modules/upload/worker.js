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
  console.debug('Encryption ' + name + ' : ' + (tEnc1 - tEnc0) + ' ms')
  return { file: encryptedFile, wrappedKey: wrap, perf: tEnc1 - tEnc0 }
}

// WARNING: this does not work, as cozy-client cannot be passed here.
// This is because the object must be serializable, which is not possible
// for functions.
export const encryptedUpload = async (client, vault, file, dirID) => {
  let tUpload0

  const fr = new FileReader()

  fr.onload = async () => {
    const tUpload1 = performance.now()
    console.debug(
      'Read file : ' + file.name + ' : ' + (tUpload1 - tUpload0) + ' ms'
    )
    const tEnc0 = performance.now()
    const encrypted = await encryptFile(fr.result, vault, file.name)
    const tEnc1 = performance.now()
    console.debug('Encryption ' + file.name + ' : ' + (tEnc1 - tEnc0) + ' ms')

    const name = 'encrypted_' + file.name

    const resp = await client
      .collection('io.cozy.files')
      .createFile(encrypted.file.cipher, {
        name,
        dirId: dirID,
        metadata: { encryption: encrypted.wrappedKey }
      })
    return resp.data
  }
  fr.onloadstart = async () => {
    tUpload0 = performance.now()
  }
  fr.readAsArrayBuffer(file)
}
