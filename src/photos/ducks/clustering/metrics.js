export default class Metrics {
  constructor() {
    // TODO not possible to declare class var in ES6... Do we need a const file ?
    const MIN_TEMPORAL_EPS = 3
    const MIN_SPATIAL_EPS = 3
    const MIN_EPS = 1

    this.epsTemporal = MIN_TEMPORAL_EPS
    this.epsSpatial = MIN_SPATIAL_EPS
    this.eps = MIN_EPS

    this.temporal = this.temporal.bind(this)
    this.spatial = this.spatial.bind(this)
    this.spatioTemporal = this.spatioTemporal.bind(this)
    this.spatioTemporalScaled = this.spatioTemporalScaled.bind(this)
  }

  spatial(p1, p2) {
    return geodesicDistance(p1, p2)
  }

  temporal(p1, p2) {
    return Math.abs(p1.date - p2.date)
  }

  spatioTemporal(p1, p2) {
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
}

const geodesicDistance = (x1, x2) => {
  // Convert to radians
  const lon1 = x1.lon * (Math.PI / 180)
  const lat1 = x1.lat * (Math.PI / 180)

  const lon2 = x2.lon * (Math.PI / 180)
  const lat2 = x2.lat * (Math.PI / 180)

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
