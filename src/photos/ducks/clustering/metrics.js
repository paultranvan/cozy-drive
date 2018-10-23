import { toRadians } from './maths'

export default class Metrics {
  constructor() {
    // TODO not possible to declare class var in ES6... Do we need a const file ?
    const MIN_TEMPORAL_EPS = 3
    const MIN_SPATIAL_EPS = 3
    const MIN_EPS = 1

    this.eps = MIN_EPS

    this.temporal = this.temporal.bind(this)
    this.spatial = this.spatial.bind(this)
    this.spatioTemporal = this.spatioTemporal.bind(this)
    this.spatioTemporalScaled = this.spatioTemporalScaled.bind(this)
    this.spatioTemporalMaxNormalized = this.spatioTemporalMaxNormalized.bind(
      this
    )
  }

  spatial(p1, p2) {
    return geodesicDistance(p1, p2)
  }

  temporal(p1, p2) {
    return Math.abs(p1.date - p2.date)
  }

  spatioTemporal(p1, p2) {
    /*
      Function giving a mix-metric for spatio temporal data
    */
    return 0.5 * this.temporal(p1, p2) + 0.5 * this.spatial(p1, p2)
  }

  spatioTemporalScaled(p1, p2) {
    /*
      Function giving a 'temporal equivalent' metric using both pure temporal
      and spatial distance by converting the spatial distance into a temporal
      equivalent distance. The conversion is done by using the caracteristic
      time and distance of the user.
    */
    const r = this.epsTemporal / this.epsSpatial
    return (this.temporal(p1, p2) + this.spatial(p1, p2) * r) / 2
  }

  spatioTemporalMaxNormalized(p1, p2) {
    /*
      Function giving the max between the normalized spatial and normalized
      temporal distance. It can thus adapt to use case where GPS coords are
      not available
    */
    const temporalNorm = this.temporal(p1, p2) / this.epsTemporal
    const spatialNorm = this.spatial(p1, p2) / this.epsSpatial
    return Math.max(temporalNorm, spatialNorm)
  }
}

const geodesicDistance = (x1, x2) => {
  // Convert to radians
  const lon1 = toRadians(x1.lon)
  const lat1 = toRadians(x1.lat)

  const lon2 = toRadians(x2.lon)
  const lat2 = toRadians(x2.lat)

  const dlon = lon2 - lon1
  const dlat = lat2 - lat1

  const a1 = Math.pow(Math.sin(dlat / 2), 2)
  const a2 = Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon / 2), 2)
  const a = a1 + a2
  const c = 2 * Math.asin(Math.sqrt(a))

  // Radius of earth is 6371 km
  const dist = 6371 * c
  return dist
}
