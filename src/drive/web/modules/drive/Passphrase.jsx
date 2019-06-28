import React, { Component } from 'react'
import { connect } from 'react-redux'
import { compose } from 'redux'
import Modal, { ModalContent } from 'cozy-ui/react/Modal'
import Alerter from 'cozy-ui/react/Alerter'
import { translate } from 'cozy-ui/react/I18n'
import { Input } from 'cozy-ui/react'
import {
  decryptVaultEncryptionKey,
  createVaultEncryptionKey
} from 'drive/web/modules/navigation/duck'
import { withClient } from 'cozy-client'

class Passphrase extends Component {
  constructor(props) {
    super(props)
    this.state = {
      passphrase: ''
    }
  }

  handleChange(e) {
    const passphrase = e.target.value
    this.setState({ passphrase })
  }

  async componentWillMount() {
    const { dispatch } = this.props

    // await dispatch(createVaultEncryptionKey('cozy'))
  }

  async onSubmitPassphrase() {
    const { t, onClose, dispatch } = this.props
    // TODO check passphrase.
    // TODO callback to props.onSubmitPassphrase()
    await dispatch(decryptVaultEncryptionKey(this.state.passphrase))
    await dispatch(createVaultEncryptionKey(this.state.passphrase))
    Alerter.success(t('encryption.passphrase.success'))
    onClose()
  }

  render() {
    const { t, client } = this.props
    console.log('client uri : ', client)
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
