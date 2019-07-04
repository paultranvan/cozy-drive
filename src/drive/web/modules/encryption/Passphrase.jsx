import React, { Component } from 'react'
import { connect } from 'react-redux'
import { compose } from 'redux'
import Modal, { ModalContent } from 'cozy-ui/react/Modal'
import Alerter from 'cozy-ui/react/Alerter'
import { translate } from 'cozy-ui/react/I18n'
import { withClient } from 'cozy-client'
import { Input } from 'cozy-ui/react'
import { DERIVED_PASSPHRASE_KEY_ID } from './keys'
import { decryptVaultEncryptionKey, createVaultEncryptionKey } from './duck'

class Passphrase extends Component {
  constructor(props) {
    super(props)
    this.state = {
      passphrase: '',
      encryptedVault: null
    }
  }

  async getEncryptedVault() {
    const { client } = this.props
    const settings = await client.query(
      client.find('io.cozy.settings').getById('io.cozy.settings.instance')
    )
    let vault
    if (settings.data.encryption && settings.data.encryption.keys) {
      for (const entry of settings.data.encryption.keys) {
        if (entry.wrappingKey.kid === DERIVED_PASSPHRASE_KEY_ID) {
          vault = entry
          break
        }
      }
    }
    return vault
  }

  async componentWillMount() {
    const encryptedVault = await this.getEncryptedVault()
    this.setState({ encryptedVault })
  }

  handleChange(e) {
    const passphrase = e.target.value
    this.setState({ passphrase })
  }

  async onSubmitPassphrase() {
    const { t, onClose, dispatch } = this.props
    if (this.state.encryptedVault) {
      await dispatch(
        decryptVaultEncryptionKey(
          this.state.encryptedVault,
          this.state.passphrase
        )
      )
    } else {
      // WARNING this does not check if the passphrase is the cozy one
      await dispatch(createVaultEncryptionKey(this.state.passphrase))
    }

    // TODO check passphrase.
    // TODO callback to props.onSubmitPassphrase()

    Alerter.success(t('encryption.passphrase.success'))
    onClose()
  }

  render() {
    const { t } = this.props
    return (
      <Modal
        title={t('encryption.passphrase.title')}
        description={<p>{t('encryption.passphrase.desc')}</p>}
        primaryText={t('encryption.passphrase.submit')}
        primaryAction={() => this.onSubmitPassphrase()}
      >
        <ModalContent>
          <Input
            type="password"
            placeholder="Enter your password"
            onChange={e => this.handleChange(e)}
          />
        </ModalContent>
      </Modal>
    )
  }
}

export default compose(
  translate(),
  connect(),
  withClient
)(Passphrase)
