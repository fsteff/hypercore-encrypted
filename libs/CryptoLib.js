const CryptoBook = require('./CryptoBook')
const Buffer = require('buffer').Buffer

class CryptoLib {
  constructor () {
    if (global.__CryptoLibSingleton) {
      console.error('CryptoLib is a singleton - use CryptoLib.getInstance() instead!')
    }

    this._books = {}
    this._onBookNotFound = []
  }

  static getInstance () {
    return global.__CryptoLibSingleton
  }

  addBook (id, book) {
    if (Buffer.isBuffer(id)) {
      id = id.toString('hex')
    }

    if (this._books[id] && this._books[id] !== book) {
      console.warn('Other CryptoBook with id=[' + id + '] is already in the library - will be overwritten!')
    }
    if (!(book instanceof CryptoBook) && typeof book === 'string') {
      try {
        book = new CryptoBook(book)
      } catch (e) {
        console.error(e)
        return
      }
    }
    this._books[id] = book
  }

  addBooks (books) {
    for (let key in books) {
      if (!books.hasOwnProperty(key)) continue

      this.addBook(key, books[key])
    }
  }

  getBook (id, suppressNotFound) {
    let book = this._books[id]
    if (!book && !suppressNotFound) {
      this._callOnBookNotFound(id)
      // try again
      book = this._books[id]
    }
    return book
  }

  getAllBooks () {
    return this._books
  }

  registerOnBookNotFound (handler) {
    if (!(typeof handler !== 'function')) {
      console.error('OnBookNotFound handler is not a function')
      return
    }
    this._onBookNotFound.push(handler)
  }

  unregisterOnBookNotFound (handler) {
    let idx = this._onBookNotFound.indexOf(handler)
    if (idx >= 0) {
      this._onBookNotFound.splice(idx, 1)
    }
  }

  _callOnBookNotFound (id) {
    this._onBookNotFound.forEach(handler => handler(id))
  }
}

module.exports = CryptoLib

global.__CryptoLibSingleton = new CryptoLib()
