import {log, cozyClient} from 'cozy-konnector-libs'
import {computeTemporalEps,
  computeSpatialEps,
  computeSpatioTemporalScaledEps,
  runOptics,
  saveResults
} from '../../../src/photos/ducks/clustering/services'
import Metrics from '../../../src/photos/ducks/clustering/metrics'
import { gradientClustering, gradientAngle } from '../../../src/photos/ducks/clustering/gradient'

//import { FILES_DOCTYPE } from '../../../src/photos/ducks/timeline/index'
//const { cozyClient } = require('cozy-konnector-libs')

const FILES_DOCTYPE = 'io.cozy.files'
const MIN_TEMPORAL_EPS = 3
const MIN_SPATIAL_EPS = 3

process.on('uncaughtException', err => {
  log('warn', JSON.stringify(err.stack))
})

process.on('unhandledRejection', err => {
  log('warn', JSON.stringify(err.stack))
})

// Returns the photos metadata sorted by date
const extractInfo = (files) => {
  let photos = files.map(file => {
    const photo = {
      id: file._id,
      name: file.name
    }
    if (file.metadata) {
      photo.datetime = file.metadata.datetime
      photo.gps = file.metadata.gps
    } else {
      photo.date = file.created_at
    }
    photo.date = (new Date(photo.datetime.slice(0, 19)).getTime() / 1000) / 3600
    return photo
  }).sort((pa, pb) => pa.date - pb.date)

  return photos
}

const clusterPhotos = async (files) => {
  const dataset = extractInfo(files)
  //log('info', JSON.stringify(info))

  // TODO for testing
  /*const dataset = [
    {
      date: 10,
      lat: 41.1,
      lon: 0.2
    }, {
      date: 12,
      lat: 41.2,
      lon: 0.2
    }, {
      date: 15,
      lat: 44.5,
      lon: 2.2
    }, {
      date: 60,
      lat: 41.1,
      lon: 3.2
    }, {
      date: 80,
      lat: 40.5,
      lon: 3.0
    }, {
      date: 110,
      lat: 20,
      lon: 20
    }
  ]*/

  const metric = new Metrics()
  let epsTemporal = computeTemporalEps(dataset, metric, 100)
  let epsSpatial = computeSpatialEps(dataset, metric, 100)

  //console.log('dataset : ', dataset)


  if (epsTemporal < MIN_TEMPORAL_EPS) {
    epsTemporal = MIN_TEMPORAL_EPS
  } else if (epsSpatial < MIN_SPATIAL_EPS) {
    epsSpatial = MIN_SPATIAL_EPS
  }

  //console.log('dataset : ', dataset)

  const eps = computeSpatioTemporalScaledEps(dataset, metric, 100)
  log('info', `eps temporal : ${epsTemporal}`)
  //console.log('eps spatial : ', epsSpatial)
  //console.log('eps spatio temporal : ', eps)
  epsTemporal = 48 // for testing
  const maxBound = 2 * epsTemporal
  const optics = runOptics(dataset, epsTemporal, metric.temporal)
  const angle = gradientAngle(epsTemporal, 1)
  log('info', `angle : , ${angle}`)
  const clusters = gradientClustering(dataset, optics, angle, maxBound)
  return clusters

  //TODO write albumswith auto:true
  //TODO write relationships
  //TODO write io.cozy.albums.settings with lastSeq
  //TODO support several clusterings

}



const onPhotoUpload = async () => {
  //const result = await cozyClient.data.findAll("io.cozy.files")
  //log('info', JSON.stringify(result))

  const lastSeq = 0
  log('info', `Get transactions since ${lastSeq}`)
  const result = await cozyClient.fetchJSON('GET', `/data/${FILES_DOCTYPE}/_changes?include_docs=true&since=${lastSeq}`)

  const newLastSeq = result.last_seq
  const files = result.results.map(res => res.doc).filter(doc => doc.class === 'image').filter(doc => doc._id.indexOf('_design') !== 0).filter(doc => !doc.trashed)

  log('info', `new last seq: ${newLastSeq}`)
  //log('info', JSON.stringify(files))

  const startTime = new Date()

  const clusters = await clusterPhotos(files)
  log('info', `${clusters.length} clusters`)

  const endTime = new Date()
  const timeDiff = (endTime - startTime) / 1000
  log('info', `Time elapsed for clustering ${files.length} photos: ${timeDiff}`)

  saveResults(clusters)

}

onPhotoUpload()
