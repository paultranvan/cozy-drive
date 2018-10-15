import {
  computeTemporalEps,
  computeSpatialEps,
  computeSpatioTemporalScaledEps,
  runOptics
} from './services'
import Metrics from './metrics'

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

describe('knn', () => {
  it('Should compute temporal eps', () => {
    expect(computeTemporalEps(dataset, metric)).toBeCloseTo(3.0, N_DIGITS)
  })
  it('Should compute spatial eps', () => {
    expect(computeSpatialEps(dataset, metric)).toBeCloseTo(386.7568, N_DIGITS)
  })
  it('Should compute spatio temporal scaled eps', () => {
    console.log('metric : ', metric)
    expect(computeSpatioTemporalScaledEps(dataset, metric)).toBeCloseTo(
      10.2669,
      N_DIGITS
    )
  })
})

describe('optics', () => {
  it('Should compute reachabilities with temporal metric', () => {
    const expected = [[0, undefined], [1, 2], [2, 3], [3, 45], [4, 20], [5, 30]]
    expect(runOptics(dataset, 1000, metric.temporal)).toEqual(
      expect.arrayContaining(expected)
    )
  })
  it('Should compute reachabilities with spatial metric', () => {
    const expected = [
      [0, undefined],
      [1, 11.119492664455889],
      [4, 244.9352126291911],
      [3, 68.80809741870237],
      [2, 386.7568104542303],
      [5, undefined]
    ]
    expect(runOptics(dataset, 1000, metric.spatial)).toEqual(
      expect.arrayContaining(expected)
    )
  })
  it('Should compute reachabilities with temporal metric', () => {
    const expected = [
      [0, undefined],
      [1, 1.0431259089583833],
      [2, 3.0571814094974092],
      [3, 24],
      [4, 10.266865749582626],
      [5, 25.831530037137995]
    ]
    expect(runOptics(dataset, 1000, metric.spatioTemporalScaled)).toEqual(
      expect.arrayContaining(expected)
    )
  })
})
