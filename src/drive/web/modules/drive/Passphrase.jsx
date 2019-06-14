import React, { Component } from 'react'
import Modal, { ModalContent } from 'cozy-ui/react/Modal'
import Alerter from 'cozy-ui/react/Alerter'
import { translate } from 'cozy-ui/react/I18n'
import { Input } from 'cozy-ui/react'

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

  async onSubmitPassphrase() {
    const { t, onClose } = this.props
    // TODO check passphrase.
    // TODO derive encryption key
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

export default translate()(Passphrase)
