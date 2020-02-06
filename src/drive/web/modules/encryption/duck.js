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
import get from 'lodash/get'

export const DECRYPT_VAULT_ENCRYPTION_KEY = 'DECRYPT_ENCRYPTION_KEY'
export const CREATE_VAULT_ENCRYPTION_KEY = 'CREATE_ENCRYPTION_KEY'

// reducer
const initialState = { vault: { key: null, id: '' } }
const encryption = (state = initialState, action) => {
  switch (action.type) {
    case DECRYPT_VAULT_ENCRYPTION_KEY:
    case CREATE_VAULT_ENCRYPTION_KEY:
      return { ...state, vault: action.vault }
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
    const wrappedKeyId = vault.key.kid
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
      vault: { key: importVaultKey, id: wrappedKeyId }
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
    const wrap = await wrapAESKey(
      vaultKey,
      derivedKey,
      DERIVED_PASSPHRASE_KEY_ID
    )
    // Save the wrapped key in settings

    // We cannot directly query throught cozy-client as the SettingsCollection
    // will query the protected /settings route
    const settings = await client
      .getStackClient()
      .fetchJSON('GET', '/data/io.cozy.settings/io.cozy.settings.instance')

    const keys = get(settings, 'encryption.keys')
      ? [...settings.encryption.keys, wrap]
      : [wrap]
    const encryption = { ...settings.encryption, keys }
    const newSettings = { ...settings, encryption }

    await client
      .getStackClient()
      .fetchJSON(
        'PUT',
        '/data/io.cozy.settings/io.cozy.settings.instance',
        newSettings
      )

    return dispatch({
      type: CREATE_VAULT_ENCRYPTION_KEY,
      vault: { key: vaultKey, id: wrap.key.kid }
    })
  }
}

export default encryption
