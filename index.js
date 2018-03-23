const hypercore = require('hypercore')
const inherits = require('inherits')
const bulk = require('bulk-write-stream')
const Buffer = require('buffer').Buffer

const CryptoBook = require('./libs/CryptoBook')

module.exports = Feed

function Feed (createStorage, key, opts) {
  if (!(this instanceof Feed)) return new Feed(createStorage, key, opts)

  this.encoding = opts.valueEncoding || 'binary'

  if (typeof opts.encryptionKeyBook === 'string') {
    // if string try to deserialize (throws an error if it fails!)
    opts.encryptionKeyBook = new CryptoBook(opts.encryptionKeyBook)
  }

  if (opts.encryptionKeyBook instanceof CryptoBook) {
    this.cryptoKeyBook = opts.encryptionKeyBook
    // encrypted data is always binary
    opts.valueEncoding = 'binary'
  } else {
    this.cryptoKeyBook = null
  }

  hypercore.call(this, createStorage, key, opts)

  this._byteLengthOffset = 0
  this.on('append', () => {
    this._byteLengthOffset = 0
  })
}

inherits(Feed, hypercore)

const oldAppend = Feed.prototype.append
Feed.prototype.append = function (batch, cb) {
  if (typeof cb !== 'function') cb = throwErr
  if (!Array.isArray(batch)) batch = [batch]
  const self = this
  this._ready((err) => {
    if (err) return cb(err)

    if (self.cryptoKeyBook) {
      batch = self._toBinary(batch)
      batch = self._encrypt(batch, self.byteLength + self._byteLengthOffset)
    }

    oldAppend.call(self, batch, cb)
  })
}

Feed.prototype.createWriteStream = function () {
  var self = this
  if (this.cryptoKeyBook) {
    return bulk.obj(writeEncr)
  } else {
    return bulk.obj(write)
  }
  function write (batch, cb) {
    self._batch(batch, cb)
  }
  function writeEncr (batch, cb) {
    self.append(batch, cb)
  }
}

const oldGet = Feed.prototype.get
Feed.prototype.get = function (index, opts, cb) {
  if (typeof opts === 'function') return this.get(index, null, opts)
  if (!this.opened) return this._readyAndGet(index, opts, cb)
  if (typeof cb !== 'function') cb = throwErr

  const self = this
  if (this.cryptoKeyBook) {
    this._ready((err) => {
      if(err) return cb(err)

      oldGet.call(this, index, opts, (err, data) => {
        if (err) return cb(err)
        this._calcOffset(index, (err, offs) => {
          if (err) return cb(err)

          data = self.cryptoKeyBook.decrypt(data, offs)
          data = self._fromBinary(data)
          cb(null, data)
        })
      })
    })
  } else {
    oldGet.call(this, index, opts, cb)
  }
}

Feed.prototype._toBinary = function (data) {
  var arr = []
  if (!Array.isArray(data)) data = [data]

  for (var i = 0; i < data.length; i++) {
    switch (this.encoding) {
      case 'utf-8':
        arr[i] = Buffer.from(data[i])
        break
      case 'json':
        arr[i] = Buffer.from(JSON.stringify(data[i]))
        break
      case 'binary':
      default:
        arr[i] = Buffer.from(data[i])
    }
  }
  return arr
}

Feed.prototype._fromBinary = function (data) {
  switch (this.encoding) {
    case 'utf-8': return Buffer.from(data).toString('utf-8')
    case 'json': return JSON.parse(Buffer.from(data).toString('utf-8'))
    case 'binary':
    default: return Buffer.from(data)
  }
}
const noarr = []
Feed.prototype._calcOffset = function (index, cb) {
  this._storage.dataOffset(index, noarr, cb)
}

Feed.prototype._encrypt = function (arr, offset) {
  if (!Array.isArray(arr)) arr = [arr]

  if (this.cryptoKeyBook.entries.length === 0) {
    this.newEncryptionKey()
  }

  var ret = new Array(arr.length)
  for (var i = 0; i < arr.length; i++) {
    ret[i] = this.cryptoKeyBook.encrypt(arr[i], offset)
    offset += arr[i].length
  }
  this._byteLengthOffset += offset

  return ret
}

Feed.prototype.newEncryptionKey = function (cb) {
  const self = this
  if (typeof cb !== 'function') cb = throwErr

  this._ready((err) => {
    if (err) cb(err)

    self.cryptoKeyBook.generateNewKey(self.byteLength + self._byteLengthOffset)
    cb(null)
  })
}

Feed.prototype.serializeCryptoKeyBook = function (cb) {
  const self = this
  if (typeof cb !== 'function') cb = throwErr

  this._ready((err) => {
    if (err) cb(err)

    cb(null, self.cryptoKeyBook.serialize())
  })
}

function throwErr (err) {
  if (err) throw err
}
