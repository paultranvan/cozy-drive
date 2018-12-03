import KNN from './knn'
import { temporal, spatial, spatioTemporalScaled } from './metrics'
import {
  MIN_EPS_TEMPORAL,
  MIN_EPS_SPATIAL,
  PERCENTILE,
  DEFAULT_MAX_BOUND,
  COARSE_COEFFICIENT
} from './consts'
import { gradientAngle, gradientClustering } from './gradient'
import { defaultParameters } from './settings'
import { albumsToClusterize } from './albums'
import { findAlbumsByIds } from './matching'

/**
 *  Retrieve the parameters used to compute the clustering
 */
export const clusteringParameters = (dataset, setting) => {
  const params = defaultParameters(setting)
  if (!params) {
    return null
  }
  if (!params.epsTemporal) {
    params.epsTemporal = computeEpsTemporal(dataset, PERCENTILE)
  }
  if (!params.epsSpatial) {
    params.epsSpatial = computeEpsSpatial(dataset, PERCENTILE)
  }
  const epsMax = Math.max(params.epsTemporal, params.epsSpatial)
  if (!params.maxBound) {
    params.maxBound =
      epsMax * 2 < DEFAULT_MAX_BOUND ? epsMax * 2 : DEFAULT_MAX_BOUND
  }
  if (!params.cosAngle) {
    params.cosAngle = gradientAngle(epsMax, COARSE_COEFFICIENT)
  }
  return params
}

/**
 *  Compute the actual clustering based on the new dataset and the existing albums
 */
export const computeClusters = async (dataset, albums, params) => {
  if (albums && albums.length > 0) {
    const toClusterize = await albumsToClusterize(albums, dataset)
    if (toClusterize) {
      for (const [id, photos] of Object.entries(toClusterize)) {
        // TODO adapt params to the period
        const reachs = reachabilities(photos, spatioTemporalScaled, params)
        const clusters = gradientClustering(photos, reachs, params)
        if (clusters.length > 0) {
          const ids = id.split(':')
          const albumsToSave = findAlbumsByIds(albums, ids)
          return [clusters, albumsToSave]
        }
      }
    }
  } else {
    // No album found: this is an initialization
    const reachs = reachabilities(dataset, spatioTemporalScaled, params)
    const clusters = gradientClustering(dataset, reachs, params)
    return [clusters]
  }
  return []
}

/**
* Compute the distance bewteen adjacents points in the dataset.
* This is a very simplified version of the OPTICS [1] algorithm, taking
* advantage of the temporal property for our context (all points are already
* sorted by time).
* The reachabilites are used later to determine how to clusterize the points.

* [1] Ankerst, M., Breunig, M. M., Kriegel, H. P., & Sander, J. (1999, June).
* OPTICS: ordering points to identify the clustering structure.
* In ACM Sigmod record (Vol. 28, No. 2, pp. 49-60). ACM.
*/
export const reachabilities = (dataset, metric, params) => {
  const reachabilities = [Number.MAX_VALUE]
  for (let i = 1; i < dataset.length; i++) {
    const point1 = dataset[i - 1]
    const point2 = dataset[i]
    const dist = metric(point1, point2, params.epsTemporal, params.epsSpatial)
    reachabilities.push(dist)
  }
  return reachabilities
}

export const computeEpsTemporal = (dataset, percentile) => {
  const epsTemporal = computeEps(dataset, temporal, ['timestamp'], percentile)
  return epsTemporal >= MIN_EPS_TEMPORAL ? epsTemporal : MIN_EPS_TEMPORAL
}

export const computeEpsSpatial = (dataset, percentile) => {
  const epsSpatial = computeEps(dataset, spatial, ['lat', 'lon'], percentile)
  return epsSpatial >= MIN_EPS_SPATIAL ? epsSpatial : MIN_EPS_SPATIAL
}

/**
 *  Compute the eps parameter for the given dataset, based on the idea described
 *  in [1]. Basically it consists of computing the k-nearest-neighbors (knn) for
 *  each point, and finding the optimal point on the sorted data, i.e. the first
 *  one making a significative slope.
 *
 *  [1] Ester, M., Kriegel, H. P., Sander, J., & Xu, X. (1996, August).
 *  A density-based algorithm for discovering clusters in large spatial databases with noise.
 *  In Kdd (Vol. 96, No. 34, pp. 226-231).
 */
const computeEps = (dataset, metric, dimensions, percentile) => {
  // Compute the k-nearest neighbors on the data
  const knn = new KNN(dataset, metric, dimensions)
  const neighbors = knn.kNeighbors(dataset)

  // Extract the sorted distances and remove outliers
  const distances = neighbors.map(n => n.distance).sort((a, b) => a - b)
  knn.excludeOutliers(distances, percentile)

  // Compute the optimal eps for the given criterion
  return knn.epsSignificativeSlope(distances)
}
