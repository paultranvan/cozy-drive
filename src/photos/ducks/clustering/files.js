import { cozyClient, log } from 'cozy-konnector-libs'
import { DOCTYPE_FILES, DOCTYPE_ALBUMS } from 'drive/lib/doctypes'

export const getChanges = async (lastSeq, limit) => {
  log('info', `Get changes on files since ${lastSeq}`)
  const result = await cozyClient.fetchJSON(
    'GET',
    `/data/${DOCTYPE_FILES}/_changes?include_docs=true&since=${lastSeq}`
  )
  // Filter the changes to only get non-trashed images.
  const photosChanges = result.results
    .map(res => {
      return { doc: res.doc, seq: res.seq }
    })
    .filter(res => {
      return (
        res.doc.class === 'image' &&
        !res.doc._id.includes('_design') &&
        !res.doc.trashed
      )
    })
    .slice(0, limit)

  const newLastSeq =
    photosChanges.length > 0
      ? photosChanges[photosChanges.length - 1].seq
      : null
  const photos = photosChanges.map(photo => photo.doc)
  return { photos, newLastSeq }
}

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
  //console.time('album')
  album._type = DOCTYPE_ALBUMS
  let files = []
  let next = true
  let count = 0
  let skip = 0
  let startDocid = ''
  /*
  /*cursor: [
    ['io.cozy.photos.albums', 'd6d304a197bff08caa498f7b1a8f57d9'],
    '18dbfbcc94f6cb2bb6b2f439d2043399'
  ],*/
  while (next) {
    //const key = `["${DOCTYPE_ALBUMS}", "${album._id}"]`
    const key = [DOCTYPE_ALBUMS, album._id]
    const cursor = [key, startDocid]
    //console.log('cursor : ', cursor)
    //TODO skip 0 when first call
    const result = await cozyClient.data.fetchReferencedFiles(
      album,
      { cursor },
      'id'
    )
    if (result && result.included) {
      let included = result.included.map(included => {
        /*const attributes = included.attributes
        attributes.id = included.id
        attributes.clusterId = album._id*/
        included.clusterId = album._id
        return included
      })
      /*console.log('meta count : ', result.meta.count)
      console.log('results : ', result.included.length)
      console.log('files : ', files.length)*/

      // Remove the last element, used as starting point for the next run
      if (files.length + included.length < result.meta.count) {
        included = included.slice(0, result.included.length - 1)
        startDocid = result.included[result.included.length - 1].id
        //console.log('new start docid : ', start_docid)
      } else {
        next = false
      }

      files = files.concat(included)

      //skip = files.length
    } else {
      next = false
    }
  }
  //console.log('n files : ', files.length)
  //console.log('file 0 : ', files[0])
  //log('debug', `file 0 : ${JSON.stringify(files[0])}`)
  //log('debug', `file last : ${JSON.stringify(files[files.length - 1])}`)

  //console.timeEnd('album')
  return files
}
