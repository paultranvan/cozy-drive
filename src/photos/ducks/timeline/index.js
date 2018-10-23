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

const getPhotosByAutoAlbums = (albums, photos) => {
  let sections = {}
  photos.forEach(p => {
    const refAlbum = getReferencedAutoAlbum(albums, p)
    console.log('ref album : ', refAlbum)
    let date = ''
    if (refAlbum) {
      //section[refAlbum.name].push(p)
      date = refAlbum.name
    } else {
      const datetime =
        p.metadata && p.metadata.datetime ? p.metadata.datetime : Date.now()
      // here we want to get an object whose keys are months in a l10able format
      // so we only keep the year and month part of the date
      date = datetime.slice(0, 10)
    }

    if (!sections.hasOwnProperty(date)) {
      sections[date] = []
    }
    sections[date].push(p)
  })
  // we need to sort the days here because when new photos are uploaded, they
  // are inserted on top of the list, and days can become unordered
  const sorted = Object.keys(sections)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .reverse()

  return sorted.map(date => {
    return {
      title: date,
      photos: sections[date]
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
  <Query query={AUTO_ALBUMS_QUERY}>
    {({ data: albumsData, ...result }) => (
      <Query
        query={TIMELINE_QUERY}
        as={TIMELINE}
        mutations={TIMELINE_MUTATIONS}
      >
        {({ data, ...result }, mutations) => (
          <Timeline
            lists={data ? getPhotosByAutoAlbums(albumsData, data) : []}
            data={data}
            albums={albumsData}
            {...mutations}
            {...result}
            {...props}
          />
        )}
      </Query>
    )}
  </Query>
)

export const TimelineBoard = ({ selection, ...props }) => (
  <Query query={ALBUMS_QUERY}>
    {({ data: albumsData, ...result }) => (
      <Query query={TIMELINE_QUERY}>
        {({ data, ...result }) => (
          <PhotoBoard
            lists={data ? getPhotosByAutoAlbums(albumsData, data) : []}
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
