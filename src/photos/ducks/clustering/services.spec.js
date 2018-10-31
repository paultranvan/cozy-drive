import {
  computeTemporalEps,
  computeSpatialEps,
  computeSpatioTemporalScaledEps,
  computeSpatioTemporalMaxNormalizedEps,
  runOptics
} from './services'
import Metrics from './metrics'
import { gradientClustering, gradientInflection } from './gradient'
import { quantile, mean, standardDeviation } from './maths'

const N_DIGITS = 4
const dataset = [
  {
    date: 10,
    lat: 41.1,
    lon: 0.2
  },
  {
    date: 12,
    lat: 41.2,
    lon: 0.2
  },
  {
    date: 15,
    lat: 44.5,
    lon: 2.2
  },
  {
    date: 60,
    lat: 41.1,
    lon: 3.2
  },
  {
    date: 80,
    lat: 40.5,
    lon: 3.0
  },
  {
    date: 110,
    lat: 20,
    lon: 20
  }
]

const metric = new Metrics()
const eps = 1000

describe('maths', () => {
  let random_data = [
    -1.56963766,
    0.77667398,
    1.1107855,
    -0.12783372,
    -0.83557117,
    -0.48297551,
    -1.89519756,
    1.55576088,
    -0.82488814,
    -0.23281369,
    -0.54799257,
    0.05951311,
    0.58379171,
    -0.69129147,
    0.04765197
  ]
  it('Should compute the right mean', () => {
    expect(mean(random_data)).toBeCloseTo(-0.2049, N_DIGITS)
  })
  it('Should compute the right standard deviation', () => {
    expect(standardDeviation(random_data)).toBeCloseTo(0.9125, N_DIGITS)
  })
  it('Should compute the right quantiles', () => {
    expect(quantile(random_data, 5)).toBeCloseTo(-1.6673, N_DIGITS)
    expect(quantile(random_data, 25)).toBeCloseTo(-0.7581, N_DIGITS)
    expect(quantile(random_data, 42)).toBeCloseTo(-0.4908, N_DIGITS)
    expect(quantile(random_data, 50)).toBeCloseTo(-0.2328, N_DIGITS)
  })
})

describe('knn', () => {
  it('Should compute temporal eps', () => {
    expect(computeTemporalEps(dataset, metric)).toBeCloseTo(3.0, N_DIGITS)
  })
  it('Should compute spatial eps', () => {
    expect(computeSpatialEps(dataset, metric)).toBeCloseTo(386.7568, N_DIGITS)
  })
  it('Should compute spatio temporal scaled eps', () => {
    expect(computeSpatioTemporalScaledEps(dataset, metric)).toBeCloseTo(
      10.2669,
      N_DIGITS
    )
  })
  it('Should compute spatio temporal max normalized eps', () => {
    expect(computeSpatioTemporalMaxNormalizedEps(dataset, metric)).toBeCloseTo(
      1.0381,
      N_DIGITS
    )
  })
})

describe('optics', () => {
  it('Should cluster data with temporal metric', () => {
    const expectedOrder = [0, 1, 2, 3, 4, 5]
    const expectedReach = [undefined, 2, 3, 45, 20, 30]
    const expectedClusters = [
      [dataset[0], dataset[1], dataset[2]],
      [dataset[3], dataset[4], dataset[5]]
    ]

    const optics = runOptics(dataset, eps, metric.temporal)
    expect(optics.ordering).toEqual(expect.arrayContaining(expectedOrder))
    expect(optics.reachabilities).toEqual(expect.arrayContaining(expectedReach))
    const cosAngle = gradientInflection(15, 1)
    const clustering = gradientClustering(dataset, optics, cosAngle, eps)
    expect(clustering).toEqual(expect.arrayContaining(expectedClusters))
  })

  it('Should cluster data with spatial metric', () => {
    const expectedOrder = [0, 1, 4, 3, 2, 5]
    const expectedReach = [
      undefined,
      11.119492664456596,
      386.7568104542309,
      68.80809741870237,
      244.93521262919106,
      undefined
    ]
    const expectedClusters = [
      [dataset[0], dataset[1], dataset[2], dataset[3], dataset[4]],
      [dataset[5]]
    ]

    const optics = runOptics(dataset, eps, metric.spatial)
    expect(optics.ordering).toEqual(expect.arrayContaining(expectedOrder))
    expect(optics.reachabilities).toEqual(expect.arrayContaining(expectedReach))
    const cosAngle = gradientInflection(15, 1)
    const clustering = gradientClustering(dataset, optics, cosAngle, eps)
    expect(clustering).toEqual(expect.arrayContaining(expectedClusters))
  })

  it('Should cluster data with spatio temporal scaled metric', () => {
    const expectedOrder = [0, 1, 2, 3, 4, 5]
    const expectedReach = [
      undefined,
      1.043125908958386,
      3.057181409497407,
      24,
      10.266865749582625,
      25.831530037137977
    ]
    const expectedClusters = [
      [dataset[0], dataset[1], dataset[2]],
      [dataset[3], dataset[4], dataset[5]]
    ]

    const optics = runOptics(dataset, eps, metric.spatioTemporalScaled)
    expect(optics.ordering).toEqual(expect.arrayContaining(expectedOrder))
    expect(optics.reachabilities).toEqual(expect.arrayContaining(expectedReach))
    const cosAngle = gradientInflection(15, 1)
    const clustering = gradientClustering(dataset, optics, cosAngle, eps)
    expect(clustering).toEqual(expect.arrayContaining(expectedClusters))
  })
})
