import { kdTree } from './kdTree'
import { diffPairWise, standardDeviation, mean, quantile } from '../maths'

export default class KNN {
  /**
   * @param {Array} dataset
   * @param {function} metric - Metric to compute the distance
   * @param {Array} dimensions - Dimensions to consider in the dataset
   */
  constructor(dataset, metric, dimensions) {
    this.points = dataset.slice()
    this.kdTree = new kdTree(this.points, metric, dimensions)
    this.ns = 2
  }

  kNeighbors() {
    const neighbors = []
    for (let i = 0; i < this.points.length; i++) {
      const nearestPoints = this.kdTree.nearest(this.points[i], this.ns)
      const point = nearestPoints[0][0]
      const distance = nearestPoints[0][1]
      neighbors.push({ point, distance })
    }

    return neighbors
  }

  excludeOutliers(distances, percentile) {
    const q = quantile(distances, percentile)
    return distances.filter(distance => distance <= q)
  }

  epsSignificativeSlope(distances) {
    /*
    Find  optimal epsilon with the first significative slope as proposed in [1]

    [1] OZKOK, Fatma Ozge et CELIK, Mete. A New Approach to Determine Eps
    Parameter of DBSCAN Algorithm. International Journal of Intelligent Systems
    and Applications in Engineering, 2017, vol. 5, no 4, p. 247-251.
    */

    if (distances.length < 3) {
      return null
    }

    const slopes = distances.map((d, i, arr) => arr[i + 1] - arr[i])
    slopes.pop()
    const slopesNotZero = slopes.filter(diff => diff > 0.0001)

    if (slopesNotZero.length > 0) {
      const avg = mean(slopesNotZero)
      const std = standardDeviation(slopesNotZero, avg)

      const indexSignSlope = slopes.findIndex(slope => {
        return slope >= avg + std
      })
      if (indexSignSlope === -1) {
        return null
      }

      //const eps = distances[distances.length - indexSignSlope - 1]
      const eps = distances[indexSignSlope]
      return eps
    }
    return null
  }

  epsMaxCurvative(distances) {
    /*
    Find  optimal epsilon with the maximal curvative as proposed in [2]

    [2] LUO, Ting, ZHENG, Xinwei, XU, Guangluan, et al. An improved
    DBSCAN algorithm to detect stops in individual trajectories. ISPRS
    International Journal of Geo-Information, 2017, vol. 6, no 3, p. 63.
    */

    if (distances.length < 3) {
      return null
    }

    const diff = diffPairWise(distances).sort((a, b) => b - a)

    let piMinus1_i = diff.slice()
    let piPlus1_i = diffPairWise(distances)
    piMinus1_i.pop()
    piPlus1_i.shift()

    const arctansMinus = piMinus1_i.map(x => Math.atan2(x, -1))
    const arctansPlus = piPlus1_i.map(x => Math.atan2(x, 1))

    const gamma = arctansMinus.map((x, i) => x - arctansPlus[i])

    const normMinusSquare = piMinus1_i.map(x => Math.sqrt(1 + x * x))
    const normPlusSquare = piPlus1_i.map(x => Math.sqrt(1 + x * x))
    const eta = normMinusSquare.map((x, i) => (x + normPlusSquare[i]) / 2)
    const curvative = eta.map((x, i) => (Math.PI - gamma[i]) / x)

    const i = curvative.indexOf(Math.max(...curvative))
    return distances[distances.length - i - 1]
  }
}
