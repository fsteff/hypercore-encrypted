const hypercore = require('hypercore')
const inherits = require('inherits')
const bulk = require('bulk-write-stream')
const Buffer = require('buffer').Buffer

module.exports = Feed

/**
 * Extension of hypercore that supports encrpytion
 * Usage is equal to hypercore, see https://github.com/mafintosh/hypercore for details
 *
 * @param {string | function} createStorage storage path or an instance of a random-access-storage letiant
 * @param {string} key (optional) hypercore public key - use to replicate existing hypercore
 * @param {object} opts at least {encrypt: (buf, offs, cb) => void, decrypt: (buf, offs, cb) => void} has to be specified
 */
function Feed (createStorage, key, opts) {
  if (!(this instanceof Feed)) return new Feed(createStorage, key, opts)

  if (!opts) throw new Error('parameter opts has to be specified - at least opts.encrypt and opts.decrypt have to be set')
  if (!opts.encrypt || !opts.decrypt || typeof opts.encrypt !== 'function' || typeof opts.decrypt !== 'function') throw new Error('Encryption handlers opts.encrypt and opts.decrypt have to be specified')

  // note: internal encoding (of the unerlying hypercore) is always binary
  this.encoding = opts.valueEncoding || 'binary'
  this.encrypt = opts.encrypt
  this.decrypt = opts.decrypt
  // copy to avoid problems with internal changes
  opts = Object.assign({}, opts)
  if (Buffer.isBuffer(key)) {
    key = key.toString('hex')
  }

  hypercore.call(this, createStorage, key, opts)

  this._byteLengthOffset = 0
  this.on('append', () => {
    this._byteLengthOffset = 0
  })
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
  const binaryBatch = self._toBinary(batch)
  const offset = self.byteLength + self._byteLengthOffset
  self._encrypt(binaryBatch, offset, ciphertext => oldAppend.call(self, ciphertext, cb))
}

/**
 * Creates a writeable stream
 */
Feed.prototype.createWriteStream = function () {
  const self = this
  return bulk.obj(writeEncr)

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
Feed.prototype.get = function (index, opts, callback) {
  const self = this
  if (!opts) opts = {}
  if (typeof opts === 'function') return self.get(index, null, opts)

  if (!self.opened) return this._readyAndGet(index, opts, callback)
  if (typeof callback !== 'function') callback = throwErr

  oldGet.call(self, index, opts, onData)

  function onData (err, data, isCascaded) {
    if (err) return callback(err)

    // little hacky bugfix: oldGet.call may call get() with onData as callback
    if (isCascaded) return callback(err, data, isCascaded)

    self._calcOffset(index, (err, offs) => {
      if (err) return callback(err)

      self.decrypt(Buffer.from(data), offs, plain => {
        const decoded = self._fromBinary(plain)
        callback(null, decoded, true)
      })
    })
  }
}

/**
 * Decodes the data to binary
 * @param {string | object | buffer | Array} data
 */
Feed.prototype._toBinary = function (data) {
  const arr = []
  if (!Array.isArray(data)) data = [data]

  for (let i = 0; i < data.length; i++) {
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
 * @param {number} offset byte offset
 * @returns {Buffer}
 */
Feed.prototype._encrypt = function (arr, offset, callback) {
  const self = this
  if (!Array.isArray(arr)) arr = [arr]

  const ret = new Array(arr.length)
  let i = 0
  this.encrypt(arr[i], offset, onCiphertext)
  function onCiphertext (data) {
    ret[i] = data
    offset += arr[i].length
    i++
    if (i < arr.length) {
      self.encrypt(arr[i], offset, onCiphertext)
    } else {
      self._byteLengthOffset += offset
      callback(ret)
    }
  }
}

// default callback
function throwErr (err) {
  if (err) throw err
}
