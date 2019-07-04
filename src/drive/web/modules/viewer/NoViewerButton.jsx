import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { Button, Alerter } from 'cozy-ui/transpiled/react'
import { logException } from 'drive/lib/reporter'
import { isMobileApp } from 'cozy-device-helper'
import { createDecryptedFileURL } from 'drive/lib/encryption/data'
import { openLocalFileCopy } from 'drive/mobile/modules/offline/duck'

class AsyncActionButton extends React.Component {
  state = {
    loading: false
  }

  onClick = async () => {
    const { onClick, onError } = this.props
    this.setState(state => ({ ...state, loading: true }))
    try {
      await onClick()
    } catch (error) {
      onError(error)
    }
    this.setState(state => ({ ...state, loading: false }))
  }

  render() {
    const { label, className } = this.props
    return (
      <Button
        busy={this.state.loading}
        className={className}
        onClick={this.onClick}
        label={label}
      />
    )
  }
}

const OpenWithCordovaButton = connect(
  null,
  (dispatch, ownProps) => ({
    openLocalFileCopy: () => dispatch(openLocalFileCopy(ownProps.file))
  })
)(({ t, openLocalFileCopy }) => (
  <AsyncActionButton
    onClick={openLocalFileCopy}
    onError={error => {
      if (/^Activity not found/.test(error.message)) {
        Alerter.error('Viewer.error.noapp', error)
      } else {
        logException(error)
        Alerter.error('Viewer.error.generic', error)
      }
    }}
    label={t('Viewer.noviewer.openWith')}
  />
))

// WARNING: this is already duplicated in cozy-client and navigation/duck/action
// Eventually, we would call a cozy-client method, so we duplicate the code for now to avoid ugly import
const forceFileDownload = (href, filename) => {
  const element = document.createElement('a')
  element.setAttribute('href', href)
  element.setAttribute('download', filename)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

const downloadFile = async file => {
  const downloadURL = await createDecryptedFileURL(file)
  forceFileDownload(downloadURL, file.name)
}

const DownloadButton = ({ t, file }) => (
  <Button
    onClick={() => downloadFile(file)}
    label={t('Viewer.noviewer.download')}
  />
)

DownloadButton.contextTypes = {
  client: PropTypes.object.isRequired
}

const NoViewerButton = ({ file, t }) => {
  if (isMobileApp()) return <OpenWithCordovaButton t={t} file={file} />
  else return <DownloadButton t={t} file={file} />
}

export default NoViewerButton
