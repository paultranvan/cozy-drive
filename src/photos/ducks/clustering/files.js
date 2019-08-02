import log from 'cozy-logger'

import { DOCTYPE_FILES, DOCTYPE_ALBUMS } from 'drive/lib/doctypes'

export const getFilesFromDate = async (
  client, date,
  { indexDateField, limit = 0 } = {}
) => {
  log('info', `Get files from ${date}`)
  const dateField = indexDateField || 'metadata.datetime'

  const query = client.find(DOCTYPE_FILES).where({
    [dateField]: { $gt: date },
    class: 'image',
    trashed: false
  })

  // The results are paginated
  let next = true
  let skip = 0
  let files = []
  while (next) {
    const result = await client.query(query.offset(skip))
    files = files.concat(result.data)
    if (limit && files.length >= limit) {
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

export const getFilesByAutoAlbum = async (client, album) => {
  let allPhotos = []
  const query = client
    .find(DOCTYPE_ALBUMS)
    .getById(album._id)
    .include(['photos'])
  const resp = await client.query(query)

  let data = client.hydrateDocuments(DOCTYPE_ALBUMS, [resp.data])
  const p = await data[0].photos.data
  allPhotos = allPhotos.concat(p)
  while (data[0].photos.hasMore) {
    await data[0].photos.fetchMore()
    const fromState = client.getDocumentFromState(DOCTYPE_ALBUMS, album._id)
    data = client.hydrateDocuments(DOCTYPE_ALBUMS, [fromState])
    const photos = await data[0].photos.data
    allPhotos = photos
    console.log('photos length : ', allPhotos.length)
  }
  return allPhotos
}
