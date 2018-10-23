const MAX_VALUE = Number.MAX_VALUE

const toRadians = angle => {
  return angle * Math.PI / 180
}

const distanceVectors = (rx, ry) => {
  return Math.sqrt(1 + Math.pow(ry - rx, 2))
}

const inflectionIndex = (xR, yR, zR) => {
  const v1 = distanceVectors(xR, yR)
  const v2 = distanceVectors(yR, zR)

  return (-1 + (xR - yR) * (zR - yR)) / (v1 * v2)
}

const gradientDeterminant = (xR, yR, zR) => {
  return yR - xR - (zR - yR)
}

/*
  This avoids the "lonely point" phenomenom, where a single point precedeed and
  followed by MAX_VALUE points will always be clustered with the next point,
  except if it is a MAX_VALUE itself.
*/
const lonelyPoint = (xData, yData, xR, yR, zR) => {
  if (xR === MAX_VALUE && yR < MAX_VALUE && zR === MAX_VALUE) {
    const xDate = new Date(xData.date)
    const yDate = new Date(yData.date)
    /* We impose 2 arbitrary conditions to force a rupture:
        - The 2 events being on 2 distincts days
        - 8 hours or more elapsed
    */
    if (
      xDate.getDate() != yDate.getDate() &&
      yDate.getTime() - xDate.getTime() > 8
    ) {
      return true
    }
  }
  return false
}

/*
  Deals with the special case where 2 points or more are successively far
  away from each other (in the given metric's sense). In that configuration,
  these points are on an increasing slope and the angle between (p1, p2) and
  (p2, p3) is really flat and no cluster boundary is detected.
*/
const increasingSlope = (xR, yR, zR, a) => {
  // End of the reachabilities
  if (zR === undefined) {
    return false
  }

  if (xR < yR && yR < zR) {
    // build a fake point, symmetric of zR wrt axe y = yR
    const zzR = yR + (yR - zR)
    // check if the (xR, yR) . (yR, zzR) angle would have triggered an inflection point
    const fInflection = inflectionIndex(xR, yR, zzR)
    return fInflection > a
  }
  return false
}

/*
  Deals with the special case where 2 points or more are successively far
  away from each other (in the given metric's sense). In that configuration,
  these points are on a decreasing slope and the angle between (p1, p2) and
  (p2, p3) is really flat and no cluster boundary is detected.
  Slightly different from the 'increasing_slope_point' since we do not want
  to consider past points anymore because they are already processed.
*/
const decreasingSlope = (yR, zR, a) => {
  // End of the reachabilities
  if (zR === undefined) {
    return false
  }

  if (yR > zR) {
    // build a fake point, symmetric of zR wrt axe y = yR
    const xR = zR
    // check if the (xR, yR) . (yR, zR) angle would have triggered an inflection point
    const fInflection = inflectionIndex(xR, yR, zR)
    return fInflection > a
  }
  return false
}
const mergeClusters = (clusters, currIndex, nextIndex) => {
  const newCluster = clusters[currIndex]
    .concat(clusters[nextIndex])
    .sort((a, b) => a - b)
  clusters.splice(nextIndex, 1)
  return newCluster
}

const respectOrder = (clusters, curr) => {
  const nextLabel = curr.label + 1

  // No need to evaluate the last cluster
  if (curr.clusterIndex === clusters.length - 1) {
    return true
  }

  // The current element is not the highest in the cluster:
  // the next label should be in the same cluster
  if (curr.label !== Math.max(...curr.cluster)) {
    return curr.cluster.includes(nextLabel)
  }
  // The next element should be in the next cluster, whatever the position
  return clusters[curr.clusterIndex + 1].includes(nextLabel)
}

/*
  The order in the clusters w.r.t. the data might not be respected as we try
  to group data with non-ordered attributes, such as GPS. Thus, we re-order the
  clusters and try to merge non-ordered clusters.
*/
// TODO test me on real data wit GPS
const reorganizeClusters = clusters => {
  for (let i = 0; i < clusters.length - 1; i++) {
    for (let j = 0; j < clusters[i].length; j++) {
      const curr = {
        label: clusters[i][j],
        labelIndex: j,
        cluster: clusters[i],
        clusterIndex: i
      }
      if (!respectOrder(clusters, curr)) {
        clusters[i] = mergeClusters(clusters, i, i + 1)
      }
    }
  }
  return clusters
}

