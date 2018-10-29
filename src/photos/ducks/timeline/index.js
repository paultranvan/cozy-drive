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
    .select([
      'dir_id',
      'name',
      'size',
      'updated_at',
      'metadata',
      'relationships'
    ])
    .sortBy({
      'metadata.datetime': 'desc'
    })

const TIMELINE_MUTATIONS = (query, ownProps) => ({
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
  const startDate = new Date(album.period.start)
  const endDate = new Date(album.period.end)
  const diffHours = (endDate.getTime() - startDate.getTime()) * 1000 * 3600
  if (startDate.getDate() !== endDate.getDate() && diffHours > 24) {
    return (
      album.period.start.slice(0, 10) + ' - ' + album.period.end.slice(0, 10)
    )
  }
  return null
}

const photosByQueryAutoAlbums = albums => {
  // TODO the query is already sorted, but it doesn't handle new additions
  return albums.map(album => {
    const title = sectionTitle(album)
    console.log('title : ', title)

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
/*
const getReferenced = (photo) => {
  if (
    photo.relationships &&
    photo.relationships.referenced_by &&
    photo.relationships.referenced_by.data &&
    photo.relationships.referenced_by.data.length > 0
  ) {
    const refs = photo.relationships.referenced_by.data
    return refs.filter(ref => ref.type === DOCTYPE)
  }
  return []
}

const photosByQueryFiles = (photos) => {
  const sections = {}
  const albums = {}
  photos.forEach(p => {
    const refs = getReferenced(p)
    const a = refs.find(r => albums[r.id])
    // An album has already been processed
    if (a) {

    }
  }
}
*/

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
      console.log(
        'diff hours between ',
        startDate,
        ' and ',
        endDate,
        ' : ',
        diffHours
      )
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

export default props => (
  <Query query={AUTO_ALBUMS_QUERY}>
    {({ data: data, ...result }) => (
      /*<Query
        query={TIMELINE_QUERY}
        as={TIMELINE}
        mutations={TIMELINE_MUTATIONS}
      >
        {({ data, ...result }, mutations) => (
        */
      //{...mutations}
      <Timeline
        lists={data ? photosByQueryAutoAlbums(data) : []}
        data={data}
        {...result}
        {...props}
      />
      /*)}
      </Query>*/
    )}
  </Query>
)

export const TimelineBoard = ({ selection, ...props }) => (
  <Query query={ALBUMS_QUERY}>
    {({ data: albumsData, ...result }) => (
      <Query query={TIMELINE_QUERY}>
        {({ data, ...result }) => (
          <PhotoBoard
            lists={data ? fakeFunction(albumsData, data) : []}
            photosContext="timeline"
            onPhotoToggle={selection.toggle}
            onPhotosSelect={selection.select}
            onPhotosUnselect={selection.unselect}
            {...result}
            {...props}
          />
        )}
      </Query>
    )}
  </Query>
)
