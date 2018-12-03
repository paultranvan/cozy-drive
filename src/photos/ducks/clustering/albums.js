import { cozyClient, log } from 'cozy-konnector-libs'
import { DOCTYPE_ALBUMS } from 'drive/lib/doctypes'
import { matchingClusters } from './matching'

// An auto album name is the date of the first photo
const albumName = photos => {
  return photos[0].datetime
}

// An auto album period starts with the first photo and ends with the last one
const albumPeriod = photos => {
  const startDate = photos[0].datetime
  const endDate =
    photos.length > 1 ? photos[photos.length - 1].datetime : startDate
  return { start: startDate, end: endDate }
}

const createReferences = async (photos, album) => {
  try {
    const ids = photos.map(p => p.id)
    await cozyClient.data.addReferencedFiles(album, ids)
    log(
      'info',
      `${photos.length} photos clustered into: ${JSON.stringify(album)}`
    )
  } catch (e) {
    log('error', e.reason)
  }
}

const createAutoAlbum = async (photos, albums) => {
  // Check if an album already exists for these photos. If not, create it
  const name = albumName(photos)
  const album = albums ? albums.find(album => album.name === name) : null
  if (album) return album
  else {
    const created_at = new Date()
    const period = albumPeriod(photos)
    const album = { name, created_at, auto: true, period }
    return await cozyClient.data.create(DOCTYPE_ALBUMS, album)
  }
}

export const findAutoAlbums = async () => {
  const autoAlbums = await cozyClient.data.defineIndex(DOCTYPE_ALBUMS, [
    'auto',
    'name'
  ])
  const results = await cozyClient.data.query(autoAlbums, {
    selector: { auto: true },
    sort: [{ name: 'desc' }]
  })
  return results
}

// TODO: deal with updates
export const saveClustering = async (clusters, albums) => {
  for (const photos of clusters) {
    if (photos && photos.length > 0) {
      const album = await createAutoAlbum(photos, albums)
      await createReferences(photos, album)
    }
  }
}

const findPhotosByAlbum = async album => {
  album._type = DOCTYPE_ALBUMS
  return await cozyClient.data.listReferencedFiles(album)
}

const findPhotosToClusterize = async albums => {
  const photos = await findPhotosByAlbum(albums[0])
  if (albums.length > 1) {
    photos.push(...findPhotosByAlbum(albums[1]))
  }
  return photos
}

/**
  Look for existing auto albums to re-clusterize.
  There are 2 cases for this to occur:
    - A photo's datetime is inside the album period
    - A photo's datetime is in a gap between the album and an adjacent one.
*/
export const albumsToClusterize = async (photos, albums) => {
  const toClusterize = {}

  for (const photo of photos) {
    const matching = matchingClusters(photo, albums)
    if (matching.length > 0) {
      const key = matching[1]
        ? matching[0]._id + ':' + matching[1]._id
        : matching[0]._id
      if (toClusterize[key]) {
        toClusterize[key].push(photo)
      } else {
        const photosToClusterize = await findPhotosToClusterize(photo, matching)
        toClusterize[key] = photosToClusterize
        toClusterize[key].push(photo)
      }
    }
  }
  return toClusterize
}
