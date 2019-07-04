import {
  deriveKey,
  generateAESKey,
  wrapAESKey,
  unwrapAESKey,
  exportKey,
  importKey,
  DERIVED_PASSPHRASE_KEY_ID
} from './keys'
import { decode as decodeArrayBuffer } from 'base64-arraybuffer'
import Alerter from 'cozy-ui/react/Alerter'

export const DECRYPT_VAULT_ENCRYPTION_KEY = 'DECRYPT_ENCRYPTION_KEY'
export const CREATE_VAULT_ENCRYPTION_KEY = 'CREATE_ENCRYPTION_KEY'

// reducer
const encryption = (state = null, action) => {
  switch (action.type) {
    case DECRYPT_VAULT_ENCRYPTION_KEY:
    case CREATE_VAULT_ENCRYPTION_KEY:
      return action.key
    default:
      return state
  }
}

// actions
export const decryptVaultEncryptionKey = (vault, passphrase) => {
  return async (dispatch, _, { client }) => {
    const salt = client.getStackClient().uri
    const derivedKey = await deriveKey(passphrase, salt)
    const wrappedKey = decodeArrayBuffer(vault.key.encrypted_key)
    // WARNING the vault key is AES-KW. However, due to a bug in Mozilla,
    // we are forced to ask for a AES-GCM key, and then "convert" it in AES-KW
    const vaultKey = await unwrapAESKey(wrappedKey, derivedKey, {
      algorithm: 'AES-GCM',
      keyUsages: vault.key.key_ops
    }).catch(error => {
      Alerter.error('encryption.passphrase.incorrect')
      throw error
    })
    const exportVaultKey = await exportKey('raw', vaultKey)
    const importVaultKey = await importKey('raw', exportVaultKey, {
      algorithm: 'AES-KW',
      keyUsages: ['wrapKey', 'unwrapKey']
    })
    return dispatch({
      type: DECRYPT_VAULT_ENCRYPTION_KEY,
      key: importVaultKey
    })
  }
}

export const createVaultEncryptionKey = passphrase => {
  return async (dispatch, _, { client }) => {
    // Derive secret key
    const stackClient = client.getStackClient()
    const salt = stackClient.uri
    const derivedKey = await deriveKey(passphrase, salt)

    // Generate vault key and wrap it
    const vaultKey = await generateAESKey({
      algorithm: 'AES-KW',
      keyUsages: ['wrapKey', 'unwrapKey']
    })
    const wrapped = await wrapAESKey(
      vaultKey,
      derivedKey,
      DERIVED_PASSPHRASE_KEY_ID
    )
    // Save the wrapped key in settings
    const settings = await client.query(
      client.find('io.cozy.settings').getById('io.cozy.settings.instance')
    )
    const keys =
      settings.data.encryption && settings.data.encryption.keys
        ? [...settings.data.encryption.keys, wrapped]
        : [wrapped]
    const encryption = { ...settings.data.encryption, keys }
    const newSettings = { ...settings.data, encryption }

    await client.collection('io.cozy.settings').update(newSettings)

    return dispatch({
      type: CREATE_VAULT_ENCRYPTION_KEY,
      key: vaultKey
    })
  }
}

export default encryption
