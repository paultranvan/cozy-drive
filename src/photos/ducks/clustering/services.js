import { OPTICS } from 'density-clustering'
import KNN from './knn/knn'

export const runOptics = (dataset, eps, metric) => {
  const optics = new OPTICS()
  const clusters = optics.run(dataset, eps, 1, metric)
  const plot = optics.getReachabilityPlot()
  const ordering = plot.map(p => p[0])
  const reachabilities = plot.map((p, i, plot) => plot[ordering[i]][1])
  const result = {
    ordering: ordering,
    reachabilities: reachabilities
  }
  return result
}

export const computeTemporalEps = (dataset, metric, percentile) => {
  metric.epsTemporal = computeEps(
    dataset,
    ['date'],
    metric.temporal,
    percentile
  )
  return metric.epsTemporal
}

export const computeSpatialEps = (dataset, metric, percentile) => {
  metric.epsSpatial = computeEps(
    dataset,
    ['lat', 'lon'],
    metric.spatial,
    percentile
  )
  return metric.epsSpatial
}

export const computeSpatioTemporalScaledEps = (dataset, metric, percentile) => {
  let eps = 0
  if (metric.epsTemporal !== undefined && metric.epsSpatial !== undefined) {
    eps = computeEps(
      dataset,
      ['date', 'lat', 'lon'],
      metric.spatioTemporalScaled,
      percentile
    )
  } else {
    eps = computeEps(
      dataset,
      ['date', 'lat', 'lon'],
      metric.spatioTemporal,
      percentile
    )
  }
  metric.eps = eps
  return eps
}

export const computeSpatioTemporalMaxNormalizedEps = (
  dataset,
  metric,
  percentile
) => {
  let eps = 0
  if (metric.epsTemporal !== undefined && metric.epsSpatial !== undefined) {
    eps = computeEps(
      dataset,
      ['date', 'lat', 'lon'],
      metric.spatioTemporalMaxNormalized,
      percentile
    )
  } else {
    eps = computeEps(
      dataset,
      ['date', 'lat', 'lon'],
      metric.spatioTemporal,
      percentile
    )
  }
  metric.eps = eps
  return eps
}

const computeEps = (dataset, dimensions, metric, percentile) => {
  // Compute the k-nearest neighbors on the data
  const knn = new KNN(dataset, metric, dimensions)
  const neighbors = knn.kNeighbors(dataset)

  // Extract the sorted distances and remove outliers
  let distances = neighbors.map(n => n.distance).sort((a, b) => a - b)
  distances = knn.excludeOutliers(distances, percentile)
  //console.log('distances : ', JSON.stringify(distances))

  // Compute the optimal eps for the given criterion
  const epsSlope = knn.epsSignificativeSlope(distances)
  const epsCurv = knn.epsMaxCurvative(distances)

  console.log('eps : ', epsSlope)

  //console.log('eps slope : ', epsSlope)
  //console.log('eps curv : ', epsCurv)

  //return (epsSlope + epsCurv) / 2
  return epsSlope
}

/*export async const createAutoAlbums = (clusters) => {

}*/
