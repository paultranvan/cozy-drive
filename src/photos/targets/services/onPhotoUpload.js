import { cozyClient } from 'cozy-konnector-libs'
import doctypes from 'photos/targets/browser/doctypes'
import CozyClient from 'cozy-client'
import log from 'cozy-logger'

import {
  getChanges,
  getFilesFromCreatedAt,
  getAllPhotos,
  getFilesFromDate,
  getFilesByAutoAlbum
} from 'photos/ducks/clustering/files'
import {
  readSetting,
  createSetting,
  updateSetting,
  getDefaultParameters,
  updateSettingStatus,
  getDefaultParametersMode,
  updateParamsPeriod
} from 'photos/ducks/clustering/settings'
import {
  computeEpsTemporal,
  computeEpsSpatial,
  reachabilities
} from 'photos/ducks/clustering/service'
import {
  PERCENTILE,
  DEFAULT_MODE,
  EVALUATION_THRESHOLD,
  CHANGES_RUN_LIMIT
} from 'photos/ducks/clustering/consts'
import { spatioTemporalScaled } from 'photos/ducks/clustering/metrics'
import { gradientClustering } from 'photos/ducks/clustering/gradient'
import { saveClustering, findAutoAlbums } from 'photos/ducks/clustering/albums'
import { albumsToClusterize } from 'photos/ducks/clustering/reclusterize'
import { prepareDataset } from 'photos/ducks/clustering/utils'
import { getMatchingParameters } from 'photos/ducks/clustering/matching'

// Compute the actual clustering based on the new dataset and the existing albums
const createNewClusters = async (params, clusterAlbums, dataset) => {
  //console.time('gradient')
  const reachs = reachabilities(dataset, spatioTemporalScaled, params)
  const clusters = gradientClustering(dataset, reachs, params)
  //console.timeEnd('gradient')
  if (clusters.length > 0) {
    //console.time('save')
    const save = await saveClustering(clusters, clusterAlbums)
    //console.timeEnd('save')
    return save
  }
  return 0
}

// Compute the inital clustering
const createInitialClusters = async (paramsMode, dataset) => {
  //console.time('gradient')
  const reachs = reachabilities(dataset, spatioTemporalScaled, paramsMode)
  const clusters = gradientClustering(dataset, reachs, paramsMode)
  //console.timeEnd('gradient')
  //console.time('save')
  const save = await saveClustering(clusters)
  //console.timeEnd('save')
  return save
}

// Clusterize the given photos, i.e. organize them depending on metrics
const clusterizePhotos = async (setting, dataset, albums) => {
  log('info', `Start clustering on ${dataset.length} photos`)

  let clusteredCount = 0
  try {
    if (albums && albums.length > 0) {
      // Build the clusterize Map, based on the dataset and existing photos
      console.time('albums clusterize')
      const clusterize = await albumsToClusterize(dataset, albums)
      console.timeEnd('albums clusterize')
      //process.exit(0)
      if (clusterize) {
        console.time('create clusters')
        for (const [clusterAlbums, photos] of clusterize.entries()) {
          // Retrieve the relevant parameters to compute this cluster
          const params = getMatchingParameters(setting.parameters, photos)
          const paramsMode = getDefaultParametersMode(params)
          if (!paramsMode) {
            log('warn', 'No parameters for clustering found')
            continue
          }
          // Actual clustering

          clusteredCount += await createNewClusters(
            paramsMode,
            clusterAlbums,
            photos
          )
          setting = await updateParamsPeriod(setting, params, dataset)
        }
        console.timeEnd('create clusters')
      } else {
        return
      }
    } else {
      // No album found: this is an initialization
      const params = setting.parameters[setting.parameters.length - 1]
      const paramsMode = getDefaultParametersMode(params)
      if (!paramsMode) {
        log('warn', 'No parameters for clustering found')
        return
      }

      clusteredCount = await createInitialClusters(paramsMode, dataset)
      setting = await updateParamsPeriod(setting, params, dataset)
    }
  } catch (e) {
    log('error', `An error occured during the clustering: ${JSON.stringify(e)}`)
    return
  }
  return { setting, clusteredCount }
}

const createParameter = (dataset, epsTemporal, epsSpatial) => {
  return {
    period: {
      start: dataset[0].datetime,
      end: dataset[dataset.length - 1].datetime
    },
    modes: [
      {
        name: DEFAULT_MODE,
        epsTemporal: epsTemporal,
        epsSpatial: epsSpatial
      }
    ]
  }
}
const initParameters = dataset => {
  log('info', `Compute clustering parameters on ${dataset.length} photos`)
  const epsTemporal = computeEpsTemporal(dataset, PERCENTILE)
  const epsSpatial = computeEpsSpatial(dataset, PERCENTILE)
  return createParameter(dataset, epsTemporal, epsSpatial)
}

const recomputeParameters = async setting => {
  const lastParams = setting.parameters[setting.parameters.length - 1]
  // The defaultEvaluation field is used at init if there are not enough files
  // for a proper parameters evaluation: we use default metrics and therefore,
  // this end period should not be taken into consideration.
  const lastPeriodEnd = lastParams.defaultEvaluation
    ? lastParams.period.start
    : lastParams.period.end

  const files = await getFilesFromDate(lastPeriodEnd)

  // Safety check
  if (files.length < EVALUATION_THRESHOLD) {
    return
  }
  log('info', `Compute clustering parameters on ${files.length} photos`)

  const dataset = prepareDataset(files)
  const epsTemporal = computeEpsTemporal(dataset, PERCENTILE)
  const epsSpatial = computeEpsSpatial(dataset, PERCENTILE)
  return createParameter(dataset, epsTemporal, epsSpatial)
}

