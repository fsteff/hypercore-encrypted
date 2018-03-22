const hypercore = require('hypercore')
const inherits = require('inherits')
const bulk = require('bulk-write-stream')
const Stream = require('stream')
const Buffer = require('buffer').Buffer

const crypto = require('./libs/crypto')

module.exports = Feed

function Feed (createStorage, key, opts) {
  if (!(this instanceof Feed)) return new Feed(createStorage, key, opts)

  this.encoding = opts.valueEncoding

  if (opts.encryptionKey instanceof crypto) {
    this.cryptoKey = opts.encryptionKey
    // encrypted data is always binary
    opts.valueEncoding = 'binary'
  } else {
    this.cryptoKey = null
  }

  hypercore.call(this, createStorage, key, opts)
}

inherits(Feed, hypercore)

const oldAppend = Feed.prototype.append
Feed.prototype.append = function (batch, cb) {
  if (this.cryptoKey) {
    batch = this._toBinary(batch)
    batch = this.cryptoKey.encrypt(batch)
  }

  oldAppend.call(this, batch, cb)
}

Feed.prototype.createWriteStream = function () {
  var self = this
  if (this.cryptoKey) {
    return bulk.obj(writeEncr)
  } else {
    return bulk.obj(write)
  }
  function write (batch, cb) {
    self._batch(batch, cb)
  }
  function writeEncr (batch, cb) {
    batch = this._toBinary(batch)
    batch = self.cryptoKey.encrypt(batch)

    self._batch(batch, cb)
  }
}

const oldGet = Feed.prototype.get
Feed.prototype.get = function (index, opts, cb) {
  if (typeof opts === 'function') return this.get(index, null, opts)
  if (!this.opened) return this._readyAndGet(index, opts, cb)
  
  const self = this
  if (this.cryptoKey) {
    oldGet.call(this, index, opts, (err, data) => {
      data = self.cryptoKey.decrypt(data)
      data = self._fromBinary(data)

      cb(err, data)
    })
  } else {
    oldGet.call(this, index, opts, cb)
  }
}

Feed.prototype._toBinary = function(data){
    switch(this.encoding){
        case 'utf-8': return Buffer.from(data)
        case 'json': return Buffer.from(JSON.stringify(data))
        case 'binary': 
        default: return Buffer.from(data)
    }
}

Feed.prototype._fromBinary = function(data){
    switch(this.encoding){
        case 'utf-8': return Buffer.from(data).toString('utf-8')
        case 'json': return JSON.parse(Buffer.from(data).toString('utf-8'))
        case 'binary':
        default: return Buffer.from(data)
    }
}
