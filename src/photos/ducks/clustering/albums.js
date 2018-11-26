import { cozyClient, log } from 'cozy-konnector-libs'
import { DOCTYPE_ALBUMS } from 'drive/lib/doctypes'

export const autoAlbums = async () => {
  // TODO make it index ?
  const albums = await cozyClient.data.findAll(DOCTYPE_ALBUMS)
  const autoAlbums = albums
    .filter(doc => doc.auto === true)
    .sort((a, b) => a.start > b.start)
  return autoAlbums
}

// TODO: need to retrieve photos for an elected album to add them to the clustering
const addPhotoToClusters = (toClusterize, photo, albumStart, albumEnd) => {
  const key = albumEnd ? albumStart.id + ':' + albumEnd.id : albumStart.id
  if (toClusterize[key]) {
    toClusterize[key].push(photo) //check duplicate
  } else {
    toClusterize[key] = [photo]
  }
}

const photoBetweenClusters = (newerAlbum, olderAlbum, photo) => {
  if (newerAlbum && olderAlbum) {
    return newerAlbum.end < photo.date && olderAlbum.start > photo.date
  }
  return false
}

const photoInsideCluster = (album, photo) => {
  return album.start < photo.date && album.end > photo.date
}

// Find the albums in which a photo can be added
const photosToClusterize = async (toClusterize, albums, photo) => {
  for (let i = 0; i < albums.length; i++) {
    // Albums are sorted by starting date from newest to oldest
    if (photoInsideCluster(albums[i], photo)) {
      addPhotoToClusters(toClusterize, photo, albums[i])
    } else if (photoBetweenClusters(albums[i], albums[i + 1], photo)) {
      addPhotoToClusters(toClusterize, photo, albums[i], albums[i + 1])
    }
  }
}

/**
  For each new photos, we need to evaluate how they must be clusterized

*/
export const pastAlbumsToProcess = async (albums, photos) => {
  const toClusterize = {}

  if (albums) {
    photos.forEach(photo => {
      if (photo.date < albums[0].end) {
        photosToClusterize(toClusterize, albums, photo)
      } else {
        // Add to the most recent album
        addPhotoToClusters(toClusterize, photo, albums[0])
      }
    })
  } else {
    // return only photos as dataset
    toClusterize['init'] = photos
  }
  return toClusterize
}
