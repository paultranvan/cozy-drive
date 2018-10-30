import { QueryDefinition, HasMany } from 'cozy-client'

class HasManyAlbums extends HasMany {

  get data() {
    const refs = this.target.relationships.referenced_by.data
    const albums = refs
      ? refs.map(ref => this.get(ref.type, ref.id)).filter(Boolean)
      : []
    return albums
  }

  static query(doc, client, assoc) {
    if (
      !doc['relationships'] ||
      !doc['relationships']['referenced_by'] ||
      !doc['relationships']['referenced_by']['data']) {
      return null
    }
    const included = doc['relationships']['referenced_by']['data']
    const ids = included
      .filter(inc => inc.type === assoc.doctype)
      .map(inc => inc.id)

    return new QueryDefinition({ doctype: assoc.doctype, ids })
  }
}

export default {
  albums: {
    doctype: 'io.cozy.photos.albums',
    attributes: {
      name: {
        type: 'string',
        unique: true
      }
    },
    relationships: {
      photos: {
        type: 'has-many',
        doctype: 'io.cozy.files'
      }
    }
  },
  files: {
    doctype: 'io.cozy.files',
    relationships: {
      albums: {
        type: HasManyAlbums,
        doctype: 'io.cozy.photos.albums'
      }
    }
  }
}
