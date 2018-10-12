import { computeTemporalEps, computeSpatialEps } from './services'
import Metrics from './metrics'

describe('knn', () => {
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

  it('Should compute temporal eps', () => {
    expect(computeTemporalEps(dataset, metric)).toBeCloseTo(3.0, N_DIGITS)
  })
  it('Should compute spatial eps', () => {
    expect(computeSpatialEps(dataset, metric)).toBeCloseTo(386.7568, N_DIGITS)
  })
})
