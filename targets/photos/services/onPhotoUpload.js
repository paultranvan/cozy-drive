import {log, cozyClient} from 'cozy-konnector-libs'
import {computeTemporalEps, computeSpatialEps, computeSpatioTemporalScaledEps, runOptics} from '../../../src/photos/ducks/clustering/services'
import Metrics from '../../../src/photos/ducks/clustering/metrics'

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
const extractInfo = async (files) => {
  const photos = files.map(file => {
    const photo = {
      file: file._id,
      name: file.name
    }
    if (file.metadata) {
      photo.date = file.metadata.datetime
      photo.gps = file.metadata.gps
    } else {
      photo.date = file.created_at
    }
    photo.date = new Date(photo.date.slice(0, 19)).getTime()
    return photo
  }).sort((pa, pb) => pa.date - pb.date)
  return photos
}

const clusterPhotos = async (files) => {
  const data = await extractInfo(files)
  //log('info', JSON.stringify(info))

  // TODO for testing
  const dataset = [
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
  ]

  const metric = new Metrics()
  metric.epsTemporal = computeTemporalEps(dataset, metric, 100)
  metric.epsSpatial = computeSpatialEps(dataset, metric, 100)

  if (metric.epsTemporal < MIN_TEMPORAL_EPS) {
    metric.epsTemporal = MIN_TEMPORAL_EPS
  } else if (metric.epsSptial < MIN_SPATIAL_EPS) {
    metric.epsSpatial = MIN_SPATIAL_EPS
  }

  const eps = computeSpatioTemporalScaledEps(dataset, metric, 100)

  runOptics(dataset, 1000, metric.temporal)

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

  await clusterPhotos(files)
}

onPhotoUpload()