const clusterizeData = (data, clusters) => {
  const newClusters = reorganizeClusters(clusters)

  let cpt = 0
  const results = newClusters.map(clu => {
    return clu.map(c => {
      return data[cpt++]
    })
  })
  return results
}

/*
  Extracts clusters from the reachability diagram by using the gradient method.

    Loosely inspired by the gradient method defined below.

    Source paper: Brecheisen, S., Kriegel, H.P., Kroger, P. and Pfeifle, M., 2004, April.
        Visually Mining through Cluster Hierarchies. In SDM (pp. 400-411).

    Arguments:
        data:
        reach_list: [ndarray] 1D numpy array containing reachability distance values of individual data points
        t: [float] angle of minimum inflection index in the inflection point, values in the range 120-160 deg
            should work fine (see source paper for more information)

    Return:
        set_of_clusters: [list] a list of found clusters
            - note: individual cluster is just a list of point indices belonging to a specific cluster
*/
export const gradientClustering = (data, optics, angle, maxBound) => {
  let reachabilities = optics.reachabilities
  const ordering = optics.ordering

  // Replace undefined by MAX_VALUE
  reachabilities = reachabilities.map(r => (r === undefined ? MAX_VALUE : r))

  let clusters = []
  let curr_cluster = [0]

  for (let i = 1; i < reachabilities.length - 1; i++) {
    const prevR = reachabilities[i - 1]
    const currR = reachabilities[i]
    const nextR = reachabilities[i + 1]

    // Special case where the current point is a noise:
    // save the current cluster and start a new
    if (currR > maxBound) {
      if (curr_cluster.length > 0) {
        clusters.push(curr_cluster)
      }
      curr_cluster = [ordering[i]]

      // The next point is also a noise: the current point is a single cluster
      if (nextR > maxBound) {
        clusters.push(curr_cluster)
        curr_cluster = []
      }
      // No need to continue the processing here
      continue
    }

    // Special conditions: if any of them is satisfied, save current cluster
    const lonelyPt = lonelyPoint(data[i - 1], data[i], prevR, currR, nextR)
    const incrSlope = increasingSlope(prevR, currR, nextR, angle)
    const decrSlope = decreasingSlope(currR, nextR, angle)

    if (lonelyPt || incrSlope || decrSlope) {
      clusters.push(curr_cluster)
      curr_cluster = []
    }

    // The current point is an inflection point
    if (inflectionIndex(prevR, currR, nextR) > angle) {
      // The next vector deviates to the left, marking an endpoint
      if (gradientDeterminant(prevR, currR, nextR) < 0) {
        curr_cluster.push(ordering[i])
        const diff = nextR - currR
        // If the reachability of the next point is higher, it is a new cluster
        if (diff > 0) {
          clusters.push(curr_cluster)
          curr_cluster = []
        }
      } else {
        // The next vector deviates to the right:
        if (curr_cluster.length > 0) {
          clusters.push(curr_cluster)
        }
        curr_cluster = [ordering[i]]
      }
    } else {
      // The current point is not an inflection: just add it to the current cluster
      curr_cluster.push(ordering[i])
    }
  }

  const lastPt = reachabilities[reachabilities.length - 1]
  const lastOrd = ordering[ordering.length - 1]
  // The last point is not noise: add it to the current cluster if not empty
  if (curr_cluster.length > 0 && lastPt < maxBound) {
    curr_cluster.push(lastOrd)
    clusters.push(curr_cluster)
  } else {
    // The last point is a single cluster
    if (curr_cluster.length > 0) {
      clusters.push(curr_cluster)
    }
    clusters.push([lastOrd])
  }
  return clusterizeData(data, clusters)
}

/* Compute the gradient angle based on the eps and a k multiplicator coefficient */
export const gradientAngle = (eps, k) => {
  if (k === undefined) {
    k = 1
  }
  return Math.cos(2 * Math.atan(1 / (eps * k)))
}