const runClustering = async setting => {
  //const since = setting.lastSeq ? setting.lastSeq : 0
  const sinceDate = setting.lastDate ? setting.lastDate : 0
  //const changes = await getChanges(since, CHANGES_RUN_LIMIT)
  //console.time('createdat')
  const photos = await getFilesFromCreatedAt(sinceDate, CHANGES_RUN_LIMIT)
  //console.timeEnd('createdat')
  if (photos.length < 1) {
    log('warn', 'No photo found to clusterize')
    return 0
  }
  const albums = await findAutoAlbums()
  //log('debug', `photo 0 : ${JSON.stringify(photos[0])}`)
  const dataset = prepareDataset(photos, albums)
  //log('debug', `dataset 0 : ${JSON.stringify(dataset[0])}`)
  //console.time('clusterize')
  const result = await clusterizePhotos(setting, dataset, albums)
  //console.timeEnd('clusterize')
  if (!result) {
    return 0
  }
  /*
  WARNING: we save the lastSeq retrieved at the beginning of the clustering.
  However, we might have produced new _changes on files by saving the
  referenced-by, so they will be computed again at the next run.
  We cannot save the new lastSeq, as new files might have been uploaded by
  this time and would be ignored for the next run.
  This is unpleasant, but harmless, as no new write will be produced on the
  already clustered files.
 */
  log('info', `${result.clusteredCount} photos clustered since ${sinceDate}`)
  const newLastDate = photos[photos.length - 1].attributes.created_at
  setting = await updateSettingStatus(
    result.setting,
    result.clusteredCount,
    newLastDate
  )
  return photos
}

const onPhotoUpload = async () => {
  log('info', `Service called with COZY_URL: ${process.env.COZY_URL}`)

  const options = {
    schema: doctypes
  }
  const client = CozyClient.fromEnv(null, options)
  //const query = client.find('io.cozy.photos.albums').getById('4f2b50a34e02cae35b7ada687dac4dcb').include(['photos'])
  console.time('fetch relationships')
  let allPhotos = []
  const query = client
    .find('io.cozy.photos.albums')
    .getById('4f2b50a34e02cae35b7ada687dac4dcb')
    .include(['photos'])
  const resp = await client.query(query)

  let data = client.hydrateDocuments('io.cozy.photos.albums', [resp.data])
  console.log('data : ', resp.data)
  const p = await data[0].photos.data
  allPhotos = allPhotos.concat(p)
  let nPhotos = 0
  while (data[0].photos.hasMore) {

    await data[0].photos.fetchMore()
    const fromState = client.getDocumentFromState(
      'io.cozy.photos.albums',
      '4f2b50a34e02cae35b7ada687dac4dcb'
    )
    data = client.hydrateDocuments('io.cozy.photos.albums', [fromState])
    const photos = await data[0].photos.data
    allPhotos = photos
    nPhotos = photos.length
    console.log('photos length : ', allPhotos.length)
  }

  console.timeEnd('fetch relationships')
  console.log('results : ', nPhotos)

  let prevPhoto = {
    metadata: {
      datatime: ''
    }
  }
  allPhotos.forEach(photo => {
    console.log(photo)
    if (photo.metadata.datetime < prevPhoto.metadata.datetime) {
      console.error('not sorted : ', photo.metadata.datetime, ' < ', prevPhoto.metadata.datetime)
      process.exit(0)
    }
    prevPhoto = photo
  })
  console.log('photos length : ', allPhotos.length)



  // skip:  2185 photos in 14128.358ms (!!!)
  // cursor: 2185 photos in 7646ms
  // cursor clientjs : 2185 photos in 5482.458ms

  /*  console.time('fetch clientjs')
  const album = resp.data
  console.log('album : ', album)
  await getFilesByAutoAlbum(album)
  console.timeEnd('fetch clientjs')
*/

  /*
  console.time('total')

  let setting = await readSetting()
  if (!setting) {
    // Create setting
    const files = await getAllPhotos()
    const dataset = prepareDataset(files)
    const params =
      dataset.length > EVALUATION_THRESHOLD
        ? initParameters(dataset)
        : getDefaultParameters(dataset)
    setting = await createSetting(params)
    log(
      'info',
      `Setting saved with ${JSON.stringify(
        params.modes
      )} on period ${JSON.stringify(params.period)}`
    )
  }

  if (setting.evaluationCount > EVALUATION_THRESHOLD) {
    // Recompute parameters when enough photos had been processed
    const newParams = await recomputeParameters(setting)
    if (newParams) {
      const params = [...setting.parameters, newParams]
      const newSetting = {
        ...setting,
        parameters: params,
        evaluationCount: 0
      }
      setting = await updateSetting(setting, newSetting)
      log('info', `Setting updated with ${JSON.stringify(newParams)}`)
    }
  }

  const processedPhotos = await runClustering(setting)
  //console.log('processed photos : ', processedPhotos)
  if (processedPhotos.length >= CHANGES_RUN_LIMIT) {
    // There are still changes to process: re-launch the service
    const args = {
      message: {
        name: 'onPhotoUpload',
        slug: 'photos'
      }
    }
    console.timeEnd('total')
    await cozyClient.jobs.create('service', args)
  }*/
}

onPhotoUpload()
