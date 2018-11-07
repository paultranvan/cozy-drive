import React from 'react'
import { Query } from 'cozy-client'
import Timeline from './components/Timeline'
import PhotoBoard from '../../components/PhotoBoard'
import { getReferencedAutoAlbum } from '../albums/index'
import { AUTO_ALBUMS_QUERY } from '../albums/index'

// constants
const TIMELINE = 'timeline'
const FILES_DOCTYPE = 'io.cozy.files'

const TIMELINE_QUERY = client =>
  client
    .find(FILES_DOCTYPE)
    .where({
      class: 'image',
      trashed: false
    })
    .select(['dir_id', 'name', 'size', 'updated_at', 'metadata'])
    .sortBy({
      'metadata.datetime': 'desc'
    })
    .include(['albums'])

const TIMELINE_MUTATIONS = query => ({
  uploadPhoto: (file, dirPath) => {
    return query.client.upload(file, dirPath, {
      updateQueries: {
        [TIMELINE]: (previousData, result) => [result.data, ...previousData]
      }
    })
  },
  deletePhoto: photo =>
    query.client.destroy(photo, {
      updateQueries: {
        [TIMELINE]: (previousData, result) =>
          previousData.filter(p => p._id !== result.data.id)
      }
    })
})

const sectionTitle = album => {
  if (album.period) {
    const startDate = new Date(album.period.start)
    const endDate = new Date(album.period.end)
    const diffHours = (endDate.getTime() - startDate.getTime()) * 1000 * 3600
    if (startDate.getDate() !== endDate.getDate() && diffHours > 24) {
      return (
        album.period.start.slice(0, 10) + ' - ' + album.period.end.slice(0, 10)
      )
    }
  }
  return null
}

const photosByQueryAutoAlbums = albums => {
  // TODO the query is already sorted, but it doesn't handle new additions
  return albums.map(album => {
    const title = sectionTitle(album)
    console.log('title : ', title)
    console.log('photos : ', album.photos.data)

    const photos = album.photos.data
      .sort((pa, pb) => {
        const dateA =
          pa.metadata && pa.metadata.datetime
            ? pa.metadata.datetime
            : Date.now()
        const dateB =
          pb.metadata && pb.metadata.datetime
            ? pb.metadata.datetime
            : Date.now()

        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })
      .reverse()

    return {
      title: title,
      photos: photos,
      date: album.name
    }
  })
}

const photosByQueryFiles = photos => {
  const sections = {}

  photos.forEach(p => {
    const refAlbums = p.albums ? p.albums.data : null
    console.log('refs for photo : ', refAlbums)

    const refAlbum = refAlbums ? refAlbums.find(ref => ref.auto) || null : null
    console.log('ref album : ', refAlbum)
    const section = {}

    // The photo is referenced by an album already processed: add the photo
    if (refAlbum) {
      section.title = sectionTitle(refAlbum)
      section.date = refAlbum.name.slice(0, 10)
    } else {
      const datetime =
        p.metadata && p.metadata.datetime ? p.metadata.datetime : Date.now()
      const day = datetime.slice(0, 10)
      section.date = day
    }

    if (!sections.hasOwnProperty(section.date)) {
      sections[section.date] = { title: section.title, photos: [] }
    }
    sections[section.date].photos.push(p)
  })

  console.log('sections : ', JSON.stringify(sections))

  const sorted = Object.keys(sections)
  sorted.sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).reverse()

  return sorted.map(date => {
    console.log('date in sorted : ', date)
    return {
      title: sections[date].title,
      photos: sections[date].photos,
      date: date
    }
  })
}

const getPhotosByAutoAlbums = (albums, photos) => {
  let sections = {}
  console.log('albums : ', albums)
  photos.forEach(p => {
    console.log('photo : ', p)
    const refAlbum = getReferencedAutoAlbum(albums, p)
    console.log('ref album : ', refAlbum)
    const album = {}
    if (refAlbum) {
      //section[refAlbum.name].push(p)
      const startDate = new Date(refAlbum.period.start)
      const endDate = new Date(refAlbum.period.end)
      const diffHours = (endDate.getTime() - startDate.getTime()) * 1000 * 3600

      if (startDate.getDate() !== endDate.getDate() && diffHours > 24) {
        album.period =
          refAlbum.period.start.slice(0, 10) +
          ' - ' +
          refAlbum.period.end.slice(0, 10)
      }
      album.date = refAlbum.name
    } else {
      const datetime =
        p.metadata && p.metadata.datetime ? p.metadata.datetime : Date.now()
      // here we want to get an object whose keys are months in a l10able format
      // so we only keep the year and month part of the date
      album.date = datetime.slice(0, 10)
    }
    //console.log('date : ', album.date)

    if (!sections.hasOwnProperty(album.date)) {
      sections[album.date] = { period: album.period, photos: [] }
    }
    sections[album.date].photos.push(p)
  })

  // we need to sort the days here because when new photos are uploaded, they
  // are inserted on top of the list, and days can become unordered
  const sorted = Object.keys(sections)
  console.log('sorted before : ', JSON.stringify(sorted))
  sorted.sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).reverse()

  console.log('sorted : ', JSON.stringify(sorted))

  return sorted.map(date => {
    console.log('date : ', JSON.stringify(date))
    return {
      period: sections[date].period,
      photos: sections[date].photos,
      date: date
    }
  })
}

const getPhotosByDay = photos => {
  let sections = {}
  photos.forEach(p => {
    const datetime =
      p.metadata && p.metadata.datetime ? p.metadata.datetime : Date.now()
    // here we want to get an object whose keys are months in a l10able format
    // so we only keep the year and month part of the date
    const day = datetime.slice(0, 10)
    if (!sections.hasOwnProperty(day)) {
      sections[day] = []
    }
    sections[day].push(p)
  })
  // we need to sort the days here because when new photos are uploaded, they
  // are inserted on top of the list, and days can become unordered
  const sortedDays = Object.keys(sections)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .reverse()

  return sortedDays.map(day => {
    return {
      day,
      photos: sections[day]
    }
  })
}
// eslint-disable-next-line
export default props => (
  <Query query={TIMELINE_QUERY} as={TIMELINE} mutations={TIMELINE_MUTATIONS}>
    {({ data, ...result }, mutations) => (
      /*<Query
        query={TIMELINE_QUERY}
        as={TIMELINE}
        mutations={TIMELINE_MUTATIONS}
      >
        {({ data, ...result }, mutations) => (
        */
      //{...mutations}
      <Timeline
        lists={data ? photosByQueryFiles(data) : []}
        data={data}
        {...mutations}
        {...result}
        {...props}
      />
      /*)}
      </Query>*/
    )}
  </Query>
)
