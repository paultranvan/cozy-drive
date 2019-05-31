import { cozyClient } from 'cozy-konnector-libs'
import { DOCTYPE_FILES, DOCTYPE_ALBUMS } from 'drive/lib/doctypes'

export const getFilesFromCreatedAt = async (date, limit) => {
  const filesIndex = await cozyClient.data.defineIndex(DOCTYPE_FILES, [
    'created_at',
    'class',
    'trashed'
  ])
  const selector = {
    created_at: { $gt: date },
    class: 'image',
    trashed: false
  }
  // The results are paginated
  let next = true
  let skip = 0
  let files = []
  while (next) {
    const result = await cozyClient.files.query(filesIndex, {
      selector: selector,
      wholeResponse: true,
      skip: skip
    })
    files = files.concat(result.data)
    if (files.length >= limit) {
      next = false
      files = files.slice(0, limit)
    }
    skip = files.length
    // NOTE: this is because of https://github.com/cozy/cozy-stack/pull/598
    if (result.meta.count < Math.pow(2, 31) - 2) {
      next = false
    }
  }
  return files
}

export const getFilesFromDate = async date => {
  // Note a file without a metadata.datetime would not be indexed: this is not
  // a big deal as this is only used to compute parameters
  const filesIndex = await cozyClient.data.defineIndex(DOCTYPE_FILES, [
    'metadata.datetime',
    'class',
    'trashed'
  ])
  const selector = {
    'metadata.datetime': { $gt: date },
    class: 'image',
    trashed: false
  }
  // The results are paginated
  let next = true
  let skip = 0
  let files = []
  while (next) {
    const result = await cozyClient.files.query(filesIndex, {
      selector: selector,
      wholeResponse: true,
      skip: skip
    })
    files = files.concat(result.data)
    skip = files.length
    // NOTE: this is because of https://github.com/cozy/cozy-stack/pull/598
    if (result.meta.count < Math.pow(2, 31) - 2) {
      next = false
    }
  }
  return files
}

export const getAllPhotos = async () => {
  const files = await cozyClient.data.findAll(DOCTYPE_FILES)
  return files.filter(file => file.class === 'image' && !file.trashed)
}

export const getFilesByAutoAlbum = async album => {
  album._type = DOCTYPE_ALBUMS
  let files = []
  let next = true
  let skip = 0
  while (next) {
    const result = await cozyClient.data.fetchReferencedFiles(album, {
      skip: skip,
      wholeResponse: true
    })
    if (result && result.included) {
      const includedFiles = result.included.map(included => {
        const attributes = included.attributes
        attributes.id = included.id
        attributes.clusterId = album._id
        return attributes
      })
      files = files.concat(includedFiles)
      skip = files.length
      if (result.meta.count < includedFiles.length) {
        next = false
      }
    } else {
      next = false
    }
  }
  return files
}
