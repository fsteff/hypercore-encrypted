const hypercore = require('hypercore')
const inherits = require('inherits')
const bulk = require('bulk-write-stream')
const Buffer = require('buffer').Buffer

const CryptoBook = require('./libs/CryptoBook')
const CryptoLib = require('./libs/CryptoLib')

module.exports = Feed
Feed.CryptoBook = CryptoBook
Feed.CryptoLib = CryptoLib

/**
 * Extension of hypercore that supports encrpytion
 * Usage is equal to hypercore, see https://github.com/mafintosh/hypercore for details
 *
 * If opts.encryptionKeyBook is set read and write access uses the encryption feature
 *
 * Use newEncryptionKey() to generate a new key that will be used for the next append() call
 *
 * To save the CryptoBook call serializeCryptoKeyBook(), which returns a plain JS object
 *
 * @param {string | function} createStorage storage path or an instance of a random-access-storage variant
 * @param {string} key (optional)
 * @param {object} opts (optional)
 */
function Feed (createStorage, key, opts) {
  if (!(this instanceof Feed)) return new Feed(createStorage, key, opts)

  if (!opts) opts = {}

  // note: internal encoding (of the unerlying hypercore) is always binary
  this.encoding = opts.valueEncoding || 'binary'
  // copy to avoid problems with internal changes
  opts = Object.assign({}, opts)

  const self = this
  if (Buffer.isBuffer(key)) {
    key = key.toString('hex')
  }

  let registerBook = findCryptoBook()

  hypercore.call(this, createStorage, key, opts)

  this._byteLengthOffset = 0
  this.on('append', () => {
    this._byteLengthOffset = 0
  })

  if (registerBook) {
    this.on('ready', () => {
      CryptoLib.getInstance().addBook(self.key.toString('hex'), self.cryptoKeyBook)
    })
  }

  function findCryptoBook () {
    let registerBook = false
    if (typeof opts.encryptionKeyBook === 'undefined' && typeof key === 'string' && !opts.noEncryption) {
      self.cryptoKeyBook = CryptoLib.getInstance().getBook(key)
      if (self.cryptoKeyBook) opts.valueEncoding = 'binary'
      return false
    } else if (typeof opts.encryptionKeyBook === 'string') {
      // if string try to deserialize (throws an error if it fails!)
      opts.encryptionKeyBook = new CryptoBook(opts.encryptionKeyBook)
      opts.valueEncoding = 'binary'
      registerBook = true
    }

    if (opts.encryptionKeyBook instanceof CryptoBook) {
      self.cryptoKeyBook = opts.encryptionKeyBook
      registerBook = true
      // encrypted data is always binary
      opts.valueEncoding = 'binary'
    } else {
      // if opts.noEncryption is specified or a key (-> old archive) is specified set it to null
      if (opts.noEncryption || key) {
        self.cryptoKeyBook = null
      } else {
        // per default create a new cryptobook
        self.cryptoKeyBook = new CryptoBook()
        self.cryptoKeyBook.generateNewKey(0)
        opts.valueEncoding = 'binary'
        registerBook = true
      }
    }
    return registerBook
  }
}

inherits(Feed, hypercore)
Feed.discoveryKey = hypercore.discoveryKey

const oldAppend = Feed.prototype.append
/**
 * Append to feed - in encryption mode it encrypts the data
 * @param {string | Array} batch
 * @param {function(err)} cb
 */
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

/**
 * Creates a writeable stream
 */
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
/**
 * Get entry of index [index]
 * (can also be called without opts, then the 2nd parameter is the callback)
 * @param {number} index
 * @param {*} opts (optional)
 * @param {function(error, data)} cb
 */
Feed.prototype.get = function (index, opts, cb) {
  const self = this

  if (typeof opts === 'function') return self.get(index, null, opts)
  if (!self.opened) return this._readyAndGet(index, opts, cb)
  if (typeof cb !== 'function') cb = throwErr

  const callback = cb

  if (self.cryptoKeyBook) {
    oldGet.call(self, index, opts, onData)
  } else {
    oldGet.call(self, index, opts, cb)
  }

  function onData (err, data, isCascaded) {
    if (err) return callback(err)

    // little hacky bugfix: oldGet.call may call get() with onData as callback
    if (isCascaded) return callback(err, data, isCascaded)

    self._calcOffset(index, (err, offs) => {
      if (err) return cb(err)

      var decrypted = self.cryptoKeyBook.decrypt(data, offs)
      var decoded = self._fromBinary(decrypted)
      cb(null, decoded, true)
    })
  }
}

/**
 * Decodes the data to binary
 * @param {string | object | buffer | Array} data
 */
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

/**
 * Encodes the data back to the specified encoding
 * @param {Buffer} data
 */
Feed.prototype._fromBinary = function (data) {
  switch (this.encoding) {
    case 'utf-8': return Buffer.from(data).toString('utf-8')
    case 'json': return JSON.parse(Buffer.from(data).toString('utf-8'))
    case 'binary':
    default: return Buffer.from(data)
  }
}
const noarr = []
/**
 * Calculats the feed offset of a node index and calls the callback when done
 * (may need to load metadata first)
 * @param {number} index
 * @param {function(err, offset, size)} cb
 */
Feed.prototype._calcOffset = function (index, cb) {
  this._storage.dataOffset(index, noarr, cb)
}

/**
 * @param {*} arr
 * @param {number} offset
 * @returns {Buffer}
 */
Feed.prototype._encrypt = function (arr, offset) {
  if (!Array.isArray(arr)) arr = [arr]

  if (this.cryptoKeyBook.entries.length === 0) {
    throw new Error('CryptoBook is empty')
  }

  var ret = new Array(arr.length)
  for (var i = 0; i < arr.length; i++) {
    ret[i] = Buffer.from(this.cryptoKeyBook.encrypt(arr[i], offset))
    offset += arr[i].length
  }
  this._byteLengthOffset += offset

  return ret
}

/**
 * Adds a new encryption key that is used for the next write to the feed
 * @param {function(err)} cb (optional) called when done
 */
Feed.prototype.newEncryptionKey = function (cb) {
  const self = this
  if (typeof cb !== 'function') cb = throwErr
  if (!this.cryptoKeyBook) throw new Error('not in encryption mode')

  this._ready((err) => {
    if (err) cb(err)

    self.cryptoKeyBook.generateNewKey(self.byteLength + self._byteLengthOffset)
    cb(null)
  })
}
/**
 * Serializes the CryptoBook to a JS object of the following form:
 * [{key: number, value: {nonce: string, iv: number}}, ...]
 * @param {function(err, data)} cb
 */
Feed.prototype.serializeCryptoKeyBook = function (cb) {
  const self = this
  if (typeof cb !== 'function') cb = throwErr

  this._ready((err) => {
    if (err) cb(err)

    cb(null, self.cryptoKeyBook.serialize())
  })
}

// default callback
function throwErr (err) {
  if (err) throw err
}
